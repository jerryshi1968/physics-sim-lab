import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const BENCH = 'optical.bench', CANDLE = 'optical.candle', LENS = 'optical.convex-lens', SCREEN = 'optical.screen', RULER = 'optical.ruler';
export const opticalParameterFields: Record<string, readonly ParameterField[]> = {
  [BENCH]: [{ key: 'lengthM', label: '光具座长度', unit: 'm', kind: 'number' }],
  [CANDLE]: [{ key: 'heightM', label: '火焰物体高度', unit: 'm', kind: 'number' }],
  [LENS]: [{ key: 'focalLengthM', label: '焦距', unit: 'm', kind: 'number' }, { key: 'apertureRadiusM', label: '有效孔径半径', unit: 'm', kind: 'number' }],
  [SCREEN]: [{ key: 'widthM', label: '光屏宽度', unit: 'm', kind: 'number' }, { key: 'heightM', label: '光屏高度', unit: 'm', kind: 'number' }],
  [RULER]: [{ key: 'lengthM', label: '刻度尺长度', unit: 'm', kind: 'number' }],
};
export function registerOpticalEquipment(registry: EquipmentRegistry): void {
  const descriptions = [
    { type: BENCH, label: '光具座', defaults: { lengthM: 1.2 }, schema: z.strictObject({ lengthM: FiniteSchema.min(.2).max(2) }) },
    { type: CANDLE, label: '蜡烛', defaults: { heightM: .02 }, schema: z.strictObject({ heightM: FiniteSchema.min(.002).max(.04) }) },
    { type: LENS, label: '凸透镜', defaults: { focalLengthM: .1, apertureRadiusM: .006 }, schema: z.strictObject({ focalLengthM: FiniteSchema.min(.02).max(.5), apertureRadiusM: FiniteSchema.min(.002).max(.04) }) },
    { type: SCREEN, label: '光屏', defaults: { widthM: .08, heightM: .08 }, schema: z.strictObject({ widthM: FiniteSchema.min(.02).max(.2), heightM: FiniteSchema.min(.02).max(.2) }) },
    { type: RULER, label: '独立刻度尺', defaults: { lengthM: 1 }, schema: z.strictObject({ lengthM: FiniteSchema.min(.05).max(1.2) }) },
  ];
  for (const item of descriptions) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'optical', label: item.label, ports: [], parameterSchemaId,
      modelAdapterId: `${item.type}.paraxial.v1`, viewId: `${item.type}.physical.v1`, defaultParameters: item.defaults });
  }
}
