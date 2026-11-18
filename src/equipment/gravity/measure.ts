import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { manualResult } from '../../core/measurements/records.ts';
import { GRAVITY_MODEL, simulateGravity } from './simulate.ts';

export const gravityProfile: MeasurementChartProfile = { id: 'gravity-mass', label: '重力 G–质量 m', available: true, x: { quantity: 'mass', unit: 'kg', label: '质量 m（kg）', pointLabel: '钩码质量' }, y: { quantity: 'force', unit: 'N', label: '重力 G（N）', pointLabel: '重力' } };
export function buildGravityReading(scene: SceneDocument, registry: EquipmentRegistry, input: { mass: string; force: string; group: string; note: string }, id: string, timestamp: string, preview = false) {
  const out = simulateGravity(scene, registry, preview), fail = (code: string) => ({ ok: false as const, code });
  if (!out.ok) return fail(out.code);
  if (!out.hung.length) return fail('GRAVITY_UNLOADED');
  if ([input.mass, input.force, input.group, input.note].some(text => text.length > 100)) return fail('INVALID_MANUAL_VALUE');
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: `gravity-${scene.documentId}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: `${input.group} · g=${scene.simulationConfig.gravityMPerS2}`, note: JSON.stringify({ kind: 'gravity-reading', group: input.group, hungIds: out.hung.map(item => item.id), note: input.note }), modelVersion: GRAVITY_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('INVALID_MANUAL_VALUE');
  const specs = [{ raw: input.mass, label: '钩码质量', quantity: 'mass', unit: 'kg', truth: out.massKg, display: out.massKg, range: { min: .000001, max: 12, resolution: .000001 } }, { raw: input.force, label: '重力', quantity: 'force', unit: 'N', truth: out.forceN, display: out.displayN!, range: { min: 0, max: Number(out.meter!.parameters.rangeN), resolution: Number(out.meter!.parameters.resolutionN) } }], records: MeasurementRecord[] = [];
  for (const spec of specs) {
    const result = manualResult(spec.raw, 'valid', spec.range); if (!result) return fail('INVALID_MANUAL_VALUE');
    const row = MeasurementRecordSchema.safeParse({ id: `${id}.${records.length}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...result, rawInput: spec.raw, equipmentId: out.meter!.id, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId: snapshot.data.runId, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '重力探究·测力计与钩码', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.display, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: [] } });
    if (!row.success) return fail('INVALID_MANUAL_VALUE'); records.push(row.data);
  }
  return { ok: true as const, snapshot: snapshot.data, records };
}
export function gravityRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(saved => saved.modelVersion === GRAVITY_MODEL).map(saved => {
    const rows = scene.measurementRecords.filter(row => row.context?.sampleId === saved.id), value = (label: string) => { const row = rows.find(row => row.context?.pointLabel === label); return row?.measurementStatus === 'valid' ? row.value : null; }, mass = value('钩码质量'), force = value('重力');
    return { id: saved.id, group: saved.setupLabel, mass, force, ratio: mass !== null && mass > 0 && force !== null ? force / mass : null };
  });
}
