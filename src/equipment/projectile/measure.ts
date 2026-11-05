import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { measurementSeries } from '../../core/measurements/charts.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { compileProjectile, projectileRuler, projectileAt } from './simulate.ts';
import type { ProjectileFlight } from './simulate.ts';
export interface ProjectileCapture { rulerId:string; timeRaw:string; originXRaw:string; ballXRaw:string; originYRaw:string; ballYRaw:string; groundYRaw?:string; setupLabel:string; note:string }
export const projectileProfiles:readonly MeasurementChartProfile[]=[
  {id:'projectile-x-t',label:'水平位移 x–t',available:true,groupByRun:true,x:{quantity:'time',unit:'s',label:'时间 t（s）',pointLabel:'时间'},y:{quantity:'length',unit:'m',label:'水平位移 x（m）',pointLabel:'水平位移'}},
  {id:'projectile-y-t2',label:'向下位移 ydrop–t²',available:true,groupByRun:true,x:{quantity:'time',unit:'s',label:'时间平方 t²（s²）',pointLabel:'时间',power:2},y:{quantity:'length',unit:'m',label:'向下位移 ydrop（m）',pointLabel:'向下位移'}},
];
export function buildProjectileMeasurements(scene:SceneDocument,registry:EquipmentRegistry,flight:ProjectileFlight|null,input:ProjectileCapture,sampleId:string,timestamp:string,unavailable=false) {
  const fail=(code:string)=>({ok:false as const,code});
  if(!flight||unavailable||flight.point.timeS<=0)return fail('PROJECTILE_CAPTURE_UNAVAILABLE');
  const original=compileProjectile(flight.initialScene,registry),verified=projectileAt(flight,flight.point.timeS);
  if(!original.ok||!verified.ok||JSON.stringify(original.initial)!==JSON.stringify(flight.rig.initial)||JSON.stringify(verified.flight.point)!==JSON.stringify(flight.point))return fail('PROJECTILE_STALE');
  const read=projectileRuler(scene,flight,input.rulerId);if(!read.ok)return read;
  const inputs=[input.timeRaw,input.originXRaw,input.ballXRaw,input.originYRaw,input.ballYRaw,input.groundYRaw??''].map(parseManualValue);
  if(inputs.some(item=>!item.ok))return fail('INVALID_MANUAL_VALUE');
  const values=inputs.map(item=>item.ok?item.value:null),[,x0,x,y0,y,groundRead]=values;
  const valid=(value:number|null|undefined,max:number)=>value!==null&&value!==undefined&&value>=0&&value<=max;
  const width=Number(read.ruler.parameters.widthM),height=Number(read.ruler.parameters.heightM);
  const displacement=valid(x0,width)&&valid(x,width)&&x!>=x0!?Number((x!-x0!).toPrecision(12)):null;
  const drop=valid(y0,height)&&valid(y,height)&&y!>=y0!?Number((y!-y0!).toPrecision(12)):null;
  const groundWithin=read.groundM>=0&&read.groundM<=height;
  const measuredHeight=groundWithin&&valid(y0,height)&&valid(groundRead,height)&&groundRead!>=y0!?Number((groundRead!-y0!).toPrecision(12)):null;
  const derived=(value:number|null)=>value===null?'':String(Number(value.toPrecision(12)));
  const point=flight.point,sequence=Math.max(1,Math.round(point.timeS*1e6)),timeRange={min:0,max:flight.rig.model.impactTimeS,resolution:flight.rig.resolutionS};
  const snapshot=MeasurementSnapshotSchema.safeParse({id:sampleId,documentId:scene.documentId,documentRevision:scene.revision,runId:flight.runId,sequence,capturedAt:timestamp,setupLabel:input.setupLabel,
    note:JSON.stringify({phase:point.state,launch:flight.launchNumber,t:point.timeS,ruler:input.rulerId,scale:[read.ruler.pose.xM,read.ruler.pose.yM,width,height],note:input.note}),modelVersion:'mechanical.projectile.analytic.v1',equipment:flight.initialScene.equipment,connections:flight.initialScene.connections,modelConfigSnapshot:flight.initialScene.simulationConfig,
    captureState:{kind:'projectile-launch',launchRevision:flight.initialScene.revision,equipment:scene.equipment,connections:scene.connections,modelConfigSnapshot:scene.simulationConfig}});
  if(!snapshot.success||input.note.length>100)return fail('PROJECTILE_CAPTURE_UNAVAILABLE');
  const clock=Number((Math.round(point.timeS/flight.rig.resolutionS)*flight.rig.resolutionS).toPrecision(12)),lengthRange={min:0,max:100,resolution:.01};
  const specs=[
    {label:'时间',quantity:'time',unit:'s',raw:input.timeRaw,truth:point.timeS,display:clock,range:timeRange},
    {label:'发射点横尺读数',quantity:'length',unit:'m',raw:input.originXRaw,truth:read.origin.xM,display:read.origin.xM,range:{...lengthRange,max:width}},
    {label:'小球横尺读数',quantity:'length',unit:'m',raw:input.ballXRaw,truth:read.ball.xM,display:read.ball.xM,range:{...lengthRange,max:width}},
    {label:'发射点竖尺读数',quantity:'length',unit:'m',raw:input.originYRaw,truth:read.origin.yM,display:read.origin.yM,range:{...lengthRange,max:height}},
    {label:'小球竖尺读数',quantity:'length',unit:'m',raw:input.ballYRaw,truth:read.ball.yM,display:read.ball.yM,range:{...lengthRange,max:height}},
    {label:'水平位移',quantity:'length',unit:'m',raw:derived(displacement),truth:point.horizontalDisplacementM,display:point.horizontalDisplacementM,range:lengthRange},
    {label:'向下位移',quantity:'length',unit:'m',raw:derived(drop),truth:point.dropM,display:point.dropM,range:lengthRange},
    {label:'地面竖尺读数',quantity:'length',unit:'m',raw:input.groundYRaw??'',truth:read.groundM,display:read.groundM,range:{...lengthRange,max:height}},
    {label:'发射高度',quantity:'length',unit:'m',raw:derived(measuredHeight),truth:flight.rig.initial.y0M-flight.rig.initial.groundYM,display:flight.rig.initial.y0M-flight.rig.initial.groundYM,range:lengthRange},
    ...(point.state==='landed'?[{label:'落地时间',quantity:'time',unit:'s',raw:input.timeRaw,truth:point.impactTimeS,display:clock,range:timeRange},{label:'射程',quantity:'length',unit:'m',raw:derived(displacement),truth:point.rangeM,display:point.rangeM,range:lengthRange}]:[]),
  ] as const;
  const records:MeasurementRecord[]=[];
  for(const [index,spec]of specs.entries()){
    const available=groundWithin||!['地面竖尺读数','发射高度'].includes(spec.label);
    const instrumentStatus=available?'valid':'out-of-model';
    const result=manualResult(spec.raw,instrumentStatus,spec.range);if(!result)return fail('INVALID_MANUAL_VALUE');
    const record=MeasurementRecordSchema.safeParse({id:`${sampleId}.${index}`,source:'manual',quantity:spec.quantity,unit:spec.unit,...result,rawInput:spec.raw,equipmentId:flight.rig.ball.id,range:spec.range,recordedAt:timestamp,documentRevision:scene.revision,runId:flight.runId,sequence,modelConfigSnapshot:flight.initialScene.simulationConfig,
      context:{sampleId,equipmentLabel:'本次平抛与计时标尺',pointLabel:spec.label,instrumentStatus,instrumentDisplayValue:available?spec.display:null,physicalValue:spec.truth,originalRawInput:spec.raw,diagnosticCodes:[...(point.state==='landed'?['PROJECTILE_LANDED']:[]),...(!available?['PROJECTILE_HEIGHT_UNREADABLE']:[])]}});
    if(!record.success)return fail('PROJECTILE_CAPTURE_UNAVAILABLE');records.push(record.data);
  }
  return {ok:true as const,records,snapshot:snapshot.data};
}
export function projectileFits(scene:SceneDocument,profile:MeasurementChartProfile) {
  return measurementSeries(scene,profile).map(series=>({...series,fit:linearFit(series.points.filter((point):point is typeof point&{y:number}=>point.y!==null),3)}));
}
