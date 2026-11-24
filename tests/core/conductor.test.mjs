import test from 'node:test';
import assert from 'node:assert/strict';
import { createConductorExperiment } from '../../src/experiments/conductor.ts';
import { CONDUCTOR_EXPERIMENT, METAL_WIRE, MetalWireSchema, metalResistance, metalPoint } from '../../src/equipment/electrical/conductor.ts';
import { conductorChange, conductorTemperature, conductorRows, conductorContrast, heaterAligned } from '../../src/equipment/conductor/experiment.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentAvailability } from '../../src/equipment/support.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildElectricalMeasurements } from '../../src/equipment/electrical/measure.ts';
import { appendMeasurements, correctManualMeasurement } from '../../src/core/measurements/records.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';

const time = '2026-11-24T00:00:00.000Z', registry = createWorkbenchRegistry();
const make = () => createConductorExperiment('conductor.test', time);
const item = (s, id) => s.equipment.find(i => i.id === id);
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function change(s, input) { const c = conductorChange(s, input); assert.ok(c); const r = executeCommand(createHistory(s), c, registry, time); assert.equal(r.ok, true); return r.history.present; }
function closed(s) { const copy = structuredClone(s); item(copy, 'S').parameters.closed = true; return copy; }
function capture(s, id, value = '.2') {
  const outcome = simulateElectrical(s), built = buildElectricalMeasurements(s, registry, { commandType: 'result', documentId: s.documentId, documentRevision: s.revision, runId: 'run', sequence: 1, payload: outcome }, { source: 'manual', setupLabel: '第1组', note: '控制变量', sampleId: id, timestamp: time, choices: [{ id: id + '.I', equipmentId: 'A', pointLabel: metalPoint(item(s, 'M')), rawInput: value }] });
  assert.equal(built.ok, true); const result = appendMeasurements(s, registry, built.records, built.snapshot, time); assert.equal(result.ok, true); return result.document;
}

test('five original apparatus kinds and one metal wire produce a valid ideal-meter experiment', () => {
  const s = make(); assert.equal(s.experimentId, CONDUCTOR_EXPERIMENT); assert.equal(s.equipment.length, 6);
  assert.equal(s.connections.length, 4); assert.equal(item(s, 'S').parameters.closed, false); assert.equal(item(s, 'A').parameters.resistanceOhm, 0);
  assert.equal(validateSceneDocument(s, registry).ok, true); assert.equal(s.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.equal(equipmentAvailability(s, METAL_WIRE).enabled, false); assert.equal(equipmentAvailability(s, 'thermal.heater').enabled, false);
  assert.equal(equipmentAvailability({ ...s, experimentId: 'J-ELEC-FREE' }, METAL_WIRE).enabled, true);
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
});

test('independent resistance benchmarks distinguish length, area, material and temperature', () => {
  const p = item(make(), 'M').parameters;
  for (const [change, resistance] of [[{}, 5], [{ lengthM: 1 }, 10], [{ areaM2: 2e-7 }, 2.5], [{ material: 'constantan' }, 2.45], [{ material: 'iron' }, .4855], [{ temperatureK: 353.15 }, 5.12], [{ material: 'iron', temperatureK: 353.15 }, .674845]]) near(metalResistance({ ...p, ...change }), resistance);
  for (const bad of [{ areaM2: 0 }, { lengthM: 0 }, { temperatureK: 400 }, { areaM2: Infinity }, { material: 'unknown' }]) { assert.equal(MetalWireSchema.safeParse({ ...p, ...bad }).success, false); assert.throws(() => metalResistance({ ...p, ...bad })); }
});

test('actual current changes through the original MNA solver, with genuine iron over-range and range rewiring', () => {
  for (const [sample, display, resistance] of [['A', .2, 5], ['B', .1, 10], ['C', .4, 2.5], ['D', .4, 2.45]]) {
    const s = closed(change(make(), { sample })), o = simulateElectrical(s); assert.equal(o.result.ok, true);
    const m = o.meters.find(m => m.id === 'A'); assert.equal(m.status, 'valid'); near(m.displayValue, display); near(m.trueValue, 1 / resistance);
  }
  const iron = change(make(), { sample: 'E' }); assert.equal(simulateElectrical(closed(iron)).meters[0].status, 'over-range');
  const high = change(iron, { range: 'high' }), a = simulateElectrical(closed(high)).meters[0]; assert.equal(a.status, 'valid'); near(a.trueValue, 1 / .4855); near(a.displayValue, 2.1);
  const hot = change(high, { parameters: { temperatureK: 353.15 } }), b = simulateElectrical(closed(hot)).meters[0]; near(b.trueValue, 1 / .674845); near(b.displayValue, 1.5);
});

test('sample substitution preserves source, existing temperature, poses and wiring, and requires an open switch', () => {
  let s = change(make(), { parameters: { temperatureK: 323.15 } }); item(s, 'E').parameters.voltageV = 2;
  const source = structuredClone(item(s, 'E')), poses = s.equipment.map(i => structuredClone(i.pose)), wires = structuredClone(s.connections);
  for (const sample of ['B', 'C', 'D', 'E', 'A']) { s = change(s, { sample }); assert.deepEqual(item(s, 'E'), source); assert.deepEqual(s.equipment.map(i => i.pose), poses); assert.deepEqual(s.connections, wires); near(item(s, 'M').parameters.temperatureK, 323.15); }
  for (const input of [{ sample: 'B' }, { range: 'high' }, { thermal: 'heat' }, { parameters: { temperatureK: 313.15 } }]) assert.equal(conductorChange(closed(s), input), null);
  assert.equal(conductorChange(s, { parameters: { areaM2: 0 } }), null);
});

test('heating and cooling obey independent energy benchmarks, heater parameters, boundaries and placement', () => {
  near(conductorTemperature(293.15, 293.15, 21, 0, 5), 303.65);
  near(conductorTemperature(333.15, 293.15, 0, .15, 30), 318.6551260648709);
  near(conductorTemperature(350, 293.15, 200, 0, 5), 353.15);
  near(conductorTemperature(293.15, 280, 0, 1, 100), 293.15);
  assert.throws(() => conductorTemperature(300, 293, 20, -1, 5));
  const tilted = make(); item(tilted, 'M').pose.rotationRad = .2; assert.equal(heaterAligned(tilted), undefined);
  const s = make(); assert.ok(heaterAligned(s)); const hot = change(s, { thermal: 'heat' }); assert.ok(item(hot, 'M').parameters.temperatureK > 303);
  const cool = change(hot, { thermal: 'cool' }); assert.ok(item(cool, 'M').parameters.temperatureK < item(hot, 'M').parameters.temperatureK);
  const stronger = make(); item(stronger, 'H').parameters.powerW = 60; assert.ok(item(change(stronger, { thermal: 'heat' }), 'M').parameters.temperatureK > item(hot, 'M').parameters.temperatureK);
  item(s, 'H').pose.xM = .8; assert.equal(heaterAligned(s), undefined); assert.equal(conductorChange(s, { thermal: 'heat' }), null);
  assert.ok(conductorChange(s, { parameters: { temperatureK: 313.15 } }));
});

test('a temperature change is one undo and returns exactly to the prior configuration', () => {
  const s = make(), r = executeCommand(createHistory(s), conductorChange(s, { thermal: 'heat' }), registry, time); assert.equal(r.ok, true); assert.equal(r.history.undo.length, 1);
  assert.deepEqual(r.history.present.equipment.filter(i => i.id !== 'M'), s.equipment.filter(i => i.id !== 'M'));
  const undo = travelHistory(r.history, 'undo', registry, time); assert.equal(undo.ok, true); assert.deepEqual(undo.history.present.equipment, s.equipment);
  const redo = travelHistory(undo.history, 'redo', registry, time); near(item(redo.history.present, 'M').parameters.temperatureK, item(r.history.present, 'M').parameters.temperatureK);
});

test('thermal instruments are passive only in this experiment; metal wire works in ordinary electric construction', () => {
  const s = make(); assert.equal(simulateElectrical(closed(s)).result.ok, true);
  s.experimentId = 'J-ELEC-FREE'; assert.equal(simulateElectrical(s).result.ok, false);
  s.equipment = s.equipment.filter(i => !i.type.startsWith('thermal.')); assert.equal(simulateElectrical(closed(s)).result.ok, true);
  const broken = make(); item(broken, 'M').parameters.areaM2 = 0; assert.equal(simulateElectrical(broken).result.ok, false); assert.deepEqual(simulateElectrical(broken).meters, []);
});

test('frozen conditions, missing readings, revision, corrections, control comparisons and SI JSON remain independent', () => {
  let s = capture(closed(make()), 'base'); item(s, 'S').parameters.closed = false;
  s = capture(closed(change(s, { sample: 'B' })), 'long', '.10');
  let rows = conductorRows(s); assert.equal(conductorContrast(rows[0], rows[1]), '只改变长度');
  const snapshots = structuredClone(s.measurementSnapshots); item(s, 'S').parameters.closed = false;
  s = change(s, { sample: 'C' }); assert.deepEqual(s.measurementSnapshots, snapshots);
  s = capture(closed(s), 'thick', '.40'); rows = conductorRows(s); assert.equal(conductorContrast(rows[1], rows[2]), '同时改变多个因素');
  const corrected = correctManualMeasurement(s, registry, 'long.I', '.12', time); assert.equal(corrected.ok, true); s = corrected.document;
  near(conductorRows(s)[1].value, .12); assert.equal(s.measurementRecords.find(r => r.id === 'long.I').context.originalRawInput, '.10');
  s = capture(s, 'blank', ''); assert.equal(conductorRows(s).at(-1).value, null);
  assert.match(measurementsCsv(s), /0.1mm²/); assert.match(measurementsCsv(s), /20℃/);
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
  rows = conductorRows(s); const changedSource = { ...rows[1], source: 'rewired' }; assert.equal(conductorContrast(rows[0], changedSource), '电源或电表条件不同');
});
