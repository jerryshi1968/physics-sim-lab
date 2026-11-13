import { AVERAGE_SPEED_EXPERIMENT, averageSpeedLabels } from '../../equipment/averageSpeed/definitions.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { portLabel } from '../../equipment/electrical/definitions.ts';
import type { Endpoint } from '../../core/connections/schema.ts';

export type Selection = { kind: 'equipment' | 'connection'; id: string } | { kind: 'equipment-group'; ids: string[] } | null;
export interface WireEndSelection { wireId: string; side: 'from' | 'to' }

export function equipmentSelectionIds(selection: Selection): string[] {
  return selection?.kind === 'equipment-group' ? selection.ids : selection?.kind === 'equipment' ? [selection.id] : [];
}

export function changeSelection(current: Selection, next: Selection, additive = false): Selection {
  if (!additive || next?.kind !== 'equipment') return next;
  const ids = equipmentSelectionIds(current);
  const selected = ids.includes(next.id) ? ids.filter(id => id !== next.id) : [...ids, next.id];
  return selected.length > 1 ? { kind: 'equipment-group', ids: selected } : selected.length ? { kind: 'equipment', id: selected[0]! } : null;
}

export function equipmentLabel(scene: SceneDocument, registry: EquipmentRegistry, id: string): string {
  const index = scene.equipment.findIndex(item => item.id === id);
  const instance = scene.equipment[index];
  return instance ? `${scene.experimentId === AVERAGE_SPEED_EXPERIMENT && averageSpeedLabels[instance.type] || registry.get(instance.type, instance.definitionVersion)?.label || '未知器材'} ${index + 1}` : '未知器材';
}

export function endpointLabel(scene: SceneDocument, registry: EquipmentRegistry, endpoint: Endpoint | null): string {
  if (!endpoint) return '未连接';
  return `${equipmentLabel(scene, registry, endpoint.equipmentId)} · ${portLabel(endpoint.portId)}`;
}
