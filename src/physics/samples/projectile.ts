import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export interface LaunchInput {
  x0M: number;
  y0M: number;
  groundYM: number;
  speedMPerS: number;
  gravityMPerS2: number;
  horizontal: boolean;
}
export interface ProjectileSample {
  timeS: number;
  impactTimeS: number;
  rangeM: number;
  xM: number;
  yM: number;
  horizontalDisplacementM: number;
  dropM: number;
  vxMPerS: number;
  vyMPerS: number;
  state: 'flying' | 'landed';
}
export interface ProjectileLaunch {
  initial: Readonly<LaunchInput>;
  impactTimeS: number;
  sample: (timeS: number) => SampleResult<ProjectileSample>;
}

export function createProjectileLaunch(input: LaunchInput): SampleResult<ProjectileLaunch> {
  const initial = Object.freeze({ ...input });
  const { x0M, y0M, groundYM, speedMPerS, gravityMPerS2, horizontal } = initial;
  if (!finite(x0M, y0M, groundYM, speedMPerS, gravityMPerS2) || gravityMPerS2 <= 0
    || speedMPerS < 0 || y0M <= groundYM) return invalid('INVALID_LAUNCH_PARAMETERS');
  if (!horizontal) return invalid('NON_HORIZONTAL_LAUNCH');
  const heightM = y0M - groundYM;
  const impactTimeS = Math.sqrt(2 * (heightM / gravityMPerS2));
  const rangeM = speedMPerS * impactTimeS;
  if (!finite(heightM, impactTimeS, rangeM) || impactTimeS <= 0) return invalid('NUMERIC_RANGE');
  return success({ initial, impactTimeS, sample(timeS: number): SampleResult<ProjectileSample> {
    if (!finite(timeS) || timeS < 0) return invalid('INVALID_SAMPLE_TIME');
    const t = Math.min(timeS, impactTimeS);
    const landed = timeS >= impactTimeS;
    const horizontalDisplacementM = speedMPerS * t;
    const dropM = landed ? heightM : gravityMPerS2 * t * t / 2;
    return success({ timeS: t, impactTimeS, rangeM, xM: x0M + horizontalDisplacementM,
      yM: landed ? groundYM : y0M - dropM, horizontalDisplacementM, dropM,
      vxMPerS: speedMPerS, vyMPerS: 0 - gravityMPerS2 * t, state: landed ? 'landed' : 'flying' });
  } });
}
