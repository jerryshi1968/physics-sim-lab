import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { ohmCircuit } from './ohm.ts';
import { buildElectricalMeasurements } from './measure.ts';
import type { ElectricalMeasurementEntry, MeasurementBatch } from './measure.ts';

export const voltammetryMode = (scene: Pick<SceneDocument, 'experimentId' | 'ohmControl'>) => scene.experimentId === 'J-ELEC-03' || scene.experimentId === 'J-ELEC-FREE' && scene.ohmControl?.mode === 'measurement';
export const unknownSamples = { A: 7.5, B: 12.5, C: 22.5 } as const;
const version = 'electrical.voltammetry.measurement.v1';

export function voltammetryCircuit(scene: Pick<SceneDocument, 'equipment' | 'connections'>) {
  const circuit = ohmCircuit(scene);
  if (circuit.ok && (Number(circuit.ammeter.parameters.resistanceOhm) !== 0 || circuit.voltmeter.parameters.finiteInput !== false)) return { ok: false as const, message: '初中伏安法使用理想电表，请恢复电流表内阻 0、电压表内阻 ∞。' };
  return circuit;
}

export function buildVoltammetryMeasurements(scene: SceneDocument, registry: EquipmentRegistry, reply: SimulationReply | null, entry: ElectricalMeasurementEntry): MeasurementBatch {
  const circuit = voltammetryCircuit(scene);
  if (!voltammetryMode(scene) || !circuit.ok || entry.choices.length !== 2 || ![circuit.ammeter.id, circuit.voltmeter.id].every(id => entry.choices.some(choice => choice.equipmentId === id))) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const batch = buildElectricalMeasurements(scene, registry, reply, entry);
  if (batch.ok) batch.snapshot.modelVersion = version;
  return batch;
}

export function voltammetryResults(scene: SceneDocument) {
  const records = new Map<string, MeasurementRecord[]>();
  for (const record of scene.measurementRecords) {
    const id = record.context?.sampleId;
    if (id) { const rows = records.get(id) ?? []; rows.push(record); records.set(id, rows); }
  }
  return (scene.measurementSnapshots ?? []).filter(snapshot => snapshot.modelVersion === version).map(snapshot => {
    const circuit = voltammetryCircuit(snapshot), rows = records.get(snapshot.id) ?? [];
    const i = rows.find(row => circuit.ok && row.equipmentId === circuit.ammeter.id && row.quantity === 'current' && row.unit === 'A');
    const u = rows.find(row => circuit.ok && row.equipmentId === circuit.voltmeter.id && row.quantity === 'voltage' && row.unit === 'V');
    const valid = circuit.ok && rows.length === 2 && !!i && !!u && i.source === u.source && [i, u].every(row => row.measurementStatus === 'valid' && row.value !== null && Number.isFinite(row.value) && row.context?.instrumentStatus === 'valid' && row.runId === snapshot.runId && row.sequence === snapshot.sequence && row.documentRevision === snapshot.documentRevision);
    const current = i?.value ?? null, voltage = u?.value ?? null;
    const reason = !valid ? '读数缺失、异常或接线/快照无效。' : !(current! > 0 && voltage! > 0) ? '电流、电压须大于零，零读数不能用于测电阻。' : !Number.isFinite(voltage! / current!) ? '比值超出数值范围。' : null;
    const aRange = circuit.ok ? meterConnection(snapshot, circuit.ammeter.id).range : null, vRange = circuit.ok ? meterConnection(snapshot, circuit.voltmeter.id).range : null;
    const deltaI = circuit.ok && aRange ? Number(circuit.ammeter.parameters[`${aRange}Resolution`]) / 2 : null;
    const deltaU = circuit.ok && vRange ? Number(circuit.voltmeter.parameters[`${vRange}Resolution`]) / 2 : null;
    const resistance = reason ? null : voltage! / current!;
    const lower = resistance !== null ? Math.max(0, voltage! - deltaU!) / (current! + deltaI!) : null;
    const upper = resistance !== null && current! > deltaI! ? (voltage! + deltaU!) / (current! - deltaI!) : null;
    const signature = circuit.ok && !reason ? JSON.stringify([snapshot.setupLabel, i!.source, circuit.resistor.id, circuit.resistor.parameters, circuit.ammeter.id, circuit.ammeter.parameters.resistanceOhm, circuit.voltmeter.id, circuit.voltmeter.parameters.finiteInput, circuit.voltmeter.parameters.inputResistanceOhm, snapshot.modelConfigSnapshot.electricalMode, snapshot.modelConfigSnapshot.randomError]) : null;
    return { id: snapshot.id, label: snapshot.setupLabel, sample: circuit.ok ? String(circuit.resistor.parameters.sampleLabel ?? 'x') : 'x', source: i?.source ?? null, current, voltage, resistance, deltaI, deltaU, lower, upper, aRange, vRange, reason, signature };
  });
}

export function voltammetryAnalysis(scene: SceneDocument) {
  const results = voltammetryResults(scene), signatures = [...new Set(results.filter(row => !row.reason).map(row => row.signature!))];
  return { results, omitted: results.filter(row => !!row.reason).length, groups: signatures.map(id => {
    const rows = results.filter(row => row.signature === id && !row.reason), first = rows[0]!;
    const mean = rows.reduce((sum, row) => sum + row.resistance! / rows.length, 0);
    const meanDeviation = rows.reduce((sum, row) => sum + Math.abs(row.resistance! - mean) / rows.length, 0);
    const points = rows.map(row => ({ x: row.current!, y: row.voltage!, sampleId: row.id }));
    return { id, label: `${first.label || '未分组'} · R${first.sample} · ${first.source === 'manual' ? '手工抄表' : '仪表示数'}`, rows, mean, meanDeviation, relativeDeviationPercent: meanDeviation / mean * 100, distinct: new Set(points.map(point => point.x)).size, fit: linearFit(points, 3), points };
  }) };
}
