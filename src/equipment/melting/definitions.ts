import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { thermalApparatus } from '../thermal/definitions.ts';
export const MELTING_EXPERIMENT = 'J-THERM-02', TUBE = 'thermal.melting-tube';
export const meltingApparatus = [...thermalApparatus, TUBE];
export const materialLabels = { hypo: '海波', wax: '石蜡' } as const;
export type MeltingMaterial = keyof typeof materialLabels;
export const meltingMaterials = {
  hypo: { solidC: 2000, liquidC: 2400, latent: 200000, startK: 321.15, endK: 321.15 },
  wax: { solidC: 2100, liquidC: 2300, latent: 160000, startK: 318.15, endK: 333.15 },
} as const;
export function registerMeltingEquipment(registry: EquipmentRegistry) {
  registry.registerParameterSchema(`${TUBE}.parameters.v1`, z.strictObject({ material: z.enum(['hypo','wax']), massKg: FiniteSchema.min(.005).max(.05), initialTemperatureK: FiniteSchema.min(273.15).max(313.15), transferWPerK: FiniteSchema.min(0).max(5) }));
  registry.register({ type: TUBE, definitionVersion: 1, domain: 'thermal', label: '试管（熔化样品）', ports: [], parameterSchemaId: `${TUBE}.parameters.v1`, defaultParameters: { material: 'hypo', massKg: .02, initialTemperatureK: 293.15, transferWPerK: .8 }, modelAdapterId: 'thermal.melting.enthalpy.v1', viewId: `${TUBE}.physical.v1` });
}
