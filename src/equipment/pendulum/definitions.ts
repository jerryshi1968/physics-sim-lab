import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const PENDULUM = 'mechanical.pendulum', PENDULUM_EXPERIMENT = 'H-MECH-04';
export const pendulumFields: readonly ParameterField[] = [
  { key: 'stringLengthM', label: '摆线长度（悬点到球面）', unit: 'm', kind: 'number' },
  { key: 'bobRadiusM', label: '摆球半径', unit: 'm', kind: 'number' },
  { key: 'massKg', label: '摆球质量', unit: 'kg', kind: 'number' },
  { key: 'initialAngleDeg', label: '释放摆角（相对竖直）', unit: '°', kind: 'number' },
];
export function registerPendulumEquipment(registry: EquipmentRegistry) {
  const parameterSchemaId = `${PENDULUM}.parameters.v1`;
  registry.registerParameterSchema(parameterSchemaId, z.strictObject({ supportId: z.string().max(80), stringLengthM: FiniteSchema.min(.08).max(.7), bobRadiusM: FiniteSchema.min(.005).max(.025), massKg: FiniteSchema.min(.005).max(.2), initialAngleDeg: FiniteSchema.min(-60).max(60) }));
  registry.register({ type: PENDULUM, definitionVersion: 1, domain: 'mechanical', label: '单摆', ports: [], parameterSchemaId,
    defaultParameters: { supportId: '', stringLengthM: .49, bobRadiusM: .01, massKg: .05, initialAngleDeg: 5 }, modelAdapterId: 'mechanical.pendulum.nonlinear.v1', viewId: 'mechanical.pendulum.physical.v1' });
}
