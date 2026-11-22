import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { KINETIC_MODEL, kineticRig, kineticRuler } from './simulate.ts';
import type { KineticRun } from './simulate.ts';
export interface KineticInput { group: string; comparison: string; mass: string; height: string; start: string; end: string; rulerId: string; note: string }
export const kineticComparisons = ['比较速度（质量相同）','比较质量（高度相同）','其他观察'];
export function buildKineticReading(scene: SceneDocument,run: KineticRun|null,input: KineticInput,id:string,timestamp:string,preview=false) {
  const fail=(message:string)=>({ok:false as const,message}),rig=kineticRig(scene);
  if(preview)return fail('请先松手完成摆放。');
  if(!rig.ok)return rig;
  if(!run||run.signature!==rig.signature||run.timeS<run.rig.endTime||run.rig.boundary)return fail('等待木块正常停止后读尺；到达接触面边界的试验不能作为正常读数。');
  const scale=kineticRuler(scene,rig,input.rulerId);
  if(!scale?.covered)return fail('请选择一把水平且覆盖木块起止位置的刻度尺。');
  if(!kineticComparisons.includes(input.comparison)||Object.values(input).some(value=>value.length>100))return fail('请选择比较条件，文字最多 100 字。');
  const start=parseManualValue(input.start),end=parseManualValue(input.end);
  if(start.ok&&end.ok&&start.value!==null&&end.value!==null&&end.value<start.value)return fail('终点读数应不小于起点读数。');
  const note=JSON.stringify({kind:'kinetic',comparison:input.comparison,note:input.note,run:run.id,timeS:run.timeS,massKg:rig.m,heightM:rig.height,blockMassKg:rig.M,friction:rig.mu,rulerId:scale.ruler.id});
  const snapshot=MeasurementSnapshotSchema.safeParse({id,documentId:scene.documentId,documentRevision:scene.revision,runId:`kinetic-${run.id}`,sequence:scene.revision+1,capturedAt:timestamp,setupLabel:input.group,note,modelVersion:KINETIC_MODEL,equipment:scene.equipment,connections:scene.connections,modelConfigSnapshot:scene.simulationConfig});
  if(!snapshot.success)return fail('记录来源无效。');
  const specs=[['mass','钢球质量',.001,'mass','kg',rig.m,rig.ball.id,{min:0,max:.5,resolution:.001}],['height','释放高度',.01,'length','m',rig.height,rig.ball.id,{min:0,max:.5,resolution:.001}],['start','木块起点',.01,'length','m',scale.start,scale.ruler.id,{min:0,max:scale.length,resolution:.001}],['end','木块终点',.01,'length','m',scale.end,scale.ruler.id,{min:0,max:scale.length,resolution:.001}]] as const;
  const records:MeasurementRecord[]=[];
  for(const [key,label,factor,quantity,unit,physicalValue,equipmentId,range] of specs){const raw=input[key],parsed=parseManualValue(raw);if(!parsed.ok)return fail('请输入有效数字，留空保留缺失。');const converted=parsed.value===null?raw:String(parsed.value*factor),result=manualResult(converted,'valid',range);if(!result)return fail('读数格式无效。');const record=MeasurementRecordSchema.safeParse({id:`${id}.${key}`,source:'manual',quantity,unit,...result,rawInput:converted,equipmentId,range,recordedAt:timestamp,documentRevision:scene.revision,runId:snapshot.data.runId,sequence:snapshot.data.sequence,modelConfigSnapshot:scene.simulationConfig,context:{sampleId:id,equipmentLabel:key==='mass'||key==='height'?'动能实验·钢球':'动能实验·刻度尺',pointLabel:label,instrumentStatus:'valid',instrumentDisplayValue:physicalValue,physicalValue,originalRawInput:converted,diagnosticCodes:[]}});if(!record.success)return fail('读数超出记录范围。');records.push(record.data);}
  return {ok:true as const,records,snapshot:snapshot.data};
}
export function kineticRows(scene:SceneDocument) {
  return (scene.measurementSnapshots??[]).flatMap(snapshot=>{
    if(snapshot.modelVersion!==KINETIC_MODEL)return [];
    try{const note=JSON.parse(snapshot.note);if(note.kind!=='kinetic'||!kineticComparisons.includes(note.comparison)||typeof note.blockMassKg!=='number'||!Number.isFinite(note.blockMassKg)||typeof note.friction!=='number'||!Number.isFinite(note.friction))return [];
      const value=(key:string)=>{const row=scene.measurementRecords.find(r=>r.context?.sampleId===snapshot.id&&r.id===`${snapshot.id}.${key}`);return row?.measurementStatus==='valid'?row.value:null;},mass=value('mass'),height=value('height'),start=value('start'),end=value('end');
      const block=snapshot.equipment.find(i=>i.type==='mechanical.friction-block'),surface=snapshot.equipment.find(i=>i.type==='mechanical.friction-surface'),track=snapshot.equipment.find(i=>i.type==='mechanical.cart-track');if(!block||!surface||!track)return [];
      const controls=JSON.stringify([block.id,block.parameters,surface.parameters,snapshot.modelConfigSnapshot.gravityMPerS2,block.pose.xM-Number(block.parameters.widthM)/2,track.pose,Number(track.parameters.lengthM)/Math.PI]);
      return [{id:snapshot.id,group:snapshot.setupLabel,comparison:String(note.comparison),mass,height,start,end,distance:start!==null&&end!==null&&end>=start?end-start:null,blockMass:note.blockMassKg as number,friction:note.friction as number,note:typeof note.note==='string'?note.note:'',controls,actualMass:Number(note.massKg),actualHeight:Number(note.heightM)}];
    }catch{return [];}
  });
}
export function kineticControlStatus(rows:ReturnType<typeof kineticRows>,index:number) {
  const row=rows[index];if(!row||row.comparison===kineticComparisons[2])return '自行判断';
  const reference=rows.slice(0,index).find(peer=>peer.comparison===row.comparison);
  if(!reference)return '首组参照';
  if(!row.controls||row.controls!==reference.controls)return '木块、接触面或起点已改变';
  const key=row.comparison===kineticComparisons[0]?'actualMass':'actualHeight';
  return Number.isFinite(row[key])&&Number.isFinite(reference[key])&&Math.abs(row[key]-reference[key])<1e-8?'控制条件一致':'应保持的质量或高度已改变';
}
