import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export interface PointM { xM: number; yM: number }
export interface ForceAtPoint { point: PointM; fxN: number; fyN: number }
export interface LeverSample {
  torquesNm: number[];
  armsM: number[];
  totalTorqueNm: number;
  reactionN: { x: number; y: number };
  balanced: boolean;
  torqueToleranceNm: number;
}

export function evaluateLever(
  pivot: PointM, loads: readonly ForceAtPoint[], supported = true,
): SampleResult<LeverSample> {
  if (!supported) return invalid('MISSING_SUPPORT');
  if (!finite(pivot.xM, pivot.yM) || !loads.every(load =>
    finite(load.point.xM, load.point.yM, load.fxN, load.fyN))) return invalid('INVALID_LEVER_PARAMETERS');
  const torquesNm = loads.map(load =>
    (load.point.xM - pivot.xM) * load.fyN - (load.point.yM - pivot.yM) * load.fxN);
  const armsM = loads.map((load, index) => {
    const forceN = Math.hypot(load.fxN, load.fyN);
    return forceN === 0 ? 0 : Math.abs(torquesNm[index]!) / forceN;
  });
  const totalTorqueNm = torquesNm.reduce((a, b) => a + b, 0);
  const torqueToleranceNm = 1e-9 + 1e-9 * torquesNm.reduce((a, b) => a + Math.abs(b), 0);
  return success({ torquesNm, armsM, totalTorqueNm, torqueToleranceNm,
    balanced: Math.abs(totalTorqueNm) <= torqueToleranceNm,
    reactionN: { x: 0 - loads.reduce((a, b) => a + b.fxN, 0), y: 0 - loads.reduce((a, b) => a + b.fyN, 0) } });
}

export function requiredLeverForce(
  pivot: PointM, loads: readonly ForceAtPoint[], point: PointM,
  direction: { x: number; y: number }, supported = true,
): SampleResult<{ forceN: number; armM: number; equilibrium: LeverSample }> {
  const before = evaluateLever(pivot, loads, supported);
  if (before.status === 'invalid') return before;
  const norm = Math.hypot(direction.x, direction.y);
  if (!finite(point.xM, point.yM, direction.x, direction.y, norm) || norm === 0) {
    return invalid('INVALID_FORCE_DIRECTION');
  }
  const dx = direction.x / norm;
  const dy = direction.y / norm;
  const signedArmM = (point.xM - pivot.xM) * dy - (point.yM - pivot.yM) * dx;
  if (!finite(signedArmM)) return invalid('NUMERIC_RANGE');
  if (Math.abs(signedArmM) <= 1e-12) return invalid('ZERO_MOMENT_ARM');
  const forceN = -before.value.totalTorqueNm / signedArmM;
  if (forceN < 0) return invalid('DIRECTION_CANNOT_BALANCE');
  const equilibrium = evaluateLever(pivot, [...loads, { point, fxN: forceN * dx, fyN: forceN * dy }], supported);
  if (equilibrium.status === 'invalid') return equilibrium;
  return success({ forceN, armM: Math.abs(signedArmM), equilibrium: equilibrium.value });
}
