import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { cartDisplacement, compileCart } from '../cart/simulate.ts';
import type { CartRig, CartRun } from '../cart/simulate.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { tapeLengthM, tickerTimeLimitS } from '../ticker/simulate.ts';
import type { TapeRun } from '../ticker/simulate.ts';
import { CART_VELOCITY_EXPERIMENT, cartVelocityTypes } from './definitions.ts';

export function compileCartVelocity(scene: SceneDocument, registry: EquipmentRegistry) {
  if (scene.experimentId !== CART_VELOCITY_EXPERIMENT || scene.equipment.some(item => !cartVelocityTypes.includes(item.type)) || scene.equipment.filter(item => item.type === MECHANICAL_RULER).length > 1) return { ok: false as const, message: '本实验仅使用现有小车、带滑轮轨道、打点计时器和独立尺。' };
  const rig = compileCart({ ...scene, equipment: scene.equipment.filter(item => item.type !== MECHANICAL_RULER) }, registry);
  if (!rig.ok) return { ok: false as const, message: '请使用水平正向的轨道与小车，把小车放在轨道上并留出运动行程。' };
  if (!rig.ticker || Math.abs(rig.ticker.pose.yM - rig.track.pose.yM - .052) > .015 || rig.ticker.pose.xM > rig.startXM - .23 || rig.startXM - rig.ticker.pose.xM > .65) return { ok: false as const, message: '将计时器置于小车后方，与小车纸带连接处同高，并让小车靠近计时器。' };
  const travelM = Math.min(rig.travelM, tapeLengthM), endTimeS = rig.acceleration > 0 ? Math.sqrt(2 * travelM / rig.acceleration) : rig.endTimeS;
  if (endTimeS > tickerTimeLimitS) return { ok: false as const, message: '本组行程所需时间超过12 s，请增大牵引质量或缩短下落行程。' };
  return { ...rig, travelM, endTimeS, stopReason: rig.travelM > tapeLengthM ? '到达纸带有效记录行程末端' : rig.stopReason };
}
export type CartVelocityRig = Extract<ReturnType<typeof compileCartVelocity>, { ok: true }>;
export interface CartVelocityMotion { run: CartRun; releasedAtS: number; ended: boolean; interrupted: boolean }
export function advanceDrivenTape(tape: TapeRun, counterTimeS: number, physicalClockS: number, rig: CartRig | null, releasedAtS: number | null, powered: boolean): TapeRun {
  if (![counterTimeS, physicalClockS].every(Number.isFinite) || counterTimeS < tape.timeS || physicalClockS < counterTimeS || releasedAtS !== null && (!rig || !Number.isFinite(releasedAtS) || releasedAtS < 0)) throw new RangeError('INVALID_CART_TAPE_CLOCK');
  const at = (timeS: number) => rig && releasedAtS !== null ? cartDisplacement(rig, Math.max(0, timeS - releasedAtS)) : 0;
  const timeS = powered ? Math.min(counterTimeS, tickerTimeLimitS) : tape.timeS, dots = [...tape.dots];
  if (powered) for (let index = dots.length; index <= Math.floor(timeS * tape.frequencyHz + 1e-9); index++) { const t = index / tape.frequencyHz; dots.push({ timeS: t, displacementM: at(t) }); }
  return { ...tape, interaction: 'pointer.v2', timeS, displacementM: at(physicalClockS), dots };
}
