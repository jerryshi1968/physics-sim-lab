import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export interface SpringInput {
  originalLengthM: number;
  stiffnessNPerM: number;
  hangingMassKg: number;
  trayMassKg: number;
  gravityMPerS2: number;
  maxExtensionM: number;
  ratedLoadN: number;
  supported: boolean;
  transitioning: boolean;
}

export function solveSpring(input: SpringInput): SampleResult<{
  forceN: number; extensionM: number; lengthM: number; totalMassKg: number;
}> {
  const { originalLengthM, stiffnessNPerM, hangingMassKg, trayMassKg, gravityMPerS2,
    maxExtensionM, ratedLoadN, supported, transitioning } = input;
  if (!finite(originalLengthM, stiffnessNPerM, hangingMassKg, trayMassKg, gravityMPerS2, maxExtensionM, ratedLoadN)
    || originalLengthM <= 0 || stiffnessNPerM <= 0 || hangingMassKg < 0 || trayMassKg < 0
    || gravityMPerS2 <= 0 || maxExtensionM < 0 || ratedLoadN <= 0) return invalid('INVALID_SPRING_PARAMETERS');
  if (!supported) return invalid('MISSING_SUPPORT');
  if (transitioning) return invalid('TRANSITIONING');
  const totalMassKg = hangingMassKg + trayMassKg;
  const forceN = totalMassKg * gravityMPerS2;
  const extensionM = forceN / stiffnessNPerM;
  if (!finite(totalMassKg, forceN, extensionM)) return invalid('NUMERIC_RANGE');
  const extensionRoundoffM = 8 * Number.EPSILON * Math.max(extensionM, maxExtensionM);
  const forceRoundoffN = 8 * Number.EPSILON * Math.max(forceN, ratedLoadN);
  if (forceN - ratedLoadN > forceRoundoffN) return invalid('RATED_LOAD_EXCEEDED');
  if (extensionM - maxExtensionM > extensionRoundoffM) return invalid('LINEAR_RANGE_EXCEEDED');
  return success({ totalMassKg, forceN, extensionM, lengthM: originalLengthM + extensionM });
}
