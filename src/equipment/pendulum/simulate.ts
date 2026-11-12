import type { SceneDocument } from '../../core/scene/schema.ts';
import { PENDULUM } from './definitions.ts';
import { SUPPORT } from '../mechanical/definitions.ts';
import { TIMER } from '../projectile/definitions.ts';

export function ellipticK(k: number) {
  if (!Number.isFinite(k) || k < 0 || k >= 1) throw new RangeError('INVALID_ELLIPTIC_MODULUS');
  let a = 1, b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 32 && Math.abs(a - b) > 1e-15; i++) { const next = (a + b) / 2; b = Math.sqrt(a * b); a = next; }
  return Math.PI / (2 * a);
}
export function pendulumPeriod(lengthM: number, gravity: number, amplitudeRad: number) {
  if (![lengthM, gravity, amplitudeRad].every(Number.isFinite) || lengthM <= 0 || gravity <= 0 || Math.abs(amplitudeRad) > Math.PI / 3 + 1e-12) throw new RangeError('INVALID_PENDULUM_MODEL');
  return 4 * Math.sqrt(lengthM / gravity) * ellipticK(Math.sin(Math.abs(amplitudeRad) / 2));
}
function incompleteF(phi: number, k: number) {
  const n = 64, h = phi / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) / Math.sqrt(1 - (k * Math.sin(i * h)) ** 2);
  return sum * h / 3;
}
export function pendulumAngle(lengthM: number, gravity: number, amplitudeRad: number, timeS: number) {
  const period = pendulumPeriod(lengthM, gravity, amplitudeRad);
  if (!Number.isFinite(timeS) || timeS < 0) throw new RangeError('INVALID_PENDULUM_TIME');
  if (amplitudeRad === 0) return 0;
  const q = (timeS % period) / period * 4, k = Math.sin(Math.abs(amplitudeRad) / 2), K = ellipticK(k);
  const fraction = q < 1 ? 1 - q : q < 2 ? q - 1 : q < 3 ? 3 - q : q - 3;
  const target = K * fraction;
  let lo = 0, hi = Math.PI / 2, phi = fraction * Math.PI / 2;
  for (let i = 0; i < 14; i++) {
    const error = incompleteF(phi, k) - target;
    if (Math.abs(error) < 1e-13) break;
    if (error < 0) lo = phi; else hi = phi;
    const next = phi - error * Math.sqrt(1 - (k * Math.sin(phi)) ** 2);
    phi = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  return Math.sign(amplitudeRad) * (q < 1 || q >= 3 ? 1 : -1) * 2 * Math.asin(k * Math.sin(phi));
}
export function pendulumRig(scene: SceneDocument) {
  const fail = (message: string) => ({ ok: false as const, message });
  const items = scene.equipment.filter(item => item.type === PENDULUM), timers = scene.equipment.filter(item => item.type === TIMER);
  if (items.length !== 1) return fail('请放置一套单摆。');
  const bob = items[0]!, p = bob.parameters;
  const support = scene.equipment.find(item => item.id === p.supportId && item.type === SUPPORT);
  if (!support) return fail('请将单摆连接到支架。');
  if (Math.abs(support.pose.rotationRad) > 1e-8 || support.pose.flippedX || Math.abs(bob.pose.rotationRad) > 1e-8 || bob.pose.flippedX) return fail('单摆和支架须保持竖直安装。');
  const lengthM = Number(p.stringLengthM) + Number(p.bobRadiusM), gravity = scene.simulationConfig.gravityMPerS2, amplitudeRad = Number(p.initialAngleDeg) * Math.PI / 180;
  const pivot = { xM: support.pose.xM + .12, yM: support.pose.yM + Number(support.parameters.heightM) - .04 };
  if (![lengthM, gravity, amplitudeRad].every(Number.isFinite) || gravity <= 0 || lengthM <= 0 || Math.abs(amplitudeRad) > Math.PI / 3 + 1e-12) return fail('单摆参数超出模型范围。');
  if (pivot.yM - lengthM - Number(p.bobRadiusM) <= support.pose.yM + .025) return fail('摆球会碰到底座，请缩短摆线或升高支架。');
  if (Number(p.massKg) * gravity * (3 - 2 * Math.cos(amplitudeRad)) > Number(support.parameters.capacityN)) return fail('支架载荷超限。');
  const timer = timers.length === 1 ? timers[0]! : null;
  const signature = JSON.stringify([scene.documentId, bob, support, timer ? { id: timer.id, parameters: timer.parameters } : null, gravity]);
  return { ok: true as const, bob, support, timer, pivot, lengthM, gravity, amplitudeRad, periodS: pendulumPeriod(lengthM, gravity, amplitudeRad), smallAngle: Math.abs(amplitudeRad) <= 5 * Math.PI / 180 + 1e-12, signature };
}
export type PendulumRig = Extract<ReturnType<typeof pendulumRig>, { ok: true }>;
export interface PendulumRun { signature: string; timeS: number; targetCycles: number; periodS: number; completed: boolean }
export function advancePendulum(run: PendulumRun, deltaS: number): PendulumRun {
  if (!Number.isFinite(run.timeS) || run.timeS < 0 || !Number.isFinite(deltaS) || deltaS < 0 || !Number.isInteger(run.targetCycles) || run.targetCycles < 1 || run.targetCycles > 50 || !Number.isFinite(run.periodS) || run.periodS <= 0) throw new RangeError('INVALID_PENDULUM_RUN');
  const end = run.targetCycles * run.periodS, timeS = Math.min(end, run.timeS + deltaS);
  return { ...run, timeS, completed: timeS >= end };
}
export function pendulumViewScene(scene: SceneDocument) {
  const rig = pendulumRig(scene);
  if (!rig.ok) return scene;
  return { ...scene, equipment: scene.equipment.map(item => item.id === rig.bob.id ? { ...item, pose: { ...item.pose, ...rig.pivot } } : item) };
}
export function pendulumDrop(scene: SceneDocument, id: string, point: { xM: number; yM: number }) {
  const item = scene.equipment.find(item => item.id === id);
  if (!item || item.type !== PENDULUM) return null;
  const support = scene.equipment.find(item => item.type === SUPPORT && Math.hypot(point.xM - item.pose.xM - .12, point.yM - item.pose.yM - Number(item.parameters.heightM) + .04) < .12);
  return { pose: { ...item.pose, ...point }, parameters: { ...item.parameters, supportId: support?.id ?? '' } };
}
