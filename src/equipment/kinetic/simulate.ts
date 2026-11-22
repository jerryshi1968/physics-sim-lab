import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
import { TRACK } from '../cart/definitions.ts';
import { BALL } from '../projectile/definitions.ts';
import { BLOCK, SURFACE } from '../mechanical/frictionDefinitions.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';
export const KINETIC_EXPERIMENT = 'J-MECH-07', KINETIC_MODEL = 'mechanical.kinetic.rolling-impact.v1', ballRadius = .025;
export const kineticApparatus = [TRACK, BALL, BLOCK, SURFACE, MECHANICAL_RULER];
export const kineticLabels: Record<string, string> = { [TRACK]: '弧形斜槽', [BALL]: '钢球', [SURFACE]: '水平接触面' };
export const kineticFields: Record<string, readonly ParameterField[]> = {
  [TRACK]: [{ key: 'lengthM', label: '斜槽水平长度', unit: 'm', kind: 'number' }],
  [BALL]: [{ key: 'massKg', label: '钢球质量', unit: 'kg', kind: 'number' }],
  [BLOCK]: [{ key: 'massKg', label: '木块质量', unit: 'kg', kind: 'number' }, { key: 'widthM', label: '木块宽度', unit: 'm', kind: 'number' }, { key: 'heightM', label: '木块高度', unit: 'm', kind: 'number' }],
  [SURFACE]: [{ key: 'lengthM', label: '接触面长度', unit: 'm', kind: 'number' }, { key: 'kineticCoefficient', label: '木块滑动摩擦系数', unit: '', kind: 'number' }],
  [MECHANICAL_RULER]: [{ key: 'lengthM', label: '刻度尺长度', unit: 'm', kind: 'number' }],
};
export function kineticBallPoint(track: EquipmentInstance, height: number): WorldPoint {
  const radius = Number(track.parameters.lengthM) / Math.PI, theta = 2 * Math.acos(Math.sqrt(Math.max(0, Math.min(2 * radius, height)) / (2 * radius)));
  return { xM: track.pose.xM + radius * (theta - Math.sin(theta) - Math.PI), yM: track.pose.yM + ballRadius + height };
}
export function kineticRig(scene: SceneDocument) {
  const fail = (message: string) => ({ ok: false as const, message });
  if (scene.connections.length || scene.equipment.some(i => !kineticApparatus.includes(i.type)) || kineticApparatus.some(type => scene.equipment.filter(i => i.type === type).length > (type === MECHANICAL_RULER ? 2 : 1))) return fail('请使用一套斜槽、钢球、木块和接触面；最多两把刻度尺。');
  const track = scene.equipment.find(i => i.type === TRACK), ball = scene.equipment.find(i => i.type === BALL), block = scene.equipment.find(i => i.type === BLOCK), surface = scene.equipment.find(i => i.type === SURFACE);
  if (!track || !ball || !block || !surface) return fail('请放置斜槽、钢球、木块和水平接触面。');
  const m = Number(ball.parameters.massKg ?? .05), M = Number(block.parameters.massKg), mu = Number(surface.parameters.kineticCoefficient), g = scene.simulationConfig.gravityMPerS2, length = Number(track.parameters.lengthM), R = length / Math.PI, height = ball.pose.yM - track.pose.yM - ballRadius, width = Number(block.parameters.widthM), left = block.pose.xM - width / 2, right = surface.pose.xM + Number(surface.parameters.lengthM) / 2;
  const surfaceLength = Number(surface.parameters.lengthM), blockHeight = Number(block.parameters.heightM);
  if (![surfaceLength,blockHeight,width].every(Number.isFinite) || surfaceLength < .5 || surfaceLength > 10 || blockHeight < ballRadius || blockHeight > .3 || width < .04 || width > .4) return fail('请使用有效长度的接触面和足够高度的木块，保证钢球正面接触木块。');
  if (![m,M,mu,g,length,height,width,...scene.equipment.flatMap(i => [i.pose.xM,i.pose.yM,i.pose.rotationRad])].every(Number.isFinite) || m < .02 || m > .5 || M < .05 || M > 2 || mu < .05 || mu > .8 || g <= 0 || g > 30 || length < .6 || length > 2 || height < .02 - 1e-9 || height > Math.min(.4,1.5 * R) + 1e-9 || scene.simulationConfig.randomError.enabled) return fail('钢球 0.02～0.5 kg，木块 0.05～2 kg，高度 2～40 cm（受斜槽限制），摩擦系数 0.05～0.8；请关闭随机误差。');
  if ([track,ball,block,surface].some(i => Math.abs(i.pose.rotationRad) > 1e-8 || i.pose.flippedX) || ball.parameters.launcherId || block.parameters.driverId || block.parameters.meterId || block.parameters.surfaceId && block.parameters.surfaceId !== surface.id || Math.abs(surface.pose.yM - track.pose.yM) > 1e-8 || Math.abs(block.pose.yM - surface.pose.yM) > 1e-8 || Math.hypot(ball.pose.xM - kineticBallPoint(track,height).xM, ball.pose.yM - kineticBallPoint(track,height).yM) > .003 || left < track.pose.xM + 2 * ballRadius || right - left - width < .05 || surface.pose.xM - Number(surface.parameters.lengthM) / 2 > track.pose.xM) return fail('斜槽出口与接触面同高；把钢球拖回斜槽、木块拖到出口右侧，断开其他实验的连接。');
  const speed = Math.sqrt(10 * g * height / 7), effectiveMass = 1.4 * m, commonSpeed = effectiveMass * speed / (M + effectiveMass), acceleration = mu * M * g / (M + effectiveMass), distance = commonSpeed ** 2 / (2 * acceleration), limit = right - left - width - .005, boundary = distance > limit, travel = Math.min(distance,limit), slideTime = boundary ? 2 * travel / (commonSpeed + Math.sqrt(Math.max(0,commonSpeed ** 2 - 2 * acceleration * travel))) : commonSpeed / acceleration, omega = Math.sqrt(5 * g / (28 * R)), rampTime = Math.PI / (2 * omega), coastTime = (left - ballRadius - track.pose.xM) / speed, hitTime = rampTime + coastTime, endTime = hitTime + slideTime;
  if (!Number.isFinite(endTime) || endTime > 120) return fail('本次运动超出 120 s 范围，请调整装置或重力参数。');
  const signature = JSON.stringify([scene.documentId,scene.experimentId,track,ball,block,surface,g,scene.simulationConfig.randomError]);
  return { ok: true as const, track,ball,block,surface,m,M,mu,g,R,height,left,width,speed,effectiveMass,commonSpeed,acceleration,distance,travel,boundary,rampTime,omega,coastTime,hitTime,endTime,signature,message: '' };
}
export type KineticRig = Extract<ReturnType<typeof kineticRig>, { ok: true }>;
export interface KineticRun { id: string; signature: string; rig: KineticRig; timeS: number }
export function advanceKinetic(run: KineticRun, deltaS: number) {
  if (!Number.isFinite(deltaS) || deltaS < 0 || !Number.isFinite(run.timeS) || run.timeS < 0 || run.timeS > run.rig.endTime) throw new RangeError('INVALID_KINETIC_TIME');
  return { ...run, timeS: Math.min(run.rig.endTime,run.timeS + deltaS) };
}
export function kineticState(r: KineticRig, time: number) {
  const t = Math.max(0,Math.min(r.endTime,time)), after = Math.max(0,t-r.hitTime), displacement = Math.min(r.travel,r.commonSpeed * after - .5 * r.acceleration * after ** 2);
  const arc = Math.sqrt(8*r.R*r.height);
  if (t < r.rampTime) { const height = r.height * Math.cos(r.omega * t) ** 2; return { ball: kineticBallPoint(r.track,height), displacement: 0, phase: '沿斜槽滚下', speed: Math.sqrt(Math.max(0,10*r.g*(r.height-height)/7)), spin: (arc-Math.sqrt(8*r.R*height))/ballRadius }; }
  return { ball: { xM: t < r.hitTime ? r.track.pose.xM + r.speed * (t-r.rampTime) : r.left - ballRadius + displacement, yM: r.track.pose.yM + ballRadius }, displacement, phase: t < r.hitTime ? '水平运动' : t < r.endTime ? '推动木块' : r.boundary ? '到达接触面边界' : '木块停止', speed: t < r.hitTime ? r.speed : Math.max(0,r.commonSpeed-r.acceleration*after), spin: (arc+r.speed*Math.min(r.coastTime,t-r.rampTime)+displacement)/ballRadius };
}
export function kineticView(scene: SceneDocument, run: KineticRun | null) {
  if (!run) return scene;
  const state = kineticState(run.rig,run.timeS);
  return { ...scene, equipment: scene.equipment.map(i => i.id === run.rig.ball.id ? { ...i,pose:{ ...i.pose,...state.ball } } : i.id === run.rig.block.id ? { ...i,pose:{ ...i.pose,xM:i.pose.xM+state.displacement } } : i) };
}
export function kineticDrop(scene: SceneDocument, item: EquipmentInstance, point: WorldPoint) {
  const track = scene.equipment.find(i => i.type === TRACK), surface = scene.equipment.find(i => i.type === SURFACE);
  if (track && item.type === BALL) { const h = Math.max(.02,Math.min(.4,1.5*Number(track.parameters.lengthM)/Math.PI,point.yM-track.pose.yM-ballRadius)); return { pose:{ ...item.pose,...kineticBallPoint(track,h),rotationRad:0 },parameters:{ ...item.parameters,launcherId:'' } }; }
  if (surface && item.type === BLOCK) return { pose:{ ...item.pose,xM:point.xM,yM:surface.pose.yM,rotationRad:0 },parameters:{ ...item.parameters,surfaceId:surface.id,driverId:'',meterId:'' } };
  return { pose:{ ...item.pose,...point },parameters:item.parameters };
}
export function kineticRuler(scene: SceneDocument, rig: KineticRig, id: string) {
  const ruler = scene.equipment.find(i => i.type === MECHANICAL_RULER && i.id === id);
  if (!ruler || Math.abs(ruler.pose.rotationRad) > 1e-8 || ruler.pose.flippedX) return null;
  const start = rig.left-ruler.pose.xM, end = start+rig.travel, length = Number(ruler.parameters.lengthM);
  return { ruler,start,end,length,covered:start>=0&&end<=length };
}
