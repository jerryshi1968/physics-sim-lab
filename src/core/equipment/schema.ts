import { z } from 'zod';

export const IdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/);
export const FiniteSchema = z.number().finite();
export const ScalarSchema = z.union([FiniteSchema, z.string().max(10_000), z.boolean()]);
export const ParametersSchema = z.record(IdSchema.refine(key => !['__proto__', 'constructor', 'prototype'].includes(key)), ScalarSchema);
export type Scalar = z.infer<typeof ScalarSchema>;

export const Pose2DSchema = z.strictObject({ xM: FiniteSchema, yM: FiniteSchema, rotationRad: FiniteSchema, flippedX: z.boolean().optional() });
export const PortDefinitionSchema = z.strictObject({
  id: IdSchema,
  kind: z.enum(['electrical-terminal', 'mechanical-anchor', 'optical-mount']),
  localPositionM: z.strictObject({ x: FiniteSchema, y: FiniteSchema }),
});

export const EquipmentDefinitionSchema = z.strictObject({
  type: IdSchema,
  definitionVersion: z.number().int().positive(),
  label: z.string().min(1).max(100),
  domain: z.enum(['electrical', 'optical', 'mechanical', 'thermal']),
  ports: z.array(PortDefinitionSchema).max(32),
  parameterSchemaId: IdSchema,
  modelAdapterId: IdSchema,
  viewId: IdSchema,
  defaultParameters: ParametersSchema,
}).refine(definition => new Set(definition.ports.map(port => port.id)).size === definition.ports.length,
  { message: 'Duplicate port IDs', path: ['ports'] });

export const EquipmentInstanceSchema = z.strictObject({
  id: IdSchema,
  type: IdSchema,
  definitionVersion: z.number().int().positive(),
  pose: Pose2DSchema,
  parameters: ParametersSchema,
});

export type Pose2D = z.infer<typeof Pose2DSchema>;
export type PortDefinition = z.infer<typeof PortDefinitionSchema>;
export type EquipmentDefinition = Omit<z.infer<typeof EquipmentDefinitionSchema>, 'ports'> & {
  readonly ports: readonly PortDefinition[];
};
export type EquipmentInstance = z.infer<typeof EquipmentInstanceSchema>;
