import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { LAMP } from './definitions.ts';
import { ohmCircuit } from './ohm.ts';
import { buildElectricalMeasurements } from './measure.ts';
import type { ElectricalMeasurementEntry, MeasurementBatch } from './measure.ts';

export const lampPowerMode = (scene: Pick<SceneDocument, 'experimentId' | 'ohmControl'>) => scene.experimentId === 'J-ELEC-04' || scene.experimentId === 'J-ELEC-FREE' && scene.ohmControl?.mode === 'lamp-power';
const version = 'electrical.lamp-power.measurement.v1';
export const lampPowerPointLabels = { below: '低于额定电压', rated: '额定工作点（按分度值）', above: '高于额定电压' };

export function lampPowerPoint(voltage: number, ratedVoltage: number, voltageResolution: number): keyof typeof lampPowerPointLabels {
  const difference = voltage - ratedVoltage;
  return Math.abs(difference) <= voltageResolution / 2 + 1e-9 * Math.max(1, ratedVoltage) ? 'rated' : difference < 0 ? 'below' : 'above';
}
export function lampPowerCircuit(scene: Pick<SceneDocument, 'equipment' | 'connections'>) {
  const circuit = ohmCircuit(scene, LAMP);
  if (!circuit.ok) return circuit;
  if (Number(circuit.ammeter.parameters.resistanceOhm) !== 0 || circuit.voltmeter.parameters.finiteInput !== false) return { ok: false as const, message: '初中小灯泡电功率实验使用理想电表，请恢复内阻 0 / ∞。' };
  return { ...circuit, lamp: circuit.resistor };
}
export function buildLampPowerMeasurements(scene: SceneDocument, registry: EquipmentRegistry, reply: SimulationReply | null, entry: ElectricalMeasurementEntry): MeasurementBatch {
  const circuit = lampPowerCircuit(scene);
  if (!lampPowerMode(scene) || !circuit.ok || entry.choices.length !== 2 || ![circuit.ammeter.id, circuit.voltmeter.id].every(id => entry.choices.some(choice => choice.equipmentId === id))) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const batch = buildElectricalMeasurements(scene, registry, reply, entry);
  if (batch.ok) batch.snapshot.modelVersion = version;
  return batch;
}
export function lampPowerResults(scene: SceneDocument) {
  const records = new Map<string, MeasurementRecord[]>();
  for (const record of scene.measurementRecords) {
    const id = record.context?.sampleId;
    if (id) { const rows = records.get(id) ?? []; rows.push(record); records.set(id, rows); }
  }
  return (scene.measurementSnapshots ?? []).filter(snapshot => snapshot.modelVersion === version).map(snapshot => {
    const circuit = lampPowerCircuit(snapshot), rows = records.get(snapshot.id) ?? [];
    const i = rows.find(row => circuit.ok && row.equipmentId === circuit.ammeter.id && row.quantity === 'current' && row.unit === 'A');
    const u = rows.find(row => circuit.ok && row.equipmentId === circuit.voltmeter.id && row.quantity === 'voltage' && row.unit === 'V');
    const valid = circuit.ok && rows.length === 2 && !!i && !!u && i.source === u.source && [i, u].every(row => row.measurementStatus === 'valid' && row.value !== null && Number.isFinite(row.value) && row.context?.instrumentStatus === 'valid' && row.runId === snapshot.runId && row.sequence === snapshot.sequence && row.documentRevision === snapshot.documentRevision);
    const current = i?.value ?? null, voltage = u?.value ?? null;
    const reason = !valid ? '读数缺失、异常或接线/快照无效。' : !(current! > 0 && voltage! > 0) ? '零读数不能比较通电工作点，请检查量程与电路。' : !Number.isFinite(current! * voltage!) || !(current! * voltage! > 0) ? '功率超出数值范围。' : null;
    const ratedVoltage = circuit.ok ? Number(circuit.lamp.parameters.ratedVoltageV) : null;
    const vRange = circuit.ok ? meterConnection(snapshot, circuit.voltmeter.id).range : null;
    const aRange = circuit.ok ? meterConnection(snapshot, circuit.ammeter.id).range : null;
    const resolution = circuit.ok && vRange ? Number(circuit.voltmeter.parameters[`${vRange}Resolution`]) : null;
    const power = reason ? null : current! * voltage!, point = reason ? null : lampPowerPoint(voltage!, ratedVoltage!, resolution!);
    const displayed = u?.context?.instrumentDisplayValue;
    const instrumentPoint = reason || displayed === null || displayed === undefined ? null : lampPowerPoint(displayed, ratedVoltage!, resolution!);
    const workPointWarning = point && point !== instrumentPoint ? '记录电压与当次仪表工作点不一致。' : null;
    const signature = circuit.ok && !reason ? JSON.stringify([snapshot.setupLabel, i!.source, circuit.lamp.id, circuit.lamp.parameters, snapshot.modelConfigSnapshot.electricalMode, snapshot.modelConfigSnapshot.randomError]) : null;
    return { id: snapshot.id, label: snapshot.setupLabel, note: snapshot.note, source: i?.source ?? null, current, voltage, power, ratedVoltage, resolution, aRange, vRange, point, workPointWarning, reason, signature };
  });
}
export function lampPowerAnalysis(scene: SceneDocument) {
  const results = lampPowerResults(scene), signatures = [...new Set(results.filter(row => !row.reason).map(row => row.signature!))];
  return { results, omitted: results.filter(row => !!row.reason).length, groups: signatures.map(id => {
    const rows = results.filter(row => row.signature === id && !row.reason), first = rows[0]!, rated = rows.filter(row => row.point === 'rated' && !row.workPointWarning);
    return { id, label: `${first.label || '未分组'} · ${first.source === 'manual' ? '手工抄表' : '仪表示数'}`, rows, ratedVoltage: first.ratedVoltage!, ratedCount: rated.length, ratedPower: rated.length ? rated.reduce((sum, row) => sum + row.power! / rated.length, 0) : null };
  }) };
}
