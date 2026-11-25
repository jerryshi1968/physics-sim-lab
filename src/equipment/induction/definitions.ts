import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';

export const INDUCTION_EXPERIMENT = 'J-ELEC-06';
export const INDUCTION_MODEL = 'induction-perspective.v2';
export const LEGACY_INDUCTION_MODEL = 'induction-quasistatic.v1';
export const MAGNET = 'electrical.horseshoe-magnet';
export const GALVANOMETER = 'electrical.galvanometer';
export const SENSITIVE_GALVANOMETER = { maximumA: .0002, resolutionA: .00001, resistanceOhm: 100, calibrationVersion: 1 } as const;
export const MagnetSchema = z.strictObject({ fieldT: FiniteSchema.min(.01).max(.5), reversed: z.boolean(),
  velocityXMPerS: FiniteSchema.optional(), velocityYMPerS: FiniteSchema.optional() });
export const GalvanometerSchema = z.strictObject({ calibrationVersion: z.literal(1).optional(), maximumA: FiniteSchema.positive().max(.1), resolutionA: FiniteSchema.positive(), resistanceOhm: FiniteSchema.nonnegative() })
  .refine(p => p.maximumA / p.resolutionA >= 1 && p.maximumA / p.resolutionA <= 50 && Math.abs(p.maximumA / p.resolutionA - Math.round(p.maximumA / p.resolutionA)) < 1e-8);
export function registerInduction(registry: EquipmentRegistry) {
  for (const spec of [
    { type: MAGNET, label: '蹄形磁体', schema: MagnetSchema, defaults: { fieldT: .1, reversed: false }, ports: [] },
    { type: GALVANOMETER, label: '灵敏电流计', schema: GalvanometerSchema, defaults: SENSITIVE_GALVANOMETER, ports: ['common', 'low'] },
  ]) {
    const parameterSchemaId = `${spec.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, spec.schema.transform(value => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Record<string, number | boolean>));
    registry.register({ type: spec.type, definitionVersion: 1, label: spec.label, domain: 'electrical', parameterSchemaId,
      modelAdapterId: `${spec.type}.dc.v1`, viewId: `${spec.type}.physical.v1`, defaultParameters: spec.defaults,
      ports: spec.ports.map((id, index) => ({ id, kind: 'electrical-terminal', localPositionM: { x: index ? .065 : -.065, y: -.065 } })),
    });
  }
}
