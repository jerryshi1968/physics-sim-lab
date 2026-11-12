import test from 'node:test';
import assert from 'node:assert/strict';
import { createOhmExperiment, OHM_EXPERIMENT } from '../../src/experiments/ohm.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildOhmMeasurements, ohmCircuit, ohmControl, ohmFits, ohmResults, ohmRecordMode } from '../../src/equipment/electrical/ohm.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-12T08:00:00.000Z';
const item = (scene, id) => scene.equipment.find(value => value.id === id);
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function create(start = 'voltage') { return createOhmExperiment(`ohm.${start}`, time, start); }
function closed(start) { const scene = create(start); item(scene, 'S').parameters.closed = true; return scene; }
function solve(scene) { const outcome = simulateElectrical(scene); assert.equal(outcome.result.ok, true, JSON.stringify(outcome.result.diagnostics)); return outcome; }
function build(scene, source = 'manual', values) {
  const outcome = solve(scene), sampleId = `ohm.sample.${scene.revision}`;
  const choices = [['A', '电流I'], ['V', '电阻两端电压U']].map(([id, pointLabel], index) => ({ equipmentId: id, pointLabel, id: `${sampleId}.${id}`, rawInput: String(values?.[index] ?? outcome.meters.find(meter => meter.id === id).trueValue) }));
  return buildOhmMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: scene.revision, runId: 'ohm-run', sequence: scene.revision + 1, payload: outcome }, { source, choices, sampleId, timestamp: time, setupLabel: '第1组', note: '' });
}
function capture(scene, source = 'manual', values) {
  const built = build(scene, source, values); assert.equal(built.ok, true, built.code);
  const appended = appendMeasurements(scene, registry, built.records, built.snapshot, time); assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics)); return appended.document;
}
function voltageFive(source = 'manual') {
  let scene = closed();
  for (const voltage of [1, 1.4, 1.8, 2.2, 2.6]) { item(scene, 'Rp').parameters.position = 10 * (6 / voltage - 1) / 50; scene.revision++; scene = capture(scene, source); }
  return scene;
}
function resistanceFive(source = 'manual', finite = false) {
  let scene = closed('resistance');
  if (finite) { item(scene, 'V').parameters.finiteInput = true; item(scene, 'V').parameters.inputResistanceOhm = 100; }
  for (const resistance of [5, 10, 15, 20, 25]) {
    item(scene, 'R').parameters.resistanceOhm = resistance;
    const parallel = finite ? 1 / (1 / resistance + .01) : resistance;
    item(scene, 'Rp').parameters.position = 2 * parallel / 50; scene.revision++; scene = capture(scene, source);
  }
  return scene;
}

test('three junior starters use only existing equipment, open at maximum rheostat resistance, with ideal voltmeters and no observations', () => {
  for (const start of ['voltage', 'resistance', 'blank']) {
    const scene = create(start); assert.equal(validateSceneDocument(scene, registry).ok, true); assert.equal(scene.experimentId, OHM_EXPERIMENT);
    assert.equal(scene.curriculumRef.stage, 'junior'); assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
    assert.equal(scene.measurementRecords.length, 0); assert.equal(equipmentSupport(scene).key, 'ohm');
    assert.equal(scene.equipment.length, start === 'blank' ? 0 : 6); assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
    if (start !== 'blank') { assert.equal(item(scene, 'S').parameters.closed, false); assert.equal(item(scene, 'Rp').parameters.position, 1); assert.equal(item(scene, 'V').parameters.finiteInput, false); assert.equal(registry.get(item(scene, 'Rp').type, 1).ports.length, 4); }
  }
  assert.equal(equipmentAvailability(create(), 'electrical.lamp').enabled, false); assert.equal(equipmentAvailability(create(), 'electrical.resistor').enabled, false);
  assert.equal(equipmentAvailability(create('blank'), 'electrical.resistor').enabled, true);
  assert.equal(parseSceneJson(serializeScene(createEmptyScene('legacy', time), registry), registry).document.ohmControl, undefined);
});
test('independent voltage divider and four working terminal combinations use the actual segment, not slider appearance', () => {
  for (const lower of ['a', 'b']) for (const upper of ['c', 'd']) {
    const scene = closed(); item(scene, 'Rp').parameters.position = .25;
    scene.connections.find(wire => wire.to?.equipmentId === 'Rp').to.portId = lower;
    scene.connections.find(wire => wire.from?.equipmentId === 'Rp').from.portId = upper;
    assert.equal(ohmCircuit(scene).ok, true);
    const outcome = solve(scene), rp = lower === 'a' ? 12.5 : 37.5;
    close(outcome.meters.find(meter => meter.id === 'A').trueValue, 6 / (10 + rp));
    close(outcome.meters.find(meter => meter.id === 'V').trueValue, 60 / (10 + rp));
  }
});
test('invalid wiring, bypasses, reversed meters, floating ends and two-top/two-bottom rheostat connections do not qualify', () => {
  assert.equal(ohmCircuit(create()).ok, false);
  const cases = [
    scene => { scene.connections.find(wire => wire.from?.equipmentId === 'Rp').from.portId = 'b'; },
    scene => { scene.connections.find(wire => wire.to?.equipmentId === 'Rp').to.portId = 'd'; },
    scene => { scene.connections.push({ id: 'shortR', kind: 'wire', from: { equipmentId: 'R', portId: 'a' }, to: { equipmentId: 'R', portId: 'b' } }); },
    scene => { scene.connections.push({ id: 'shortS', kind: 'wire', from: { equipmentId: 'S', portId: 'a' }, to: { equipmentId: 'S', portId: 'b' } }); },
    scene => { for (const wire of scene.connections) for (const side of ['from', 'to']) if (wire[side]?.equipmentId === 'A') wire[side].portId = wire[side].portId === 'low' ? 'common' : 'low'; },
    scene => { scene.connections.find(wire => wire.from?.equipmentId === 'V' && wire.from.portId === 'low').to = { equipmentId: 'E', portId: 'positive' }; },
    scene => { scene.connections.push({ id: 'both', kind: 'wire', from: { equipmentId: 'A', portId: 'high' }, to: { equipmentId: 'S', portId: 'b' } }); },
    scene => { scene.connections.push({ id: 'loose', kind: 'wire', from: null, to: null, looseFromWorldM: { x: 0, y: 0 }, looseToWorldM: { x: .1, y: .1 } }); },
  ];
  for (const mutate of cases) { const scene = closed(); mutate(scene); assert.equal(ohmCircuit(scene).ok, false); }
});
test('I-U records fit 0.1 A/V and zero intercept for R=10 ohm without using theoretical y values', () => {
  const scene = voltageFive(), result = ohmFits(scene); assert.equal(result.omitted, 0); assert.equal(result.groups.length, 1);
  close(result.groups[0].fit.slope, .1); close(result.groups[0].fit.intercept, 0); close(result.groups[0].fit.rSquared, 1);
  const instrument = ohmFits(voltageFive('instrument')); close(instrument.groups[0].fit.slope, .1);
  const first = scene.measurementRecords.find(row => row.quantity === 'current'), corrected = correctManualMeasurement(scene, registry, first.id, '.12', time); assert.equal(corrected.ok, true);
  assert.notEqual(ohmFits(corrected.document).groups[0].fit.slope, result.groups[0].fit.slope);
  const deleted = removeMeasurement(scene, registry, first.id, time); assert.equal(deleted.ok, true); assert.equal(ohmFits(deleted.document).omitted, 1); assert.equal(ohmFits(deleted.document).groups[0].fit, null);
});
test('I-(1/R) uses known replacement resistance and fixed voltage; ideal slope is 2 V and finite voltmeter adds its real loading intercept', () => {
  const ideal = ohmFits(resistanceFive()); assert.equal(ideal.groups[0].fit.distinct, 5); close(ideal.groups[0].fit.slope, 2); close(ideal.groups[0].fit.intercept, 0);
  const finite = ohmFits(resistanceFive('manual', true)); close(finite.groups[0].fit.slope, 2); close(finite.groups[0].fit.intercept, .02); assert.equal(finite.groups[0].finiteVoltmeter, true);
  const displayed = ohmFits(resistanceFive('instrument')); assert.equal(displayed.groups[0].fit.distinct, 5); close(displayed.groups[0].fit.slope, 7539 / 3788); close(displayed.groups[0].fit.intercept, 843 / 378800);
});
test('changing R without restoring U retains evidence but excludes the point, and fabricated handwritten U cannot hide the actual display', () => {
  let scene = closed('resistance'); item(scene, 'Rp').parameters.position = .2;
  scene = capture(scene); assert.equal(ohmResults(scene)[0].reason, null);
  item(scene, 'R').parameters.resistanceOhm = 10; scene.revision++;
  scene = capture(scene, 'manual', [.3, 2]); assert.match(ohmResults(scene)[1].reason, /电压表示数/);
  item(scene, 'Rp').parameters.position = .4; scene.revision++;
  scene = capture(scene, 'manual', [.2, 3]); assert.match(ohmResults(scene)[2].reason, /所记电压/);
  const wrong = scene.measurementRecords.at(-1), corrected = correctManualMeasurement(scene, registry, wrong.id, '2', time); assert.equal(corrected.ok, true); assert.equal(ohmResults(corrected.document)[2].reason, null);
  const retained = scene.measurementRecords.length; assert.equal(retained, 6); assert.equal(ohmFits(scene).omitted, 2);
});
test('fixed-R violations, missing values, wrong ranges and stale results never become normal fit points', () => {
  let scene = closed(); item(scene, 'R').parameters.resistanceOhm = 20; scene = capture(scene); assert.match(ohmResults(scene)[0].reason, /固定电阻/);
  const base = closed(), missing = build(base); assert.equal(missing.ok, true); missing.records[0].rawInput = ''; missing.records[0].context.originalRawInput = ''; missing.records[0].measurementStatus = 'invalid'; missing.records[0].value = null;
  const appended = appendMeasurements(base, registry, missing.records, missing.snapshot, time); assert.equal(appended.ok, true); assert.equal(ohmFits(appended.document).groups.length, 0);
  const over = closed(); item(over, 'Rp').parameters.position = 0; const batch = build(over, 'instrument'); assert.equal(batch.ok, true); assert.equal(batch.records.find(row => row.quantity === 'voltage').measurementStatus, 'over-range');
  const input = { source: 'manual', choices: [], sampleId: 'stale', timestamp: time, setupLabel: '组', note: '' }; assert.equal(buildOhmMeasurements(base, registry, null, input).ok, false);
  const outcome = solve(base), entry = { ...input, choices: [{ equipmentId: 'A', id: 'a', pointLabel: 'I', rawInput: '.1' }, { equipmentId: 'V', id: 'v', pointLabel: 'U', rawInput: '1' }] };
  assert.equal(buildOhmMeasurements(base, registry, { commandType: 'result', documentId: base.documentId, documentRevision: base.revision + 1, runId: 'run', sequence: 1, payload: outcome }, entry).code, 'STALE_MEASUREMENT');
});
test('snapshot control targets survive mode changes, corrections, JSON and undo while different sources/configurations form separate series', () => {
  let scene = voltageFive(); const before = serializeScene(scene, registry), history = createHistory(scene);
  const command = { type: 'set-ohm-control', control: { ...ohmControl(scene), mode: 'resistance' } }, changed = executeCommand(history, command, registry, time); assert.equal(changed.ok, true);
  assert.equal(ohmFits(changed.history.present).groups[0].control.mode, 'voltage');
  const undone = travelHistory(changed.history, 'undo', registry, time); assert.equal(undone.ok, true); assert.equal(undone.history.present.ohmControl.mode, 'voltage');
  const loaded = parseSceneJson(serializeScene(changed.history.present, registry), registry); assert.equal(loaded.ok, true); assert.equal(loaded.document.ohmControl.mode, 'resistance'); assert.equal(ohmFits(loaded.document).groups[0].fit.distinct, 5);
  assert.equal(serializeScene(scene, registry), before);
  item(scene, 'Rp').parameters.position = 1; scene.revision++; scene = capture(scene, 'instrument'); assert.equal(ohmFits(scene).groups.length, 2);
  item(scene, 'V').parameters.inputResistanceOhm = 100; scene.revision++; scene = capture(scene); assert.equal(ohmFits(scene).groups.length, 3);
  for (const control of [{ ...ohmControl(scene), targetVoltageV: 0 }, { ...ohmControl(scene), voltageToleranceV: 3 }]) assert.equal(executeCommand(createHistory(scene), { type: 'set-ohm-control', control }, registry, time).ok, false);
});
test('resistor replacement preserves wires and pose; changing only the slider cannot manufacture five distinct work points', () => {
  const scene = closed(), wires = structuredClone(scene.connections), resistor = item(scene, 'R'), history = createHistory(scene);
  const replaced = executeCommand(history, { type: 'update-equipment', id: resistor.id, pose: resistor.pose, parameters: { resistanceOhm: 25 } }, registry, time); assert.equal(replaced.ok, true); assert.deepEqual(replaced.history.present.connections, wires); assert.deepEqual(item(replaced.history.present, 'R').pose, resistor.pose);
  let repeated = closed(); for (let n = 0; n < 5; n++) { repeated.revision++; repeated = capture(repeated); } assert.equal(ohmFits(repeated).groups[0].fit, null);
  const malformed = voltageFive(); malformed.measurementSnapshots[0].note = '{broken'; assert.equal(ohmFits(malformed).omitted, 1);
});

test('the unified electrical blank switches record modes without replacing apparatus, history or document identity', () => {
  const scene = closed(); scene.experimentId = 'J-ELEC-FREE'; delete scene.ohmControl;
  assert.equal(ohmRecordMode(scene), false); assert.equal(build(scene).ok, false);
  const history = createHistory(scene), enabled = executeCommand(history, { type: 'set-ohm-control', control: { mode: 'voltage', fixedResistanceOhm: 10, targetVoltageV: 2, voltageToleranceV: .05 } }, registry, time);
  assert.equal(enabled.ok, true); assert.equal(ohmRecordMode(enabled.history.present), true);
  const active = enabled.history.present; assert.equal(active.documentId, scene.documentId); assert.equal(active.experimentId, 'J-ELEC-FREE'); assert.deepEqual(active.equipment, scene.equipment); assert.deepEqual(active.connections, scene.connections);
  assert.equal(equipmentAvailability(active, 'electrical.lamp').enabled, true);
  const sampled = capture(active), off = executeCommand(createHistory(sampled), { type: 'set-ohm-control', control: null }, registry, time); assert.equal(off.ok, true);
  assert.equal(ohmRecordMode(off.history.present), false); assert.equal(off.history.present.ohmControl, undefined); assert.equal(off.history.present.measurementRecords.length, 2); assert.equal(ohmResults(off.history.present)[0].reason, null);
  const restored = travelHistory(off.history, 'undo', registry, time); assert.equal(restored.ok, true); assert.equal(ohmRecordMode(restored.history.present), true);
  const json = serializeScene(off.history.present, registry), loaded = parseSceneJson(json, registry); assert.equal(loaded.ok, true); assert.equal(ohmRecordMode(loaded.document), false); assert.equal(loaded.document.measurementRecords.length, 2); assert.equal(json.includes('"ohmControl": null'), false);
  const legacy = create('blank'); delete legacy.ohmControl; assert.equal(ohmRecordMode(legacy), true);
});
