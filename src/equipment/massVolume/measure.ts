import type { SceneDocument, MeasurementRecord, MeasurementSnapshot } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { simulateMassVolume, MASS_VOLUME_MODEL } from './simulate.ts';
export type MassVolumePhase = 'mass' | 'edge';
export const massVolumeProfile: MeasurementChartProfile = { id: 'mass-volume-relation', label: '同种铝块 m–V 图', available: true, x: { quantity: 'volume', unit: 'm³', displayUnit: 'cm³', label: '体积 V（cm³）', pointLabel: '测得体积' }, y: { quantity: 'mass', unit: 'kg', displayUnit: 'g', label: '质量 m（g）', pointLabel: '测得质量' } };
const fail = (code: string) => ({ ok: false as const, code });
function snapshot(scene: SceneDocument, id: string, timestamp: string, group: string, note: object, sources?: string[]) {
  return MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: `mass-volume-${scene.documentId}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: group, note: JSON.stringify(note), modelVersion: MASS_VOLUME_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig, ...(sources ? { sourceSnapshotIds: sources } : {}) });
}
export function buildMassVolumeReading(scene: SceneDocument, registry: EquipmentRegistry, input: { phase: MassVolumePhase; mass: string; start: string; end: string; group: string; note: string }, id: string, timestamp: string, preview = false) {
  if (preview) return fail('MV_PREVIEW');
  if (!['mass', 'edge'].includes(input.phase)) return fail('MV_SOURCES');
  const out = simulateMassVolume(scene, registry); if (!out.ok) return out;
  const w = out.weighing, mass = input.phase === 'mass';
  if (mass && (!w.ok || !w.readableMass || w.load?.id !== out.block.id)) return fail('MV_MASS');
  if (!mass && !out.rulerReadable) return fail('MV_RULER');
  if (input.note.length > 100 || input.group.length > 100) return fail('INVALID_MANUAL_VALUE');
  const saved = snapshot(scene, id, timestamp, input.group, { kind: 'mass-volume-reading', phase: input.phase, blockId: out.block.id, code: out.sample.code, material: 'aluminum', note: input.note });
  if (!saved.success) return fail('INVALID_MANUAL_VALUE');
  const specs = mass ? [{ raw: input.mass, quantity: 'mass', unit: 'kg', factor: .001, label: '称量质量', truth: out.sample.massKg, display: w.ok ? w.rightKg : 0, equipmentId: w.ok ? w.balance.id : out.block.id, range: { min: 0, max: .2, resolution: .0002 } }] : [{ raw: input.start, label: '边长起点', truth: out.startM }, { raw: input.end, label: '边长终点', truth: out.endM }].map(s => ({ ...s, quantity: 'length', unit: 'm', factor: .01, display: Math.round(s.truth / .001) * .001, equipmentId: out.ruler!.id, range: { min: 0, max: Number(out.ruler!.parameters.lengthM), resolution: .001 } }));
  const records: MeasurementRecord[] = [];
  for (const spec of specs) {
    const parsed = parseManualValue(spec.raw); if (!parsed.ok || spec.raw.length > 100) return fail('INVALID_MANUAL_VALUE');
    const raw = parsed.value === null ? '' : String(Number((parsed.value * spec.factor).toPrecision(12))), value = manualResult(raw, 'valid', spec.range);
    const row = MeasurementRecordSchema.safeParse({ id: `${id}.${records.length}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...value, rawInput: raw, equipmentId: spec.equipmentId, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: mass ? '质量体积探究·天平' : '质量体积探究·独立刻度尺', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.display, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: [] } });
    if (!value || !row.success) return fail('INVALID_MANUAL_VALUE'); records.push(row.data);
  }
  return { ok: true as const, snapshot: saved.data, records };
}
export function massVolumeSource(scene: SceneDocument, saved: MeasurementSnapshot) {
  if (saved.modelVersion !== MASS_VOLUME_MODEL || saved.documentId !== scene.documentId) return null;
  try { const note = JSON.parse(saved.note); return note.kind === 'mass-volume-reading' && ['mass', 'edge'].includes(note.phase) ? { snapshot: saved, phase: note.phase as MassVolumePhase, code: String(note.code) } : null; } catch { return null; }
}
function restored(scene: SceneDocument, saved: MeasurementSnapshot) { return { ...scene, revision: saved.documentRevision, equipment: saved.equipment, connections: saved.connections, simulationConfig: saved.modelConfigSnapshot, measurementRecords: [], measurementSnapshots: undefined }; }
export function buildMassVolumeResult(scene: SceneDocument, registry: EquipmentRegistry, massId: string, edgeId: string, group: string, id: string, timestamp: string) {
  const m = scene.measurementRecords.find(r => r.id === massId), massSnap = scene.measurementSnapshots?.find(s => s.id === m?.context?.sampleId), edgeSnap = scene.measurementSnapshots?.find(s => s.id === edgeId);
  if (!m || !massSnap || !edgeSnap || massSnap.id === edgeSnap.id) return fail('MV_SOURCES');
  const a = massVolumeSource(scene, massSnap), b = massVolumeSource(scene, edgeSnap), rows = scene.measurementRecords.filter(r => r.context?.sampleId === edgeSnap.id), start = rows.find(r => r.context?.pointLabel === '边长起点'), end = rows.find(r => r.context?.pointLabel === '边长终点');
  if (!a || !b || a.phase !== 'mass' || b.phase !== 'edge' || a.code !== b.code || massSnap.setupLabel !== group || edgeSnap.setupLabel !== group || rows.length !== 2 || !start || !end || m.quantity !== 'mass' || m.unit !== 'kg' || m.context?.pointLabel !== '称量质量' || [m, start, end].some(r => r.measurementStatus !== 'valid' || r.value === null) || [start, end].some(r => r.quantity !== 'length' || r.unit !== 'm')) return fail('MV_SOURCES');
  const weigh = simulateMassVolume(restored(scene, massSnap), registry), measured = simulateMassVolume(restored(scene, edgeSnap), registry);
  if (!weigh.ok || !measured.ok || !weigh.weighing.ok || !weigh.weighing.readableMass || weigh.weighing.load?.id !== weigh.block.id || !measured.rulerReadable || weigh.block.id !== measured.block.id || weigh.sample.code !== measured.sample.code) return fail('MV_SOURCES');
  const edgeM = Number((end.value! - start.value!).toPrecision(12)), massKg = m.value!;
  if (!(edgeM > 0 && edgeM <= Number(measured.ruler!.parameters.lengthM) && massKg > 0)) return fail('MV_LENGTH');
  const volumeM3 = Number((edgeM ** 3).toPrecision(12));
  const saved = snapshot(scene, id, timestamp, group, { kind: 'mass-volume-result', code: a.code, material: 'aluminum', refs: [m, start, end].map(r => ({ id: r.id, value: r.value })), formula: 'a=end-start; V=a^3' }, [massSnap.id, edgeSnap.id]);
  if (!saved.success) return fail('MV_SOURCES');
  const specs = [{ quantity: 'mass', unit: 'kg', label: '测得质量', value: massKg, truth: weigh.sample.massKg }, { quantity: 'length', unit: 'm', label: '测得边长', value: edgeM, truth: weigh.sample.edgeM }, { quantity: 'volume', unit: 'm³', label: '测得体积', value: volumeM3, truth: weigh.sample.volumeM3 }], records: MeasurementRecord[] = [];
  for (const spec of specs) {
    const row = MeasurementRecordSchema.safeParse({ id: `${id}.${records.length}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, value: spec.value, rawInput: String(spec.value), measurementStatus: 'valid', equipmentId: weigh.block.id, range: null, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '质量体积探究·手工读数计算', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.truth, physicalValue: spec.truth, originalRawInput: String(Number((spec.value * (spec.unit === 'kg' ? 1000 : spec.unit === 'm' ? 100 : 1e6)).toPrecision(12))), diagnosticCodes: [] } });
    if (!row.success) return fail('MV_LENGTH'); records.push(row.data);
  }
  return { ok: true as const, snapshot: saved.data, records };
}
export function massVolumeResults(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).flatMap(s => {
    if (s.modelVersion !== MASS_VOLUME_MODEL) return [];
    try { const note = JSON.parse(s.note); if (note.kind !== 'mass-volume-result') return []; const rows = scene.measurementRecords.filter(r => r.context?.sampleId === s.id), value = (label: string) => { const r = rows.find(r => r.context?.pointLabel === label); return r?.measurementStatus === 'valid' ? r.value : null; }; return [{ id: s.id, group: s.setupLabel, code: String(note.code), massKg: value('测得质量'), edgeM: value('测得边长'), volumeM3: value('测得体积') }]; } catch { return []; }
  });
}
