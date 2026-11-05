import type { Connection, Endpoint } from '../connections/schema.ts';
import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { EquipmentInstance } from '../equipment/schema.ts';
import { endpointWorld } from './geometry.ts';
import type { WorldPoint } from './geometry.ts';

export function nearestElectricalPort(point: WorldPoint, equipment: readonly EquipmentInstance[], registry: EquipmentRegistry,
  radiusM: number): Endpoint | null {
  let nearest: Endpoint | null = null;
  let distance = radiusM;
  for (const instance of equipment) {
    for (const port of registry.get(instance.type, instance.definitionVersion)?.ports ?? []) {
      if (port.kind !== 'electrical-terminal') continue;
      const endpoint = { equipmentId: instance.id, portId: port.id };
      const position = endpointWorld(endpoint, equipment, registry);
      const gap = Math.hypot(point.xM - position.xM, point.yM - position.yM);
      if (gap <= distance) { distance = gap; nearest = endpoint; }
    }
  }
  return nearest;
}

export function translateLooseWire(wire: Connection, delta: WorldPoint): Connection {
  if (wire.from || wire.to) throw new RangeError('WIRE_HAS_ATTACHED_END');
  return { ...wire,
    freeFromWorldM: { x: wire.freeFromWorldM!.x + delta.xM, y: wire.freeFromWorldM!.y + delta.yM },
    freeToWorldM: { x: wire.freeToWorldM!.x + delta.xM, y: wire.freeToWorldM!.y + delta.yM },
    routeWorldM: (wire.routeWorldM ?? []).map(point => ({ x: point.x + delta.xM, y: point.y + delta.yM })) };
}

export function curvedWirePath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let path = `M${points[0]!.x},${points[0]!.y}`;
  if (points.length === 2) {
    const first = points[0]!;
    const last = points[1]!;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.hypot(dx, dy);
    const slack = Math.min(50, length * 0.18);
    const nx = length === 0 ? 0 : -dy / length * slack;
    const ny = length === 0 ? 0 : dx / length * slack;
    return `${path} C${first.x + dx / 3 + nx},${first.y + dy / 3 + ny} ${first.x + 2 * dx / 3 + nx},${first.y + 2 * dy / 3 + ny} ${last.x},${last.y}`;
  }
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[Math.max(0, index - 1)]!;
    const point = points[index]!;
    const next = points[index + 1]!;
    const after = points[Math.min(points.length - 1, index + 2)]!;
    path += ` C${point.x + (next.x - previous.x) / 6},${point.y + (next.y - previous.y) / 6} ${next.x - (after.x - point.x) / 6},${next.y - (after.y - point.y) / 6} ${next.x},${next.y}`;
  }
  return path;
}
