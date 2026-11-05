import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
export const LAUNCHER = 'mechanical.projectile-launcher', BALL = 'mechanical.projectile-ball', TIMER = 'mechanical.projectile-timer', SCALE = 'mechanical.projectile-scale', GROUND = 'mechanical.projectile-ground', PROJECTILE_EXPERIMENT = 'H-MECH-02';
export const projectileTypes = [LAUNCHER, BALL, TIMER, SCALE, GROUND];
export const projectileFields: Record<string, readonly ParameterField[]> = {
  [LAUNCHER]: [{ key: 'speedMPerS', label: '下次发射初速', unit: 'm/s', kind: 'number' }],
  [TIMER]: [{ key: 'intervalS', label: '下次等时间隔', unit: 's', kind: 'number' }, { key: 'resolutionS', label: '下次计时分度值', unit: 's', kind: 'number' }],
  [SCALE]: [{ key: 'widthM', label: '横尺范围', unit: 'm', kind: 'number' }, { key: 'heightM', label: '竖尺范围', unit: 'm', kind: 'number' }],
  [GROUND]: [{ key: 'lengthM', label: '地面显示长度', unit: 'm', kind: 'number' }],
};
export function registerProjectileEquipment(registry: EquipmentRegistry) {
  const items = [
    { type: LAUNCHER, label: '水平发射器', defaults: { speedMPerS: 2 }, schema: z.strictObject({ speedMPerS: FiniteSchema.min(0).max(20) }) },
    { type: BALL, label: '平抛小球', defaults: { launcherId: '' }, schema: z.strictObject({ launcherId: z.string().max(80) }) },
    { type: TIMER, label: '计时器', defaults: { intervalS: .1, resolutionS: .001 }, schema: z.strictObject({ intervalS: FiniteSchema.min(.001).max(2), resolutionS: FiniteSchema.min(.0001).max(.1) }) },
    { type: SCALE, label: '平抛二维标尺', defaults: { widthM: 2, heightM: 1.4 }, schema: z.strictObject({ widthM: FiniteSchema.min(.2).max(10), heightM: FiniteSchema.min(.2).max(10) }) },
    { type: GROUND, label: '水平地面', defaults: { lengthM: 3.3 }, schema: z.strictObject({ lengthM: FiniteSchema.min(.5).max(50) }) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'mechanical', label: item.label, ports: [], parameterSchemaId, defaultParameters: item.defaults, modelAdapterId: 'mechanical.projectile.analytic.v1', viewId: `${item.type}.physical.v1` });
  }
}
