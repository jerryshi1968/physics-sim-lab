import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { endpointKey } from '../../core/workbench/geometry.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT, JUNCTION } from './definitions.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { buildElectricalMeasurements } from './measure.ts';
import type { ElectricalMeasurementEntry, MeasurementBatch } from './measure.ts';

export type EmfWiring = 'inner' | 'outer';
export const emfWiringLabels = { inner: '电流表内接 · 电压表跨电源端', outer: '电流表外接 · 电压表跨负载' };
type Circuit = Pick<SceneDocument, 'equipment' | 'connections'>;
export type EmfCircuit = { ok: true; wiring: EmfWiring; source: EquipmentInstance; ammeter: EquipmentInstance; voltmeter: EquipmentInstance; signature: string } | { ok: false; message: string };

export function emfCircuit(scene: Circuit): EmfCircuit {
  const one = (type: string) => scene.equipment.filter(item => item.type === type);
  const source = one(POWER)[0], ammeter = one(AMMETER)[0], voltmeter = one(VOLTMETER)[0];
  if (![POWER, AMMETER, VOLTMETER].every(type => one(type).length === 1) || !source || !ammeter || !voltmeter) return { ok: false, message: '请各放置一只电源、电流表和电压表。' };
  if (scene.equipment.some(item => ![POWER, AMMETER, VOLTMETER, RESISTOR, SWITCH, RHEOSTAT, JUNCTION].includes(item.type))) return { ok: false, message: '本实验的拟合仅支持电阻性负载。' };
  if (scene.connections.some(wire => wire.kind !== 'wire' || !wire.from || !wire.to)) return { ok: false, message: '存在未接好的导线，接好或删除后再记录。' };
  const a = meterConnection(scene, ammeter.id), v = meterConnection(scene, voltmeter.id);
  if (!a.range || !v.range || a.bothRanges || v.bothRanges || !a.commonConnected || !v.commonConnected) return { ok: false, message: '请正确连接电表的公共端及一个量程端。' };
  const parent = new Map<string, string>();
  const root = (key: string): string => { const next = parent.get(key); if (!next) { parent.set(key, key); return key; } if (next === key) return key; const result = root(next); parent.set(key, result); return result; };
  const union = (x: string, y: string) => parent.set(root(x), root(y));
  const key = (item: EquipmentInstance, portId: string) => endpointKey({ equipmentId: item.id, portId });
  for (const wire of scene.connections) union(endpointKey(wire.from!), endpointKey(wire.to!));
  const resistors: [string, string][] = [];
  const resistor = (x: string, y: string, resistance: number) => resistance === 0 ? union(x, y) : resistors.push([x, y]);
  for (const item of scene.equipment) {
    if (item.type === SWITCH && item.parameters.closed) union(key(item, 'a'), key(item, 'b'));
    if (item.type === RESISTOR) resistor(key(item, 'a'), key(item, 'b'), Number(item.parameters.resistanceOhm));
    if (item.type === RHEOSTAT) {
      union(key(item, 'c'), key(item, 'd'));
      resistor(key(item, 'a'), key(item, 'c'), Number(item.parameters.maxResistanceOhm) * Number(item.parameters.position));
      resistor(key(item, 'b'), key(item, 'c'), Number(item.parameters.maxResistanceOhm) * (1 - Number(item.parameters.position)));
    }
  }
  const p = root(key(source, 'positive')), n = root(key(source, 'negative')), load = root(key(ammeter, 'common'));
  const ap = root(key(ammeter, a.range)), vp = root(key(voltmeter, v.range)), vn = root(key(voltmeter, 'common'));
  const wiring = vp === p ? 'inner' : vp === load ? 'outer' : null;
  const invalid = { ok: false as const, message: '请闭合开关并检查接线：电流表串联，电压表负端接电源负端，正端跨电源或负载；禁止旁路和短接。' };
  if (p === n || p === load || load === n || ap !== p || vn !== n || !wiring) return invalid;
  const edges = resistors.map(([x, y]) => [root(x), root(y)]);
  if (edges.some(([x, y]) => x === p || y === p)) return invalid;
  const visited = new Set([load]);
  for (let size = -1; size !== visited.size;) { size = visited.size; for (const [x, y] of edges) { if (visited.has(x!)) visited.add(y!); if (visited.has(y!)) visited.add(x!); } }
  if (!visited.has(n) || edges.some(([x, y]) => !visited.has(x!) || !visited.has(y!))) return invalid;
  const signature = JSON.stringify([wiring, source.id, source.parameters.voltageV, source.parameters.internalResistanceOhm ?? 0,
    ammeter.id, ammeter.parameters, a.range, voltmeter.id, voltmeter.parameters, v.range]);
  return { ok: true, wiring, source, ammeter, voltmeter, signature };
}

export function emfFits(scene: SceneDocument) {
  const groups = new Map<string, { id: string; label: string; wiring: EmfWiring; circuit: Extract<EmfCircuit, { ok: true }>; points: { x: number; y: number }[] }>();
  const bySample = new Map<string, SceneDocument['measurementRecords']>();
  for (const row of scene.measurementRecords) {
    const id = row.context?.sampleId;
    if (id) { const rows = bySample.get(id) ?? []; rows.push(row); bySample.set(id, rows); }
  }
  let omitted = 0;
  for (const snapshot of scene.measurementSnapshots ?? []) {
    if (snapshot.modelVersion !== 'electrical.emf.v1') continue;
    const circuit = emfCircuit(snapshot);
    const rows = bySample.get(snapshot.id) ?? [];
    const current = rows.find(row => row.equipmentId === (circuit.ok ? circuit.ammeter.id : '') && row.quantity === 'current' && row.unit === 'A');
    const voltage = rows.find(row => row.equipmentId === (circuit.ok ? circuit.voltmeter.id : '') && row.quantity === 'voltage' && row.unit === 'V');
    if (!circuit.ok || !current || !voltage || rows.length !== 2 || current.source !== voltage.source || [current, voltage].some(row => row.measurementStatus !== 'valid' || row.value === null || row.context?.instrumentStatus !== 'valid' || row.runId !== snapshot.runId || row.sequence !== snapshot.sequence || row.documentRevision !== snapshot.documentRevision)) { omitted++; continue; }
    const id = JSON.stringify([snapshot.setupLabel, current.source, circuit.signature]);
    const group = groups.get(id) ?? { id, label: `${snapshot.setupLabel || '未分组'} · ${emfWiringLabels[circuit.wiring]} · ${current.source === 'manual' ? '手工抄表' : '仪表示数'}`, wiring: circuit.wiring, circuit, points: [] };
    group.points.push({ x: current.value!, y: voltage.value! }); groups.set(id, group);
  }
  return { omitted, groups: [...groups.values()].map(group => {
    const fit = linearFit(group.points);
    return { ...group, fit, physical: !!fit && fit.intercept > 0 && fit.slope <= 0 };
  }) };
}

export function emfLoading(circuit: Extract<EmfCircuit, { ok: true }>) {
  const e = Number(circuit.source.parameters.voltageV), r = Number(circuit.source.parameters.internalResistanceOhm ?? 0);
  const ra = Number(circuit.ammeter.parameters.resistanceOhm), rv = circuit.voltmeter.parameters.finiteInput ? Number(circuit.voltmeter.parameters.inputResistanceOhm) : Infinity;
  return circuit.wiring === 'inner' ? { intercept: e / (1 + r / rv), resistance: r / (1 + r / rv), e, r, ra, rv }
    : { intercept: e, resistance: r + ra, e, r, ra, rv };
}

export function buildEmfMeasurements(scene: SceneDocument, registry: EquipmentRegistry, reply: SimulationReply | null, entry: ElectricalMeasurementEntry): MeasurementBatch {
  const circuit = emfCircuit(scene);
  if (!circuit.ok || entry.choices.length !== 2 || ![circuit.ammeter.id, circuit.voltmeter.id].every(id => entry.choices.some(choice => choice.equipmentId === id))) return { ok: false, code: 'INVALID_MEASUREMENT_SELECTION' };
  const batch = buildElectricalMeasurements(scene, registry, reply, entry);
  if (batch.ok) batch.snapshot.modelVersion = 'electrical.emf.v1';
  return batch;
}
