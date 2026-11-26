import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartVelocityExperiment } from '../../src/experiments/cartVelocity.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';
import { compileCartVelocity, advanceDrivenTape } from '../../src/equipment/cartVelocity/motion.ts';
import { buildCartVelocityMeasurement, cartVelocityRows, cartVelocityNumbers, cartVelocityCsv } from '../../src/equipment/cartVelocity/measure.ts';
import { startTape, tickerSignature } from '../../src/equipment/ticker/simulate.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../../src/core/measurements/records.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { linearFit } from '../../src/core/measurements/fit.ts';

const time = '2026-11-26T08:00:00.000Z', registry = createWorkbenchRegistry(), setup = () => createCartVelocityExperiment('cart-v', time);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const input = { zero: 20, at: 20, stride: 5, half: 1, rawA: '.28', rawB: '.27', group: '第1次', note: '观察记录' }, paper = { xM: -.55, yM: -.96 };
function tape(scene, id = 'paper', release = .1, end = 1.5) { const rig = compileCartVelocity(scene, registry); assert.equal(rig.ok, true, JSON.stringify(rig)); return advanceDrivenTape(startTape(scene, id), end, end, rig, release, true); }
function capture(scene, overrides = {}, run = tape(scene), place = paper) { return buildCartVelocityMeasurement(scene, run, true, { ...input, ...overrides }, 'sample-' + scene.revision, time, place); }
function save(scene, result) { assert.equal(result.ok, true, JSON.stringify(result)); const saved = appendMeasurements(scene, registry, result.records, result.snapshot, time); assert.equal(saved.ok, true, JSON.stringify(saved)); return saved.document; }

test('cart velocity starts with four reused apparatus, no fabricated records and pending teacher mapping', () => {
  const scene = setup(); assert.deepEqual(scene.equipment.map(i => i.type), ['mechanical.cart-track', 'mechanical.cart-ticker', 'mechanical.cart', 'mechanical.ruler']);
  assert.equal(equipmentSupport(scene).key, 'ticker'); assert.equal(equipmentAvailability(scene, 'mechanical.cart-photogate').enabled, false);
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.equal(scene.measurementRecords.length, 0); assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
});
test('shared system model includes hanging mass and limits travel, with independently calculated acceleration', () => {
  const scene = setup(), rig = compileCartVelocity(scene, registry); assert.equal(rig.ok, true); close(rig.acceleration, .2 / .47); close(rig.travelM, .75); close(rig.endTimeS, Math.sqrt(1.5 * .47 / .2));
  scene.equipment.find(i => i.id === 'track').parameters.dropLimitM = 1.4; close(compileCartVelocity(scene, registry).travelM, .8);
  scene.equipment.find(i => i.id === 'cart').pose.xM = .7; assert.equal(compileCartVelocity(scene, registry).ok, false);
});
test('dots remain stationary before release, then use exact clock times at 50 and 60 Hz independent of frame steps', () => {
  for (const f of [50, 60]) { const scene = setup(); scene.equipment.find(i => i.id === 'ticker').parameters.frequencyHz = f; const rig = compileCartVelocity(scene, registry), base = startTape(scene, 'p'), release = .137;
    const whole = advanceDrivenTape(base, 1, 1, rig, release, true); let chunked = base; for (let i = 1; i <= 100; i++) chunked = advanceDrivenTape(chunked, i / 100, i / 100, rig, release, true);
    assert.deepEqual(chunked.dots, whole.dots); assert.equal(whole.dots.length, f + 1); for (const d of whole.dots) close(d.displacementM, .5 * (.2 / .47) * Math.max(0, d.timeS - release) ** 2);
  }
});
test('power off freezes dots while the car continues to its physical stop and stationary powered dots overlap', () => {
  const scene = setup(), rig = compileCartVelocity(scene, registry), before = advanceDrivenTape(startTape(scene, 'p'), .6, .6, rig, .1, true), off = advanceDrivenTape(before, .6, 3, rig, .1, false);
  assert.deepEqual(off.dots, before.dots); close(off.timeS, .6); close(off.displacementM, .75);
  const on = advanceDrivenTape(before, 3, 3, rig, .1, true); close(on.dots.at(-1).displacementM, .75); close(on.dots.at(-2).displacementM, .75);
  assert.throws(() => advanceDrivenTape(before, .5, 1, rig, .1, true), /CLOCK/);
});
test('invalid pose, incompatible equipment, random error and absent timer never produce a valid coupled rig', () => {
  for (const mutate of [s => s.equipment.splice(1, 1), s => s.equipment[1].pose.rotationRad = .1, s => s.equipment[1].pose.yM = .5, s => s.simulationConfig.randomError.enabled = true, s => s.equipment[2].pose.yM = .2]) { const s = setup(); mutate(s); assert.equal(compileCartVelocity(s, registry).ok, false); }
});
test('symmetric positions give speed at E including a nonzero speed at the chosen time zero', () => {
  const scene = setup(), run = tape(scene), e = 20, a = .3 - run.dots[e - 1].displacementM, b = .3 - run.dots[e + 1].displacementM;
  const row = cartVelocityRows(save(scene, capture(scene, { rawA: String(a), rawB: String(b) }, run)))[0]; close(row.atTimeS, 0); close(row.velocityMPerS, (.2 / .47) * .3); close(row.timeS, .04); assert.equal(row.meta.e, e);
  close(cartVelocityNumbers(.3, .28, 2, 60).velocityMPerS, .6);
});
test('missing, reversed and over-range readings do not become normal velocities; overlapping dots are rejected', () => {
  for (const readings of [{ rawA: '', rawB: '.2' }, { rawA: '.2', rawB: '.3' }, { rawA: '50', rawB: '.2' }]) assert.equal(cartVelocityRows(save(setup(), capture(setup(), readings)))[0].velocityMPerS, null);
  assert.equal(capture(setup(), { zero: 1, at: 1 }).ok, false); assert.equal(capture(setup(), { at: 21 }).ok, false); assert.equal(capture(setup(), { rawA: 'NaN' }).ok, false);
  assert.equal(capture(setup(), {}, tape(setup()), { xM: -.55, yM: 0 }).ok, false);
});
test('correcting a raw reading recalculates speed and CSV while preserving raw input and frozen equipment', () => {
  let scene = save(setup(), capture(setup())); const old = scene.measurementSnapshots[0], id = scene.measurementRecords[0].id;
  const correction = correctManualMeasurement(scene, registry, id, '.29', time); assert.equal(correction.ok, true); scene = correction.document; close(cartVelocityRows(scene)[0].velocityMPerS, .5);
  assert.equal(scene.measurementRecords[0].context.originalRawInput, '.28'); assert.deepEqual(scene.measurementSnapshots[0], old); assert.match(cartVelocityCsv(scene), /0.29,0.27/);
  scene.equipment[2].parameters.hangerMassKg = .03; assert.notEqual(tickerSignature(scene), tape(setup()).signature); assert.deepEqual(scene.measurementSnapshots[0], old); assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
  const removed = removeMeasurement(scene, registry, scene.measurementRecords[1].id, time); assert.equal(cartVelocityRows(removed.document)[0].velocityMPerS, null);
});
test('three distinct repeated runs remain grouped and fitted solely from manual velocities with a free intercept', () => {
  let scene = setup();
  for (let group = 1; group <= 3; group++) for (let j = 0; j < 3; j++) scene = save(scene, capture(scene, { at: 20 + j * 5, group: '第' + group + '次', rawA: String(.27 + .04 * (.2 + j * .05 * group)), rawB: '.27' }, tape(scene, 'paper' + group)));
  const rows = cartVelocityRows(scene); assert.equal(new Set(rows.map(r => r.groupKey)).size, 3);
  for (let g = 1; g <= 3; g++) { const fit = linearFit(rows.filter(r => r.sample.runId === 'paper' + g).map(r => ({ x: r.atTimeS, y: r.velocityMPerS })), 3); close(fit.intercept, .2); close(fit.slope, .5 * g); }
});
