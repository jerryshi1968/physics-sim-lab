import type { SceneDocument, MeasurementRecord, MeasurementSnapshot } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { simulateDensity, densityMethod } from './simulate.ts';
import type { DensityOutcome } from './simulate.ts';
export const densityPhases = { mass: '固体质量m', initial: '初始液面V1', immersed: '浸没液面V2', 'liquid-before': '液体倒出前总质量m1', 'liquid-after': '液体倒出后总质量m2', 'liquid-volume': '倒出液体体积V' } as const;
export type DensityPhase = keyof typeof densityPhases;
export const densityPhaseList = (method: string): DensityPhase[] => method === 'liquid' ? ['liquid-before', 'liquid-after', 'liquid-volume'] : ['mass', 'initial', 'immersed'];
export const densityProfiles: readonly MeasurementChartProfile[] = [{ id: 'density-m-v', label: '质量—体积（学生记录）', available: true, x: { quantity: 'volume', unit: 'm³', displayUnit: 'mL', label: '体积（mL = cm³）', pointLabel: '测得体积' }, y: { quantity: 'mass', unit: 'kg', displayUnit: 'g', label: '质量（g）', pointLabel: '测得质量' } }, { id: 'density-results', label: '各组密度比较', available: true, x: 'sample', y: { quantity: 'density', unit: 'kg/m³', displayUnit: 'g/cm³', label: '密度（g/cm³）', pointLabel: '测得密度' } }];
type Good = Extract<DensityOutcome, { ok: true }>;
const fail = (code: string) => ({ ok: false as const, code });
function snapshot(scene: SceneDocument, id: string, timestamp: string, group: string, note: object, sources?: string[]) {
  return MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: `density-${scene.documentId}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: group, note: JSON.stringify(note), modelVersion: 'measurement.density.static.v1', equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig, ...(sources ? { sourceSnapshotIds: sources } : {}) });
}
function readingGate(outcome: Good, phase: DensityPhase): string | null {
  if (['mass', 'liquid-before', 'liquid-after'].includes(phase)) {
    if (!outcome.readableMass) return 'DENSITY_BALANCE';
    const sample = phase === 'mass' ? outcome.specimen : outcome.beaker;
    if (!sample || outcome.load?.id !== sample.id) return 'DENSITY_STAGE';
  } else {
    if (!outcome.readableVolume || phase === 'immersed' && !outcome.liquid.fullyImmersed) return 'DENSITY_VOLUME';
    if (phase === 'immersed' ? !outcome.inCylinder : outcome.inCylinder) return 'DENSITY_STAGE';
  }
  return null;
}
export function buildDensityReading(scene: SceneDocument, registry: EquipmentRegistry, input: { phase: DensityPhase; raw: string; group: string; note: string }, id: string, timestamp: string, preview = false) {
  if (preview) return fail('DENSITY_PREVIEW');
  const outcome = simulateDensity(scene, registry); if (!outcome.ok) return outcome;
  if (!densityPhaseList(densityMethod(scene)).includes(input.phase)) return fail('DENSITY_STAGE');
  const gate = readingGate(outcome, input.phase); if (gate) return fail(gate);
  const mass = ['mass', 'liquid-before', 'liquid-after'].includes(input.phase), parsed = parseManualValue(input.raw);
  if (!parsed.ok || input.raw.length > 100 || input.note.length > 100) return fail('INVALID_MANUAL_VALUE');
  const raw = parsed.value === null ? '' : String(Number((parsed.value * (mass ? .001 : .000001)).toPrecision(12)));
  const range = mass ? { min: 0, max: .2, resolution: .0002 } : { min: 0, max: .0001, resolution: .000001 }, truth = mass ? outcome.leftKg : outcome.liquid.readingM3, display = mass ? outcome.rightKg : Math.round(truth / .000001) * .000001;
  const saved = snapshot(scene, id, timestamp, input.group, { kind: 'density-reading', phase: input.phase, method: densityMethod(scene), raw: input.raw, unit: mass ? 'g' : 'mL', note: input.note });
  const result = manualResult(raw, 'valid', range);
  if (!saved.success || !result) return fail('INVALID_MANUAL_VALUE');
  const record = MeasurementRecordSchema.safeParse({ id: `${id}.0`, source: 'manual', quantity: mass ? 'mass' : 'volume', unit: mass ? 'kg' : 'm³', ...result, rawInput: raw, equipmentId: mass ? outcome.balance.id : outcome.cylinder.id, range, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: mass ? '密度测量·托盘天平' : '密度测量·量筒', pointLabel: densityPhases[input.phase], instrumentStatus: 'valid', instrumentDisplayValue: display, physicalValue: truth, originalRawInput: input.raw, diagnosticCodes: [] } });
  return record.success ? { ok: true as const, snapshot: saved.data, records: [record.data] } : fail('INVALID_MANUAL_VALUE');
}
export function densitySource(scene: SceneDocument, record: MeasurementRecord) {
  const snap = (scene.measurementSnapshots ?? []).find(item => item.id === record.context?.sampleId);
  if (!snap || snap.modelVersion !== 'measurement.density.static.v1') return null;
  try { const note = JSON.parse(snap.note); return note.kind === 'density-reading' && Object.hasOwn(densityPhases, note.phase) ? { snapshot: snap, phase: note.phase as DensityPhase, method: String(note.method) } : null; } catch { return null; }
}
function fromSnapshot(scene: SceneDocument, saved: MeasurementSnapshot, registry: EquipmentRegistry) {
  return simulateDensity({ ...scene, revision: saved.documentRevision, equipment: saved.equipment, connections: saved.connections, simulationConfig: saved.modelConfigSnapshot, measurementRecords: [], measurementSnapshots: undefined }, registry);
}
export function buildDensityResult(scene: SceneDocument, registry: EquipmentRegistry, ids: string[], group: string, id: string, timestamp: string) {
  const rows = ids.map(id => scene.measurementRecords.find(row => row.id === id));
  if (ids.length !== 3 || new Set(ids).size !== 3 || rows.some(row => !row || row.measurementStatus !== 'valid' || row.value === null)) return fail('DENSITY_SOURCES');
  const records = rows as MeasurementRecord[], sources = records.map(row => densitySource(scene, row));
  if (sources.some(source => !source)) return fail('DENSITY_SOURCES');
  const selected = sources as NonNullable<ReturnType<typeof densitySource>>[], phases = densityPhaseList(densityMethod(scene));
  if (group !== selected[0]!.snapshot.setupLabel || selected.some((source, i) => source.phase !== phases[i] || source.method !== densityMethod(scene) || source.snapshot.setupLabel !== selected[0]!.snapshot.setupLabel || source.snapshot.documentId !== scene.documentId)) return fail('DENSITY_SOURCES');
  const outcomes = selected.map(source => fromSnapshot(scene, source.snapshot, registry));
  if (outcomes.some((outcome, i) => !outcome.ok || readingGate(outcome, selected[i]!.phase))) return fail('DENSITY_SOURCES');
  const [a, b, c] = outcomes as [Good, Good, Good], [sa, sb, sc] = selected.map(source => source.snapshot);
  const solid = densityMethod(scene) === 'solid', near = (x: number, y: number) => Math.abs(x - y) < 1e-12;
  let trueMass: number;
  let trueVolume: number;
  if (solid) {
    const specimen = a.specimen;
    if (!specimen || [b, c].some(({ specimen: other }) => !other || other.id !== specimen.id || other.parameters.massKg !== specimen.parameters.massKg || other.parameters.volumeM3 !== specimen.parameters.volumeM3 || other.parameters.sampleCode !== specimen.parameters.sampleCode)
      || b.cylinder.id !== c.cylinder.id || !near(Number(b.cylinder.parameters.liquidM3), Number(c.cylinder.parameters.liquidM3)) || b.cylinder.parameters.liquidDensityKgPerM3 !== c.cylinder.parameters.liquidDensityKgPerM3 || sb!.documentRevision >= sc!.documentRevision || sa!.documentRevision >= sc!.documentRevision) return fail('DENSITY_SOURCES');
    trueMass = Number(specimen.parameters.massKg);
    trueVolume = Number(specimen.parameters.volumeM3);
  } else {
    const [before, after, atVolume] = [a.beaker, b.beaker, c.beaker];
    if (!before || !after || !atVolume || [after, atVolume].some(beaker => beaker.id !== before.id || beaker.parameters.tareKg !== before.parameters.tareKg || beaker.parameters.liquidDensityKgPerM3 !== before.parameters.liquidDensityKgPerM3 || beaker.parameters.liquidCode !== before.parameters.liquidCode)
      || [b, c].some(outcome => outcome.cylinder.id !== a.cylinder.id)
      || Number(a.cylinder.parameters.liquidM3) !== 0 || !near(Number(b.cylinder.parameters.liquidM3), Number(c.cylinder.parameters.liquidM3)) || !near(Number(after.parameters.liquidM3), Number(atVolume.parameters.liquidM3)) || !near(Number(before.parameters.liquidM3), Number(after.parameters.liquidM3) + Number(b.cylinder.parameters.liquidM3)) || b.cylinder.parameters.liquidDensityKgPerM3 !== before.parameters.liquidDensityKgPerM3 || sa!.documentRevision >= sb!.documentRevision || sa!.documentRevision >= sc!.documentRevision) return fail('DENSITY_SOURCES');
    trueVolume = Number(c.cylinder.parameters.liquidM3);
    trueMass = Number(before.parameters.liquidDensityKgPerM3) * Number(b.cylinder.parameters.liquidM3);
  }
  const mass = solid ? records[0]!.value! : records[0]!.value! - records[1]!.value!, volume = solid ? records[2]!.value! - records[1]!.value! : records[2]!.value!;
  if (!(mass > 0 && volume > 0 && Number.isFinite(mass / volume))) return fail('DENSITY_DIFFERENCE');
  const saved = snapshot(scene, id, timestamp, group, { kind: 'density-result', method: densityMethod(scene), refs: records.map(row => ({ id: row.id, value: row.value })), massKg: trueMass, volumeM3: trueVolume }, selected.map(source => source.snapshot.id));
  if (!saved.success || !scene.equipment.some(item => item.id === a.balance.id)) return fail('DENSITY_SOURCES');
  const specs = [{ label: '测得质量', quantity: 'mass', unit: 'kg', value: mass, truth: trueMass, max: .2, resolution: .0002 }, { label: '测得体积', quantity: 'volume', unit: 'm³', value: volume, truth: trueVolume, max: .0001, resolution: .000001 }, { label: '测得密度', quantity: 'density', unit: 'kg/m³', value: mass / volume, truth: trueMass / trueVolume, max: Number.MAX_VALUE, resolution: 1 }] as const;
  const derived: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const raw = String(Number(spec.value.toPrecision(12))), result = manualResult(raw, 'valid', { min: 0, max: spec.max, resolution: spec.resolution });
    const row = MeasurementRecordSchema.safeParse({ id: `${id}.${index}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...result, rawInput: raw, equipmentId: a.balance.id, range: null, recordedAt: timestamp, documentRevision: scene.revision, runId: saved.data.runId, sequence: saved.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '密度测量·手工读数计算', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.truth, physicalValue: spec.truth, originalRawInput: String(Number((spec.value * (spec.unit === 'kg' ? 1000 : spec.unit === 'm³' ? 1e6 : .001)).toPrecision(12))), diagnosticCodes: [] } });
    if (!row.success) return fail('DENSITY_DIFFERENCE'); derived.push(row.data);
  }
  return { ok: true as const, snapshot: saved.data, records: derived };
}
