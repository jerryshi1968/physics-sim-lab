import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
import { RULER, SCREEN } from '../optical/definitions.ts';
import { MIRROR } from '../reflection/definitions.ts';

export const MIRROR_IMAGE_EXPERIMENT = 'J-OPT-03';
export const MIRROR_IMAGE_MODEL = 'optical.mirror-image.planar.v1';
export const TARGET = 'optical.mirror-target', MATCH = 'optical.mirror-match', EYE = 'optical.observation-eye';
export const mirrorImageTypes = [TARGET, MATCH, EYE];
export const mirrorImageApparatus = [MIRROR, SCREEN, RULER, ...mirrorImageTypes];
const heightField = { key: 'heightM', label: '标记高度', unit: 'm', kind: 'number' } as const;
export const mirrorImageFields: Record<string, readonly ParameterField[]> = { [TARGET]: [heightField], [MATCH]: [heightField] };

export function registerMirrorImageEquipment(registry: EquipmentRegistry) {
  const marker = z.strictObject({ heightM: FiniteSchema.min(.02).max(.25) });
  const definitions = [
    { type: TARGET, label: '成像标记物', schema: marker, defaults: { heightM: .12 } },
    { type: MATCH, label: '镜后对照物', schema: marker, defaults: { heightM: .12 } },
    { type: EYE, label: '观察眼', schema: z.strictObject({}), defaults: {} },
  ];
  for (const item of definitions) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'optical', label: item.label, ports: [], parameterSchemaId,
      defaultParameters: item.defaults, modelAdapterId: MIRROR_IMAGE_MODEL, viewId: `${item.type}.physical.v1` });
  }
}
