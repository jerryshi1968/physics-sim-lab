import test from 'node:test';
import assert from 'node:assert/strict';
import { createLampPowerExperiment } from '../../src/experiments/lamp-power.ts';
import { createCatalogExperiment, experimentChoices } from '../../src/experiments/catalog.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { lampPowerCircuit, lampPowerMode, lampPowerPoint, buildLampPowerMeasurements, lampPowerAnalysis } from '../../src/equipment/electrical/lamp-power.ts';
import { ohmRecordMode } from '../../src/equipment/electrical/ohm.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { equipmentAvailability, equipmentSupport } from '../../src/equipment/support.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-13T02:00:00.000Z';
const item = (scene, id) => scene.equipment.find(value => value.id === id);
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function create() { const scene = createLampPowerExperiment('lamp-power', time); item(scene, 'S').parameters.closed = true; return scene; }
function build(scene, source = 'manual', values, revision = scene.revision) {
  const payload = simulateElectrical(scene), sampleId = `lamp.sample.${scene.revision}`;
  const choices = ['A', 'V'].map((id, index) => ({ id: `${sampleId}.${id}`, equipmentId: id, pointLabel: id, rawInput: String(values?.[index] ?? payload.meters.find(meter => meter.id === id)?.trueValue ?? '') }));
  return buildLampPowerMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: revision, runId: 'run', sequence: scene.revision + 1, payload }, { source, choices, sampleId, timestamp: time, setupLabel: '第1组', note: '自行观察' });
}
function capture(scene, source = 'manual', values) {
  const built = build(scene, source, values); assert.equal(built.ok, true, built.code);
  const appended = appendMeasurements(scene, registry, built.records, built.snapshot, time); assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics)); return appended.document;
}
function lowCurrent(scene) { for (const wire of scene.connections) for (const end of [wire.from, wire.to]) if (end.equipmentId === 'A' && end.portId === 'high') end.portId = 'low'; return scene; }

test('junior power starter reuses the original lamp and six apparatus, starts open at maximum rheostat and high ranges without records', () => {
  const scene = createLampPowerExperiment('start', time);
  assert.equal(scene.experimentId, 'J-ELEC-04'); assert.equal(scene.equipment.length, 6); assert.equal(scene.connections.length, 7);
  assert.deepEqual(item(scene, 'L1').parameters, registry.get('electrical.lamp', 1).defaultParameters);
  assert.equal(item(scene, 'S').parameters.closed, false); assert.equal(item(scene, 'Rp').parameters.position, 1);
  assert.equal(item(scene, 'A').parameters.resistanceOhm, 0); assert.equal(item(scene, 'V').parameters.finiteInput, false);
  assert.equal(scene.measurementRecords.length, 0); assert.equal(equipmentSupport(scene).key, 'lampPower'); assert.equal(equipmentAvailability(scene, 'electrical.resistor').enabled, false);
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
});

test('independent cubic lamp benchmarks reach below, rated and above work points by actual rheostat segments; brightness follows power', () => {
  let scene = lowCurrent(create()), previous = -1;
  for (const [position, current, voltage, power] of [[.72, .15, .6, .09], [.2, .3, 3, .9], [.03, .375, 5.4375, 2.0390625]]) {
    item(scene, 'Rp').parameters.position = position; scene.revision++;
    const solved = simulateElectrical(scene); assert.equal(solved.result.ok, true);
    const lamp = solved.result.solution.branches.find(value => value.id === 'L1'); close(Math.abs(lamp.currentA), current); close(Math.abs(lamp.voltageV), voltage); close(lamp.powerW, power);
    assert.ok(lamp.brightness > previous); previous = lamp.brightness;
    scene = capture(scene, 'manual', [current, voltage]);
  }
  const analysis = lampPowerAnalysis(scene); assert.deepEqual(analysis.results.map(row => row.point), ['below', 'rated', 'above']);
  assert.equal(analysis.groups.length, 1); assert.equal(analysis.groups[0].ratedCount, 1); close(analysis.groups[0].ratedPower, .9);
  assert.notEqual(analysis.groups[0].ratedPower, analysis.results.reduce((sum, row) => sum + row.power / 3, 0));
});

test('instrument power multiplies quantized displayed U and I, never the nonlinear model power or nameplate reference', () => {
  const scene = lowCurrent(create()); item(scene, 'Rp').parameters.position = .72;
  const analysis = lampPowerAnalysis(capture(scene, 'instrument')); close(analysis.results[0].current, .16); close(analysis.results[0].voltage, .5); close(analysis.results[0].power, .08);
  assert.equal(analysis.groups[0].ratedPower, null);
  for (const wire of scene.connections) for (const end of [wire.from, wire.to]) if (end.equipmentId === 'V' && end.portId === 'high') end.portId = 'low';
  close(lampPowerAnalysis(capture(scene, 'instrument')).results[0].power, .096);
});

test('work point is judged by saved voltage resolution, rated powers only average rated records and revisions recalculate them', () => {
  const falseRated = lowCurrent(create()); item(falseRated, 'Rp').parameters.position = .72;
  const reported = lampPowerAnalysis(capture(falseRated, 'manual', [.15, 3])); close(reported.results[0].power, .45); assert.ok(reported.results[0].workPointWarning); assert.equal(reported.groups[0].ratedPower, null);
  assert.equal(lampPowerPoint(2.95, 3, .1), 'rated'); assert.equal(lampPowerPoint(2.94, 3, .1), 'below'); assert.equal(lampPowerPoint(3.06, 3, .1), 'above');
  let scene = lowCurrent(create()); item(scene, 'Rp').parameters.position = .2; scene = capture(scene, 'manual', [.3, 3]); scene = capture(scene, 'manual', [.32, 3]);
  close(lampPowerAnalysis(scene).groups[0].ratedPower, .93);
  const frozen = JSON.stringify(scene.measurementSnapshots), corrected = correctManualMeasurement(scene, registry, scene.measurementRecords[3].id, '4', time); assert.equal(corrected.ok, true); scene = corrected.document;
  close(lampPowerAnalysis(scene).groups[0].ratedPower, .9); assert.equal(lampPowerAnalysis(scene).results[1].point, 'above'); assert.equal(JSON.stringify(scene.measurementSnapshots), frozen);
  const removed = removeMeasurement(scene, registry, scene.measurementRecords[0].id, time); assert.equal(removed.ok, true); assert.equal(lampPowerAnalysis(removed.document).omitted, 1); assert.equal(lampPowerAnalysis(removed.document).groups[0].ratedPower, null);
});

test('missing, zero, reversed, over-range and out-of-model measurements are retained but never normal power points', () => {
  const scene = lowCurrent(create()); item(scene, 'Rp').parameters.position = .2;
  for (const values of [['', 3], [0, 3], [-.3, 3], [.3, 16]]) { const analysis = lampPowerAnalysis(capture(scene, 'manual', values)); assert.equal(analysis.omitted, 1); assert.equal(analysis.results[0].power, null); }
  for (const wire of scene.connections) for (const end of [wire.from, wire.to]) if (end.equipmentId === 'V' && end.portId === 'high') end.portId = 'low';
  item(scene, 'Rp').parameters.position = .03; assert.equal(lampPowerAnalysis(capture(scene, 'instrument')).omitted, 1);
  item(scene, 'E').parameters.voltageV = 1000; item(scene, 'Rp').parameters.position = 0;
  assert.equal(simulateElectrical(scene).result.ok, false); const unavailable = capture(scene, 'instrument');
  assert.ok(unavailable.measurementRecords.every(row => row.measurementStatus === 'out-of-model')); assert.equal(lampPowerAnalysis(unavailable).omitted, 1); assert.equal(lampPowerAnalysis(unavailable).results[0].power, null);
});

test('wrong topology, non-ideal junior meters and stale replies cannot bypass power capture qualification', () => {
  assert.equal(build(create(), 'manual', undefined, -1).ok, false);
  const open = create(); item(open, 'S').parameters.closed = false; assert.equal(lampPowerCircuit(open).ok, false);
  const cases = [scene => { scene.connections.find(wire => wire.to.equipmentId === 'Rp').to.portId = 'd'; }, scene => { scene.connections.find(wire => wire.from.equipmentId === 'V').to = { equipmentId: 'E', portId: 'positive' }; }, scene => { item(scene, 'A').parameters.resistanceOhm = .1; }, scene => { item(scene, 'V').parameters.finiteInput = true; }];
  for (const change of cases) { const scene = create(); change(scene); assert.equal(build(scene).ok, false); }
});

test('changing current lamp ratings does not alter historic work points and different lamps or sources remain separate', () => {
  let scene = lowCurrent(create()); item(scene, 'Rp').parameters.position = .2; scene = capture(scene, 'manual', [.3, 3]);
  item(scene, 'L1').parameters.ratedVoltageV = 6; item(scene, 'Rp').parameters.position = 0; scene.revision++;
  scene = capture(scene, 'manual', [.3, 6]); const analysis = lampPowerAnalysis(scene);
  assert.equal(analysis.groups.length, 2); close(analysis.groups[0].ratedPower, .9); close(analysis.groups[1].ratedPower, 1.8); assert.equal(analysis.results[0].ratedVoltage, 3);
  scene = capture(scene, 'instrument'); assert.equal(lampPowerAnalysis(scene).groups.length, 3);
});

test('unified electrical blank selects saved, undoable power records without adding a second blank or changing apparatus', () => {
  const scene = createCatalogExperiment('electrical-blank', 'blank', time), kit = create(); scene.equipment = kit.equipment; scene.connections = kit.connections;
  const history = createHistory(scene), result = executeCommand(history, { type: 'set-ohm-control', control: { mode: 'lamp-power', fixedResistanceOhm: 10, targetVoltageV: 2, voltageToleranceV: .05 } }, registry, time);
  assert.equal(result.ok, true); assert.equal(lampPowerMode(result.history.present), true); assert.equal(ohmRecordMode(result.history.present), false);
  assert.deepEqual(result.history.present.equipment, scene.equipment); assert.deepEqual(result.history.present.connections, scene.connections); assert.equal(equipmentSupport(result.history.present).key, 'electrical');
  assert.equal(lampPowerMode(parseSceneJson(serializeScene(result.history.present, registry), registry).document), true);
  assert.equal(lampPowerMode(travelHistory(result.history, 'undo', registry, time).history.present), false);
  assert.equal(experimentChoices.filter(choice => choice.stage === 'junior' && choice.domain === 'electrical' && choice.id.endsWith('-blank')).length, 1);
});
