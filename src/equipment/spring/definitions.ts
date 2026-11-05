import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const SPRING = 'mechanical.spring', SPRING_EXPERIMENT = 'H-MECH-01';
export const springFields: readonly ParameterField[] = [
  { key: 'originalLengthM', label: '弹簧原长', unit: 'm', kind: 'number' },
  { key: 'stiffnessNPerM', label: '劲度系数', unit: 'N/m', kind: 'number' },
  { key: 'trayMassKg', label: '挂载盘质量', unit: 'kg', kind: 'number' },
  { key: 'maxExtensionM', label: '最大线性伸长', unit: 'm', kind: 'number' },
  { key: 'ratedLoadN', label: '额定载荷', unit: 'N', kind: 'number' },
];
export function registerSpringEquipment(registry: EquipmentRegistry) {
  const parameterSchemaId = `${SPRING}.parameters.v1`;
  registry.registerParameterSchema(parameterSchemaId, z.strictObject({ supportId: z.string().max(80), originalLengthM: FiniteSchema.min(.02).max(.5), stiffnessNPerM: FiniteSchema.min(.1).max(1000), trayMassKg: FiniteSchema.min(0).max(2), maxExtensionM: FiniteSchema.min(0).max(.5), ratedLoadN: FiniteSchema.positive().max(100) }));
  registry.register({ type: SPRING, definitionVersion: 1, domain: 'mechanical', label: '弹簧', ports: [], parameterSchemaId,
    defaultParameters: { supportId: '', originalLengthM: .1, stiffnessNPerM: 20, trayMassKg: 0, maxExtensionM: .06, ratedLoadN: 1.2 }, modelAdapterId: 'mechanical.spring.statics.v1', viewId: 'mechanical.spring.physical.v1' });
}
