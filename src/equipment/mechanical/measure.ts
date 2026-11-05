import type { SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { parseManualValue, manualResult } from '../../core/measurements/records.ts';
import { simulateLever } from './simulate.ts';

export interface LeverEntry { equipmentId: string; forceRaw: string; armRaw: string; turn: '' | 'cw' | 'ccw' }
export interface LeverCapture { entries: LeverEntry[]; setupLabel: string; observation: string; note: string }
export function buildLeverMeasurements(scene: SceneDocument, registry: EquipmentRegistry, input: LeverCapture, sampleId: string, timestamp: string) {
  const outcome = simulateLever(scene, registry), fail = (code: string) => ({ ok: false as const, code });
  if (!outcome.ok || !outcome.calibrated || !input.entries.length) return fail('LEVER_MEASUREMENT_UNAVAILABLE');
  if (!['未判定', '平衡', '不平衡'].includes(input.observation) || new Set(input.entries.map(entry => entry.equipmentId)).size !== input.entries.length) return fail('INVALID_LEVER_ENTRY');
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId: sampleId, sequence: 1, capturedAt: timestamp,
    setupLabel: input.setupLabel, modelVersion: 'mechanical.lever.endnuts.v1', equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig,
    note: JSON.stringify({ observation: input.observation, actualBalanced: outcome.balanced, selfWeight: outcome.lever.parameters.includeSelfWeight, calibrated: outcome.calibrated, note: input.note }) });
  if (!snapshot.success) return fail('INVALID_LEVER_ENTRY');
  const records = [];
  for (const [slot, entry] of input.entries.entries()) {
    const load = outcome.loads.find(load => load.id === entry.equipmentId), force = parseManualValue(entry.forceRaw), arm = parseManualValue(entry.armRaw);
    if (!load || !force.ok || !arm.ok || !['', 'cw', 'ccw'].includes(entry.turn)) return fail('INVALID_MANUAL_VALUE');
    const torqueRaw = force.value !== null && arm.value !== null && entry.turn ? String(force.value * arm.value * (entry.turn === 'cw' ? -1 : 1)) : '';
    if (!parseManualValue(torqueRaw).ok) return fail('INVALID_MANUAL_VALUE');
    const meter = outcome.meters.find(meter => meter.id === entry.equipmentId), available = !meter || meter.status === 'valid';
    const meterParameters = scene.equipment.find(item => item.id === entry.equipmentId)?.parameters;
    const forceRange = { min: 0, max: meter ? Number(meterParameters!.rangeN) : 200, resolution: meter ? Number(meterParameters!.resolutionN) : .01 };
    const validFactors = (force.value === null || force.value >= 0 && force.value <= forceRange.max) && (arm.value === null || arm.value >= 0 && arm.value <= 2);
    const specs = [
      { raw: entry.forceRaw, truth: load.forceN, quantity: 'force', unit: 'N', label: '力', range: forceRange, display: meter?.displayN ?? load.forceN, available },
      { raw: entry.armRaw, truth: load.armM, quantity: 'length', unit: 'm', label: '力臂', range: { min: 0, max: 2, resolution: .001 }, display: Math.round(load.armM * 1000) / 1000, available: true },
      { raw: torqueRaw, truth: load.torqueNm, quantity: 'torque', unit: 'N·m', label: '力矩', range: { min: -400, max: 400, resolution: .0001 }, display: load.torqueNm, available: available && validFactors },
    ] as const;
    for (const [index, spec] of specs.entries()) {
      const status = spec.available ? 'valid' : meter?.status === 'over-range' ? 'over-range' : 'invalid', result = manualResult(spec.raw, status, spec.range);
      if (!result) return fail('INVALID_MANUAL_VALUE');
      const record = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${slot}.${index}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, rawInput: spec.raw, ...result,
        equipmentId: load.kind === 'self' || load.kind === 'trim' ? outcome.lever.id : load.id, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId: sampleId, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
        context: { sampleId, equipmentLabel: load.kind === 'weight' ? '钩码' : load.kind === 'meter' ? '测力计' : load.kind === 'self' ? '杆自重' : '调平螺母', pointLabel: spec.label, instrumentStatus: status,
          instrumentDisplayValue: spec.available ? spec.display : null, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: spec.available ? [] : ['LEVER_FORCE_UNAVAILABLE'] } });
      if (!record.success) return fail('INVALID_LEVER_ENTRY');
      records.push(record.data);
    }
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
