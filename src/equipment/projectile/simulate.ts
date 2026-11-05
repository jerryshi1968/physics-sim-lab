import type { SceneDocument } from '../../core/scene/schema.ts';
import { SceneDocumentSchema } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { createProjectileLaunch } from '../../physics/samples/projectile.ts';
import type { ProjectileSample } from '../../physics/samples/projectile.ts';
import { LAUNCHER, BALL, TIMER, SCALE, GROUND, PROJECTILE_EXPERIMENT, projectileTypes } from './definitions.ts';
const fail = (code: string) => ({ ok: false as const, code });
export const isProjectileScene = (scene: SceneDocument) => scene.experimentId === PROJECTILE_EXPERIMENT || scene.equipment.some(item=>projectileTypes.includes(item.type));
export function compileProjectile(scene: SceneDocument, registry: EquipmentRegistry) {
  if (!validateSceneDocument(scene,registry).ok) return fail('PROJECTILE_DOCUMENT');
  if (scene.simulationConfig.randomError.enabled) return fail('PROJECTILE_RANDOM_UNSUPPORTED');
  if (scene.connections.length || scene.equipment.some(item=>!projectileTypes.includes(item.type))) return fail('PROJECTILE_DOMAIN');
  const apparatus = [LAUNCHER,BALL,TIMER,GROUND].map(type=>scene.equipment.filter(item=>item.type===type));
  if (apparatus.some(items=>items.length!==1)) return fail('PROJECTILE_APPARATUS');
  const [launcher,ball,timer,ground] = apparatus.map(items=>items[0]!);
  if (ball!.parameters.launcherId!==launcher!.id) return fail('PROJECTILE_BALL_ATTACHMENT');
  if (scene.equipment.some(item=>item.pose.flippedX || Math.abs(item.pose.xM)>100 || Math.abs(item.pose.yM)>100 || Math.abs(item.pose.rotationRad)>2*Math.PI || item.type!==LAUNCHER && item.type!==SCALE && Math.abs(item.pose.rotationRad)>1e-10)) return fail('PROJECTILE_ORIENTATION');
  const initial = { x0M:launcher!.pose.xM,y0M:launcher!.pose.yM,groundYM:ground!.pose.yM,speedMPerS:Number(launcher!.parameters.speedMPerS),gravityMPerS2:scene.simulationConfig.gravityMPerS2,horizontal:Math.abs(Math.sin(launcher!.pose.rotationRad))<=1e-10&&Math.cos(launcher!.pose.rotationRad)>0 };
  const created = createProjectileLaunch(initial);
  if (created.status!=='ok') return fail(created.code);
  const intervalS=Number(timer!.parameters.intervalS),resolutionS=Number(timer!.parameters.resolutionS);
  if (initial.y0M-initial.groundYM>10 || created.value.impactTimeS>30 || created.value.impactTimeS/intervalS>1000 || created.value.initial.speedMPerS*created.value.impactTimeS>100 || resolutionS>intervalS) return fail('PROJECTILE_RANGE');
  return {ok:true as const,launcher:launcher!,ball:ball!,timer:timer!,ground:ground!,initial,model:created.value,intervalS,resolutionS};
}
export type ProjectileRig=Extract<ReturnType<typeof compileProjectile>,{ok:true}>;
export interface ProjectileFlight { documentId:string; initialScene:SceneDocument; rig:ProjectileRig; runId:string; launchNumber:number; point:ProjectileSample }
export function beginProjectileFlight(scene:SceneDocument,registry:EquipmentRegistry,runId:string,launchNumber=1) {
  const captured=SceneDocumentSchema.parse({...scene,measurementRecords:[],measurementSnapshots:undefined}),rig=compileProjectile(captured,registry);
  if(!rig.ok)return rig;
  const sample=rig.model.sample(0);if(sample.status!=='ok')return fail(sample.code);
  return {ok:true as const,flight:{documentId:scene.documentId,initialScene:captured,rig,runId,launchNumber,point:sample.value} satisfies ProjectileFlight};
}
export function projectileAt(flight:ProjectileFlight,timeS:number) {
  const sample=flight.rig.model.sample(timeS);
  return sample.status==='ok'?{ok:true as const,flight:{...flight,point:sample.value}}:fail(sample.code);
}
export function advanceProjectile(flight:ProjectileFlight,seconds:number) {
  if(!Number.isFinite(seconds)||seconds<0)return fail('INVALID_SAMPLE_TIME');
  return projectileAt(flight,flight.point.timeS+seconds);
}
export function projectileIdentity(scene:SceneDocument,flight:ProjectileFlight) {
  return scene.documentId===flight.documentId && [flight.rig.launcher,flight.rig.ball,flight.rig.timer,flight.rig.ground].every(item=>scene.equipment.some(current=>current.id===item.id&&current.type===item.type));
}
export function projectileSignature(scene:SceneDocument) { return JSON.stringify([scene.equipment.filter(item=>[LAUNCHER,BALL,TIMER,GROUND].includes(item.type)),scene.simulationConfig]); }
export function projectileMarks(flight:ProjectileFlight) {
  const count=Math.min(1000,Math.floor((flight.point.timeS+1e-12)/flight.rig.intervalS)),marks:ProjectileSample[]=[];
  for(let index=0;index<=count;index++){const t=index*flight.rig.intervalS;if(t>flight.rig.model.impactTimeS+1e-12)break;const sample=flight.rig.model.sample(Math.min(t,flight.rig.model.impactTimeS));if(sample.status==='ok')marks.push(sample.value);}
  return marks;
}
export function projectileView(scene:SceneDocument,flight:ProjectileFlight|null) {
  return {...scene,equipment:scene.equipment.map(item=>{
    if(item.type!==BALL)return item;
    if(flight&&item.id===flight.rig.ball.id)return {...item,pose:{...item.pose,xM:flight.point.xM,yM:flight.point.yM}};
    const launcher=scene.equipment.find(other=>other.id===item.parameters.launcherId&&other.type===LAUNCHER);
    return launcher?{...item,pose:{...item.pose,xM:launcher.pose.xM,yM:launcher.pose.yM}}:item;
  })};
}
export function projectileDrop(scene:SceneDocument,item:EquipmentInstance,point:{xM:number;yM:number}) {
  const parameters={...item.parameters};
  if(item.type===BALL){const nearest=scene.equipment.filter(other=>other.type===LAUNCHER).map(other=>({item:other,distance:Math.hypot(point.xM-other.pose.xM,point.yM-other.pose.yM)})).sort((a,b)=>a.distance-b.distance)[0];parameters.launcherId=nearest&&nearest.distance<=.15?nearest.item.id:'';}
  return {pose:{...item.pose,...point},parameters};
}
export function projectileRuler(scene:SceneDocument,flight:ProjectileFlight,rulerId:string) {
  const ruler=scene.equipment.find(item=>item.id===rulerId&&item.type===SCALE);
  if(!projectileIdentity(scene,flight))return fail('PROJECTILE_STALE');
  if(!ruler||ruler.pose.flippedX||Math.abs(ruler.pose.rotationRad)>1e-10)return fail('PROJECTILE_RULER_ALIGNMENT');
  const origin={xM:flight.rig.initial.x0M-ruler.pose.xM,yM:ruler.pose.yM-flight.rig.initial.y0M},ball={xM:flight.point.xM-ruler.pose.xM,yM:ruler.pose.yM-flight.point.yM};
  if([origin,ball].some(point=>point.xM< -1e-10||point.yM< -1e-10||point.xM>Number(ruler.parameters.widthM)+1e-10||point.yM>Number(ruler.parameters.heightM)+1e-10))return fail('PROJECTILE_RULER_RANGE');
  return {ok:true as const,ruler,origin,ball,groundM:ruler.pose.yM-flight.rig.initial.groundYM};
}
export const projectileMessage=(code:string)=>({PROJECTILE_DOCUMENT:'平抛器材参数无效。',PROJECTILE_RANDOM_UNSUPPORTED:'本版平抛尚不施加随机误差。',PROJECTILE_DOMAIN:'平抛实验只支持发射器、小球、二维标尺、计时器和水平地面。',PROJECTILE_APPARATUS:'请各放置一件发射器、小球、计时器和水平地面。',PROJECTILE_BALL_ATTACHMENT:'请把小球放入发射器，拖到枪口或在装配区选择。',PROJECTILE_ORIENTATION:'请检查器材姿态；地面和计时器应水平，器材不翻转。',NON_HORIZONTAL_LAUNCH:'发射器未水平，请自行调平后发射。',INVALID_LAUNCH_PARAMETERS:'发射点须高于地面，重力为正，初速不为负。',PROJECTILE_RANGE:'高度、飞行时间、射程或计时间隔超出教学模型范围。',PROJECTILE_STALE:'本次发射器材已被删除或替换，请重置后重新发射。',PROJECTILE_RULER_ALIGNMENT:'请将二维标尺保持水平/竖直正向，并选择读尺来源。',PROJECTILE_RULER_RANGE:'本次起点和小球须落在标尺范围内，请移动尺零点或调整尺范围。',PROJECTILE_CAPTURE_UNAVAILABLE:'请先发射或单步，再暂停读数；移动预览中不采样。'}[code]??'当前不在平抛模型有效范围内。');
