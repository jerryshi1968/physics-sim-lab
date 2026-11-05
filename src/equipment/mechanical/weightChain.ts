import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { WEIGHT, LEVER } from './definitions.ts';

export const weightDiscs = (item: EquipmentInstance) => Math.min(6, Math.max(1, Math.round(Number(item.parameters.massKg) / .05)));
export const weightHookDrop = (item: EquipmentInstance) => .053 + (weightDiscs(item) - 1) * .011;
export const weightBottom = (item: EquipmentInstance) => ({ xM: item.pose.xM, yM: item.pose.yM - weightHookDrop(item) });

export function weightChainIssue(items: readonly EquipmentInstance[]) {
  const byId = new Map(items.map(item => [item.id, item])), children = new Set<string>(), hooks = new Set<string>();
  for (const item of items.filter(item => item.type === WEIGHT)) {
    const parentId = String(item.parameters.parentWeightId ?? '');
    if (!parentId) {
      if (item.parameters.leverId) {
        const key = JSON.stringify([item.parameters.leverId, item.parameters.hookIndex]);
        if (hooks.has(key)) return 'WEIGHT_HOOK_OCCUPIED';
        hooks.add(key);
      }
      continue;
    }
    if (item.parameters.leverId || byId.get(parentId)?.type !== WEIGHT) return 'WEIGHT_CHAIN_REFERENCE';
    if (children.has(parentId)) return 'WEIGHT_CHAIN_BRANCH';
    children.add(parentId);
    const seen = new Set([item.id]); let cursor = parentId;
    while (cursor) {
      if (seen.has(cursor)) return 'WEIGHT_CHAIN_CYCLE';
      seen.add(cursor); cursor = String(byId.get(cursor)?.parameters.parentWeightId ?? '');
    }
  }
  return null;
}

export function weightParents(items: readonly EquipmentInstance[]) {
  const parents = new Map<string, string>(), occupied = new Map<string, string>();
  for (const item of items.filter(item => item.type === WEIGHT)) {
    if (item.parameters.parentWeightId) parents.set(item.id, String(item.parameters.parentWeightId));
  }
  // 旧文档同一挂点的独立钩码按原器材顺序显示为一串，不改写保存的引用。
  for (const item of items.filter(item => item.type === WEIGHT && item.parameters.leverId && !item.parameters.parentWeightId)) {
    const key = JSON.stringify([item.parameters.leverId, item.parameters.hookIndex]), previous = occupied.get(key);
    if (previous) {
      let tail = previous; const seen = new Set<string>();
      while (!seen.has(tail)) {
        seen.add(tail); const child = [...parents].find(([, parent]) => parent === tail)?.[0];
        if (!child) break;
        tail = child;
      }
      parents.set(item.id, tail);
    }
    occupied.set(key, item.id);
  }
  return parents;
}

export function weightRoot(items: readonly EquipmentInstance[], item: EquipmentInstance) {
  const byId = new Map(items.map(value => [value.id, value])), seen = new Set<string>(); let root = item;
  while (root.type === WEIGHT && root.parameters.parentWeightId) {
    if (seen.has(root.id)) return null;
    seen.add(root.id); const parent = byId.get(String(root.parameters.parentWeightId));
    if (!parent || parent.type !== WEIGHT) return null;
    root = parent;
  }
  return root;
}

export function positionWeightChains(items: readonly EquipmentInstance[]) {
  const parents = weightParents(items), byId = new Map(items.map(item => [item.id, item])), positioned = new Map<string, EquipmentInstance>();
  for (const item of items) {
    const path: EquipmentInstance[] = [], seen = new Set<string>(); let cursor: EquipmentInstance | undefined = item;
    while (cursor && !positioned.has(cursor.id) && !seen.has(cursor.id)) {
      seen.add(cursor.id); path.push(cursor); cursor = byId.get(parents.get(cursor.id) ?? '');
    }
    for (const current of path.reverse()) {
      const parent = positioned.get(parents.get(current.id) ?? '');
      positioned.set(current.id, parent ? { ...current, pose: { ...current.pose, ...weightBottom(parent) } } : current);
    }
  }
  return items.map(item => positioned.get(item.id)!);
}

export function weightDescendants(items: readonly EquipmentInstance[], id: string) {
  const parents = weightParents(items), found = new Set([id]);
  let size = 0;
  while (size !== found.size) {
    size = found.size;
    for (const [child, parent] of parents) if (found.has(parent)) found.add(child);
  }
  return found;
}

export function occupiedWeightHook(items: readonly EquipmentInstance[], id: string, leverId: string, hookIndex: number) {
  return !!leverId && items.some(item => item.type === WEIGHT && item.id !== id && item.parameters.leverId === leverId && !item.parameters.parentWeightId && Number(item.parameters.hookIndex) === hookIndex);
}

export function weightAttachment(scene: SceneDocument, item: EquipmentInstance, leverId: string, hookIndex: number, parentWeightId = ''): Record<string, Scalar> | null {
  const excluded = weightDescendants(scene.equipment, item.id), available = scene.equipment.filter(value => !excluded.has(value.id)), parents = weightParents(available);
  if (!parentWeightId && occupiedWeightHook(scene.equipment, item.id, leverId, hookIndex)) return null;
  let parent = parentWeightId ? available.find(value => value.type === WEIGHT && value.id === parentWeightId) : undefined;
  const seen = new Set<string>();
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); const next = available.find(value => parents.get(value.id) === parent!.id);
    if (!next) break;
    parent = next;
  }
  return { ...item.parameters, leverId: parent ? '' : leverId, hookIndex: parent ? 0 : hookIndex, parentWeightId: parent?.id ?? '' };
}

export function detachedWeightUpdates(scene: SceneDocument, removedIds: readonly string[], visible: SceneDocument) {
  const removed = new Set(removedIds), parents = weightParents(scene.equipment);
  return scene.equipment.filter(item => item.type === WEIGHT && !removed.has(item.id) && removed.has(parents.get(item.id) ?? '')).map(item => ({
    id: item.id, pose: { ...(visible.equipment.find(value => value.id === item.id) ?? item).pose },
    parameters: { ...item.parameters, parentWeightId: '', leverId: '' },
  }));
}

export function validWeightTargets(scene: SceneDocument, item: EquipmentInstance) {
  const excluded = weightDescendants(scene.equipment, item.id);
  return scene.equipment.filter(value => value.type === WEIGHT && !excluded.has(value.id));
}

export function weightMount(items: readonly EquipmentInstance[], item: EquipmentInstance) {
  const root = weightRoot(items, item);
  return root && items.some(value => value.type === LEVER && value.id === root.parameters.leverId) ? { leverId: String(root.parameters.leverId), hookIndex: Number(root.parameters.hookIndex) } : null;
}
