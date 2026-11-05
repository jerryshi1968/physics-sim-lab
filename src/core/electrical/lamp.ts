import { z } from 'zod';
import { FiniteSchema } from '../equipment/schema.ts';

export const LampParametersSchema = z.strictObject({
  ratedVoltageV: FiniteSchema.positive(), ratedCurrentA: FiniteSchema.positive(),
  coldResistanceOhm: FiniteSchema.positive(), maxCurrentA: FiniteSchema.positive(),
}).refine(spec => spec.maxCurrentA >= spec.ratedCurrentA && spec.ratedVoltageV >= spec.coldResistanceOhm * spec.ratedCurrentA
  && Number.isFinite(spec.ratedCurrentA ** 3) && spec.ratedCurrentA ** 3 > 0
  && Number.isFinite(spec.ratedVoltageV * spec.ratedCurrentA) && spec.ratedVoltageV * spec.ratedCurrentA > 0
  && Number.isFinite((spec.ratedVoltageV - spec.coldResistanceOhm * spec.ratedCurrentA) / spec.ratedCurrentA ** 3),
{ message: 'Invalid lamp rating, cold resistance or model range' });
export type LampParameters = z.infer<typeof LampParametersSchema>;

export function lampCoefficient(spec: LampParameters): number {
  return (spec.ratedVoltageV - spec.coldResistanceOhm * spec.ratedCurrentA) / spec.ratedCurrentA ** 3;
}

export function lampVoltageV(currentA: number, spec: LampParameters): number {
  const coefficient = lampCoefficient(spec);
  return spec.coldResistanceOhm * currentA + (coefficient === 0 ? 0 : coefficient * currentA ** 3);
}

export function lampDifferentialOhm(currentA: number, spec: LampParameters): number {
  const coefficient = lampCoefficient(spec);
  return spec.coldResistanceOhm + (coefficient === 0 ? 0 : 3 * coefficient * currentA ** 2);
}

export const LAMP_BRIGHTNESS_REFERENCE_W = 0.9;

export function lampBrightness(powerW: number): number {
  const power = Math.max(0, powerW);
  return power / (power + LAMP_BRIGHTNESS_REFERENCE_W);
}
