import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { MeasurementRecord, MeasurementSnapshot, SceneDocument } from '../../core/scene/schema.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { manualResult } from '../../core/measurements/records.ts';
import { AMMETER, VOLTMETER } from './definitions.ts';

export interface MeasurementChoice { equipmentId: string; pointLabel: string; rawInput: string }
export interface ElectricalMeasurementEntry {
  source: 'manual' | 'instrument'; setupLabel: string; note: string; choices: (MeasurementChoice & { id: string })[];
  sampleId: string; timestamp: string;
}
export type MeasurementBatch = { ok: true; records: MeasurementRecord[]; snapshot: MeasurementSnapshot } | { ok: false; code: string };

export function buildElectricalMeasurements(scene: SceneDocument, registry: EquipmentRegistry, reply: SimulationReply | null, entry: ElectricalMeasurementEntry): MeasurementBatch {
  if (!reply || reply.commandType !== 'result' || reply.documentId !== scene.documentId || reply.documentRevision !== scene.revision
    || !Number.isSafeInteger(reply.sequence) || reply.sequence < 1) return { ok: false, code: 'STALE_MEASUREMENT' };
  if (!entry.choices.length || new Set(entry.choices.map(item => item.equipmentId)).size !== entry.choices.length) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const outcome = reply.payload;
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: entry.sampleId, documentId: scene.documentId, documentRevision: scene.revision,
    runId: reply.runId, sequence: reply.sequence, capturedAt: entry.timestamp, setupLabel: entry.setupLabel, note: entry.note,
    modelVersion: outcome.result.ok ? outcome.result.solution.modelVersion : 'dc-unavailable',
    equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const records: MeasurementRecord[] = [];
  for (const choice of entry.choices) {
    const instance = scene.equipment.find(item => item.id === choice.equipmentId);
    if (!instance || ![AMMETER, VOLTMETER].includes(instance.type) || !choice.pointLabel.trim()) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
    const reading = outcome.meters.find(item => item.id === choice.equipmentId);
    const instrumentStatus = outcome.result.ok ? reading?.status ?? 'invalid' : 'out-of-model';
    const connection = meterConnection(scene, instance.id);
    const range = connection.range && !connection.bothRanges ? { min: 0, max: Number(instance.parameters[`${connection.range}Range`]), resolution: Number(instance.parameters[`${connection.range}Resolution`]) } : null;
    const status: MeasurementRecord['measurementStatus'] = instrumentStatus === 'valid' ? 'valid' : instrumentStatus === 'reverse' ? 'reverse'
      : instrumentStatus === 'over-range' ? 'over-range' : instrumentStatus === 'out-of-model' ? 'out-of-model' : 'invalid';
    const manual = entry.source === 'manual' ? manualResult(choice.rawInput, status, range) : null;
    if (entry.source === 'manual' && !manual) return { ok: false, code: 'INVALID_MANUAL_VALUE' };
    const diagnosticCodes = outcome.result.diagnostics.filter(item => item.severity !== 'info').map(item => item.code).slice(0, 49);
    if (scene.simulationConfig.randomError.enabled) diagnosticCodes.push('RANDOM_ERROR_NOT_APPLIED');
    const parsed = MeasurementRecordSchema.safeParse({ id: choice.id, source: entry.source,
      quantity: instance.type === AMMETER ? 'current' : 'voltage', unit: instance.type === AMMETER ? 'A' : 'V',
      value: entry.source === 'manual' ? manual!.value : status === 'valid' ? reading?.displayValue ?? null : null,
      rawInput: entry.source === 'manual' ? choice.rawInput : null, equipmentId: instance.id, range,
      measurementStatus: manual?.measurementStatus ?? status, recordedAt: entry.timestamp, documentRevision: scene.revision,
      runId: reply.runId, sequence: reply.sequence, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId: entry.sampleId, equipmentLabel: `${registry.get(instance.type, instance.definitionVersion)?.label ?? instance.type} ${scene.equipment.indexOf(instance) + 1}`,
        pointLabel: choice.pointLabel.trim(), instrumentStatus, instrumentDisplayValue: outcome.result.ok ? reading?.displayValue ?? null : null,
        physicalValue: outcome.result.ok ? reading?.trueValue ?? null : null, originalRawInput: entry.source === 'manual' ? choice.rawInput : null, diagnosticCodes } });
    if (!parsed.success) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
    records.push(parsed.data);
  }
  return { ok: true, records, snapshot: snapshot.data };
}
