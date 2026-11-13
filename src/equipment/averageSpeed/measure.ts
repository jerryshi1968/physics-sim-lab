import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { parseManualValue, manualResult } from '../../core/measurements/records.ts';
import { averageSpeedRig, averageSpeedRuler, AVERAGE_SPEED_MODEL } from './simulate.ts';
import type { AverageSpeedRun } from './simulate.ts';
export interface AverageSpeedCapture { rulerId:string; startRaw:string; stopRaw:string; timeRaw:string; segment:'full'|'upper'; setupLabel:string; note:string }
export function buildAverageSpeedMeasurements(scene:SceneDocument,run:AverageSpeedRun|null,input:AverageSpeedCapture,id:string,time:string) {
  const fail=(message:string)=>({ok:false as const,message}),rig=averageSpeedRig(scene);
  if(!rig.ok || !run || run.signature!==rig.signature || run.timeS<run.rig.endTimeS) return fail('请先重新释放小车，等小车撞到挡片、停表后再记录。');
  const scale=averageSpeedRuler(scene,run.rig,input.rulerId);
  if(!scale?.covered) return fail('请沿斜面摆放刻度尺，使刻度覆盖小车起始前端和挡片。');
  if(input.setupLabel.length>100||input.note.length>100) return fail('组名和备注最多 100 字。');
  const specs=[{quantity:'length',unit:'m',label:'起点尺读数',raw:input.startRaw,truth:scale.startM,range:{min:0,max:scale.lengthM,resolution:.001},equipmentId:scale.ruler.id},
    {quantity:'length',unit:'m',label:'挡片尺读数',raw:input.stopRaw,truth:scale.stopM,range:{min:0,max:scale.lengthM,resolution:.001},equipmentId:scale.ruler.id},
    {quantity:'time',unit:'s',label:'运动时间',raw:input.timeRaw,truth:run.timeS,range:{min:0,max:60,resolution:run.rig.resolutionS},equipmentId:run.rig.timer.id}] as const;
  const runId=`average-speed-${id}`,sequence=scene.revision+1;
  const snapshot=MeasurementSnapshotSchema.safeParse({id,documentId:scene.documentId,documentRevision:scene.revision,runId,sequence,capturedAt:time,setupLabel:input.setupLabel,note:JSON.stringify({segment:input.segment,trialId:run.id,elapsedS:run.timeS,note:input.note}),modelVersion:AVERAGE_SPEED_MODEL,equipment:scene.equipment,connections:scene.connections,modelConfigSnapshot:scene.simulationConfig});
  if(!snapshot.success)return fail('本次测量快照无效。');
  const records:MeasurementRecord[]=[];
  for(const [index,spec] of specs.entries()) {
    const parsed=parseManualValue(spec.raw);if(!parsed.ok)return fail('请输入有限的尺读数和时间，留空记缺失。');
    const rawSI=parsed.value===null?spec.raw:spec.unit==='m'?String(parsed.value/100):spec.raw,result=manualResult(rawSI,'valid',spec.range);
    if(!result)return fail('本次读数无效。');
    const display=spec.unit==='m'?Math.round(spec.truth/.001)*.001:Number((Math.round(spec.truth/spec.range.resolution)*spec.range.resolution).toPrecision(12));
    const record=MeasurementRecordSchema.safeParse({id:`${id}.${index}`,source:'manual',quantity:spec.quantity,unit:spec.unit,...result,rawInput:rawSI,equipmentId:spec.equipmentId,range:spec.range,recordedAt:time,documentRevision:scene.revision,runId,sequence,modelConfigSnapshot:scene.simulationConfig,
      context:{sampleId:id,equipmentLabel:spec.unit==='m'?'独立刻度尺':'停表',pointLabel:spec.label,instrumentStatus:'valid',instrumentDisplayValue:display,physicalValue:spec.truth,originalRawInput:spec.raw,diagnosticCodes:[]}});
    if(!record.success)return fail('测量记录未通过校验。');records.push(record.data);
  }
  return{ok:true as const,records,snapshot:snapshot.data};
}
export function averageSpeedResults(scene:SceneDocument) {
  return(scene.measurementSnapshots??[]).filter(s=>s.modelVersion===AVERAGE_SPEED_MODEL).map(snapshot=>{
    const records=scene.measurementRecords.filter(r=>r.context?.sampleId===snapshot.id);
    const value=(label:string)=>{const rows=records.filter(r=>r.context?.pointLabel===label);return rows.length===1&&rows[0]!.measurementStatus==='valid'?rows[0]!.value:null;};
    const start=value('起点尺读数'),stop=value('挡片尺读数'),timeS=value('运动时间'),distanceM=start!==null&&stop!==null?Math.abs(start-stop):null;
    let segment='未标记',note='';try{const data=JSON.parse(snapshot.note);segment=data.segment==='full'?'全程':data.segment==='upper'?'上半程':'未标记';note=String(data.note??'');}catch{/* Imported legacy metadata cannot infer a segment. */}
    const valid=distanceM!==null&&distanceM>0&&timeS!==null&&timeS>0;
    return{id:snapshot.id,label:snapshot.setupLabel,segment,note,distanceM,timeS,velocity:valid?distanceM!/timeS!:null};
  });
}
