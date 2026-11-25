import type { SceneDocument } from '../../core/scene/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { MAGNET } from './definitions.ts';
import { inductionParts } from './model.ts';

export interface MotionBounds { minX: number; maxX: number; minY: number; maxY: number }
export function inductionMotionBounds(scene: SceneDocument, id: string, view: SceneDocument = scene): MotionBounds | null {
  const base = inductionParts(scene), current = inductionParts(view), item = scene.equipment.find(i => i.id === id);
  if (!base.magnet || !current.magnet || !current.wire || !item || ![current.magnet.id, current.wire.id].includes(id)) return null;
  const origin = base.magnet.pose, peer = item.type === MAGNET ? current.wire.pose : current.magnet.pose;
  const bounds = { minX: Math.max(origin.xM - .23, peer.xM - .23), maxX: Math.min(origin.xM + .23, peer.xM + .23),
    minY: Math.max(origin.yM - .055, peer.yM - .055), maxY: Math.min(origin.yM + .055, peer.yM + .055) };
  return bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY ? bounds : null;
}
export function clampInductionPoint(point: WorldPoint, bounds: MotionBounds): WorldPoint {
  return { xM: Math.max(bounds.minX, Math.min(bounds.maxX, point.xM)), yM: Math.max(bounds.minY, Math.min(bounds.maxY, point.yM)) };
}
export function reflectedMotion(position: number, velocity: number, min: number, max: number, seconds: number) {
  if (![position, velocity, min, max, seconds].every(Number.isFinite) || max < min || seconds < 0) throw new RangeError('INVALID_INDUCTION_MOTION');
  if (max === min) return { position: min, velocity: 0 };
  if (velocity === 0 || seconds === 0) return { position: Math.max(min, Math.min(max, position)), velocity };
  const width = max - min, p = Math.max(min, Math.min(max, position)) - min;
  const phase = (velocity > 0 ? p : 2 * width - p) + Math.abs(velocity) * seconds;
  const folded = ((phase % (2 * width)) + 2 * width) % (2 * width);
  return { position: Math.max(min, Math.min(max, folded <= width ? min + folded : max - (folded - width))), velocity: (folded < width ? 1 : -1) * Math.abs(velocity) };
}
export function inductionViewport(scene: SceneDocument, width: number, height: number) {
  const points: WorldPoint[] = [];
  for (const item of scene.equipment) {
    const x = item.pose.xM, y = item.pose.yM;
    const bx = item.type === MAGNET ? .87 : item.parameters.inductionShape ? .44 : .15;
    const by = item.type === MAGNET ? .40 : item.parameters.inductionShape ? .17 : .15;
    points.push({ xM: x - bx, yM: y - by }, { xM: x + bx, yM: y + by });
  }
  for (const wire of scene.connections) for (const p of [...(wire.routeWorldM ?? []), ...(wire.freeFromWorldM ? [wire.freeFromWorldM] : []), ...(wire.freeToWorldM ? [wire.freeToWorldM] : [])]) points.push({ xM: p.x, yM: p.y });
  const minX = Math.min(...points.map(p => p.xM), -.1), maxX = Math.max(...points.map(p => p.xM), .1);
  const minY = Math.min(...points.map(p => p.yM), -.1), maxY = Math.max(...points.map(p => p.yM), .1);
  return { centerXM: (minX + maxX) / 2, centerYM: (minY + maxY) / 2, pixelsPerM: Math.max(100, Math.min(520, (width - 110) / (maxX - minX), (height - 90) / (maxY - minY))) };
}
