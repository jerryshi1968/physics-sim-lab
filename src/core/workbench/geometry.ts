import type { EquipmentInstance, Pose2D } from '../equipment/schema.ts';
import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { Connection, Endpoint } from '../connections/schema.ts';
import type { SceneDocument } from '../scene/schema.ts';

export interface WorldPoint { xM: number; yM: number }
export interface ScreenPoint { x: number; y: number }
export interface SurfaceSize { width: number; height: number }
export type Viewport = NonNullable<SceneDocument['viewport']>;
export const DEFAULT_VIEWPORT: Readonly<Viewport> = Object.freeze({ centerXM: 0, centerYM: 0, pixelsPerM: 600 });

function validView(view: Viewport, size: SurfaceSize): void {
  if (![view.centerXM, view.centerYM, view.pixelsPerM, size.width, size.height].every(Number.isFinite)
    || view.pixelsPerM <= 0 || size.width <= 0 || size.height <= 0) throw new RangeError('INVALID_VIEWPORT');
}

export function worldToScreen(point: WorldPoint, view: Viewport, size: SurfaceSize): ScreenPoint {
  validView(view, size);
  return { x: size.width / 2 + (point.xM - view.centerXM) * view.pixelsPerM,
    y: size.height / 2 - (point.yM - view.centerYM) * view.pixelsPerM };
}

export function screenToWorld(point: ScreenPoint, view: Viewport, size: SurfaceSize): WorldPoint {
  validView(view, size);
  return { xM: view.centerXM + (point.x - size.width / 2) / view.pixelsPerM,
    yM: view.centerYM - (point.y - size.height / 2) / view.pixelsPerM };
}

export function zoomViewport(view: Viewport, factor: number, anchor: ScreenPoint, size: SurfaceSize): Viewport {
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('INVALID_ZOOM');
  const before = screenToWorld(anchor, view, size);
  const pixelsPerM = Math.min(2400, Math.max(100, view.pixelsPerM * factor));
  const after = screenToWorld(anchor, { ...view, pixelsPerM }, size);
  return { centerXM: view.centerXM + before.xM - after.xM, centerYM: view.centerYM + before.yM - after.yM, pixelsPerM };
}

export function panViewport(view: Viewport, dxPx: number, dyPx: number): Viewport {
  if (![dxPx, dyPx, view.centerXM, view.centerYM, view.pixelsPerM].every(Number.isFinite) || view.pixelsPerM <= 0) {
    throw new RangeError('INVALID_VIEWPORT');
  }
  return { ...view, centerXM: view.centerXM - dxPx / view.pixelsPerM, centerYM: view.centerYM + dyPx / view.pixelsPerM };
}

export function localToWorld(point: { x: number; y: number }, pose: Pose2D): WorldPoint {
  if (pose.flippedX) point = { ...point, x: -point.x };
  const cos = Math.cos(pose.rotationRad);
  const sin = Math.sin(pose.rotationRad);
  return { xM: pose.xM + point.x * cos - point.y * sin, yM: pose.yM + point.x * sin + point.y * cos };
}

export function endpointWorld(endpoint: Endpoint, equipment: readonly EquipmentInstance[], registry: EquipmentRegistry): WorldPoint {
  const instance = equipment.find(item => item.id === endpoint.equipmentId);
  const port = instance && registry.get(instance.type, instance.definitionVersion)?.ports.find(item => item.id === endpoint.portId);
  if (!instance || !port) throw new RangeError('UNKNOWN_ENDPOINT');
  return localToWorld(port.localPositionM, instance.pose);
}

export function wireWorldPoints(connection: Connection, equipment: readonly EquipmentInstance[], registry: EquipmentRegistry): WorldPoint[] {
  return [connection.from ? endpointWorld(connection.from, equipment, registry) : { xM: connection.freeFromWorldM!.x, yM: connection.freeFromWorldM!.y },
    ...(connection.routeWorldM ?? []).map(point => ({ xM: point.x, yM: point.y })),
    connection.to ? endpointWorld(connection.to, equipment, registry) : { xM: connection.freeToWorldM!.x, yM: connection.freeToWorldM!.y }];
}

export function endpointKey(endpoint: Endpoint | null): string {
  return endpoint ? JSON.stringify([endpoint.equipmentId, endpoint.portId]) : 'null';
}
