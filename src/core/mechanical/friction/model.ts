import { evaluateFriction } from '../../../physics/samples/friction.ts';

export interface FrictionConfig { massKg: number; gravityMPerS2: number; staticCoefficient: number; kineticCoefficient: number; mode: 'force' | 'speed'; pullN: number; targetMPerS: number }
export interface FrictionMotion { xM: number; velocityMPerS: number; timeS: number; steadyS: number; driveKey: string }
export const initialFrictionMotion = (xM = 0, velocityMPerS = 0): FrictionMotion => ({ xM, velocityMPerS, timeS: 0, steadyS: 0, driveKey: '' });
const fail = (code: string) => ({ ok: false as const, code });
const driveKey = (c: FrictionConfig) => JSON.stringify([c.massKg, c.gravityMPerS2, c.staticCoefficient, c.kineticCoefficient, c.mode, c.pullN, c.targetMPerS]);
export function frictionForces(c: FrictionConfig, state: FrictionMotion, stepS = 1 / 120) {
  if (!Object.values(state).filter(value => typeof value === 'number').every(Number.isFinite) || !Object.values(c).filter(value => typeof value === 'number').every(Number.isFinite)
    || !['force', 'speed'].includes(c.mode) || c.massKg <= 0 || c.massKg > 20 || c.gravityMPerS2 <= 0 || c.gravityMPerS2 > 100 || c.staticCoefficient > 2 || c.kineticCoefficient < 0 || c.staticCoefficient < c.kineticCoefficient
    || Math.abs(c.pullN) > 1000 || Math.abs(c.targetMPerS) > 1 || stepS <= 0 || stepS > .05 || !Number.isFinite(stepS)) return fail('FRICTION_PARAMETERS');
  let pullN = c.pullN;
  if (c.mode === 'speed') {
    const v = state.velocityMPerS, difference = c.targetMPerS - v, acceleration = Math.max(-.4, Math.min(.4, difference / stepS));
    const direction = Math.sign(v || c.targetMPerS);
    pullN = c.massKg * acceleration + direction * c.kineticCoefficient * c.massKg * c.gravityMPerS2;
    if (v === 0) pullN = c.targetMPerS === 0 ? 0 : Math.sign(c.targetMPerS) * Math.max(Math.abs(pullN), c.staticCoefficient * c.massKg * c.gravityMPerS2 + 1e-8);
  }
  const result = evaluateFriction({ ...c, velocityMPerS: state.velocityMPerS, pullN });
  if (result.status !== 'ok') return fail(result.code);
  return { ok: true as const, ...result.value, steady: result.value.state === 'sliding-steady' && Math.abs(state.velocityMPerS) > 1e-6 && state.steadyS >= .3 && state.driveKey === driveKey(c) };
}
export function stepFriction(c: FrictionConfig, previous: FrictionMotion, stepS: number) {
  const before = frictionForces(c, previous, stepS);
  if (!before.ok) return before;
  if (previous.timeS < 0 || previous.steadyS < 0 || previous.timeS + stepS > 300 || Math.abs(previous.xM) > 1000 || Math.abs(previous.velocityMPerS) > 100) return fail('FRICTION_RANGE');
  let xM = previous.xM, velocityMPerS = previous.velocityMPerS, remaining = stepS;
  const a = before.accelerationMPerS2;
  if (velocityMPerS !== 0 && a * velocityMPerS < 0 && -velocityMPerS / a <= remaining) {
    const stopS = -velocityMPerS / a;
    xM += velocityMPerS * stopS + .5 * a * stopS * stopS; remaining -= stopS; velocityMPerS = 0;
  }
  const rest = evaluateFriction({ ...c, velocityMPerS, pullN: before.pullN });
  if (rest.status !== 'ok') return fail(rest.code);
  xM += velocityMPerS * remaining + .5 * rest.value.accelerationMPerS2 * remaining * remaining;
  velocityMPerS += rest.value.accelerationMPerS2 * remaining;
  if (c.mode === 'speed' && Math.abs(velocityMPerS - c.targetMPerS) <= 1e-12) velocityMPerS = c.targetMPerS;
  if (![xM, velocityMPerS].every(Number.isFinite) || Math.abs(velocityMPerS) > 100 || Math.abs(xM) > 1000) return fail('FRICTION_RANGE');
  const movingSteadily = rest.value.state === 'sliding-steady' && Math.abs(velocityMPerS) > 1e-6;
  const state: FrictionMotion = { xM, velocityMPerS, timeS: previous.timeS + stepS, driveKey: driveKey(c), steadyS: movingSteadily ? (previous.driveKey === driveKey(c) ? previous.steadyS : 0) + stepS : 0 };
  return { ok: true as const, state, appliedPullN: before.pullN };
}
