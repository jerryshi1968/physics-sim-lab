import type { SceneDocument, MeasurementRecord, MeasurementSnapshot } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { simulateMass } from './simulate.ts';
import { SPECIMEN, BEAKER } from '../density/definitions.ts';
export const massPhases = { solid: '固体质量', tare: '空烧杯质量', total: '烧杯和水的总质量' } as const;
export type MassPhase = keyof typeof massPhases;
export const massProfiles: readonly MeasurementChartProfile[] = [{ id: 'mass-readings', label: '质量测量记录', available: true, x: 'sample', y: { quantity: 'mass', unit: 'kg', displayUnit: 'g', label: '质量（g）' } }];
const range = { min: 0, max: .2, resolution: .0002 }, version = 'measurement.mass.static.v1';
const fail = (code: string) => ({ ok: false as const, code });
function snapshot(scene: SceneDocument, id: string, timestamp: string, group: string, note: object, sources?: string[]) {
  return MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: `mass-${scene.documentId}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: group, note: JSON.stringify(note), modelVersion: version, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig, ...(sources ? { sourceSnapshotIds: sources } : {}) });
}
function gate(scene: SceneDocument, registry: EquipmentRegistry, phase: MassPhase) {
  const outcome = simulateMass(scene, registry);
  if (!outcome.ok) return outcome;
  const w = outcome.weighing;
  if (!w.readableMass) return fail('MASS_BALANCE');
  if (phase === 'solid' ? w.load?.type !== SPECIMEN : w.load?.type !== BEAKER || (phase === 'tare' ? Number(w.load.parameters.liquidM3) !== 0 : Number(w.load.parameters.liquidM3) <= 0)) return fail('MASS_PHASE');
  return { ok: true as const, weighing: w };
}
export function buildMassReading(scene: SceneDocument, registry: EquipmentRegistry, input: { phase: MassPhase; raw: string; group: string; note: string }, id: string, timestamp: string, preview = false) {
  if (preview) return fail('MASS_PREVIEW');
  if (!Object.hasOwn(massPhases, input.phase)) return fail('MASS_PHASE');
  const result = gate(scene, registry, input.phase); if (!result.ok) return result;
  const parsed = parseManualValue(input.raw);
  if (!parsed.ok || input.raw.length > 100 || input.note.length > 100) return fail('INVALID_MANUAL_VALUE');
  const raw = parsed.value === null ? '' : String(Number((parsed.value / 1000).toPrecision(12))), value = manualResult(raw, 'valid', range);
  const saved = snapshot(scene, id, timestamp, input.group, { kind: 'mass-reading', phase: input.phase, raw: input.raw, unit: 'g', note: input.note });
  if (!saved.success || !value) return fail('INVALID_MANUAL_VALUE');
  const w = result.weighing, row = MeasurementRecordSchema.safeParse({ id: `${id}.0`, source: 'manual', quantity: 'mass', unit: 'kg', ...value, rawInput: raw, equipmentId: w.balance.id, range, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '质量测量·托盘天平', pointLabel: input.phase === 'solid' ? `固体质量·${String(w.load?.parameters.sampleCode)}` : massPhases[input.phase], instrumentStatus: 'valid', instrumentDisplayValue: w.rightKg, physicalValue: w.leftKg, originalRawInput: input.raw, diagnosticCodes: [] } });
  return row.success ? { ok: true as const, snapshot: saved.data, records: [row.data] } : fail('INVALID_MANUAL_VALUE');
}
export function massSource(scene: SceneDocument, row: MeasurementRecord) {
  const saved = scene.measurementSnapshots?.find(s => s.id === row.context?.sampleId);
  if (!saved || saved.modelVersion !== version) return null;
  try { const note = JSON.parse(saved.note); return note.kind === 'mass-reading' && Object.hasOwn(massPhases, note.phase) ? { snapshot: saved, phase: note.phase as MassPhase } : null; } catch { return null; }
}
function restore(scene: SceneDocument, saved: MeasurementSnapshot) { return { ...scene, revision: saved.documentRevision, equipment: saved.equipment, connections: saved.connections, simulationConfig: saved.modelConfigSnapshot, measurementRecords: [], measurementSnapshots: undefined }; }
export function buildMassDifference(scene: SceneDocument, registry: EquipmentRegistry, ids: string[], group: string, id: string, timestamp: string) {
  const rows = ids.map(id => scene.measurementRecords.find(r => r.id === id));
  if (ids.length !== 2 || new Set(ids).size !== 2 || rows.some(r => !r || r.quantity !== 'mass' || r.unit !== 'kg' || r.measurementStatus !== 'valid' || r.value === null)) return fail('MASS_SOURCES');
  const records = rows as MeasurementRecord[], selected = records.map(r => massSource(scene, r)), [a, b] = selected;
  if (!a || !b || a.phase !== 'tare' || b.phase !== 'total' || [a, b].some(s => s.snapshot.documentId !== scene.documentId || s.snapshot.setupLabel !== group) || a.snapshot.documentRevision >= b.snapshot.documentRevision) return fail('MASS_SOURCES');
  const empty = gate(restore(scene, a.snapshot), registry, 'tare'), full = gate(restore(scene, b.snapshot), registry, 'total');
  if (!empty.ok || !full.ok) return fail('MASS_SOURCES');
  const before = empty.weighing, after = full.weighing, cup = before.load!, filled = after.load!;
  if (cup.id !== filled.id || before.balance.id !== after.balance.id || !scene.equipment.some(i => i.id === before.balance.id) || cup.parameters.tareKg !== filled.parameters.tareKg || ['capacityKg', 'resolutionKg', 'zeroErrorKg', 'zeroTrimKg'].some(k => before.balance.parameters[k] !== after.balance.parameters[k])) return fail('MASS_SOURCES');
  const value = Number((records[1]!.value! - records[0]!.value!).toPrecision(12));
  if (!(value > 0 && Number.isFinite(value))) return fail('MASS_DIFFERENCE');
  const truth = after.leftKg - before.leftKg, saved = snapshot(scene, id, timestamp, group, { kind: 'mass-result', refs: records.map(r => ({ id: r.id, value: r.value })), formula: 'total-tare' }, [a.snapshot.id, b.snapshot.id]);
  if (!saved.success) return fail('MASS_SOURCES');
  const row = MeasurementRecordSchema.safeParse({ id: `${id}.0`, source: 'manual', quantity: 'mass', unit: 'kg', value, rawInput: String(value), measurementStatus: 'valid', equipmentId: before.balance.id, range: null, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '质量测量·手工读数计算', pointLabel: '液体质量（总质量−空杯质量）', instrumentStatus: 'valid', instrumentDisplayValue: truth, physicalValue: truth, originalRawInput: String(value * 1000), diagnosticCodes: [] } });
  return row.success ? { ok: true as const, snapshot: saved.data, records: [row.data] } : fail('MASS_DIFFERENCE');
}
