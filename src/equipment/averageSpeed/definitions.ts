import { z } from 'zod';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
import { CART, TRACK } from '../cart/definitions.ts';
import { BLOCK } from '../mechanical/frictionDefinitions.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { TIMER } from '../projectile/definitions.ts';
export const AVERAGE_SPEED_EXPERIMENT = 'J-MECH-04', STOP = 'mechanical.metal-stop';
export const averageSpeedApparatus = [TRACK, CART, STOP, BLOCK, MECHANICAL_RULER, TIMER];
export const averageSpeedLabels: Record<string, string> = { [TRACK]: '斜面', [CART]: '小车', [BLOCK]: '垫高木块', [TIMER]: '停表' };
export const averageSpeedFields: Record<string, readonly ParameterField[]> = {
  [TRACK]: [{ key: 'lengthM', label: '斜面长度', unit: 'm', kind: 'number' }],
  [CART]: [{ key: 'cartMassKg', label: '小车质量', unit: 'kg', kind: 'number' }],
  [STOP]: [], [BLOCK]: [],
  [MECHANICAL_RULER]: [{ key: 'lengthM', label: '刻度尺长度', unit: 'm', kind: 'number' }],
  [TIMER]: [{ key: 'resolutionS', label: '停表分度值', unit: 's', kind: 'number' }],
};
export function registerAverageSpeedEquipment(registry: EquipmentRegistry) {
  registry.registerParameterSchema(`${STOP}.parameters.v1`, z.strictObject({}));
  registry.register({ type: STOP, definitionVersion: 1, domain: 'mechanical', label: '金属挡片', ports: [], parameterSchemaId: `${STOP}.parameters.v1`, defaultParameters: {}, modelAdapterId: 'mechanical.average-speed.analytic.v1', viewId: `${STOP}.physical.v1` });
}
