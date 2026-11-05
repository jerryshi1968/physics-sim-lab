import type { SceneDocument } from './schema.ts';
import { SceneDocumentSchema, SCHEMA_VERSION } from './schema.ts';

export function createEmptyScene(documentId: string, timestamp: string): SceneDocument {
  return SceneDocumentSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    documentId,
    revision: 0,
    title: '未命名实验',
    experimentId: null,
    equipment: [],
    connections: [],
    simulationConfig: {
      modelVersions: {},
      electricalMode: 'ideal',
      gravityMPerS2: 10,
      fixedTimeStepS: 1 / 120,
      randomError: { enabled: false, seed: 0, distribution: 'none', amplitude: 0 },
    },
    measurementRecords: [],
    curriculumRef: null,
    provenance: { origin: 'original', sourceDocumentId: null, createdAt: timestamp, updatedAt: timestamp, notes: [] },
  });
}
