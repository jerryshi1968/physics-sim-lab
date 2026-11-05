import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export interface FrictionInput {
  massKg: number;
  gravityMPerS2: number;
  staticCoefficient: number;
  kineticCoefficient: number;
  velocityMPerS: number;
  pullN: number;
}
export interface FrictionSample {
  state: 'static' | 'sliding-steady' | 'sliding-accelerating';
  normalN: number;
  frictionN: number;
  pullN: number;
  netForceN: number;
  accelerationMPerS2: number;
}

export function evaluateFriction(input: FrictionInput): SampleResult<FrictionSample> {
  const { massKg, gravityMPerS2, staticCoefficient: mus, kineticCoefficient: muk, velocityMPerS: v, pullN } = input;
  if (!finite(massKg, gravityMPerS2, mus, muk, v, pullN) || massKg <= 0 || gravityMPerS2 <= 0
    || muk < 0 || mus < muk) return invalid('INVALID_FRICTION_PARAMETERS');
  const normalN = massKg * gravityMPerS2;
  const staticLimitN = mus * normalN;
  const kineticN = muk * normalN;
  if (!finite(normalN, staticLimitN, kineticN)) return invalid('NUMERIC_RANGE');
  if (v === 0 && Math.abs(pullN) <= staticLimitN) {
    return success({ state: 'static', normalN, frictionN: -pullN, pullN, netForceN: 0, accelerationMPerS2: 0 });
  }
  const direction = v === 0 ? Math.sign(pullN) : Math.sign(v);
  const frictionN = -direction * kineticN;
  const netForceN = pullN + frictionN;
  const forceToleranceN = 1e-9 + 1e-9 * Math.max(Math.abs(pullN), kineticN);
  return success({ state: Math.abs(netForceN) <= forceToleranceN ? 'sliding-steady' : 'sliding-accelerating',
    normalN, frictionN, pullN, netForceN, accelerationMPerS2: netForceN / massKg });
}
