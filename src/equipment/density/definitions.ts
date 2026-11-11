import { z } from 'zod';
import type { Scalar } from '../../core/equipment/schema.ts';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
export const BALANCE = 'mechanical.density-balance', CYLINDER = 'mechanical.density-cylinder', SPECIMEN = 'mechanical.density-specimen', MASS_SET = 'mechanical.density-masses', BEAKER = 'mechanical.density-beaker';
export const DENSITY_EXPERIMENT = 'J-MEAS-01', LIQUID_EXPERIMENT = 'J-MEAS-01-L';
export const densityExperimentTitles = { solid: '测量固体的密度', liquid: '测量液体的密度' };
export const densityTypes = [BALANCE, CYLINDER, SPECIMEN, MASS_SET, BEAKER];
export const standardMassesG = [100, 50, 20, 20, 10, 5, 2, 2, 1];
export const specimenMassLimitsKg = { min: .001, max: .18 };
export const densityFields: Record<string, readonly ParameterField[]> = {};
export const solidSamples = [{ label: '固体 A', massKg: .054, volumeM3: .000020 }, { label: '固体 B', massKg: .065, volumeM3: .000025 }, { label: '固体 C', massKg: .078, volumeM3: .000010 }];
export function registerDensityEquipment(registry: EquipmentRegistry) {
  const presentParameters = (parameters: Record<string, Scalar | undefined>): Record<string, Scalar> => Object.fromEntries(Object.entries(parameters).filter((entry): entry is [string, Scalar] => entry[1] !== undefined));
  const targetId = z.string().max(80), volume = FiniteSchema.min(0).max(.00025);
  const items = [
    { type: BALANCE, label: '托盘天平', defaults: { capacityKg: .2, resolutionKg: .0002, riderKg: 0, zeroErrorKg: .0006, zeroTrimKg: 0 }, schema: z.strictObject({ capacityKg: z.literal(.2), resolutionKg: z.literal(.0002), riderKg: FiniteSchema.min(0).max(.005), zeroErrorKg: FiniteSchema.min(-.002).max(.002), zeroTrimKg: FiniteSchema.min(-.002).max(.002) }) },
    { type: CYLINDER, label: '量筒', defaults: { capacityM3: .0001, resolutionM3: .000001, liquidM3: .00005, liquidDensityKgPerM3: 1000, eyeLevel: 0 }, schema: z.strictObject({ capacityM3: z.literal(.0001), resolutionM3: z.literal(.000001), liquidM3: volume, liquidDensityKgPerM3: FiniteSchema.min(700).max(1500), eyeLevel: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }) },
    { type: SPECIMEN, label: '待测固体', defaults: { massKg: .054, volumeM3: .000020, targetId: '', liftM: 0, sampleCode: 'A' }, schema: z.strictObject({ massKg: FiniteSchema.min(specimenMassLimitsKg.min).max(specimenMassLimitsKg.max), volumeM3: FiniteSchema.min(.000001).max(.00004), targetId, liftM: FiniteSchema.min(0).max(.2), sampleCode: z.string().min(1).max(30) }) },
    { type: MASS_SET, label: '天平砝码盒', defaults: { balanceId: '', mask: 0 }, schema: z.strictObject({ balanceId: targetId, mask: z.number().int().min(0).max(511) }) },
    { type: BEAKER, label: '烧杯', defaults: { tareKg: .03, liquidM3: .00008, liquidDensityKgPerM3: 1000, targetId: '', liquidCode: 'A' }, schema: z.strictObject({ tareKg: FiniteSchema.min(.01).max(.08), liquidM3: FiniteSchema.min(0).max(.0006), liquidDensityKgPerM3: FiniteSchema.min(700).max(1500), targetId, liquidCode: z.string().min(1).max(30), buoyancyRole: z.enum(['vessel', 'receiver']).optional() }).refine(value => value.liquidM3 <= .00025 || value.buoyancyRole === 'vessel').transform(presentParameters) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, label: item.label, domain: 'mechanical', definitionVersion: 1, ports: [], parameterSchemaId, defaultParameters: item.defaults, modelAdapterId: 'measurement.density.static.v1', viewId: `${item.type}.physical.v1` });
  }
}
