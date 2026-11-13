import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { parseManualValue } from '../../core/measurements/records.ts';
import { thermalReading, thermalRig } from './simulate.ts';
import type { ThermalState } from './simulate.ts';

export const THERMAL_VERSION = 'thermal.boiling.lumped.v1';
export interface ThermalCapture { source: 'manual' | 'instrument'; timeRaw: string; temperatureRaw: string; setupLabel: string; note: string }
export function buildThermalMeasurements(scene: SceneDocument, state: ThermalState, signature: string, seriesId: string, heating: boolean, input: ThermalCapture, sampleId: string, timestamp: string) {
  const fail = (message: string) => ({ ok: false as const, message }), rig = thermalRig(scene), reading = thermalReading(rig, state);
  if (!rig.ok || rig.signature !== signature || !rig.timer || !reading.ok || !rig.meter) return fail(!rig.timer ? '请添加计时器。' : reading.message || '装置已改变，请重新计时。');
  if (input.setupLabel.length > 100 || input.note.length > 100) return fail('组名、备注最多 100 字。');
  const sequence = scene.revision + 1, runId = `thermal-${sampleId}`, specs = [
    { quantity: 'time' as const, unit: 's' as const, label: '加热计时', id: rig.timer.id, raw: input.timeRaw, truth: state.timeS, display: Number((Math.round(state.timeS / Number(rig.timer.parameters.resolutionS)) * Number(rig.timer.parameters.resolutionS)).toPrecision(12)), range: { min: 0, max: 7200, resolution: Number(rig.timer.parameters.resolutionS) } },
    { quantity: 'temperature' as const, unit: 'K' as const, label: '水温', id: rig.meter.id, raw: input.temperatureRaw, truth: state.temperatureK, display: reading.valueK, range: { min: 273.15, max: 383.15, resolution: Number(rig.meter.parameters.resolutionK) } },
  ];
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId, sequence, capturedAt: timestamp, setupLabel: input.setupLabel, note: JSON.stringify({ seriesId, timeS: state.timeS, temperatureK: state.temperatureK, massKg: state.massKg, heating: heating && rig.contact, note: input.note }), modelVersion: THERMAL_VERSION, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('热学快照无效。');
  const records: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const parsed = parseManualValue(spec.raw);
    if (input.source === 'manual' && !parsed.ok) return fail('请输入有限的时间和摄氏温度；留空记缺失。');
    const manual = parsed.ok && parsed.value !== null ? parsed.value + (spec.unit === 'K' ? 273.15 : 0) : null;
    const rawSI = spec.unit === 'K' && manual !== null ? String(manual) : spec.raw;
    const value = input.source === 'instrument' ? spec.display : manual;
    const valid = value !== null && value >= spec.range.min - 1e-9 && value <= spec.range.max + 1e-9;
    const record = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${index}`, source: input.source, quantity: spec.quantity, unit: spec.unit, value: valid ? value : null, rawInput: input.source === 'manual' ? rawSI : null, equipmentId: spec.id, range: spec.range, measurementStatus: valid ? 'valid' : 'invalid', recordedAt: timestamp, documentRevision: scene.revision, runId, sequence, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: spec.unit === 'K' ? '温度计' : '计时器', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.display, physicalValue: spec.truth, originalRawInput: input.source === 'manual' ? spec.raw : null, diagnosticCodes: [] } });
    if (!record.success) return fail('热学记录无效。');
    records.push(record.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
export function thermalRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(s => s.modelVersion === THERMAL_VERSION).map(snapshot => {
    const records = scene.measurementRecords.filter(r => r.context?.sampleId === snapshot.id);
    const value = (quantity: string) => { const rows = records.filter(r => r.quantity === quantity); return rows.length === 1 && rows[0]!.measurementStatus === 'valid' ? rows[0]!.value : null; };
    let series = snapshot.id, note = '', heating = false;
    try { const data = JSON.parse(snapshot.note); if (typeof data.seriesId !== 'string' || !data.seriesId) throw new Error('MISSING_THERMAL_SERIES'); series = data.seriesId; note = String(data.note ?? ''); heating = data.heating === true; } catch { /* Malformed imported metadata must not join independent runs. */ }
    const timeS = value('time'), temperatureK = value('temperature');
    return { id: snapshot.id, label: snapshot.setupLabel, series, note, heating, timeS, temperatureC: temperatureK === null ? null : Number((temperatureK - 273.15).toFixed(8)) };
  });
}
