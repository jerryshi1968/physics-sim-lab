import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
import { BALANCE, BEAKER, CYLINDER, MASS_SET } from '../density/definitions.ts';
import { FORCE_METER, SUPPORT, MECHANICAL_RULER } from '../mechanical/definitions.ts';

export const BUOYANCY_EXPERIMENT = 'J-MECH-03', BUOYANCY_MODEL = 'mechanical.buoyancy.static.v1';
export const BODY = 'mechanical.buoyancy-body', OVERFLOW = 'mechanical.overflow-can';
export const buoyancyTypes = [BODY, OVERFLOW];
export const buoyancyApparatus = [...buoyancyTypes, SUPPORT, FORCE_METER, BEAKER, CYLINDER, BALANCE, MASS_SET, MECHANICAL_RULER];
export const vesselAreaM2 = .004, vesselHeightM = .15, spoutHeightM = .12, beakerCapacityM3 = .0006;
export const buoyancyFields: Record<string, readonly ParameterField[]> = {
  [FORCE_METER]: [{ key: 'mountHeightM', label: '支架挂接高度', unit: 'm', kind: 'number' }, { key: 'rangeN', label: '测力计量程', unit: 'N', kind: 'number' }, { key: 'resolutionN', label: '测力计分度值', unit: 'N', kind: 'number' }],
  [BODY]: [{ key: 'massKg', label: '圆柱体质量', unit: 'kg', kind: 'number' }, { key: 'areaM2', label: '圆柱体横截面积', unit: 'm²', kind: 'number' }, { key: 'heightM', label: '圆柱体高度', unit: 'm', kind: 'number' }],
  [OVERFLOW]: [{ key: 'liquidDensityKgPerM3', label: '液体密度', unit: 'kg/m³', kind: 'number' }],
  [BEAKER]: [{ key: 'tareKg', label: '空杯质量', unit: 'kg', kind: 'number' }, { key: 'liquidM3', label: '杯内液体体积', unit: 'm³', kind: 'number' }, { key: 'liquidDensityKgPerM3', label: '液体密度', unit: 'kg/m³', kind: 'number' }],
};

export function registerBuoyancyEquipment(registry: EquipmentRegistry) {
  const id = z.string().max(80), volume = FiniteSchema.min(0).max(.002);
  const items = [
    { type: BODY, label: '带吊环圆柱体', defaults: { massKg: .1, areaM2: .001, heightM: .05, meterId: '' },
      schema: z.strictObject({ massKg: FiniteSchema.min(.005).max(1), areaM2: FiniteSchema.min(.0001).max(.002), heightM: FiniteSchema.min(.01).max(.12), meterId: id }) },
    { type: OVERFLOW, label: '溢水杯', defaults: { liquidM3: 0, liquidDensityKgPerM3: 1000, receiverId: '', initialLiquidM3: 0, spilledM3: 0, lostM3: 0, trialId: '' },
      schema: z.strictObject({ liquidM3: volume.max(vesselAreaM2 * spoutHeightM), liquidDensityKgPerM3: FiniteSchema.min(700).max(1500), receiverId: id,
        initialLiquidM3: volume, spilledM3: volume, lostM3: volume, trialId: id }) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'mechanical', label: item.label, ports: [], parameterSchemaId,
      defaultParameters: item.defaults, modelAdapterId: BUOYANCY_MODEL, viewId: `${item.type}.physical.v1` });
  }
}
