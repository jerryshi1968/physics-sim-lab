import { INDUCTION_EXPERIMENT } from '../../equipment/induction/definitions.ts';
import { METAL_WIRE } from '../../equipment/electrical/conductor.ts';
import { PARALLEL_CURRENT_EXPERIMENT, parallelCurrentSetup } from '../../experiments/parallel-current.ts';
import { SERIES_CURRENT_EXPERIMENT, seriesCurrentSetup } from '../../experiments/series-current.ts';
import { HEAT_COMPARISON_EXPERIMENT, heatComparisonLabel } from '../../equipment/heatComparison/simulate.ts';
import { PULLEY, pulleyModes } from '../../equipment/pulley/definitions.ts';
import { KINETIC_EXPERIMENT, kineticLabels } from '../../equipment/kinetic/simulate.ts';
import { TWO_FORCE_EXPERIMENT, twoForceLabels } from '../../equipment/twoForce/simulate.ts';
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
  if (scene.experimentId === INDUCTION_EXPERIMENT && instance?.type === METAL_WIRE) return instance.parameters.inductionShape === 'coil' ? '线圈 AB' : '导体 AB';
  const parallel = scene.experimentId === PARALLEL_CURRENT_EXPERIMENT || scene.experimentId === 'J-ELEC-01' ? parallelCurrentSetup(scene) : null;
  if (parallel?.roles && (scene.experimentId === PARALLEL_CURRENT_EXPERIMENT || parallel.position)) { if (id === parallel.roles.L1) return '灯泡 L1'; if (id === parallel.roles.L2) return '灯泡 L2'; }
  const series = scene.experimentId === SERIES_CURRENT_EXPERIMENT || scene.experimentId === 'J-ELEC-01' ? seriesCurrentSetup(scene) : null;
  if (series?.roles && (scene.experimentId === SERIES_CURRENT_EXPERIMENT || series.position)) { if (id === series.roles.L1) return '灯泡 L1'; if (id === series.roles.L2) return '灯泡 L2'; }
  if (instance && scene.experimentId === HEAT_COMPARISON_EXPERIMENT) return heatComparisonLabel(scene, instance);
  return instance ? `${instance.type === PULLEY && (instance.parameters.mode === 'direct' ? '备用滑轮' : instance.parameters.mode === 'tackle' ? '动滑轮' : pulleyModes[instance.parameters.mode as keyof typeof pulleyModes]) || scene.experimentId === KINETIC_EXPERIMENT && kineticLabels[instance.type] || scene.experimentId === TWO_FORCE_EXPERIMENT && twoForceLabels[instance.type] || scene.experimentId === AVERAGE_SPEED_EXPERIMENT && averageSpeedLabels[instance.type] || registry.get(instance.type, instance.definitionVersion)?.label || '未知器材'} ${index + 1}` : '未知器材';
}

export function endpointLabel(scene: SceneDocument, registry: EquipmentRegistry, endpoint: Endpoint | null): string {
  if (!endpoint) return '未连接';
  return `${equipmentLabel(scene, registry, endpoint.equipmentId)} · ${scene.equipment.find(i => i.id === endpoint.equipmentId)?.type === 'electrical.galvanometer' ? endpoint.portId === 'low' ? '正接线柱 +' : '负接线柱 −' : portLabel(endpoint.portId)}`;
}
