import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { SceneDocument } from '../scene/schema.ts';
import { endpointKey } from './geometry.ts';

export function wiringNodes(document: SceneDocument, registry: EquipmentRegistry): string[][] {
  const parent = new Map<string, string>();
  function root(key: string): string {
    const current = parent.get(key);
    if (!current) throw new RangeError('UNKNOWN_ENDPOINT');
    if (current === key) return key;
    const representative = root(current);
    parent.set(key, representative);
    return representative;
  }
  for (const instance of document.equipment) {
    const definition = registry.get(instance.type, instance.definitionVersion);
    if (!definition) throw new RangeError('UNKNOWN_EQUIPMENT_VERSION');
    for (const port of definition.ports) {
      if (port.kind !== 'electrical-terminal') continue;
      const key = endpointKey({ equipmentId: instance.id, portId: port.id });
      parent.set(key, key);
    }
  }
  for (const wire of document.connections) {
    if (wire.kind !== 'wire' || !wire.from || !wire.to) continue;
    const a = root(endpointKey(wire.from));
    const b = root(endpointKey(wire.to));
    if (a !== b) parent.set(b, a);
  }
  const groups = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const representative = root(key);
    const group = groups.get(representative) ?? [];
    group.push(key);
    groups.set(representative, group);
  }
  return [...groups.values()].map(group => group.sort()).sort((a, b) => a[0]!.localeCompare(b[0]!));
}
