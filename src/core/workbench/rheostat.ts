import type { Pose2D } from '../equipment/schema.ts';
import type { WorldPoint } from './geometry.ts';

export const RHEOSTAT_TRACK_START_M = -.045;
export const RHEOSTAT_TRACK_LENGTH_M = .09;

export function rheostatWiperXM(position: number): number {
  return RHEOSTAT_TRACK_START_M + RHEOSTAT_TRACK_LENGTH_M * position;
}

export function rheostatLocalXM(point: WorldPoint, pose: Pose2D): number {
  const value = ((point.xM - pose.xM) * Math.cos(pose.rotationRad) + (point.yM - pose.yM) * Math.sin(pose.rotationRad)) * (pose.flippedX ? -1 : 1);
  if (!Number.isFinite(value)) throw new RangeError('INVALID_RHEOSTAT_POINTER');
  return value;
}

export function rheostatPointerPosition(point: WorldPoint, pose: Pose2D, grabOffsetXM: number): number {
  const position = (rheostatLocalXM(point, pose) - grabOffsetXM - RHEOSTAT_TRACK_START_M) / RHEOSTAT_TRACK_LENGTH_M;
  if (!Number.isFinite(position)) throw new RangeError('INVALID_RHEOSTAT_POINTER');
  return Math.max(0, Math.min(1, position));
}
