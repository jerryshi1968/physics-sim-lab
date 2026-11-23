import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { csvCell } from '../../core/measurements/csv.ts';
import { utf8ByteLength } from '../../core/scene/transfer.ts';
import { EFFICIENCY_MODEL, EFFICIENCY_LEGACY_MODEL } from './definitions.ts';
import { pulleyLayout } from './simulate.ts';
import { buildPulleyReading } from './measure.ts';
import type { PulleyInput } from './measure.ts';
export function buildEfficiencyReading(scene:SceneDocument,registry:EquipmentRegistry,input:PulleyInput,id:string,time:string,preview=false) {
  const built=buildPulleyReading(scene,registry,input,id,time,preview);if(!built.ok)return built;
  const meta=JSON.parse(built.snapshot.note),layout=pulleyLayout(scene)!,runId=`efficiency-${id}`;
  if(!['direct','tackle'].includes(meta.mode))return {ok:false as const,message:'请选择直接称重或一定一动的滑轮组装配。'};
  return {ok:true as const,snapshot:{...built.snapshot,runId,modelVersion:EFFICIENCY_MODEL,note:JSON.stringify({...meta,kind:'efficiency',ropeEnd:layout.ropeEnd,strands:meta.mode==='direct'?0:layout.n,direction:layout.sign===1?'向上':'向下'})},records:built.records.filter(r=>meta.mode!=='direct'||r.id===`${id}.gravity`).map(r=>({...r,runId}))};
}
export function efficiencyRows(scene:SceneDocument) {
  return (scene.measurementSnapshots??[]).flatMap(snapshot=>{if(snapshot.modelVersion!==EFFICIENCY_MODEL&&snapshot.modelVersion!==EFFICIENCY_LEGACY_MODEL)return [];try{
    const meta=JSON.parse(snapshot.note);if(meta.kind!=='efficiency'||!['direct','tackle'].includes(meta.mode)||typeof meta.massKg!=='number'||!Number.isFinite(meta.massKg)||meta.massKg<=0||typeof meta.pulleyMassKg!=='number'||!Number.isFinite(meta.pulleyMassKg)||meta.pulleyMassKg<0||meta.pulleyMassKg>.2)return [];
    const ropeEnd=meta.ropeEnd??'stand',strands=meta.strands??(meta.mode==='tackle'?2:0);if(!['stand','moving'].includes(ropeEnd)||strands!==(meta.mode==='direct'?0:ropeEnd==='moving'?3:2))return [];
    const value=(key:string)=>{const r=scene.measurementRecords.find(r=>r.id===`${snapshot.id}.${key}`&&r.context?.sampleId===snapshot.id&&r.runId===snapshot.runId);return r?.measurementStatus==='valid'&&r.value!==null&&Number.isFinite(r.value)?r.value:null;};
    const gravity=value('gravity'),force=value('force'),a=value('loadStart'),b=value('loadEnd'),c=value('pullStart'),d=value('pullEnd'),height=meta.mode==='tackle'&&a!==null&&b!==null&&b>=a?b-a:null,distance=meta.mode==='tackle'&&c!==null&&d!==null?Math.abs(d-c):null;
    const useful=gravity!==null&&gravity>=0&&height!==null?gravity*height:null,total=force!==null&&force>=0&&distance!==null?force*distance:null,efficiency=useful!==null&&total!==null&&total>0&&height!==null&&height>0&&distance!==null&&distance>0?useful/total:null;
    const warning=efficiency!==null&&efficiency>1+1e-9?'效率超过 100%，请核对读数':meta.mode==='tackle'&&(height===null||distance===null||gravity===null||force===null)?'读数缺失或无效':meta.mode==='tackle'&&(!height||!distance||!total)?'位移或总功为零，效率不计算':'';
    return [{id:snapshot.id,group:snapshot.setupLabel,mode:meta.mode==='direct'?'直接称重':strands===3?'滑轮组（3 段承重）':'滑轮组',ropeEnd:ropeEnd==='moving'?'动滑轮挂钩':'支架',strands,direction:typeof meta.direction==='string'?meta.direction:'',gravity,force,height,distance,useful,total,efficiency,warning,mass:meta.massKg as number,pulleyMass:meta.pulleyMassKg as number,note:typeof meta.note==='string'?meta.note:''}];
  }catch{return [];}});
}
export function efficiencyCsv(scene:SceneDocument) {
  const columns=['组别','装配','钩码质量/kg','动滑轮质量/kg','重力G/N','提升高度h/m','有用功/J','拉力F/N','绳端距离s/m','总功/J','机械效率','核对提示','来源采样标识','备注','绳端固定位置','承重段数','拉动方向'];
  const rows=efficiencyRows(scene).map(r=>[r.group,r.mode,r.mass,r.pulleyMass,r.gravity,r.height,r.useful,r.force,r.distance,r.total,r.efficiency,r.warning,r.id,r.note,r.ropeEnd,r.strands,r.direction]);
  const csv='\uFEFF'+[columns,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';if(utf8ByteLength(csv)>20*1024*1024)throw Error('CSV_TOO_LARGE');return csv;
}
