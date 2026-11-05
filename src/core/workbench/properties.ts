import type { EquipmentInstance } from '../equipment/schema.ts';
import { Pose2DSchema } from '../equipment/schema.ts';
import type { EquipmentRegistry } from '../equipment/registry.ts';
import { convertUnit } from '../units/units.ts';

export interface PropertyDraft { raw: string; applied: number }
export type PropertyDrafts = Record<string, PropertyDraft>;
export function propertyValue(item: EquipmentInstance, key: string): number {
  return key === 'xM' || key === 'yM' ? item.pose[key] : key === 'degrees' ? convertUnit(item.pose.rotationRad, 'rad', 'deg') : Number(item.parameters[key]);
}
export function activePropertyDrafts(item: EquipmentInstance, drafts: PropertyDrafts): PropertyDrafts {
  return Object.fromEntries(Object.entries(drafts).filter(([key, draft]) => Object.is(draft.applied, propertyValue(item, key))));
}
export function propertyCandidate(item: EquipmentInstance, drafts: PropertyDrafts) {
  const pose = { ...item.pose }, parameters = { ...item.parameters };
  for (const [key, draft] of Object.entries(drafts)) {
    const value = draft.raw.trim() === '' ? NaN : Number(draft.raw);
    if (!Number.isFinite(value)) continue;
    if (key === 'xM' || key === 'yM') pose[key] = value;
    else if (key === 'degrees') pose.rotationRad = convertUnit(value, 'deg', 'rad');
    else parameters[key] = value;
  }
  if (item.type === 'mechanical.friction-surface' && ['staticCoefficient', 'kineticCoefficient'].some(key => parameters[key] !== item.parameters[key])) parameters.material = 'custom';
  return { ...item, pose, parameters };
}
export function validPropertyCandidate(item: EquipmentInstance, registry: EquipmentRegistry) {
  const definition = registry.get(item.type, item.definitionVersion);
  return !!definition && Pose2DSchema.safeParse(item.pose).success && registry.validateParameters(definition, item.parameters);
}
export function acknowledgePropertyDrafts(item: EquipmentInstance, drafts: PropertyDrafts): PropertyDrafts {
  return Object.fromEntries(Object.entries(drafts).map(([key, draft]) => {
    const numeric = draft.raw.trim() === '' ? NaN : Number(draft.raw);
    const actual = propertyValue(item, key);
    return [key, Number.isFinite(numeric) && Math.abs(numeric - actual) <= 1e-12 * Math.max(1, Math.abs(actual)) ? { ...draft, applied: actual } : draft];
  }));
}
