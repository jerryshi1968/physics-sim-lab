import test from 'node:test';
import assert from 'node:assert/strict';
import { createPendulumExperiment } from '../../src/experiments/pendulum.ts';
import { PENDULUM } from '../../src/equipment/pendulum/definitions.ts';
import { pendulumRig, pendulumDrop, pendulumViewScene } from '../../src/equipment/pendulum/simulate.ts';
import { buildPendulumMeasurements, pendulumResults, pendulumFits } from '../../src/equipment/pendulum/measure.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { equipmentAvailability, equipmentSupport } from '../../src/equipment/support.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';

const time = '2026-11-12T00:00:00.000Z', registry = createWorkbenchRegistry();
const create = () => createPendulumExperiment('pendulum-test', time);
const input = { rulerId: 'ruler', pivotRaw: '0', centerRaw: '.5', cyclesRaw: '20', timeRaw: '28.398', setupLabel: '第1组', note: '' };
function completed(scene) { const rig = pendulumRig(scene); assert.equal(rig.ok, true); return { signature: rig.signature, timeS: rig.periodS * 20, periodS: rig.periodS, targetCycles: 20, completed: true }; }
function capture(scene, fields = {}, id = 'sample') { return buildPendulumMeasurements(scene, completed(scene), { ...input, ...fields }, id, time); }
function append(scene, built) { assert.equal(built.ok, true, built.message); const result = appendMeasurements(scene, registry, built.records, built.snapshot, time); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.document; }

test('senior pendulum starter, blank, registry limits, SI document and shared timer are valid', () => {
  const scene = create(); assert.equal(validateSceneDocument(scene, registry).ok, true);
  assert.equal(scene.simulationConfig.gravityMPerS2, 9.81);
  assert.equal(createPendulumExperiment('blank', time, true).simulationConfig.gravityMPerS2, 9.81);
  assert.equal(scene.curriculumRef.stage, 'senior'); assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.equal(scene.equipment.length, 4); assert.equal(createPendulumExperiment('blank', time, true).equipment.length, 0);
  assert.equal(equipmentSupport(scene).key, 'pendulum'); assert.equal(equipmentAvailability(scene, PENDULUM).enabled, false);
  assert.equal(equipmentAvailability(scene, 'mechanical.spring').enabled, false); assert.equal(equipmentAvailability(scene, 'mechanical.ruler').enabled, true);
  assert.equal(scene.equipment.filter(item => item.type.includes('timer')).length, 1);
});
test('length includes radius, mounting follows the stand, and detached/tilted/colliding/overloaded states are rejected', () => {
  const scene = create(), bob = scene.equipment.find(item => item.id === 'pendulum'), stand = scene.equipment.find(item => item.id === 'support');
  assert.equal(pendulumRig(scene).lengthM, .5);
  stand.pose.xM = .1; assert.ok(Math.abs(pendulumViewScene(scene).equipment.find(item => item.id === bob.id).pose.xM - .22) < 1e-12);
  assert.equal(pendulumDrop(scene, bob.id, { xM: .22, yM: .76 }).parameters.supportId, stand.id);
  assert.equal(pendulumDrop(scene, bob.id, { xM: .7, yM: .3 }).parameters.supportId, '');
  stand.parameters.heightM = .4; assert.equal(pendulumRig(scene).ok, false); stand.parameters.heightM = .8;
  stand.pose.rotationRad = .1; assert.equal(pendulumRig(scene).ok, false); stand.pose.rotationRad = 0;
  stand.parameters.capacityN = .01; assert.equal(pendulumRig(scene).ok, false); stand.parameters.capacityN = 100;
  bob.parameters.supportId = ''; assert.equal(pendulumRig(scene).ok, false);
});
test('recording requires a completed current run and a downward ruler; missing values never become normal results', () => {
  const scene = create(), run = completed(scene);
  assert.equal(buildPendulumMeasurements(scene, null, input, 'a', time).ok, false);
  assert.equal(buildPendulumMeasurements(scene, { ...run, completed: false }, input, 'a', time).ok, false);
  scene.equipment.find(item => item.id === 'ruler').pose.xM += .1;
  assert.equal(pendulumRig(scene).signature, run.signature);
  scene.equipment[1].parameters.initialAngleDeg = 30;
  assert.equal(buildPendulumMeasurements(scene, run, input, 'a', time).ok, false);
  scene.equipment[1].parameters.initialAngleDeg = 5;
  scene.equipment.find(item => item.id === 'ruler').pose.rotationRad = 0; assert.equal(capture(scene).ok, false);
  scene.equipment.find(item => item.id === 'ruler').pose.rotationRad = -Math.PI / 2;
  assert.equal(capture(scene, { timeRaw: 'Infinity' }).ok, false);
  for (const fields of [{ timeRaw: '' }, { centerRaw: '' }, { cyclesRaw: '1.5' }, { cyclesRaw: '10' }, { pivotRaw: '.6' }, { timeRaw: '-2' }]) {
    const recorded = append(scene, capture(scene, fields)); assert.equal(pendulumResults(recorded)[0].valid, false);
  }
});
test('raw readings determine g; corrections, row deletion, JSON and undo keep source snapshots', () => {
  const scene = create(), built = capture(scene), recorded = append(scene, built), row = pendulumResults(recorded)[0];
  assert.equal(row.valid, true); assert.ok(Math.abs(row.g - 9.8) < .02);
  const fixed = correctManualMeasurement(recorded, registry, 'sample.3', '30', time); assert.equal(fixed.ok, true);
  assert.ok(Math.abs(pendulumResults(fixed.document)[0].g - 8.772981689857207) < 1e-10);
  const deleted = removeMeasurement(recorded, registry, 'sample.0', time); assert.equal(deleted.ok, true); assert.equal(pendulumResults(deleted.document)[0].valid, false); assert.equal(deleted.document.measurementSnapshots.length, 1);
  const history = executeCommand(createHistory(scene), { type: 'record-measurements', records: built.records, snapshot: built.snapshot }, registry, time); assert.equal(history.ok, true);
  assert.equal(travelHistory(history.history, 'undo', registry, time).history.present.measurementRecords.length, 0);
  const saved = serializeScene(recorded, registry);
  const loaded = parseSceneJson(saved, registry); assert.equal(loaded.ok, true); assert.deepEqual(pendulumResults(loaded.document), pendulumResults(recorded));
  assert.equal('timeS' in loaded.document, false);
});
test('five distinct small-angle lengths fit g; large-angle records and different configurations do not mix', () => {
  let scene = create();
  for (const [index, length] of [.2, .3, .4, .5, .6].entries()) {
    scene.equipment[1].parameters.stringLengthM = length - .01;
    scene = append(scene, capture(scene, { centerRaw: String(length), timeRaw: String(completed(scene).timeS) }, `sample${index}`));
  }
  const fit = pendulumFits(scene)[0]; assert.equal(fit.fit.distinct, 5); assert.ok(Math.abs(fit.g - 9.81) < .02);
  scene.equipment[1].parameters.initialAngleDeg = 60;
  scene = append(scene, capture(scene, { centerRaw: '.6', timeRaw: String(completed(scene).timeS) }, 'large'));
  assert.equal(pendulumResults(scene).at(-1).smallAngle, false); assert.ok(pendulumResults(scene).at(-1).g < 8.6); assert.equal(pendulumFits(scene)[0].count, 5);
  scene.equipment[1].parameters.initialAngleDeg = 5; scene.equipment[1].parameters.massKg = .1;
  scene = append(scene, capture(scene, { centerRaw: '.6' }, 'different')); assert.equal(pendulumFits(scene).length, 2);
});

test('gravity edits are validated, undoable and saved without changing earlier measurement snapshots', () => {
  const source = append(create(), capture(create())), initial = createHistory(source), original = JSON.stringify(source), previous = pendulumRig(source);
  for (const value of [0, -1, NaN, Infinity]) assert.equal(executeCommand(initial, { type: 'set-gravity', gravityMPerS2: value }, registry, time).ok, false);
  assert.equal(JSON.stringify(source), original);
  const changed = executeCommand(initial, { type: 'set-gravity', gravityMPerS2: 2.4525 }, registry, time); assert.equal(changed.ok, true);
  const next = pendulumRig(changed.history.present); assert.ok(Math.abs(next.periodS / previous.periodS - 2) < 1e-12); assert.notEqual(next.signature, previous.signature);
  assert.equal(changed.history.present.measurementSnapshots[0].modelConfigSnapshot.gravityMPerS2, 9.81);
  const restored = travelHistory(changed.history, 'undo', registry, time); assert.equal(restored.history.present.simulationConfig.gravityMPerS2, 9.81);
  const redone = travelHistory(restored.history, 'redo', registry, time); assert.equal(redone.history.present.simulationConfig.gravityMPerS2, 2.4525);
  const loaded = parseSceneJson(serializeScene(redone.history.present, registry), registry); assert.equal(loaded.ok, true); assert.equal(loaded.document.simulationConfig.gravityMPerS2, 2.4525);
});
