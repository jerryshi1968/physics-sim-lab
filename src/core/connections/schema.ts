import { z } from 'zod';
import { FiniteSchema, IdSchema } from '../equipment/schema.ts';

export const ConnectionKindSchema = z.enum(['wire', 'rigid-mount', 'rope']);
export type ConnectionKind = z.infer<typeof ConnectionKindSchema>;

export const EndpointSchema = z.strictObject({ equipmentId: IdSchema, portId: IdSchema });
export const ConnectionSchema = z.strictObject({
  id: IdSchema,
  kind: ConnectionKindSchema,
  from: EndpointSchema.nullable(),
  to: EndpointSchema.nullable(),
  freeFromWorldM: z.strictObject({ x: FiniteSchema, y: FiniteSchema }).optional(),
  freeToWorldM: z.strictObject({ x: FiniteSchema, y: FiniteSchema }).optional(),
  routeWorldM: z.array(z.strictObject({ x: FiniteSchema, y: FiniteSchema })).max(100).optional(),
}).superRefine((connection, context) => {
  for (const side of ['from', 'to'] as const) {
    const free = side === 'from' ? connection.freeFromWorldM : connection.freeToWorldM;
    if (connection[side] === null ? connection.kind !== 'wire' || !free : free !== undefined) {
      context.addIssue({ code: 'custom', message: 'Wire ends must be attached or have an explicit free position', path: [side] });
    }
  }
});

export type Endpoint = z.infer<typeof EndpointSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
