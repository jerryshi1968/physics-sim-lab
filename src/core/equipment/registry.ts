import type { z } from 'zod';
import type { ConnectionKind } from '../connections/schema.ts';
import { EquipmentDefinitionSchema, IdSchema, ParametersSchema } from './schema.ts';
import type { EquipmentDefinition, Scalar } from './schema.ts';

export class EquipmentRegistry {
  private readonly definitions = new Map<string, EquipmentDefinition>();
  private readonly parameterSchemas = new Map<string, z.ZodType<Record<string, Scalar>>>();
  private readonly connectionKinds: ReadonlySet<ConnectionKind>;

  constructor(connectionKinds: readonly ConnectionKind[] = ['wire']) {
    this.connectionKinds = new Set(connectionKinds);
  }

  registerParameterSchema(id: string, schema: z.ZodType<Record<string, Scalar>>): void {
    IdSchema.parse(id);
    if (this.parameterSchemas.has(id)) throw new Error('DUPLICATE_PARAMETER_SCHEMA');
    this.parameterSchemas.set(id, schema);
  }

  register(input: EquipmentDefinition): void {
    const definition = EquipmentDefinitionSchema.parse(input);
    const key = `${definition.type}@${definition.definitionVersion}`;
    if (this.definitions.has(key)) throw new Error('DUPLICATE_DEFINITION');
    const schema = this.parameterSchemas.get(definition.parameterSchemaId);
    if (!schema) throw new Error('UNKNOWN_PARAMETER_SCHEMA');
    if (!this.validateParameters(definition, definition.defaultParameters)) throw new Error('INVALID_DEFAULT_PARAMETERS');
    this.definitions.set(key, definition);
  }

  get(type: string, version: number): EquipmentDefinition | undefined {
    const definition = this.definitions.get(`${type}@${version}`);
    return definition ? EquipmentDefinitionSchema.parse(definition) : undefined;
  }

  list(): EquipmentDefinition[] {
    return [...this.definitions.values()].map(definition => EquipmentDefinitionSchema.parse(definition));
  }

  validateParameters(definition: EquipmentDefinition, parameters: Record<string, Scalar>): boolean {
    const parsed = this.parameterSchemas.get(definition.parameterSchemaId)?.safeParse(parameters);
    if (!parsed?.success) return false;
    const checked = ParametersSchema.safeParse(parsed.data);
    if (!checked.success) return false;
    const keys = Object.keys(parameters);
    return keys.length === Object.keys(checked.data).length && keys.every(key =>
      Object.hasOwn(checked.data, key) && Object.is(parameters[key], checked.data[key]));
  }

  supportsConnection(kind: ConnectionKind): boolean {
    return this.connectionKinds.has(kind);
  }
}
