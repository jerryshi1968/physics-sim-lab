import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { MeasurementRecord, SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult } from '../../core/measurements/records.ts';
import { TWO_FORCE_MODEL, twoForceDynamics, twoForceRig } from './simulate.ts';
import type { TwoForceRun } from './simulate.ts';
export const conditionOptions = { magnitude: ['未判断', '相等', '不等'], direction: ['未判断', '相反', '不相反'], line: ['未判断', '在同一直线上', '不在同一直线上'], motion: ['未判断', '保持静止', '保持匀速直线运动', '开始平动', '开始转动', '平动并转动'] } as const;
export interface TwoForceInput { left: string; right: string; group: string; note: string; magnitude: string; direction: string; line: string; motion: string }
export function buildTwoForceReading(scene: SceneDocument, registry: EquipmentRegistry, run: TwoForceRun | null, input: TwoForceInput, id: string, timestamp: string, preview = false, running = false) {
  const fail = (code: string) => ({ ok: false as const, code }); if (preview) return fail('TF_PREVIEW');
  const rig = twoForceRig(scene, registry); if (!rig.ok) return rig;
  if (!run || running || run.signature !== rig.signature || run.timeS <= 0 || run.reason && run.reason !== 'TF_TIME_LIMIT' || !twoForceDynamics(run.rig, run.state).ok) return fail('TF_RECORD');
  if ([input.left, input.right, input.group, input.note].some(text => text.length > 100) || Object.entries(conditionOptions).some(([key, options]) => !(options as readonly string[]).includes(input[key as keyof typeof conditionOptions]))) return fail('INVALID_MANUAL_VALUE');
  const note = JSON.stringify({ kind: 'two-force', conditions: [input.magnitude, input.direction, input.line, input.motion], note: input.note, run: run.id, t: run.timeS, q: run.state.map(value => Number(value.toPrecision(8))) });
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: `two-force-${run.id}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: input.group, note, modelVersion: TWO_FORCE_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('INVALID_MANUAL_VALUE');
  const records: MeasurementRecord[] = [];
  for (const [i, raw] of [input.left, input.right].entries()) {
    const range = { min: .000001, max: 1, resolution: .000001 }, value = manualResult(raw, 'valid', range); if (!value) return fail('INVALID_MANUAL_VALUE');
    const row = MeasurementRecordSchema.safeParse({ id: `${id}.${i}`, source: 'manual', quantity: 'mass', unit: 'kg', ...value, rawInput: raw, equipmentId: rig.cart.id, range, recordedAt: timestamp, documentRevision: scene.revision, runId: snapshot.data.runId, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '二力平衡·小车与钩码组', pointLabel: i ? '右钩码总质量' : '左钩码总质量', instrumentStatus: 'valid', instrumentDisplayValue: rig.mass[i]!, physicalValue: rig.mass[i]!, originalRawInput: raw, diagnosticCodes: [] } });
    if (!row.success) return fail('INVALID_MANUAL_VALUE'); records.push(row.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
export function twoForceRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).flatMap(saved => {
    if (saved.modelVersion !== TWO_FORCE_MODEL) return [];
    try { const note = JSON.parse(saved.note); if (note.kind !== 'two-force' || !Array.isArray(note.conditions) || note.conditions.length !== 4 || Object.values(conditionOptions).some((options, index) => !(options as readonly string[]).includes(note.conditions[index])) || typeof note.note !== 'string' || note.note.length > 100 || typeof note.t !== 'number' || !Number.isFinite(note.t) || note.t < 0 || note.t > 8 || !Array.isArray(note.q) || note.q.length !== 6 || note.q.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value))) return []; const rows = scene.measurementRecords.filter(row => row.context?.sampleId === saved.id), mass = (label: string) => { const row = rows.find(row => row.context?.pointLabel.replaceAll('挂码', '钩码') === label); return row?.measurementStatus === 'valid' ? row.value : null; }; return [{ id: saved.id, group: saved.setupLabel, left: mass('左钩码总质量'), right: mass('右钩码总质量'), conditions: note.conditions as string[], note: String(note.note), timeS: Number(note.t) }]; } catch { return []; }
  });
}
