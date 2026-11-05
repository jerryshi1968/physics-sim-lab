import { z } from 'zod';
import { FiniteSchema } from '../equipment/schema.ts';

export const RheostatParametersSchema = z.strictObject({
  maxResistanceOhm: FiniteSchema.positive(), position: FiniteSchema.min(0).max(1),
}).refine(spec => (spec.position === 0 || spec.maxResistanceOhm * spec.position > 0)
  && (spec.position === 1 || spec.maxResistanceOhm * (1 - spec.position) > 0), { message: 'Rheostat segment underflow' });
export type RheostatParameters = z.infer<typeof RheostatParametersSchema>;

export function rheostatResistances(spec: RheostatParameters) {
  return { asOhm: spec.position * spec.maxResistanceOhm, sbOhm: (1 - spec.position) * spec.maxResistanceOhm };
}
