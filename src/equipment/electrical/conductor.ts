import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';

export const METAL_WIRE = 'electrical.metal-wire';
export const CONDUCTOR_EXPERIMENT = 'J-ELEC-05';
export const metalMaterials = {
  nichrome: { label: '镍铬合金', rho: 1e-6, alpha: .0004, color: '#827a68' },
  constantan: { label: '康铜', rho: 4.9e-7, alpha: .00003, color: '#b47b50' },
  iron: { label: '铁', rho: 9.71e-8, alpha: .0065, color: '#657882' },
} as const;
export const MetalWireSchema = z.strictObject({
  material: z.enum(['nichrome', 'constantan', 'iron']),
  lengthM: FiniteSchema.min(.2).max(2),
  areaM2: FiniteSchema.min(5e-8).max(4e-7),
  temperatureK: FiniteSchema.min(293.15).max(353.15),
});
export type MetalWireParameters = z.infer<typeof MetalWireSchema>;
export const metalSamples = [
  { id: 'A', label: 'A · 镍铬丝，50 cm，0.10 mm²', material: 'nichrome', lengthM: .5, areaM2: 1e-7 },
  { id: 'B', label: 'B · 镍铬丝，100 cm，0.10 mm²', material: 'nichrome', lengthM: 1, areaM2: 1e-7 },
  { id: 'C', label: 'C · 镍铬丝，50 cm，0.20 mm²', material: 'nichrome', lengthM: .5, areaM2: 2e-7 },
  { id: 'D', label: 'D · 康铜丝，50 cm，0.10 mm²', material: 'constantan', lengthM: .5, areaM2: 1e-7 },
  { id: 'E', label: 'E · 铁丝，50 cm，0.10 mm²', material: 'iron', lengthM: .5, areaM2: 1e-7 },
] as const;
export function metalResistance(input: unknown): number {
  const p = MetalWireSchema.parse(input), m = metalMaterials[p.material];
  return m.rho * p.lengthM / p.areaM2 * (1 + m.alpha * (p.temperatureK - 293.15));
}
export function metalSampleId(instance: EquipmentInstance) {
  return metalSamples.find(s => s.material === instance.parameters.material && s.lengthM === instance.parameters.lengthM && s.areaM2 === instance.parameters.areaM2)?.id ?? '自定';
}
export function metalPoint(instance: EquipmentInstance) {
  const p = MetalWireSchema.parse(instance.parameters);
  return `${metalSampleId(instance)} · ${metalMaterials[p.material].label} · ${Number((p.lengthM * 100).toFixed(2))}cm · ${Number((p.areaM2 * 1e6).toFixed(3))}mm² · ${Number((p.temperatureK - 273.15).toFixed(2))}℃`;
}
export function registerMetalWire(registry: EquipmentRegistry) {
  registry.registerParameterSchema(`${METAL_WIRE}.parameters.v1`, MetalWireSchema);
  registry.register({ type: METAL_WIRE, definitionVersion: 1, label: '金属丝（电阻丝）', domain: 'electrical',
    parameterSchemaId: `${METAL_WIRE}.parameters.v1`, modelAdapterId: `${METAL_WIRE}.dc.v1`, viewId: `${METAL_WIRE}.physical.v1`,
    defaultParameters: { material: 'nichrome', lengthM: .5, areaM2: 1e-7, temperatureK: 293.15 },
    ports: ['a', 'b'].map((id, index) => ({ id, kind: 'electrical-terminal', localPositionM: { x: index ? .2 : -.2, y: 0 } })),
  });
}
