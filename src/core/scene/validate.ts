import { documentDiagnostic } from '../diagnostics/diagnostic.ts';
import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import type { EquipmentRegistry } from '../equipment/registry.ts';
import { SceneDocumentSchema } from './schema.ts';
import type { SceneDocument } from './schema.ts';

export type DocumentValidation = { ok: true; document: SceneDocument }
  | { ok: false; diagnostics: Diagnostic[] };

export function validateSceneDocument(input: unknown, registry: EquipmentRegistry): DocumentValidation {
  const parsed = SceneDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, diagnostics: parsed.error.issues.map(issue =>
      documentDiagnostic('SCHEMA_INVALID', issue.path.map(String).join('.'))) };
  }
  const document = parsed.data;
  const diagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  const equipment = new Map(document.equipment.map(instance => [instance.id, instance]));
  for (const [collection, values] of [['equipment', document.equipment], ['connections', document.connections],
    ['measurementRecords', document.measurementRecords], ['measurementSnapshots', document.measurementSnapshots ?? []]] as const) {
    values.forEach((value, index) => {
      if (ids.has(value.id)) diagnostics.push(documentDiagnostic('DUPLICATE_ID', `${collection}.${index}.id`));
      ids.add(value.id);
    });
  }
  document.equipment.forEach((instance, index) => {
    const definition = registry.get(instance.type, instance.definitionVersion);
    if (!definition) {
      diagnostics.push(documentDiagnostic('UNKNOWN_EQUIPMENT_VERSION', `equipment.${index}`, [instance.id]));
    } else if (!registry.validateParameters(definition, instance.parameters)) {
      diagnostics.push(documentDiagnostic('INVALID_EQUIPMENT_PARAMETERS', `equipment.${index}.parameters`, [instance.id]));
    }
  });
  document.connections.forEach((connection, index) => {
    const path = `connections.${index}`;
    if (connection.from && connection.to && connection.from.equipmentId === connection.to.equipmentId && connection.from.portId === connection.to.portId) {
      diagnostics.push(documentDiagnostic('SELF_CONNECTION', path, [connection.from.equipmentId]));
    }
    if (!registry.supportsConnection(connection.kind)) {
      diagnostics.push(documentDiagnostic('UNSUPPORTED_CONNECTION_KIND', `${path}.kind`));
    }
    const expectedPortKind = connection.kind === 'wire' ? 'electrical-terminal' : 'mechanical-anchor';
    for (const side of ['from', 'to'] as const) {
      const endpoint = connection[side];
      if (endpoint === null) continue;
      const instance = equipment.get(endpoint.equipmentId);
      if (!instance) {
        diagnostics.push(documentDiagnostic('DANGLING_ENDPOINT', `${path}.${side}`, [endpoint.equipmentId]));
        continue;
      }
      const definition = registry.get(instance.type, instance.definitionVersion);
      if (!definition) continue;
      const port = definition.ports.find(port => port.id === endpoint.portId);
      if (!port) diagnostics.push(documentDiagnostic('UNKNOWN_PORT', `${path}.${side}`, [instance.id]));
      else if (port.kind !== expectedPortKind) {
        diagnostics.push(documentDiagnostic('INCOMPATIBLE_PORT', `${path}.${side}`, [instance.id]));
      }
    }
  });
  const snapshots = new Map((document.measurementSnapshots ?? []).map(snapshot => [snapshot.id, snapshot]));
  for (const [index, snapshot] of (document.measurementSnapshots ?? []).entries()) {
    if (snapshot.sourceSnapshotIds?.some(id => !snapshots.has(id) || snapshots.get(id)!.documentRevision >= snapshot.documentRevision)) {
      diagnostics.push(documentDiagnostic('INVALID_MEASUREMENT_SNAPSHOT', `measurementSnapshots.${index}.sourceSnapshotIds`));
    }
    if (snapshot.documentId !== document.documentId || snapshot.documentRevision > document.revision) {
      diagnostics.push(documentDiagnostic('INVALID_MEASUREMENT_SNAPSHOT', `measurementSnapshots.${index}`));
    }
    const checked = validateSceneDocument({ ...document, revision: snapshot.documentRevision, equipment: snapshot.equipment,
      connections: snapshot.connections, simulationConfig: snapshot.modelConfigSnapshot, measurementRecords: [], measurementSnapshots: undefined }, registry);
    if (!checked.ok) diagnostics.push(documentDiagnostic('INVALID_MEASUREMENT_SNAPSHOT', `measurementSnapshots.${index}`));
    if (snapshot.captureState) {
      const source = snapshot.captureState;
      const checkedSource = validateSceneDocument({ ...document, revision: snapshot.documentRevision, equipment: source.equipment, connections: source.connections, simulationConfig: source.modelConfigSnapshot, measurementRecords: [], measurementSnapshots: undefined }, registry);
      if (!checkedSource.ok) diagnostics.push(documentDiagnostic('INVALID_MEASUREMENT_SNAPSHOT', `measurementSnapshots.${index}.captureState`));
    }
  }
  document.measurementRecords.forEach((record, index) => {
    if (!equipment.has(record.equipmentId)) {
      diagnostics.push(documentDiagnostic('DANGLING_MEASUREMENT', `measurementRecords.${index}.equipmentId`, [record.equipmentId]));
    }
    if (record.documentRevision > document.revision) {
      diagnostics.push(documentDiagnostic('FUTURE_MEASUREMENT_REVISION', `measurementRecords.${index}.documentRevision`, [record.equipmentId]));
    }
    if (record.context) {
      const snapshot = snapshots.get(record.context.sampleId);
      if (!snapshot || snapshot.documentRevision !== record.documentRevision || snapshot.runId !== record.runId || snapshot.sequence !== record.sequence
        || snapshot.capturedAt !== record.recordedAt || !snapshot.equipment.some(item => item.id === record.equipmentId)
        || JSON.stringify(snapshot.modelConfigSnapshot) !== JSON.stringify(record.modelConfigSnapshot)) {
        diagnostics.push(documentDiagnostic('INVALID_MEASUREMENT_SNAPSHOT', `measurementRecords.${index}.context`, [record.equipmentId]));
      }
    }
  });
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, document };
}
