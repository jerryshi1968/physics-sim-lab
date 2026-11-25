import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { manualResult } from '../../core/measurements/records.ts';
import type { ElectricalOutcome } from '../electrical/simulate.ts';
import { GALVANOMETER, INDUCTION_EXPERIMENT, INDUCTION_MODEL, LEGACY_INDUCTION_MODEL } from './definitions.ts';
import { inductionParts } from './model.ts';

export const deflections = ['未判断', '不偏转', '向左偏转', '向右偏转'] as const;
export interface InductionInput { group: string; observation: string; current: string; note: string }
export function buildInductionReading(scene: SceneDocument, view: SceneDocument, outcome: ElectricalOutcome | null, input: InductionInput, id: string, timestamp: string) {
  const fail = () => ({ ok: false as const, message: '请检查装置、输入和读数状态后再保存。' });
  if (scene.experimentId !== INDUCTION_EXPERIMENT || scene.documentId !== view.documentId || scene.revision !== view.revision || !outcome?.result.ok || !inductionParts(view).wire || !inductionParts(view).magnet || !deflections.includes(input.observation as typeof deflections[number]) || Object.values(input).some(v => v.length > 100)) return fail();
  const meters = view.equipment.filter(i => i.type === GALVANOMETER); if (meters.length !== 1) return fail();
  const meter = outcome.meters.find(m => m.id === meters[0]!.id); if (!meter) return fail();
  const range = { min: -meter.maximum, max: meter.maximum, resolution: meter.resolution };
  const status = meter.status === 'valid' ? 'valid' : meter.status === 'over-range' ? 'over-range' : 'invalid';
  const value = manualResult(input.current, status === 'valid' && Number(input.current) < range.min ? 'over-range' : status, range); if (!value) return fail();
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision,
    runId: `induction-${id}`, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: input.group,
    note: JSON.stringify({ kind: 'induction', observation: input.observation, note: input.note }), modelVersion: INDUCTION_MODEL,
    equipment: view.equipment, connections: view.connections, modelConfigSnapshot: view.simulationConfig,
    captureState: { kind: 'induction-motion', launchRevision: scene.revision, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig } });
  if (!snapshot.success) return fail();
  const record = MeasurementRecordSchema.safeParse({ id: `${id}.I`, source: 'manual', quantity: 'current', unit: 'A', ...value, rawInput: input.current,
    equipmentId: meter.id, range, recordedAt: timestamp, documentRevision: scene.revision, runId: snapshot.data.runId, sequence: snapshot.data.sequence, modelConfigSnapshot: view.simulationConfig,
    context: { sampleId: id, equipmentLabel: '灵敏电流计', pointLabel: `偏转观察 · ${input.observation}`, instrumentStatus: meter.status,
      instrumentDisplayValue: meter.displayValue, physicalValue: meter.trueValue, originalRawInput: input.current, diagnosticCodes: [] } });
  return record.success ? { ok: true as const, snapshot: snapshot.data, records: [record.data] } : fail();
}
export function inductionRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(s => [INDUCTION_MODEL, LEGACY_INDUCTION_MODEL].includes(s.modelVersion)).flatMap(s => {
    try {
      const note = JSON.parse(s.note); if (note.kind !== 'induction' || !deflections.includes(note.observation)) return [];
      const { wire, magnet } = inductionParts(s), r = scene.measurementRecords.find(r => r.context?.sampleId === s.id);
      if (!wire || !magnet || !r) return [];
      return [{ id: s.id, group: s.setupLabel, observation: String(note.observation), note: String(note.note), shape: wire.parameters.inductionShape === 'coil' ? `${wire.parameters.turns} 匝线圈` : '导体 AB', field: Number(magnet.parameters.fieldT), reversed: magnet.parameters.reversed === true,
        closed: s.equipment.some(i => i.type === 'electrical.switch' && i.parameters.closed), vx: Number(wire.parameters.velocityXMPerS ?? 0) - Number(magnet.parameters.velocityXMPerS ?? 0), vy: Number(wire.parameters.velocityYMPerS ?? 0) - Number(magnet.parameters.velocityYMPerS ?? 0), current: r.measurementStatus === 'valid' ? r.value : null }];
    } catch { return []; }
  });
}
