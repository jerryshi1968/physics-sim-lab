import { z } from 'zod';
import { ConnectionKindSchema, ConnectionSchema, EndpointSchema } from '../connections/schema.ts';
import { EquipmentInstanceSchema, IdSchema, Pose2DSchema } from '../equipment/schema.ts';
import { SceneDocumentSchema, SCHEMA_VERSION } from './schema.ts';

const LegacyConnectionSchema = z.strictObject({
  id: IdSchema, kind: ConnectionKindSchema, from: EndpointSchema, to: EndpointSchema,
  routeWorldM: ConnectionSchema.shape.routeWorldM,
});
const LegacySceneSchema = SceneDocumentSchema.omit({ measurementSnapshots: true }).extend({ schemaVersion: z.literal(1), connections: z.array(LegacyConnectionSchema).max(500),
  equipment: z.array(EquipmentInstanceSchema.extend({ pose: Pose2DSchema.omit({ flippedX: true }) })).max(200) });

export type MigrationResult = { ok: true; value: unknown; fromVersion: number }
  | { ok: false; code: 'UNSUPPORTED_SCHEMA_VERSION' | 'INVALID_LEGACY_DOCUMENT' };

export function migrateSceneDocument(input: unknown): MigrationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !('schemaVersion' in input)) {
    return { ok: false, code: 'UNSUPPORTED_SCHEMA_VERSION' };
  }
  if (input.schemaVersion === SCHEMA_VERSION) return { ok: true, value: input, fromVersion: SCHEMA_VERSION };
  if (input.schemaVersion !== 1) return { ok: false, code: 'UNSUPPORTED_SCHEMA_VERSION' };
  if ('measurementRecords' in input && Array.isArray(input.measurementRecords) && input.measurementRecords.some(record => record && typeof record === 'object' && ('context' in record || 'correctedAt' in record))) {
    return { ok: false, code: 'INVALID_LEGACY_DOCUMENT' };
  }
  const parsed = LegacySceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_LEGACY_DOCUMENT' };
  return { ok: true, value: { ...parsed.data, schemaVersion: SCHEMA_VERSION }, fromVersion: 1 };
}
