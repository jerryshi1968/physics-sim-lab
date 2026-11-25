import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickerExperiment } from '../../src/experiments/ticker.ts';
import { createCartExperiment } from '../../src/experiments/cart.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { TICKER, CART } from '../../src/equipment/cart/definitions.ts';
import { MECHANICAL_RULER } from '../../src/equipment/mechanical/definitions.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';
import { startTape, advanceTape, tapeSelection, tickerRig, tapeLengthM, tickerTimeLimitS } from '../../src/equipment/ticker/simulate.ts';
import { buildTickerMeasurement, tickerProfiles } from '../../src/equipment/ticker/measure.ts';
import { appendMeasurements, correctManualMeasurement } from '../../src/core/measurements/records.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';

const timestamp = '2026-11-25T00:00:00.000Z', registry = createWorkbenchRegistry();
const setup = () => createTickerExperiment('ticker-test', timestamp);
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const input = { origin: 5, target: 10, count: '5', rawM: '.02', group: '第一条', note: '水平拉动' };
const run = scene => advanceTape(startTape(scene, 'tape-test'), .6, .2);
const capture = (scene, overrides = {}, tape = run(scene)) => buildTickerMeasurement(scene, tape, true, { ...input, ...overrides }, 'sample', timestamp);

test('ticker start reuses exactly two registered apparatus types and preserves cart behavior', () => {
  const scene = setup();
  assert.deepEqual(scene.equipment.map(i => i.type), [TICKER, MECHANICAL_RULER]);
  assert.equal(scene.experimentId, 'H-MECH-05');
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.equal(equipmentSupport(scene).key, 'ticker');
  assert.equal(equipmentAvailability(scene, CART).enabled, false);
  assert.equal(equipmentAvailability(scene, TICKER).enabled, false);
  const old = createCartExperiment('old', timestamp);
  assert.equal(equipmentSupport(old).key, 'cart');
  assert.deepEqual(old.equipment.find(i => i.type === TICKER).parameters, { frequencyHz: 50 });
  assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
});

test('50 and 60 Hz count intervals with arbitrary nonzero origin: five intervals have six points', () => {
  for (const hz of [50, 60]) {
    const scene = setup(); scene.equipment[0].parameters.frequencyHz = hz;
    const tape = run(scene), selected = tapeSelection(tape, 5, 10);
    assert.equal(tape.dots.length, .6 * hz + 1);
    assert.equal(selected.intervals, 5); close(selected.timeS, 5 / hz); close(selected.displacementM, .2 * 5 / hz);
    close(tape.dots[10].timeS - tape.dots[5].timeS, selected.timeS);
  }
});

test('equal time sampling is invariant under render subdivision and captures variable hand speed', () => {
  const scene = setup(), whole = advanceTape(startTape(scene, 'same'), 1, .2);
  let sliced = startTape(scene, 'same');
  for (let n = 0; n < 120; n++) sliced = advanceTape(sliced, 1 / 120, .2);
  assert.equal(whole.dots.length, sliced.dots.length);
  for (let i = 0; i < whole.dots.length; i++) close(whole.dots[i].displacementM, sliced.dots[i].displacementM);
  const changed = advanceTape(advanceTape(startTape(scene, 'variable'), .2, .1), .2, .4);
  close(changed.dots[5].displacementM, .01); close(changed.dots[10].displacementM, .02); close(changed.dots[20].displacementM, .1);
  close(changed.dots[15].displacementM - changed.dots[10].displacementM, .04);
});

test('stationary powered tape produces overlapping dots; choose clear points after pulling', () => {
  const scene = setup(), stationary = advanceTape(startTape(scene, 'still'), .2, 0);
  assert.equal(stationary.dots.length, 11); assert.ok(stationary.dots.every(dot => dot.displacementM === 0));
  const moving = advanceTape(stationary, .4, .2);
  assert.equal(tapeSelection(moving, 0, 15), null);
  assert.equal(tapeSelection(moving, 10, 15), null);
  close(tapeSelection(moving, 15, 20).displacementM, .02);
  for (const [a, b] of [[0, 0], [-1, 10], [10, 5], [5.5, 10], [5, 1000]]) assert.equal(tapeSelection(moving, a, b), null);
});

test('physical tape and time limits truncate deterministically and invalid motion is rejected', () => {
  const scene = setup(), tape = advanceTape(startTape(scene, 'limit'), 100, .4);
  assert.equal(tape.timeS, tickerTimeLimitS); assert.equal(tape.displacementM, tapeLengthM);
  assert.equal(tape.dots.length, tickerTimeLimitS * 50 + 1);
  assert.ok(tape.dots.every(dot => dot.displacementM <= tapeLengthM));
  for (const [dt, speed] of [[NaN, .1], [Infinity, .1], [-1, .1], [.1, -.1], [.1, .6]]) assert.throws(() => advanceTape(tape, dt, speed), /TICKER_INVALID_MOTION/);
});

test('missing, duplicate, incompatible, rotated and random-error rigs do not produce normal readings', () => {
  for (const change of [s => { s.equipment = []; }, s => s.equipment.push({ ...s.equipment[0], id: 'other' }), s => { s.equipment[0].parameters.frequencyHz = 55; }, s => { s.equipment[0].pose.rotationRad = .1; }, s => { s.equipment[0].pose.flippedX = true; }, s => { s.simulationConfig.randomError.enabled = true; }]) {
    const scene = setup(); change(scene); assert.equal(tickerRig(scene).ok, false); assert.equal(startTape(scene, 'bad'), null);
  }
  const scene = setup(); scene.equipment = scene.equipment.filter(i => i.type !== MECHANICAL_RULER);
  assert.equal(tickerRig(scene).ok, true); assert.equal(capture(scene).ok, false);
});

test('manual count, derived time and independent ruler reading preserve truth, raw input and SI', () => {
  const scene = setup(), result = capture(scene, { rawM: '0.0230' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.records.map(r => [r.unit, r.value]), [['1', 5], ['s', .1], ['m', .023]]);
  const row = result.records[2]; assert.equal(row.source, 'manual'); assert.equal(row.rawInput, '0.0230'); assert.equal(row.context.originalRawInput, '0.0230'); close(row.context.physicalValue, .02);
  const note = JSON.parse(result.snapshot.note); assert.equal(note.origin, 5); assert.equal(note.target, 10); close(note.originM, .02); close(note.targetM, .04); assert.equal(note.frequencyHz, 50);
  const saved = appendMeasurements(scene, registry, result.records, result.snapshot, timestamp);
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const series = measurementSeries(saved.document, tickerProfiles[0]); close(series[0].points[0].x, .1); close(series[0].points[0].y, .023);
  assert.deepEqual(parseSceneJson(serializeScene(saved.document, registry), registry).document, saved.document);
});

test('wrong counts, stale or attached tapes and invalid/short rulers cannot be saved', () => {
  const scene = setup(), tape = run(scene);
  for (const count of ['6', '', '-1', 'hello']) assert.equal(capture(scene, { count }, tape).ok, false);
  assert.equal(buildTickerMeasurement(scene, tape, false, input, 'sample', timestamp).ok, false);
  assert.equal(capture(scene, { rawM: 'NaN' }, tape).ok, false);
  scene.equipment[0].parameters.frequencyHz = 60; assert.equal(capture(scene, {}, tape).ok, false);
  const short = setup(); short.equipment[1].parameters.lengthM = .05;
  assert.equal(capture(short, { target: 25, count: '20' }).ok, false);
  short.equipment[1].pose.rotationRad = .2; assert.equal(capture(short).ok, false);
});

test('ruler repositioning after taking a tape preserves the run and each origin plots separately', () => {
  const scene = setup(), tape = run(scene);
  scene.equipment[1].pose.xM = .5;
  assert.equal(capture(scene, {}, tape).ok, true);
  scene.equipment[1].pose.rotationRad = Math.PI / 2;
  assert.equal(capture(scene, {}, tape).ok, false);
  scene.equipment[1].pose.rotationRad = 0;
  const first = capture(scene, {}, tape), saved = appendMeasurements(scene, registry, first.records, first.snapshot, timestamp);
  const next = buildTickerMeasurement(saved.document, tape, true, { ...input, origin: 10, target: 15 }, 'second', timestamp);
  const both = appendMeasurements(saved.document, registry, next.records, next.snapshot, timestamp);
  assert.equal(both.ok, true);
  assert.equal(measurementSeries(both.document, tickerProfiles[0]).length, 2);
});

test('missing and out-of-range values remain explicit; corrections preserve original and transaction history', () => {
  for (const [rawM, status] of [['', 'invalid'], ['-.01', 'reverse'], ['2', 'over-range']]) {
    const result = capture(setup(), { rawM }); assert.equal(result.ok, true); assert.equal(result.records[2].value, null); assert.equal(result.records[2].measurementStatus, status);
  }
  const scene = setup(), result = capture(scene);
  const command = executeCommand(createHistory(scene), { type: 'record-measurements', records: result.records, snapshot: result.snapshot }, registry, timestamp);
  assert.equal(command.ok, true); assert.equal(command.history.present.measurementRecords.length, 3);
  const undone = travelHistory(command.history, 'undo', registry, timestamp); assert.equal(undone.history.present.measurementRecords.length, 0);
  const corrected = correctManualMeasurement(command.history.present, registry, 'sample.2', '.025', timestamp);
  assert.equal(corrected.ok, true); assert.equal(corrected.document.measurementRecords[2].value, .025); assert.equal(corrected.document.measurementRecords[2].context.originalRawInput, '.02');
  assert.deepEqual(corrected.document.measurementSnapshots, command.history.present.measurementSnapshots);
});
