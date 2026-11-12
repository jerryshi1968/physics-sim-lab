import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoltammetryExperiment } from '../../src/experiments/voltammetry.ts';
import { createCatalogExperiment } from '../../src/experiments/catalog.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildVoltammetryMeasurements, voltammetryAnalysis, voltammetryMode } from '../../src/equipment/electrical/voltammetry.ts';
import { ohmRecordMode } from '../../src/equipment/electrical/ohm.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-12T08:00:00.000Z';
const item = (scene, id) => scene.equipment.find(value => value.id === id);
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function create(low = true) {
  const scene = createVoltammetryExperiment('resistance', time);
  item(scene, 'S').parameters.closed = true;
  if (low) for (const wire of scene.connections) for (const end of [wire.from, wire.to]) if (['A', 'V'].includes(end.equipmentId) && end.portId === 'high') end.portId = 'low';
  return scene;
}
function build(scene, source = 'manual', values, revision = scene.revision) {
  const payload = simulateElectrical(scene), sampleId = `sample.${scene.revision}`;
  assert.equal(payload.result.ok, true);
  const choices = ['A', 'V'].map((id, index) => ({ id: `${sampleId}.${id}`, equipmentId: id, pointLabel: id, rawInput: String(values?.[index] ?? payload.meters.find(meter => meter.id === id).trueValue) }));
  return buildVoltammetryMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: revision, runId: 'run', sequence: scene.revision + 1, payload }, { source, choices, sampleId, timestamp: time, setupLabel: '第1组', note: '' });
}
function capture(scene, source = 'manual', values) {
  const batch = build(scene, source, values); assert.equal(batch.ok, true, batch.code);
  const appended = appendMeasurements(scene, registry, batch.records, batch.snapshot, time); assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics)); return appended.document;
}

test('J-ELEC-03 reuses the six existing apparatus, starts safely on high ranges and round trips hidden resistor settings', () => {
  const scene = createVoltammetryExperiment('start', time);
  assert.equal(scene.experimentId, 'J-ELEC-03'); assert.equal(equipmentSupport(scene).key, 'voltammetry');
  assert.equal(scene.equipment.length, 6); assert.equal(scene.connections.length, 7); assert.equal(scene.measurementRecords.length, 0);
  assert.equal(item(scene, 'S').parameters.closed, false); assert.equal(item(scene, 'Rp').parameters.position, 1);
  assert.deepEqual(item(scene, 'R').parameters, { resistanceOhm: 7.5, concealResistance: true, sampleLabel: 'A' });
  assert.equal(item(scene, 'V').parameters.finiteInput, false);
  assert.equal(scene.connections.some(wire => wire.from.portId === 'low' || wire.to.portId === 'low'), false);
  assert.equal(equipmentAvailability(scene, 'electrical.lamp').enabled, false);
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
});

test('independent divider benchmark and actual meter ranges show different quantization and resolution intervals', () => {
  const scene = create(false), meters = simulateElectrical(scene).meters;
  close(meters.find(meter => meter.id === 'A').trueValue, 12 / 115);
  close(meters.find(meter => meter.id === 'V').trueValue, 18 / 23);
  const high = voltammetryAnalysis(capture(scene, 'instrument')).results[0];
  close(high.resistance, 10); close(high.lower, 5); close(high.upper, 25);
  const low = voltammetryAnalysis(capture(create(), 'instrument')).results[0];
  close(low.resistance, 8); close(low.lower, .75 / .11); close(low.upper, .85 / .09);
  assert.ok(low.upper - low.lower < high.upper - high.lower);
});

test('three independently chosen divider points calculate U/I means and U-I slope without using hidden resistance as the answer', () => {
  for (const source of ['manual', 'instrument']) {
    let scene = create();
    for (const [position, current, voltage] of [[.6, .16, 1.2], [.35, .24, 1.8], [.225, .32, 2.4]]) {
      item(scene, 'Rp').parameters.position = position; scene.revision++;
      const payload = simulateElectrical(scene); close(payload.meters.find(meter => meter.id === 'A').trueValue, current); close(payload.meters.find(meter => meter.id === 'V').trueValue, voltage);
      scene = capture(scene, source, [current, voltage]);
    }
    const analysis = voltammetryAnalysis(scene), group = analysis.groups[0];
    assert.equal(analysis.results.length, 3); assert.equal(analysis.omitted, 0); close(group.mean, 7.5); close(group.meanDeviation, 0); close(group.fit.slope, 7.5); close(group.fit.intercept, 0); close(group.fit.rSquared, 1);
    item(scene, 'R').parameters.resistanceOhm = 99;
    close(voltammetryAnalysis(scene).groups[0].mean, 7.5);
  }
});

test('manual correction and deletion recompute derived resistance, retain the captured apparatus and exclude partial pairs', () => {
  let scene = capture(create(), 'manual', [.1, .8]);
  close(voltammetryAnalysis(scene).groups[0].mean, 8);
  const frozen = JSON.stringify(scene.measurementSnapshots);
  const corrected = correctManualMeasurement(scene, registry, scene.measurementRecords[1].id, '.9', time); assert.equal(corrected.ok, true); scene = corrected.document;
  close(voltammetryAnalysis(scene).groups[0].mean, 9); assert.equal(JSON.stringify(scene.measurementSnapshots), frozen);
  const removed = removeMeasurement(scene, registry, scene.measurementRecords[0].id, time); assert.equal(removed.ok, true);
  assert.equal(voltammetryAnalysis(removed.document).omitted, 1); assert.equal(voltammetryAnalysis(removed.document).groups.length, 0);
});

test('zero, missing, reversed and over-range data never produce a normal resistance; near resolution has no finite upper bound', () => {
  for (const values of [[0, 0], ['', .8], [-.1, .8], [4, .8]]) {
    const analysis = voltammetryAnalysis(capture(create(), 'manual', values));
    assert.equal(analysis.omitted, 1); assert.equal(analysis.results[0].resistance, null); assert.equal(analysis.groups.length, 0);
  }
  const overloaded = create(); item(overloaded, 'Rp').parameters.position = 0;
  const invalid = voltammetryAnalysis(capture(overloaded, 'instrument')); assert.equal(invalid.omitted, 1);
  const near = voltammetryAnalysis(capture(create(), 'manual', [.01, .8])).results[0]; assert.equal(near.reason, null); assert.equal(near.upper, null);
});

test('actual wiring and reply revision guard capture; this junior experiment rejects non-ideal meter configurations', () => {
  assert.equal(build(create(), 'manual', undefined, -1).ok, false);
  const wrong = create(); wrong.connections.find(wire => wire.to.equipmentId === 'Rp').to.portId = 'd'; assert.equal(build(wrong).ok, false);
  const reversed = create(); for (const wire of reversed.connections) for (const end of [wire.from, wire.to]) if (end.equipmentId === 'A') end.portId = end.portId === 'common' ? 'low' : 'common'; assert.equal(build(reversed).ok, false);
  const scene = create(); item(scene, 'V').parameters.finiteInput = true; item(scene, 'V').parameters.inputResistanceOhm = 30;
  assert.equal(build(scene).ok, false);
  item(scene, 'V').parameters.finiteInput = false; item(scene, 'A').parameters.resistanceOhm = .1; assert.equal(build(scene).ok, false);
});

test('series are separated for different specimens or sources, while both meter ranges can compare the same resistor', () => {
  let scene = capture(create(false), 'instrument');
  for (const wire of scene.connections) for (const end of [wire.from, wire.to]) if (['A', 'V'].includes(end.equipmentId) && end.portId === 'high') end.portId = 'low';
  scene.revision++; scene = capture(scene, 'instrument'); assert.equal(voltammetryAnalysis(scene).groups.length, 1);
  item(scene, 'R').parameters.resistanceOhm = 12.5; item(scene, 'R').parameters.sampleLabel = 'B'; scene.revision++; scene = capture(scene, 'instrument'); assert.equal(voltammetryAnalysis(scene).groups.length, 2);
  scene = capture(scene, 'manual'); assert.equal(voltammetryAnalysis(scene).groups.length, 3);
});

test('unified blank adds resistance measurement as an undoable saved record mode without replacing apparatus or adding a duplicate catalogue blank', () => {
  const scene = createCatalogExperiment('electrical-blank', 'blank', time), hardware = create(); scene.equipment = hardware.equipment; scene.connections = hardware.connections;
  let history = createHistory(scene);
  const control = { mode: 'measurement', fixedResistanceOhm: 10, targetVoltageV: 2, voltageToleranceV: .05 };
  let result = executeCommand(history, { type: 'set-ohm-control', control }, registry, time); assert.equal(result.ok, true); history = result.history;
  assert.equal(voltammetryMode(history.present), true); assert.equal(ohmRecordMode(history.present), false); assert.equal(equipmentSupport(history.present).key, 'electrical');
  assert.deepEqual(history.present.equipment, scene.equipment); assert.deepEqual(history.present.connections, scene.connections);
  assert.equal(voltammetryMode(parseSceneJson(serializeScene(history.present, registry), registry).document), true);
  assert.equal(voltammetryMode(travelHistory(history, 'undo', registry, time).history.present), false);
  result = executeCommand(history, { type: 'set-ohm-control', control: null }, registry, time); assert.equal(result.ok, true); assert.equal(voltammetryMode(result.history.present), false);
});
