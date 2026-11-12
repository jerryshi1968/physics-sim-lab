import type { SceneDocument, OhmControl, MeasurementRecord } from '../../core/scene/schema.ts';
import { OhmControlSchema } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { endpointKey } from '../../core/workbench/geometry.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { buildElectricalMeasurements } from './measure.ts';
import type { ElectricalMeasurementEntry, MeasurementBatch } from './measure.ts';
import { POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT, JUNCTION } from './definitions.ts';

export const ohmRecordMode = (scene: Pick<SceneDocument, 'experimentId' | 'ohmControl'>) => scene.experimentId === 'J-ELEC-02' || scene.experimentId === 'J-ELEC-FREE' && scene.ohmControl !== undefined;
export const ohmLabels = { voltage: 'I–U：保持电阻不变', resistance: 'I–1/R：保持电压不变' };
export const ohmResistanceChoices = [5, 10, 15, 20, 25] as const;
export const ohmControl = (scene: SceneDocument): OhmControl => scene.ohmControl ?? { mode: 'voltage', fixedResistanceOhm: 10, targetVoltageV: 2, voltageToleranceV: .05 };
type CircuitScene = Pick<SceneDocument, 'equipment' | 'connections'>;
type OhmCircuit = { ok: true; source: EquipmentInstance; resistor: EquipmentInstance; rheostat: EquipmentInstance; ammeter: EquipmentInstance; voltmeter: EquipmentInstance; signature: string } | { ok: false; message: string };

export function ohmCircuit(scene: CircuitScene): OhmCircuit {
  const fail = (message: string): OhmCircuit => ({ ok: false, message }), one = (type: string) => scene.equipment.filter(item => item.type === type);
  if (![POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT].every(type => one(type).length === 1)) return fail('请各放置一只电源、开关、定值电阻、电流表、电压表和四柱滑动变阻器。');
  if (scene.equipment.some(item => ![POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT, JUNCTION].includes(item.type))) return fail('本实验使用定值电阻，请移除不支持的器材。');
  if (scene.connections.some(wire => wire.kind !== 'wire' || !wire.from || !wire.to)) return fail('请接好或删除悬空导线后读表。');
  const source = one(POWER)[0]!, resistor = one(RESISTOR)[0]!, sw = one(SWITCH)[0]!, rheostat = one(RHEOSTAT)[0]!, ammeter = one(AMMETER)[0]!, voltmeter = one(VOLTMETER)[0]!;
  const a = meterConnection(scene, ammeter.id), v = meterConnection(scene, voltmeter.id);
  if (!a.range || !v.range || a.bothRanges || v.bothRanges || !a.commonConnected || !v.commonConnected) return fail('电表应接公共负端和一个正量程端，不能同时接两个正量程端。');
  const connected = (item: EquipmentInstance, port: string) => scene.connections.some(wire => [wire.from, wire.to].some(end => end?.equipmentId === item.id && end.portId === port));
  const bottom = ['a', 'b'].filter(port => connected(rheostat, port)), top = ['c', 'd'].filter(port => connected(rheostat, port));
  if (bottom.length !== 1 || top.length !== 1) return fail('四柱变阻器应使用一上一下两柱；接两下柱是定值电阻，接两上柱近似短路。');
  if (![source, resistor, sw].every(item => (item.type === POWER ? ['positive', 'negative'] : ['a', 'b']).every(port => connected(item, port)))) return fail('请将电源、开关和定值电阻接入完整回路。');
  const parents = new Map<string, string>();
  const root = (key: string): string => { const next = parents.get(key); if (!next) { parents.set(key, key); return key; } if (next === key) return key; const result = root(next); parents.set(key, result); return result; };
  const union = (x: string, y: string) => parents.set(root(x), root(y)), key = (item: EquipmentInstance, port: string) => endpointKey({ equipmentId: item.id, portId: port });
  for (const wire of scene.connections) union(endpointKey(wire.from!), endpointKey(wire.to!));
  if (root(key(sw, 'a')) === root(key(sw, 'b'))) return fail('开关被导线旁路，请重新接线。');
  if (!sw.parameters.closed) return fail('开关已断开，请接好电路后闭合并读表。');
  union(key(sw, 'a'), key(sw, 'b')); union(key(rheostat, 'c'), key(rheostat, 'd'));
  const p = root(key(source, 'positive')), n = root(key(source, 'negative'));
  const edges = [{ kind: 'A', from: root(key(ammeter, a.range)), to: root(key(ammeter, 'common')) }, { kind: 'R', from: root(key(resistor, 'a')), to: root(key(resistor, 'b')) }, { kind: 'Rp', from: root(key(rheostat, bottom[0]!)), to: root(key(rheostat, top[0]!)) }];
  const invalid = () => fail('请检查接线：电流表、定值电阻和变阻器串联，电压表正向跨接定值电阻两端；禁止旁路或短接。');
  if (p === n || edges.some(edge => edge.from === edge.to)) return invalid();
  let node = p, positive = '', negative = '';
  while (edges.length) {
    const incident = edges.filter(edge => edge.from === node || edge.to === node);
    if (incident.length !== 1 || node === n) return invalid();
    const edge = incident[0]!, next = edge.from === node ? edge.to : edge.from;
    if (edge.kind === 'A' && edge.from !== node) return fail('电流表反接，请让电流从正量程端流入。');
    if (edge.kind === 'R') { positive = node; negative = next; }
    edges.splice(edges.indexOf(edge), 1); node = next;
  }
  if (node !== n || root(key(voltmeter, v.range)) !== positive || root(key(voltmeter, 'common')) !== negative) return invalid();
  const signature = JSON.stringify([source.id, source.parameters, resistor.id, ammeter.id, ammeter.parameters, a.range, voltmeter.id, voltmeter.parameters, v.range, rheostat.id, rheostat.parameters.maxResistanceOhm]);
  return { ok: true, source, resistor, rheostat, ammeter, voltmeter, signature };
}

export function ohmQualification(control: OhmControl, resistance: number, shownVoltage: number | null, recordedVoltage?: number | null) {
  if (control.mode === 'voltage') return Math.abs(resistance - control.fixedResistanceOhm) <= Math.max(1e-9, control.fixedResistanceOhm * 1e-9) ? null : '定值电阻已改变，未保持本组固定电阻。';
  const within = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value) && Math.abs(value - control.targetVoltageV) <= control.voltageToleranceV + 1e-9;
  if (!within(shownVoltage)) return '电压表示数未保持目标值，请调节变阻器后重新读表。';
  if (recordedVoltage !== undefined && !within(recordedVoltage)) return '所记电压不符合本组保持电压的条件。';
  return null;
}
export function buildOhmMeasurements(scene: SceneDocument, registry: EquipmentRegistry, reply: SimulationReply | null, entry: ElectricalMeasurementEntry): MeasurementBatch {
  const circuit = ohmCircuit(scene);
  if (!ohmRecordMode(scene) || !circuit.ok || entry.choices.length !== 2 || ![circuit.ammeter.id, circuit.voltmeter.id].every(id => entry.choices.some(choice => choice.equipmentId === id))) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const batch = buildElectricalMeasurements(scene, registry, reply, entry);
  if (!batch.ok) return batch;
  const note = JSON.stringify({ control: ohmControl(scene), note: entry.note });
  if (note.length > 500) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  batch.snapshot.modelVersion = 'electrical.ohm.inquiry.v1'; batch.snapshot.note = note;
  return batch;
}
export function ohmResults(scene: SceneDocument) {
  const rows = new Map<string, MeasurementRecord[]>();
  for (const record of scene.measurementRecords) { const id = record.context?.sampleId; if (id) { const group = rows.get(id) ?? []; group.push(record); rows.set(id, group); } }
  return (scene.measurementSnapshots ?? []).filter(snapshot => snapshot.modelVersion === 'electrical.ohm.inquiry.v1').map(snapshot => {
    const circuit = ohmCircuit(snapshot), records = rows.get(snapshot.id) ?? [];
    let control: OhmControl | null = null;
    try { const parsed = OhmControlSchema.safeParse(JSON.parse(snapshot.note).control); if (parsed.success) control = parsed.data; } catch { /* A malformed imported control snapshot must not qualify for a fit. */ }
    const i = records.find(record => circuit.ok && record.equipmentId === circuit.ammeter.id && record.quantity === 'current' && record.unit === 'A');
    const u = records.find(record => circuit.ok && record.equipmentId === circuit.voltmeter.id && record.quantity === 'voltage' && record.unit === 'V');
    const nominal = circuit.ok ? Number(circuit.resistor.parameters.resistanceOhm) : NaN;
    const resistance = Number.isFinite(nominal) && nominal > 0 ? nominal : null;
    const valid = !!control && circuit.ok && records.length === 2 && !!i && !!u && i.source === u.source && [i, u].every(record => record.measurementStatus === 'valid' && record.value !== null && record.context?.instrumentStatus === 'valid' && record.runId === snapshot.runId && record.sequence === snapshot.sequence && record.documentRevision === snapshot.documentRevision) && resistance !== null && Number.isFinite(resistance) && resistance > 0;
    const reason = !valid ? '读数缺失、异常或接线/快照无效。' : ohmQualification(control!, resistance!, u!.context!.instrumentDisplayValue, u!.value);
    return { id: snapshot.id, label: snapshot.setupLabel, control, circuit, resistance, current: valid ? i!.value : null, voltage: valid ? u!.value : null, source: i?.source ?? null, reason,
      signature: valid ? JSON.stringify([snapshot.setupLabel, i!.source, control, circuit.ok ? circuit.signature : '', snapshot.modelConfigSnapshot.electricalMode, snapshot.modelConfigSnapshot.randomError]) : null };
  });
}
export function ohmFits(scene: SceneDocument) {
  const results = ohmResults(scene), signatures = [...new Set(results.filter(row => !row.reason).map(row => row.signature!))];
  return { results, omitted: results.filter(row => !!row.reason).length, groups: signatures.map(id => {
    const rows = results.filter(row => row.signature === id && !row.reason), first = rows[0]!, control = first.control!;
    const points = rows.map(row => ({ x: control.mode === 'voltage' ? row.voltage! : 1 / row.resistance!, y: row.current!, sampleId: row.id }));
    const fit = linearFit(points);
    return { id, label: `${first.label || '未分组'} · ${first.source === 'manual' ? '手工抄表' : '仪表示数'}`, control, points, fit, finiteVoltmeter: first.circuit.ok && first.circuit.voltmeter.parameters.finiteInput === true };
  }) };
}
