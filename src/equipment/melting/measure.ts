import type { SceneDocument,MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema,MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { parseManualValue } from '../../core/measurements/records.ts';
import { meltingRig,meltingReading,meltingPhase,meltingCoupled,MELTING_MODEL } from './simulate.ts';
import type { MeltingState } from './simulate.ts';
import { TUBE,materialLabels } from './definitions.ts';
import type { ThermalCapture } from '../thermal/measure.ts';
export type MeltingCapture=ThermalCapture;
export function buildMeltingMeasurements(scene:SceneDocument,state:MeltingState,signature:string,seriesId:string,originS:number,heating:boolean,input:MeltingCapture,id:string,time:string) {
  const fail=(message:string)=>({ok:false as const,message}),rig=meltingRig(scene),reading=meltingReading(rig,state);
  if(!rig.ok||rig.signature!==signature||!rig.bathRig.timer||!rig.bathRig.meter||!reading.ok||!Number.isFinite(originS)||originS<0||originS>state.timeS)return fail(reading.message||'请放置计时器，并检查当前装置。');
  if(input.setupLabel.length>100||input.note.length>100)return fail('组名和观察备注最多 100 字。');
  const elapsed=state.timeS-originS,res=Number(rig.bathRig.timer.parameters.resolutionS),phase=meltingPhase(rig.config,state.sampleJ),runId=`melting-${id}`,sequence=scene.revision+1;
  const specs=[{quantity:'time',unit:'s',label:'熔化记录时间',raw:input.timeRaw,id:rig.bathRig.timer.id,truth:elapsed,display:Number((Math.round(elapsed/res)*res).toPrecision(12)),range:{min:0,max:7200,resolution:res}},
    {quantity:'temperature',unit:'K',label:'样品温度',raw:input.temperatureRaw,id:rig.bathRig.meter.id,truth:phase.temperatureK,display:reading.valueK,range:{min:273.15,max:383.15,resolution:Number(rig.bathRig.meter.parameters.resolutionK)}}] as const;
  const snapshot=MeasurementSnapshotSchema.safeParse({id,documentId:scene.documentId,documentRevision:scene.revision,runId,sequence,capturedAt:time,setupLabel:input.setupLabel,note:JSON.stringify({seriesId,material:rig.config.material,originS,elapsedS:state.timeS,bathK:state.bathK,sampleJ:state.sampleJ,fraction:phase.fraction,heating:heating&&rig.bathRig.contact,immersed:meltingCoupled(rig,state),note:input.note}),modelVersion:MELTING_MODEL,equipment:scene.equipment,connections:scene.connections,modelConfigSnapshot:scene.simulationConfig});
  if(!snapshot.success)return fail('熔化实验快照无效。');
  const records:MeasurementRecord[]=[];
  for(const [index,spec] of specs.entries()) {
    const parsed=parseManualValue(spec.raw);if(input.source==='manual'&&!parsed.ok)return fail('请输入有限的分钟数和摄氏温度；留空记缺失。');
    const manual=parsed.ok&&parsed.value!==null?(spec.unit==='K'?parsed.value+273.15:parsed.value*60):null,value=input.source==='instrument'?spec.display:manual,valid=value!==null&&value>=spec.range.min&&value<=spec.range.max;
    const rawSI=manual!==null?String(manual):spec.raw;
    const record=MeasurementRecordSchema.safeParse({id:`${id}.${index}`,source:input.source,quantity:spec.quantity,unit:spec.unit,value:valid?value:null,measurementStatus:valid?'valid':'invalid',rawInput:input.source==='manual'?rawSI:null,equipmentId:spec.id,range:spec.range,recordedAt:time,documentRevision:scene.revision,runId,sequence,modelConfigSnapshot:scene.simulationConfig,
      context:{sampleId:id,equipmentLabel:spec.unit==='K'?'样品温度计':'记录计时器',pointLabel:spec.label,instrumentStatus:'valid',instrumentDisplayValue:spec.display,physicalValue:spec.truth,originalRawInput:input.source==='manual'?spec.raw:null,diagnosticCodes:meltingCoupled(rig,state)?[]:['MELTING_OUT_OF_BATH']}});
    if(!record.success)return fail('熔化读数未通过校验。');records.push(record.data);
  }
  return{ok:true as const,records,snapshot:snapshot.data};
}
export function meltingRows(scene:SceneDocument) {
  return(scene.measurementSnapshots??[]).filter(s=>s.modelVersion===MELTING_MODEL).map(snapshot=>{
    const records=scene.measurementRecords.filter(r=>r.context?.sampleId===snapshot.id),value=(quantity:string)=>{const found=records.filter(r=>r.quantity===quantity);return found.length===1&&found[0]!.measurementStatus==='valid'?found[0]!.value:null;};
    const tube=snapshot.equipment.find(i=>i.type===TUBE),material=tube?.parameters.material==='wax'?'wax':'hypo',timeS=value('time'),temperatureK=value('temperature');
    let series=snapshot.id,note='';try{const data=JSON.parse(snapshot.note);if(typeof data.seriesId==='string'&&data.seriesId)series=data.seriesId;note=String(data.note??'');}catch{/* Keep malformed imported observations in independent series. */}
    return{id:snapshot.id,label:snapshot.setupLabel,material,materialLabel:materialLabels[material],massKg:Number(tube?.parameters.massKg),series,note,timeMin:timeS===null?null:timeS/60,temperatureC:temperatureK===null?null:Number((temperatureK-273.15).toFixed(8))};
  });
}
