import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
import { EMITTER, PROTRACTOR, NORMAL } from '../reflection/definitions.ts';
import { RULER } from '../optical/definitions.ts';
export const REFRACTION_EXPERIMENT = 'J-OPT-04', TANK = 'optical.water-tank', REFRACTION_MODEL = 'optical.refraction.interface.v1';
export const refractionApparatus = [TANK, PROTRACTOR, NORMAL, EMITTER, RULER];
export const refractionFields: Record<string, readonly ParameterField[]> = {
  [TANK]: [{ key: 'widthM', label: '水槽宽度', unit: 'm', kind: 'number' }, { key: 'depthM', label: '水深', unit: 'm', kind: 'number' }],
};
export function registerRefractionEquipment(registry: EquipmentRegistry) {
  const parameterSchemaId = `${TANK}.parameters.v1`;
  registry.registerParameterSchema(parameterSchemaId, z.strictObject({ widthM: FiniteSchema.min(.6).max(2), depthM: FiniteSchema.min(.25).max(1) }));
  registry.register({ type: TANK, definitionVersion: 1, domain: 'optical', label: '透明水槽', ports: [], parameterSchemaId, defaultParameters: { widthM: 1.2, depthM: .48 }, modelAdapterId: REFRACTION_MODEL, viewId: `${TANK}.physical.v1` });
}
