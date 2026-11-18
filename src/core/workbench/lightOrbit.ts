import type { Pose2D } from '../equipment/schema.ts';
import type { WorldPoint } from './geometry.ts';
export interface OrbitBounds { left: number; right: number; bottom: number; top: number }
export interface LightOrbit { id: string; pose: Pose2D; center: WorldPoint; radiusM: number; startRad: number; minRad: number; maxRad: number }
const turn = 2 * Math.PI;
export function createLightOrbit(id: string, pose: Pose2D, center: WorldPoint, surfaceRad: number, above: boolean, bounds?: OrbitBounds): LightOrbit | null {
  const dx = pose.xM - center.xM, dy = pose.yM - center.yM, radiusM = Math.hypot(dx, dy);
  if (![pose.xM, pose.yM, pose.rotationRad, center.xM, center.yM, surfaceRad, radiusM].every(Number.isFinite) || radiusM < 1e-6) return null;
  let relative = Math.atan2(dy, dx) - surfaceRad;
  relative = Math.atan2(Math.sin(relative), Math.cos(relative));
  if (above && relative < 0) relative += turn;
  if (!above && relative > 0) relative -= turn;
  const startRad = surfaceRad + relative, low = surfaceRad + (above ? Math.PI / 36 : -Math.PI + Math.PI / 36), high = surfaceRad + (above ? Math.PI - Math.PI / 36 : -Math.PI / 36);
  if (relative <= (above ? 0 : -Math.PI) || relative >= (above ? Math.PI : 0)) return null;
  let minRad = Math.min(low, startRad), maxRad = Math.max(high, startRad);
  if (bounds) {
    if (!Object.values(bounds).every(Number.isFinite) || bounds.left >= bounds.right || bounds.bottom >= bounds.top) return null;
    const valid = (angle: number) => { const x = center.xM + radiusM * Math.cos(angle), y = center.yM + radiusM * Math.sin(angle); return x >= bounds.left - 1e-10 && x <= bounds.right + 1e-10 && y >= bounds.bottom - 1e-10 && y <= bounds.top + 1e-10; };
    if (!valid(startRad)) return null;
    const breaks = [minRad, maxRad];
    const addRoots = (value: number, vertical: boolean) => {
      if (Math.abs(value) > 1) return;
      const a = vertical ? Math.asin(value) : Math.acos(value), roots = vertical ? [a, Math.PI - a] : [a, -a];
      for (const root of roots) for (let k = Math.floor((minRad - root) / turn); k <= Math.ceil((maxRad - root) / turn); k++) { const angle = root + k * turn; if (angle > minRad && angle < maxRad) breaks.push(angle); }
    };
    for (const x of [bounds.left, bounds.right]) addRoots((x - center.xM) / radiusM, false);
    for (const y of [bounds.bottom, bounds.top]) addRoots((y - center.yM) / radiusM, true);
    breaks.sort((a, b) => a - b);
    const intervals: { min: number; max: number }[] = [];
    for (let i = 1; i < breaks.length; i++) { const a = breaks[i - 1]!, b = breaks[i]!; if (b - a < 1e-12 || !valid((a + b) / 2)) continue; const previous = intervals.at(-1); if (previous && Math.abs(previous.max - a) < 1e-10) previous.max = b; else intervals.push({ min: a, max: b }); }
    const connected = intervals.find(range => startRad >= range.min - 1e-10 && startRad <= range.max + 1e-10);
    if (!connected) return null;
    minRad = connected.min; maxRad = connected.max;
  }
  return { id, pose: { ...pose }, center: { ...center }, radiusM, startRad, minRad, maxRad };
}
export function lightOrbitPose(orbit: LightOrbit, angleRad: number): Pose2D {
  if (!Number.isFinite(angleRad)) return { ...orbit.pose };
  const angle = Math.max(orbit.minRad, Math.min(orbit.maxRad, angleRad));
  if (Math.abs(angle - orbit.startRad) < 1e-12) return { ...orbit.pose };
  const xM = orbit.center.xM + orbit.radiusM * Math.cos(angle), yM = orbit.center.yM + orbit.radiusM * Math.sin(angle);
  return { ...orbit.pose, xM, yM, rotationRad: Math.atan2(orbit.center.yM - yM, orbit.center.xM - xM) };
}
export const orbitAngleDelta = (next: number, previous: number) => Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
