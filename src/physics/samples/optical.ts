import { finite, invalid, success } from './result.ts';
import type { SampleResult } from './result.ts';

export type LensImage =
  | { kind: 'no-finite-image'; imageDistanceM: null; magnification: null; nearFocus: true }
  | { kind: 'real' | 'virtual'; imageDistanceM: number; magnification: number; nearFocus: boolean };

export function solveThinLens(focalLengthM: number, objectDistanceM: number): SampleResult<LensImage> {
  if (!finite(focalLengthM, objectDistanceM) || focalLengthM <= 0 || objectDistanceM <= 0) {
    return invalid('INVALID_LENS_PARAMETERS');
  }
  if (objectDistanceM === focalLengthM) {
    return success({ kind: 'no-finite-image', imageDistanceM: null, magnification: null, nearFocus: true });
  }
  const relativeGap = (objectDistanceM - focalLengthM) / focalLengthM;
  if (!finite(relativeGap) || relativeGap === 0) return invalid('NUMERIC_RANGE');
  const magnification = -1 / relativeGap;
  const imageDistanceM = -objectDistanceM * magnification;
  return success({ kind: objectDistanceM > focalLengthM ? 'real' : 'virtual',
    imageDistanceM, magnification, nearFocus: Math.abs(relativeGap) <= 1e-8 });
}
