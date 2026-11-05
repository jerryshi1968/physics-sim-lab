import type { SceneDocument,MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema,MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { parseManualValue,manualResult } from '../../core/measurements/records.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { simulateReflection } from './simulate.ts';
export interface ReflectionCapture { incidenceDeg:string; reflectionDeg:string; observation:string; setupLabel:string; note:string }
export const reflectionProfiles:readonly MeasurementChartProfile[]=[{id:'reflection-r-i',label:'反射角 r—入射角 i（SI rad）',available:true,x:{quantity:'angle',unit:'rad',label:'入射角 i（rad）',pointLabel:'入射角i'},y:{quantity:'angle',unit:'rad',label:'反射角 r（rad）',pointLabel:'反射角r'}}];
export function buildReflectionMeasurements(scene:SceneDocument,registry:EquipmentRegistry,input:ReflectionCapture,sampleId:string,timestamp:string,preview=false){
  const fail=(code:string)=>({ok:false as const,code}),outcome=simulateReflection(scene,registry);
  if(preview||!outcome.ok)return fail('REFLECTION_CAPTURE_UNAVAILABLE');
  if(!['未判断','能看到','不能看到'].includes(input.observation)||input.note.length>100)return fail('INVALID_REFLECTION_OBSERVATION');
  const parsed=[input.incidenceDeg,input.reflectionDeg].map(parseManualValue);if(parsed.some(item=>!item.ok))return fail('INVALID_MANUAL_VALUE');
  const si=parsed.map(item=>item.ok&&item.value!==null?String(Number((item.value*Math.PI/180).toPrecision(12))):'');
  const snapshot=MeasurementSnapshotSchema.safeParse({id:sampleId,documentId:scene.documentId,documentRevision:scene.revision,runId:sampleId,sequence:1,capturedAt:timestamp,setupLabel:input.setupLabel,modelVersion:'optical.reflection.spatial.v1',equipment:scene.equipment,connections:scene.connections,modelConfigSnapshot:scene.simulationConfig,
    note:JSON.stringify({degrees:[input.incidenceDeg,input.reflectionDeg],observation:input.observation,foldRad:outcome.paper.parameters.foldRad,evidence:outcome.evidence,note:input.note})});
  if(!snapshot.success)return fail('INVALID_REFLECTION_OBSERVATION');
  const specs=[{label:'入射角i',quantity:'angle',unit:'rad',raw:si[0]!,original:input.incidenceDeg+'°',value:outcome.incidenceRad,valid:outcome.readable.incident,id:outcome.gauge.id},
    {label:'反射角r',quantity:'angle',unit:'rad',raw:si[1]!,original:input.reflectionDeg+'°',value:outcome.reflectionRad,valid:outcome.readable.reflected,id:outcome.gauge.id},
    {label:'右纸板连续反射光迹',quantity:'dimensionless',unit:'1',raw:input.observation==='未判断'?'':input.observation==='能看到'?'1':'0',original:input.observation,value:outcome.outgoing[1]!.kind==='along'?1:0,valid:true,id:outcome.paper.id}]as const;
  const records:MeasurementRecord[]=[];
  for(const [index,spec]of specs.entries()){
    const range={min:0,max:index===2?1:Math.PI/2,resolution:index===2?1:Math.PI/180},status=spec.valid?'valid':'out-of-model';
    const result=manualResult(spec.raw,status,range);if(!result)return fail('INVALID_MANUAL_VALUE');
    const record=MeasurementRecordSchema.safeParse({id:`${sampleId}.${index}`,source:'manual',quantity:spec.quantity,unit:spec.unit,...result,rawInput:spec.raw,equipmentId:spec.id,range,recordedAt:timestamp,documentRevision:scene.revision,runId:sampleId,sequence:1,modelConfigSnapshot:scene.simulationConfig,
      context:{sampleId,equipmentLabel:'量角器与折板观察',pointLabel:spec.label,instrumentStatus:status,physicalValue:spec.value,instrumentDisplayValue:spec.valid?Number((Math.round(spec.value/range.resolution)*range.resolution).toPrecision(12)):null,originalRawInput:spec.original,diagnosticCodes:spec.valid?[]:['REFLECTION_NO_READABLE_TRACE']}});
    if(!record.success)return fail('REFLECTION_CAPTURE_UNAVAILABLE');records.push(record.data);
  }
  return {ok:true as const,records,snapshot:snapshot.data};
}
