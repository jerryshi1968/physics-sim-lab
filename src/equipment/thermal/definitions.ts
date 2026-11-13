import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { BEAKER } from '../density/definitions.ts';
import { SUPPORT } from '../mechanical/definitions.ts';
import { TIMER } from '../projectile/definitions.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const BOILING_EXPERIMENT = 'J-THERM-01', HEATER = 'thermal.heater', THERMOMETER = 'thermal.thermometer';
export const thermalApparatus = [BEAKER, HEATER, THERMOMETER, SUPPORT, TIMER];
export const thermalFields: Record<string, readonly ParameterField[]> = {
  [BEAKER]: [{ key: 'tareKg', label: '烧杯质量', unit: 'kg', kind: 'number' }],
  [HEATER]: [{ key: 'powerW', label: '加热功率', unit: 'W', kind: 'number' }, { key: 'efficiency', label: '加热效率（0～1）', unit: '', kind: 'number' }, { key: 'lossWPerK', label: '散热系数', unit: 'W/K', kind: 'number' }],
  [THERMOMETER]: [{ key: 'resolutionK', label: '分度值', unit: '℃', kind: 'number' }],
  [TIMER]: [{ key: 'resolutionS', label: '计时分度值', unit: 's', kind: 'number' }],
  [SUPPORT]: [{ key: 'heightM', label: '支架高度', unit: 'm', kind: 'number' }],
};
export function registerThermalEquipment(registry: EquipmentRegistry) {
  const items = [
    { type: HEATER, label: '加热装置', defaults: { powerW: 500, efficiency: .7, lossWPerK: .5, initialTemperatureK: 293.15, ambientTemperatureK: 293.15 }, schema: z.strictObject({ powerW: FiniteSchema.min(0).max(2000), efficiency: FiniteSchema.min(0).max(1), lossWPerK: FiniteSchema.min(0).max(10), initialTemperatureK: FiniteSchema.min(273.15).max(373.15), ambientTemperatureK: FiniteSchema.min(273.15).max(313.15) }) },
    { type: THERMOMETER, label: '温度计', defaults: { resolutionK: 1 }, schema: z.strictObject({ resolutionK: FiniteSchema.min(.1).max(5) }) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'thermal', label: item.label, ports: [], parameterSchemaId, defaultParameters: item.defaults, modelAdapterId: 'thermal.boiling.lumped.v1', viewId: `${item.type}.physical.v1` });
  }
}
