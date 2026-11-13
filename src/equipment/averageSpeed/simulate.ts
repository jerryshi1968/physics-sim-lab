import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance, Pose2D } from '../../core/equipment/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { CART, TRACK, cartHalfLengthM } from '../cart/definitions.ts';
import { BLOCK } from '../mechanical/frictionDefinitions.ts';
import { TIMER } from '../projectile/definitions.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { averageSpeedApparatus, STOP } from './definitions.ts';

export const AVERAGE_SPEED_MODEL = 'mechanical.average-speed.analytic.v1';
export function alongTrack(track: EquipmentInstance, point: WorldPoint) {
  const dx = point.xM - track.pose.xM, dy = point.yM - track.pose.yM, a = track.pose.rotationRad;
  return { along: dx * Math.cos(a) + dy * Math.sin(a), normal: -dx * Math.sin(a) + dy * Math.cos(a) };
}
export function trackPoint(track: Pick<EquipmentInstance, 'pose'>, along: number, normal = 0): WorldPoint {
  const a = track.pose.rotationRad;
  return { xM: track.pose.xM + along * Math.cos(a) - normal * Math.sin(a), yM: track.pose.yM + along * Math.sin(a) + normal * Math.cos(a) };
}
export function averageSpeedRig(scene: SceneDocument) {
  const fail = (message: string) => ({ ok: false as const, message });
  if (scene.connections.length || scene.equipment.some(i => !averageSpeedApparatus.includes(i.type)) || averageSpeedApparatus.some(type => scene.equipment.filter(i => i.type === type).length > 1)) return fail('本实验每种器材最多一件，请移除不兼容或重复器材。');
  const track = scene.equipment.find(i => i.type === TRACK), cart = scene.equipment.find(i => i.type === CART), stop = scene.equipment.find(i => i.type === STOP), timer = scene.equipment.find(i => i.type === TIMER);
  if (!track || !cart || !stop || !timer) return fail('请放置斜面、小车、金属挡片和停表；读尺时再添加刻度尺。');
  const angle = track.pose.rotationRad, lengthM = Number(track.parameters.lengthM), gravity = scene.simulationConfig.gravityMPerS2;
  if (![angle,lengthM,gravity,...scene.equipment.flatMap(i => [i.pose.xM,i.pose.yM,i.pose.rotationRad])].every(Number.isFinite) || lengthM < .6 || lengthM > 4 || gravity <= 0 || gravity > 25 || scene.simulationConfig.randomError.enabled || scene.equipment.some(i => i.pose.flippedX)) return fail('装置或重力参数超出模型范围；请关闭随机误差。');
  if (angle < Math.PI / 180 - 1e-10 || angle > 8 * Math.PI / 180 + 1e-10) return fail('请让斜面右高左低，坡度设置在 1°～8°。');
  const start = alongTrack(track, cart.pose), end = alongTrack(track, stop.pose);
  if (Math.abs(start.normal) > .025 || Math.abs(end.normal) > .025 || Math.abs(cart.pose.rotationRad - angle) > 1e-8 || Math.abs(stop.pose.rotationRad - angle) > 1e-8) return fail('将小车和金属挡片拖到斜面上，沿斜面摆放。');
  const front = start.along - cartHalfLengthM, distanceM = front - end.along;
  if (start.along + cartHalfLengthM > lengthM / 2 + 1e-9 || start.along - cartHalfLengthM < -lengthM / 2 || end.along < -lengthM / 2 + .01 || distanceM < .02) return fail('小车应完整放在斜面内，挡片在小车前方且留出至少 2 cm 路程。');
  const acceleration = gravity * Math.sin(angle), endTimeS = Math.sqrt(2 * distanceM / acceleration), resolutionS = Number(timer.parameters.resolutionS);
  if (!Number.isFinite(endTimeS) || endTimeS > 60 || !Number.isFinite(resolutionS) || resolutionS <= 0 || resolutionS > .1) return fail('本次行程或停表分度超出模型范围。');
  const signature = JSON.stringify([scene.documentId,track.id,track.pose,lengthM,cart.id,cart.pose,cart.parameters,stop.id,stop.pose,timer.id,timer.parameters,gravity,scene.simulationConfig.randomError]);
  return { ok: true as const, track, cart, stop, timer, startAlongM: start.along, frontAlongM: front, stopAlongM: end.along, distanceM, acceleration, endTimeS, resolutionS, signature, message: '' };
}
export type AverageSpeedRig = Extract<ReturnType<typeof averageSpeedRig>, { ok: true }>;
export interface AverageSpeedRun { id: string; signature: string; rig: AverageSpeedRig; timeS: number }
export function advanceAverageSpeed(run: AverageSpeedRun, deltaS: number): AverageSpeedRun {
  if (!Number.isFinite(deltaS) || deltaS < 0 || !Number.isFinite(run.timeS) || run.timeS < 0 || run.timeS > run.rig.endTimeS) throw new RangeError('INVALID_AVERAGE_SPEED_TIME');
  return { ...run, timeS: Math.min(run.rig.endTimeS,run.timeS + deltaS) };
}
export function averageSpeedView(scene: SceneDocument, run: AverageSpeedRun | null) {
  if (!run) return scene;
  const distance = Math.min(run.rig.distanceM, .5 * run.rig.acceleration * run.timeS ** 2);
  return { ...scene, equipment: scene.equipment.map(i => i.id === run.rig.cart.id ? { ...i, pose: { ...i.pose,...trackPoint(run.rig.track,run.rig.startAlongM - distance) } } : i) };
}
export function averageSpeedDrop(scene: SceneDocument, item: EquipmentInstance, point: WorldPoint) {
  const track = scene.equipment.find(i => i.type === TRACK);
  if (!track || ![CART,STOP,MECHANICAL_RULER].includes(item.type)) return { pose: { ...item.pose,...point }, parameters: item.parameters };
  const local = alongTrack(track,point);
  if (Math.abs(local.along) > Number(track.parameters.lengthM) / 2 + .1 || Math.abs(local.normal) > .18) return { pose: { ...item.pose,...point }, parameters: item.parameters };
  return { pose: { ...item.pose,...trackPoint(track,local.along,item.type === MECHANICAL_RULER ? -.15 : 0),rotationRad:track.pose.rotationRad },parameters:item.parameters };
}
export function averageTrackUpdates(scene: SceneDocument, track: EquipmentInstance, pose: Pose2D, parameters: EquipmentInstance['parameters']) {
  const next = { ...track,pose,parameters };
  return scene.equipment.filter(i => i.id === track.id || [CART,STOP,MECHANICAL_RULER,BLOCK].includes(i.type)).map(i => {
    if (i.id === track.id) return { id:i.id,pose,parameters };
    const local = alongTrack(track,i.pose);
    return { id:i.id,pose:{...i.pose,...trackPoint(next,local.along,local.normal),rotationRad:i.type === BLOCK ? i.pose.rotationRad : i.pose.rotationRad + pose.rotationRad - track.pose.rotationRad},parameters:i.parameters };
  });
}
export function averageSpeedRuler(scene: SceneDocument, rig: AverageSpeedRig, rulerId: string) {
  const ruler = scene.equipment.find(i => i.id === rulerId && i.type === MECHANICAL_RULER);
  if (!ruler || ruler.pose.flippedX || Math.abs(ruler.pose.rotationRad - rig.track.pose.rotationRad) > 1e-8) return null;
  const origin = alongTrack(rig.track,ruler.pose).along, lengthM = Number(ruler.parameters.lengthM), startM = rig.frontAlongM - origin, stopM = rig.stopAlongM - origin;
  return { ruler,lengthM,startM,stopM,covered: Math.min(startM,stopM) >= -1e-9 && Math.max(startM,stopM) <= lengthM + 1e-9 };
}
