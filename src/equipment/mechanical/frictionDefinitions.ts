import { z } from 'zod';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const FRICTION_EXPERIMENT = 'J-MECH-01';
export const BLOCK = 'mechanical.friction-block', SURFACE = 'mechanical.friction-surface', DRIVE = 'mechanical.friction-drive', LOAD = 'mechanical.friction-load';
export const frictionTypes = [BLOCK, SURFACE, DRIVE, LOAD];
export const frictionLabels: Record<string, string> = { [BLOCK]: '木块', [SURFACE]: '接触面', [DRIVE]: '牵引器', [LOAD]: '砝码' };
export const materials = { board: { label: '木块—木板', mus: .3, muk: .2 }, cloth: { label: '木块—布面', mus: .5, muk: .4 }, rough: { label: '木块—粗糙面', mus: .6, muk: .45 } } as const;
export const frictionParameterFields: Record<string, readonly ParameterField[]> = {
  [BLOCK]: [{ key: 'massKg', label: '木块质量', unit: 'kg', kind: 'number' }, { key: 'areaM2', label: '接触面积', unit: 'm²', kind: 'number' }, { key: 'widthM', label: '木块宽度', unit: 'm', kind: 'number' }, { key: 'heightM', label: '木块高度', unit: 'm', kind: 'number' }],
  [SURFACE]: [{ key: 'lengthM', label: '接触面长度', unit: 'm', kind: 'number' }, { key: 'staticCoefficient', label: '静摩擦系数', unit: '', kind: 'number' }, { key: 'kineticCoefficient', label: '滑动摩擦系数', unit: '', kind: 'number' }],
  [DRIVE]: [{ key: 'pullN', label: '控制拉力（右正左负）', unit: 'N', kind: 'number' }, { key: 'targetMPerS', label: '目标速度（右正左负）', unit: 'm/s', kind: 'number' }, { key: 'initialMPerS', label: '初速度', unit: 'm/s', kind: 'number' }],
  [LOAD]: [{ key: 'massKg', label: '砝码质量', unit: 'kg', kind: 'number' }],
};
export function registerFrictionEquipment(registry: EquipmentRegistry) {
  const id = z.string().max(80);
  const definitions = [
    { type: BLOCK, defaults: { massKg: .5, areaM2: .008, widthM: .16, heightM: .08, surfaceId: '', driverId: '', meterId: '', material: 'wood' }, schema: z.strictObject({ massKg: FiniteSchema.positive().max(10), areaM2: FiniteSchema.min(.0001).max(.1), widthM: FiniteSchema.min(.04).max(.4), heightM: FiniteSchema.min(.02).max(.3), surfaceId: id, driverId: id, meterId: id, material: z.string().max(40) }) },
    { type: SURFACE, defaults: { lengthM: 3, staticCoefficient: .3, kineticCoefficient: .2, material: 'board' }, schema: z.strictObject({ lengthM: FiniteSchema.min(.5).max(10), staticCoefficient: FiniteSchema.min(0).max(2), kineticCoefficient: FiniteSchema.min(0).max(2), material: z.enum(['board', 'cloth', 'rough', 'custom']) }) },
    { type: DRIVE, defaults: { mode: 'speed', pullN: 0, targetMPerS: .1, initialMPerS: 0 }, schema: z.strictObject({ mode: z.enum(['speed', 'force']), pullN: FiniteSchema.min(-1000).max(1000), targetMPerS: FiniteSchema.min(-1).max(1), initialMPerS: FiniteSchema.min(-5).max(5) }) },
    { type: LOAD, defaults: { massKg: .5, blockId: '' }, schema: z.strictObject({ massKg: FiniteSchema.positive().max(5), blockId: id }) },
  ];
  for (const item of definitions) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'mechanical', label: frictionLabels[item.type]!, ports: [], parameterSchemaId, defaultParameters: item.defaults, modelAdapterId: 'mechanical.friction.v1', viewId: `${item.type}.physical.v1` });
  }
}
