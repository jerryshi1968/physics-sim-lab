import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const LEVER = 'mechanical.lever', SUPPORT = 'mechanical.support', WEIGHT = 'mechanical.weights', FORCE_METER = 'mechanical.force-meter', MECHANICAL_RULER = 'mechanical.ruler';
export function mechanicalLabel(scene: { equipment: readonly EquipmentInstance[] }, id: string) {
  const index = scene.equipment.findIndex(item => item.id === id), labels: Record<string, string> = { [LEVER]: '杠杆', [SUPPORT]: '支架', [WEIGHT]: '钩码', [FORCE_METER]: '弹簧测力计', [MECHANICAL_RULER]: '独立刻度尺', 'mechanical.pendulum': '单摆', 'mechanical.spring': '弹簧', 'mechanical.projectile-launcher': '发射器', 'mechanical.projectile-ball': '小球', 'mechanical.projectile-timer': '计时器', 'mechanical.projectile-scale': '二维标尺', 'mechanical.projectile-ground': '地面' };
  return index >= 0 ? `${labels[scene.equipment[index]!.type] ?? '器材'} ${index + 1}` : id.endsWith(':self') ? '杆自重' : id.endsWith(':nut-left') ? '左端平衡螺母' : id.endsWith(':nut-right') ? '右端平衡螺母' : id.endsWith(':trim') ? '调平螺母' : '未挂接器材';
}
export const mechanicalParameterFields: Record<string, readonly ParameterField[]> = {
  [LEVER]: [{ key: 'spacingM', label: '挂点间距', unit: 'm', kind: 'number' }, { key: 'halfHooks', label: '每侧挂点数', unit: '', kind: 'number' }, { key: 'pivotIndex', label: '支点挂点编号', unit: '', kind: 'number' }, { key: 'includeSelfWeight', label: '计入杠杆自重', unit: '', kind: 'boolean' }, { key: 'massKg', label: '杠杆质量', unit: 'kg', kind: 'number' }, { key: 'comOffsetM', label: '杆质心距中点', unit: 'm', kind: 'number' }],
  [SUPPORT]: [{ key: 'heightM', label: '支架高度', unit: 'm', kind: 'number' }, { key: 'capacityN', label: '支点反力上限', unit: 'N', kind: 'number' }],
  [WEIGHT]: [{ key: 'massKg', label: '钩码总质量', unit: 'kg', kind: 'number' }],
  [FORCE_METER]: [{ key: 'forceN', label: '施加拉力', unit: 'N', kind: 'number' }, { key: 'directionDeg', label: '拉力方向（右为0，上为90）', unit: '°', kind: 'number' }, { key: 'rangeN', label: '测力计量程', unit: 'N', kind: 'number' }, { key: 'resolutionN', label: '测力计分度值', unit: 'N', kind: 'number' }],
  [MECHANICAL_RULER]: [{ key: 'lengthM', label: '刻度尺长度', unit: 'm', kind: 'number' }],
};
export function registerMechanicalEquipment(registry: EquipmentRegistry) {
  const presentParameters = (parameters: Record<string, Scalar | undefined>): Record<string, Scalar> => Object.fromEntries(Object.entries(parameters).filter((entry): entry is [string, Scalar] => entry[1] !== undefined));
  const attachment = { leverId: z.string().max(80), hookIndex: z.number().int().min(-10).max(10) };
  const items = [
    { type: LEVER, label: '杠杆', defaults: { spacingM: .05, halfHooks: 6, pivotIndex: 0, supportId: '', trimPositionM: .02, trimMassKg: .02, includeSelfWeight: false, massKg: .1, comOffsetM: .002, zeroReference: '', leftNutOffsetM: .02, rightNutOffsetM: .02 },
      schema: z.strictObject({ spacingM: FiniteSchema.min(.01).max(.1), halfHooks: z.number().int().min(2).max(10), pivotIndex: z.number().int().min(-10).max(10), supportId: z.string().max(80), trimPositionM: FiniteSchema.min(-1).max(1), trimMassKg: FiniteSchema.min(0).max(.5), includeSelfWeight: z.boolean(), massKg: FiniteSchema.min(0).max(2), comOffsetM: FiniteSchema.min(-1).max(1), zeroReference: z.string().max(1000), leftNutOffsetM: FiniteSchema.min(0).max(.06).optional(), rightNutOffsetM: FiniteSchema.min(0).max(.06).optional() }).transform(presentParameters) },
    { type: SUPPORT, label: '支架', defaults: { heightM: .32, capacityN: 100 }, schema: z.strictObject({ heightM: FiniteSchema.min(.1).max(.8), capacityN: FiniteSchema.min(1).max(200) }) },
    { type: WEIGHT, label: '钩码', defaults: { massKg: .1, leverId: '', hookIndex: 0 }, schema: z.strictObject({ massKg: FiniteSchema.positive().max(2), ...attachment, parentWeightId: z.string().max(80).optional(), springId: z.string().max(80).optional() }).transform(presentParameters) },
    { type: FORCE_METER, label: '弹簧测力计', defaults: { forceN: 0, directionDeg: -90, rangeN: 5, resolutionN: .1, leverId: '', hookIndex: 0 }, schema: z.strictObject({ forceN: FiniteSchema.min(0).max(100), directionDeg: FiniteSchema.min(-360).max(360), rangeN: FiniteSchema.min(.1).max(50), resolutionN: FiniteSchema.min(.001).max(1), ...attachment, supportId: z.string().max(80).optional(), mountHeightM: FiniteSchema.min(.05).max(.8).optional() }).transform(presentParameters) },
    { type: MECHANICAL_RULER, label: '独立刻度尺', defaults: { lengthM: 1 }, schema: z.strictObject({ lengthM: FiniteSchema.min(.05).max(1.2) }) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'mechanical', label: item.label, ports: [], parameterSchemaId,
      defaultParameters: item.defaults, modelAdapterId: `${item.type}.statics.v1`, viewId: `${item.type}.physical.v1` });
  }
}
