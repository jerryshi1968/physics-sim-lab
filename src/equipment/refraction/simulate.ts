import { lightOrbitForScene } from '../optical/lightOrbit.ts';
import { lightOrbitPose } from '../../core/workbench/lightOrbit.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { refractInterface } from '../../core/optical/refraction.ts';
import type { Ray2 } from '../../core/optical/refraction.ts';
import { EMITTER, NORMAL, PROTRACTOR } from '../reflection/definitions.ts';
import { RULER } from '../optical/definitions.ts';
import { TANK, refractionApparatus } from './definitions.ts';
export const AIR_INDEX = 1, WATER_INDEX = 4 / 3;
const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function waterDistance(point: Ray2, ray: Ray2, tank: EquipmentInstance, maximum: number) {
  const left = tank.pose.xM - Number(tank.parameters.widthM) / 2, right = tank.pose.xM + Number(tank.parameters.widthM) / 2, bottom = tank.pose.yM - Number(tank.parameters.depthM);
  const distances = [maximum];
  if (ray.x > 1e-10) distances.push((right - point.x) / ray.x);
  if (ray.x < -1e-10) distances.push((left - point.x) / ray.x);
  if (ray.y < -1e-10) distances.push((bottom - point.y) / ray.y);
  return Math.max(0, Math.min(...distances));
}
export function simulateRefraction(scene: SceneDocument, registry: EquipmentRegistry) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (!validateSceneDocument(scene, registry).ok) return fail('REFRACTION_DOCUMENT');
  if (scene.connections.length || scene.equipment.some(i => !refractionApparatus.includes(i.type))) return fail('REFRACTION_MIXED');
  if (scene.simulationConfig.randomError.enabled) return fail('REFRACTION_RANDOM');
  const find = (type: string) => scene.equipment.filter(i => i.type === type), tanks = find(TANK), sources = find(EMITTER), normals = find(NORMAL), gauges = find(PROTRACTOR);
  if (tanks.length !== 1 || sources.length !== 1 || normals.length > 1 || gauges.length > 2) return fail('REFRACTION_APPARATUS');
  if (scene.equipment.some(i => i.type !== RULER && (i.pose.flippedX || Math.abs(i.pose.xM) > 100 || Math.abs(i.pose.yM) > 100 || Math.abs(i.pose.rotationRad) > 2 * Math.PI))) return fail('REFRACTION_RANGE');
  const tank = tanks[0]!, emitter = sources[0]!, normalMarker = normals[0];
  if (Math.abs(tank.pose.rotationRad) > 1e-8) return fail('REFRACTION_LEVEL');
  if (!emitter.parameters.enabled) return fail('REFRACTION_LIGHT_OFF');
  const source = { x: emitter.pose.xM, y: emitter.pose.yM }, direction = { x: Math.cos(emitter.pose.rotationRad), y: Math.sin(emitter.pose.rotationRad) }, surfaceY = tank.pose.yM, fromWater = source.y < surfaceY;
  if (Math.abs(source.y - surfaceY) < 1e-7) return fail('REFRACTION_ON_SURFACE');
  if (Math.abs(direction.y) < 1e-10 || (fromWater ? direction.y <= 0 : direction.y >= 0)) return fail('REFRACTION_NO_HIT');
  const width = Number(tank.parameters.widthM), depth = Number(tank.parameters.depthM), maximum = Number(emitter.parameters.rangeM), distance = (surfaceY - source.y) / direction.y;
  if (distance <= 1e-7 || distance >= maximum) return fail('REFRACTION_NO_HIT');
  if (fromWater && (Math.abs(source.x - tank.pose.xM) >= width / 2 - 1e-7 || source.y <= surfaceY - depth + 1e-7)) return fail('REFRACTION_OUTSIDE_WATER');
  const hit = { x: source.x + distance * direction.x, y: surfaceY };
  if (Math.abs(hit.x - tank.pose.xM) >= width / 2 - 1e-7) return fail('REFRACTION_SURFACE_MISS');
  const optical = refractInterface(direction, fromWater ? WATER_INDEX : AIR_INDEX, fromWater ? AIR_INDEX : WATER_INDEX), remaining = maximum - distance;
  const transmittedLengthM = !optical.transmitted ? 0 : fromWater ? Math.min(.65, remaining) : waterDistance(hit, optical.transmitted, tank, remaining);
  const reflectedLengthM = fromWater ? waterDistance(hit, optical.reflected, tank, remaining) : Math.min(.5, remaining);
  const aligned = (item: EquipmentInstance, rotationRad: number) => Math.hypot(item.pose.xM - hit.x, item.pose.yM - hit.y) < 1e-5 && angularDistance(item.pose.rotationRad, rotationRad) < 1e-5;
  const upper = gauges.find(i => aligned(i, 0)), lower = gauges.find(i => aligned(i, Math.PI) || aligned(i, -Math.PI));
  const normalAligned = !!normalMarker && (aligned(normalMarker, 0) || aligned(normalMarker, Math.PI) || aligned(normalMarker, -Math.PI));
  const incidentGauge = fromWater ? lower : upper, refractedGauge = fromWater ? upper : lower;
  const readable = { incident: normalAligned && !!incidentGauge && distance >= Number(incidentGauge.parameters.radiusM), refracted: normalAligned && !!refractedGauge && !!optical.transmitted && transmittedLengthM >= Number(refractedGauge.parameters.radiusM) };
  return { ok: true as const, tank, emitter, normalMarker, gauges, incidentGauge, refractedGauge, source, direction, hit, fromWater, ...optical, distance, maximum, transmittedLengthM, reflectedLengthM, normalAligned, readable };
}
export type RefractionOutcome = ReturnType<typeof simulateRefraction>;
export const refractionMessage = (code: string) => ({ REFRACTION_DOCUMENT: '器材参数无效，请检查属性。', REFRACTION_MIXED: '本实验支持水槽、光源、量角器、法线和独立尺；请移除不兼容器材。', REFRACTION_RANDOM: '折射模型尚未施加随机误差，请关闭后观察。', REFRACTION_APPARATUS: '请放置一个透明水槽和一个窄光束光源；测角可再放两把半圆量角器和一个法线标记。', REFRACTION_RANGE: '请保持器材正面和有限坐标，不支持左右翻转。', REFRACTION_LEVEL: '本实验水面保持水平，请将水槽转角恢复为 0°。', REFRACTION_LIGHT_OFF: '光源已关闭。', REFRACTION_ON_SURFACE: '光源不能放在水面上，请放在空气中或水中。', REFRACTION_NO_HIT: '光束未正向射向水面；请移动或转动光源，避开平行水面的方向。', REFRACTION_OUTSIDE_WATER: '水下光源须位于水槽内部。', REFRACTION_SURFACE_MISS: '光束未命中有限水面，请重新摆放光源。' }[code] ?? '当前折射装置不可用。');
export function refractionAim(scene: SceneDocument, angleRad: number, fromWater: boolean) {
  const tank = scene.equipment.find(i => i.type === TANK), emitter = scene.equipment.find(i => i.type === EMITTER);
  if (!tank || !emitter || !Number.isFinite(angleRad) || Math.abs(angleRad) > 85 * Math.PI / 180) return null;
  const orbit = lightOrbitForScene(scene, 'refraction');
  if (orbit && fromWater === (emitter.pose.yM < tank.pose.yM)) return { id: emitter.id, pose: lightOrbitPose(orbit, (fromWater ? -Math.PI / 2 - angleRad : Math.PI / 2 + angleRad)), parameters: emitter.parameters };
  const radius = fromWater ? Math.min(.34, Number(tank.parameters.depthM) * .75, Number(tank.parameters.widthM) * .4) : .46;
  const dx = Math.sin(angleRad), dy = (fromWater ? 1 : -1) * Math.cos(angleRad);
  return { id: emitter.id, pose: { ...emitter.pose, xM: tank.pose.xM - radius * dx, yM: tank.pose.yM - radius * dy, rotationRad: Math.atan2(dy, dx) }, parameters: emitter.parameters };
}
export function reverseRefraction(outcome: RefractionOutcome) {
  if (!outcome.ok || !outcome.transmitted || outcome.kind === 'critical' || outcome.transmittedLengthM < .03) return null;
  const radius = Math.min(.34, outcome.transmittedLengthM * .7), d = outcome.transmitted;
  return { id: outcome.emitter.id, pose: { ...outcome.emitter.pose, xM: outcome.hit.x + d.x * radius, yM: outcome.hit.y + d.y * radius, rotationRad: Math.atan2(-d.y, -d.x) }, parameters: outcome.emitter.parameters };
}
