import { evaluateLever, requiredLeverForce } from '../../physics/samples/lever.ts';
import type { PointM, ForceAtPoint } from '../../physics/samples/lever.ts';

export interface LeverLoad extends ForceAtPoint { id: string; kind: 'weight' | 'meter' | 'self' | 'trim'; hookIndex: number | null }
export const BALANCE_NUT_MASS_KG = .05, BALANCE_DROP_M = .01, NUT_TRAVEL_M = .06;
export function endNutBalance(input: { halfLengthM: number; pivotM: number; massKg: number; comM: number; leftM: number; rightM: number }) {
  const { halfLengthM, pivotM, massKg, comM, leftM, rightM } = input;
  if (!Object.values(input).every(Number.isFinite) || halfLengthM <= 0 || massKg < 0 || Math.abs(pivotM) > halfLengthM || Math.abs(comM) > halfLengthM || leftM < 0 || leftM > NUT_TRAVEL_M || rightM < 0 || rightM > NUT_TRAVEL_M) return { ok: false as const, code: 'LEVER_RANGE' };
  const leftXM = -halfLengthM - .015 - leftM, rightXM = halfLengthM + .015 + rightM;
  const firstMomentKgM = massKg * (comM - pivotM) + BALANCE_NUT_MASS_KG * (leftXM + rightXM - 2 * pivotM);
  const totalMassKg = massKg + 2 * BALANCE_NUT_MASS_KG;
  const equilibriumRad = -Math.atan2(firstMomentKgM, totalMassKg * BALANCE_DROP_M);
  return { ok: true as const, leftXM, rightXM, firstMomentKgM, totalMassKg, equilibriumRad, angleRad: Math.max(-.25, Math.min(.25, equilibriumRad)) };
}
export function solveLever(pivot: PointM, loads: readonly LeverLoad[], supportCapacityN: number) {
  if (!Number.isFinite(supportCapacityN) || supportCapacityN <= 0) return { ok: false as const, code: 'INVALID_SUPPORT' };
  const result = evaluateLever(pivot, loads);
  if (result.status !== 'ok') return { ok: false as const, code: result.code };
  const value = result.value;
  if (![...value.torquesNm, ...value.armsM, value.totalTorqueNm, value.reactionN.x, value.reactionN.y, value.torqueToleranceNm].every(Number.isFinite)) return { ok: false as const, code: 'NUMERIC_RANGE' };
  if (Math.hypot(value.reactionN.x, value.reactionN.y) > supportCapacityN) return { ok: false as const, code: 'SUPPORT_OVERLOAD' };
  return { ok: true as const, ...value, loads: loads.map((load, index) => ({ ...load, forceN: Math.hypot(load.fxN, load.fyN), torqueNm: value.torquesNm[index]!, armM: value.armsM[index]! })),
    clockwiseNm: 0 - value.torquesNm.filter(torque => torque < 0).reduce((sum, torque) => sum + torque, 0), counterclockwiseNm: value.torquesNm.filter(torque => torque > 0).reduce((sum, torque) => sum + torque, 0),
    relativeResidual: Math.abs(value.totalTorqueNm) / Math.max(1, value.torquesNm.reduce((sum, torque) => sum + Math.abs(torque), 0)) };
}
export function targetLeverForce(pivot: PointM, known: readonly LeverLoad[], point: PointM, directionDeg: number) {
  if (!Number.isFinite(directionDeg)) return { status: 'invalid' as const, code: 'INVALID_FORCE_DIRECTION' };
  const radians = directionDeg * Math.PI / 180;
  const result = requiredLeverForce(pivot, known, point, { x: Math.cos(radians), y: Math.sin(radians) });
  if (result.status === 'ok' && ![result.value.forceN, result.value.armM, ...result.value.equilibrium.torquesNm, ...result.value.equilibrium.armsM, result.value.equilibrium.totalTorqueNm, result.value.equilibrium.torqueToleranceNm, result.value.equilibrium.reactionN.x, result.value.equilibrium.reactionN.y].every(Number.isFinite)) return { status: 'invalid' as const, code: 'NUMERIC_RANGE' };
  return result;
}

export function forceReading(forceN: number, rangeN: number, resolutionN: number, available: boolean) {
  if (![forceN, rangeN, resolutionN].every(Number.isFinite) || rangeN <= 0 || resolutionN <= 0 || resolutionN > rangeN || forceN < 0) return { status: 'invalid' as const, displayN: null };
  if (!available) return { status: 'disconnected' as const, displayN: null };
  if (forceN > rangeN) return { status: 'over-range' as const, displayN: null };
  return { status: 'valid' as const, displayN: Math.min(rangeN, Number((Math.round(forceN / resolutionN) * resolutionN).toPrecision(12))) };
}
