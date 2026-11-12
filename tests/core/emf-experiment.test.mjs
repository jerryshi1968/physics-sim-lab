import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmfExperiment, EMF_EXPERIMENT, emfStarts } from '../../src/experiments/emf.ts';
import { createElectricalRegistry, POWER, AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { emfCircuit, emfFits, emfLoading, buildEmfMeasurements } from '../../src/equipment/electrical/emf.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { equipmentAvailability, equipmentSupport } from '../../src/equipment/support.ts';
import { propertyValue, propertyCandidate } from '../../src/core/workbench/properties.ts';
import { createCatalogExperiment } from '../../src/experiments/catalog.ts';

const registry = createElectricalRegistry(), timestamp = '2026-11-11T08:00:00.000Z';
const create = (start = 'reference') => createEmfExperiment(`emf.${start}`, timestamp, start);
const item = (scene, id) => scene.equipment.find(peer => peer.id === id);
const closed = start => { const scene = create(start); item(scene, 'S').parameters.closed = true; return scene; };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function solve(scene) { const outcome = simulateElectrical(scene); assert.equal(outcome.result.ok, true, JSON.stringify(outcome.result.diagnostics)); return outcome; }
const branch = (outcome, id) => outcome.result.solution.branches.find(value => value.id === id);
function record(scene, source = 'manual', values) {
  const outcome = solve(scene), sampleId = `sample.${scene.revision}`, sequence = scene.revision + 1;
  const circuit = emfCircuit(scene); assert.equal(circuit.ok, true);
  const batch = buildEmfMeasurements(scene, registry, { documentId: scene.documentId, documentRevision: scene.revision, runId: 'run', sequence, commandType: 'result', payload: outcome }, {
    source, setupLabel: '第1组', note: '', timestamp, sampleId,
    choices: [['A', '电流I'], ['V', '电压U']].map(([id, pointLabel], index) => ({ id: `record.${scene.revision}.${id}`, equipmentId: id, pointLabel, rawInput: String(values?.[index] ?? (index ? branch(outcome, 'V').voltageV : branch(outcome, 'A').currentA)) })),
  });
  assert.equal(batch.ok, true);
  const appended = appendMeasurements(scene, registry, batch.records, batch.snapshot, timestamp); assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics));
  return appended.document;
}
function five(start = 'reference', source = 'manual') {
  let scene = closed(start);
  for (const position of [0, .1, .2, .4, .8]) { item(scene, 'Rp').parameters.position = position; scene.revision++; scene = record(scene, source); }
  return scene;
}

test('EMF starters are independent validated scenes, open, with no fabricated observations and pending curriculum mapping', () => {
  for (const choice of emfStarts) {
    const scene = create(choice.id); assert.equal(validateSceneDocument(scene, registry).ok, true); assert.equal(scene.experimentId, EMF_EXPERIMENT);
    assert.equal(scene.curriculumRef.stage, 'senior'); assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.deepEqual(scene.measurementRecords, []);
    assert.equal(equipmentSupport(scene).key, 'emf');
    if (choice.id !== 'blank') { assert.equal(item(scene, 'S').parameters.closed, false); assert.equal(emfCircuit(scene).ok, false); assert.equal(equipmentAvailability(scene, POWER).enabled, false); }
  }
  item(create(), 'E').parameters.internalResistanceOhm = 99; assert.equal(item(create(), 'E').parameters.internalResistanceOhm, 2);
});

test('junior meters default to the ideal model and nonideal EMF starters inherit the large finite resistance', () => {
  const defaults = registry.get(VOLTMETER, 1).defaultParameters;
  assert.equal(defaults.finiteInput, false); assert.equal(defaults.inputResistanceOhm, 1_000_000);
  for (const id of ['series-same', 'series-different', 'parallel-same', 'parallel-different', 'emf-reference', 'emf-inner', 'emf-outer']) {
    const scene = createCatalogExperiment(id, `meter.${id}`, timestamp), meter = scene.equipment.find(item => item.type === VOLTMETER);
    assert.equal(meter.parameters.finiteInput, id === 'emf-inner' || id === 'emf-outer', id);
    assert.equal(meter.parameters.inputResistanceOhm, 1_000_000, id);
  }
});

test('ideal voltage measurement is independent of its inactive stored resistance and does not serialize Infinity', () => {
  const scene = closed('reference'); item(scene, 'Rp').parameters.position = .5;
  item(scene, 'V').parameters.inputResistanceOhm = 100;
  close(branch(solve(scene), 'V').voltageV, 30 / 11);
  const restored = parseSceneJson(serializeScene(scene, registry), registry).document;
  assert.equal(item(restored, 'V').parameters.finiteInput, false); assert.equal(item(restored, 'V').parameters.inputResistanceOhm, 100);
  item(scene, 'V').parameters.inputResistanceOhm = Infinity; assert.equal(validateSceneDocument(scene, registry).ok, false);
});

test('legacy ideal sources retain the exact old parameter shape; negative, infinite and string internal resistances are rejected', () => {
  const scene = create(); delete item(scene, 'E').parameters.internalResistanceOhm;
  const loaded = parseSceneJson(serializeScene(scene, registry), registry); assert.equal(loaded.ok, true); assert.deepEqual(item(loaded.document, 'E').parameters, { voltageV: 3 });
  for (const value of [-1, Infinity, NaN, '2']) { item(scene, 'E').parameters.internalResistanceOhm = value; assert.equal(validateSceneDocument(scene, registry).ok, false); }
});

test('legacy source editor displays zero resistance without writing it during unrelated edits or native input undo', () => {
  const source = structuredClone(item(create(), 'E')); delete source.parameters.internalResistanceOhm;
  assert.equal(propertyValue(source, 'internalResistanceOhm'), 0);
  const changed = propertyCandidate(source, { voltageV: { raw: '9', applied: 3 } });
  assert.deepEqual(changed.parameters, { voltageV: 9 });
  const restored = propertyCandidate(changed, { voltageV: { raw: '3', applied: 9 } }); assert.deepEqual(restored, source);
  assert.deepEqual(propertyCandidate(source, { internalResistanceOhm: { raw: '2', applied: 0 } }).parameters, { voltageV: 3, internalResistanceOhm: 2 });
});

test('reference circuit equals hand calculation E=3, r=2, R=5+30p and conserves source power', () => {
  const scene = closed('reference'); item(scene, 'Rp').parameters.position = .5;
  const outcome = solve(scene), i = 3 / 22, u = 30 / 11;
  close(branch(outcome, 'A').currentA, i); close(branch(outcome, 'V').voltageV, u);
  close(branch(outcome, 'E').currentA, -i); close(branch(outcome, 'E').internalLossW, i * i * 2);
  close(branch(outcome, 'E').emfPowerW, -3 * i); close(outcome.result.solution.residuals.powerBalanceW, 0);
});

test('actual inner/outer wiring includes RV loading and RA voltage drop independently of titles and starter labels', () => {
  for (const start of ['inner', 'outer']) {
    const scene = closed(start); item(scene, 'Rp').parameters.position = .5;
    item(scene, 'A').parameters.resistanceOhm = 1; item(scene, 'V').parameters.inputResistanceOhm = 20;
    const outcome = solve(scene), circuit = emfCircuit(scene); assert.equal(circuit.ok, true); assert.equal(circuit.wiring, start);
    const expectedI = start === 'inner' ? 30 / 251 : 3 / 13;
    const expectedU = start === 'inner' ? 630 / 251 : 30 / 13;
    close(branch(outcome, 'A').currentA, expectedI); close(branch(outcome, 'V').voltageV, expectedU);
    scene.title = '不是模板'; scene.provenance.notes = []; scene.equipment.reverse(); scene.connections.reverse();
    assert.equal(emfCircuit(scene).wiring, start); close(branch(solve(scene), 'V').voltageV, expectedU);
  }
});

test('finite source direct short has I=E/r, while zero-r ideal short is an explicit failure', () => {
  const scene = create('blank'); scene.equipment = [structuredClone(item(create(), 'E'))];
  scene.connections = [{ id: 'short', kind: 'wire', from: { equipmentId: 'E', portId: 'positive' }, to: { equipmentId: 'E', portId: 'negative' } }];
  close(branch(solve(scene), 'E').currentA, -1.5);
  item(scene, 'E').parameters.internalResistanceOhm = 0;
  const outcome = simulateElectrical(scene); assert.equal(outcome.result.ok, false); assert.equal(outcome.result.diagnostics[0].code, 'IDEAL_SOURCE_SHORT'); assert.deepEqual(outcome.meters, []);
});

test('open, loose, both-range, bypass and reversed connections never classify as an accepted U-I fit circuit', () => {
  const loose = closed('inner'); loose.connections[0].to = null; assert.equal(emfCircuit(loose).ok, false);
  const bypass = closed('inner'); bypass.connections.push({ id: 'bypass', kind: 'wire', from: { equipmentId: 'E', portId: 'positive' }, to: { equipmentId: 'R', portId: 'a' } }); assert.equal(emfCircuit(bypass).ok, false);
  const both = closed('inner'); both.connections.push({ id: 'range', kind: 'wire', from: { equipmentId: 'A', portId: 'high' }, to: { equipmentId: 'A', portId: 'low' } }); assert.equal(emfCircuit(both).ok, false);
  const reversed = closed('inner'); for (const wire of reversed.connections) for (const side of ['from', 'to']) if (wire[side].equipmentId === 'V') wire[side].portId = wire[side].portId === 'common' ? 'low' : 'common'; assert.equal(emfCircuit(reversed).ok, false);
  assert.equal(emfCircuit(create()).ok, false);
});

test('zero rheostat endpoints and manually rewired voltmeter are analyzed through actual terminals', () => {
  const scene = closed('inner'); item(scene, 'Rp').parameters.position = 0; assert.equal(emfCircuit(scene).wiring, 'inner');
  const positive = scene.connections.find(wire => wire.from.equipmentId === 'V' && wire.from.portId === 'low'); positive.to = { equipmentId: 'A', portId: 'common' };
  assert.equal(emfCircuit(scene).wiring, 'outer'); item(scene, 'Rp').parameters.position = 1; assert.equal(emfCircuit(scene).wiring, 'outer');
});

test('OLS fits five paired recorded values and agrees with independent loading formulas', () => {
  for (const [start, e, r] of [['reference', 3, 2], ['inner', 1_500_000 / 500_001, 1_000_000 / 500_001], ['outer', 3, 2.2]]) {
    const scene = five(start), result = emfFits(scene); assert.equal(result.groups.length, 1); assert.equal(result.omitted, 0);
    const fit = result.groups[0].fit; assert.equal(fit.distinct, 5); close(fit.intercept, e); close(-fit.slope, r); close(fit.rSquared, 1);
    const loading = emfLoading(emfCircuit(scene)); close(loading.intercept, e); close(loading.resistance, r);
    const loaded = parseSceneJson(serializeScene(scene, registry), registry); assert.equal(loaded.ok, true); assert.deepEqual(emfFits(loaded.document), result);
  }
});

test('source, meter, range, wiring and source-method changes split series; changed scene cannot rewrite frozen samples', () => {
  let scene = five('inner'); const initial = structuredClone(emfFits(scene));
  for (const [id, field, value] of [['E', 'voltageV', 2.8], ['E', 'internalResistanceOhm', 3], ['A', 'resistanceOhm', 1], ['V', 'inputResistanceOhm', 20]]) {
    item(scene, id).parameters[field] = value; scene.revision++; scene = record(scene);
  }
  scene.revision++; scene = record(scene, 'instrument'); assert.equal(emfFits(scene).groups.length, 6);
  for (const id of ['A', 'V']) {
    for (const wire of scene.connections) for (const side of ['from', 'to']) if (wire[side].equipmentId === id && wire[side].portId === 'low') wire[side].portId = 'high';
    scene.revision++; scene = record(scene);
  }
  const voltageWire = scene.connections.find(wire => wire.from.equipmentId === 'V' && wire.from.portId === 'high'); voltageWire.to = { equipmentId: 'A', portId: 'common' };
  scene.revision++; scene = record(scene); assert.equal(emfFits(scene).groups.length, 9);
  scene.equipment = []; scene.connections = []; assert.deepEqual(emfFits(scene).groups[0], initial.groups[0]);
});

test('repeated currents, missing values, over-range and deleted pair members cannot create a five-point fit', () => {
  let scene = closed('reference');
  for (let index = 0; index < 6; index++) scene = record(scene);
  assert.equal(emfFits(scene).groups[0].fit, null);
  scene = five(); const removed = removeMeasurement(scene, registry, scene.measurementRecords[0].id, timestamp); assert.equal(removed.ok, true); assert.equal(emfFits(removed.document).groups[0].fit, null); assert.equal(emfFits(removed.document).omitted, 1);
  const corrected = correctManualMeasurement(scene, registry, scene.measurementRecords[0].id, '', timestamp); assert.equal(corrected.ok, true); assert.equal(emfFits(corrected.document).groups[0].fit, null);
  const excessive = closed('reference'); item(excessive, 'E').parameters.voltageV = 30;
  const abnormal = record(excessive, 'instrument'); assert.equal(emfFits(abnormal).groups.length, 0); assert.equal(emfFits(abnormal).omitted, 1);
});

test('student correction changes OLS, preserves original truth, and positive slope is not interpreted as physical internal resistance', () => {
  let scene = five(); const truth = scene.measurementRecords[0].context.physicalValue;
  scene = correctManualMeasurement(scene, registry, scene.measurementRecords[0].id, '.5', timestamp).document;
  assert.notEqual(emfFits(scene).groups[0].fit.intercept, 3); assert.equal(scene.measurementRecords[0].context.physicalValue, truth);
  scene = five();
  for (const row of scene.measurementRecords.filter(row => row.quantity === 'voltage')) {
    const i = scene.measurementRecords.find(peer => peer.context.sampleId === row.context.sampleId && peer.quantity === 'current').value;
    scene = correctManualMeasurement(scene, registry, row.id, String(1 + i), timestamp).document;
  }
  assert.equal(emfFits(scene).groups[0].physical, false);
});

test('stale replies and single-meter entries are rejected without appending data', () => {
  const scene = closed('inner'), payload = solve(scene), reply = { documentId: scene.documentId, documentRevision: 99, runId: 'run', sequence: 1, commandType: 'result', payload };
  const entry = { source: 'manual', setupLabel: '', note: '', sampleId: 'sample', timestamp, choices: [{ equipmentId: 'A', pointLabel: 'I', rawInput: '.1', id: 'i' }, { equipmentId: 'V', pointLabel: 'U', rawInput: '2', id: 'u' }] };
  assert.equal(buildEmfMeasurements(scene, registry, reply, entry).code, 'STALE_MEASUREMENT');
  assert.equal(buildEmfMeasurements(scene, registry, { ...reply, documentRevision: 0 }, { ...entry, choices: entry.choices.slice(0, 1) }).ok, false);
  assert.equal(scene.measurementRecords.length, 0); assert.equal(item(scene, 'A').type, AMMETER); assert.equal(item(scene, 'V').type, VOLTMETER);
});

test('open-switch terminal voltage includes the real voltmeter drain; disconnecting the voltmeter restores E', () => {
  const scene = create('inner'), outcome = solve(scene);
  close(branch(outcome, 'A').currentA, 0); close(branch(outcome, 'V').voltageV, 1_500_000 / 500_001); close(branch(outcome, 'E').currentA, -1 / 333_334);
  item(scene, 'V').parameters.finiteInput = false;
  close(branch(solve(scene), 'V').voltageV, 3); close(branch(solve(scene), 'E').currentA, 0);
});

test('instrument-series fit uses rounded recorded samples rather than replacing them with exact solver values', () => {
  const scene = five('reference', 'instrument'), group = emfFits(scene).groups[0];
  assert.deepEqual(group.points, [{ x: .42, y: 2.1 }, { x: .3, y: 2.4 }, { x: .24, y: 2.5 }, { x: .16, y: 2.7 }, { x: .1, y: 2.8 }]);
  close(group.fit.intercept, 11749 / 3870); close(group.fit.slope, -850 / 387);
  assert.notEqual(group.fit.intercept, 3); assert.notEqual(-group.fit.slope, 2);
});
