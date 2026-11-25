import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickerExperiment } from '../../src/experiments/ticker.ts';
import { advanceTapePosition, startTape, tapeRulerPlacement, tickerTapeHandlingNotice, TICKER_DIRECT_MODEL } from '../../src/equipment/ticker/simulate.ts';
import { buildTickerMeasurement } from '../../src/equipment/ticker/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';

const time = '2026-11-25T08:00:00.000Z', registry = createWorkbenchRegistry();
const setup = () => createTickerExperiment('pointer-test', time);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const input = { origin: 5, target: 10, count: '5', rawM: '.041', group: '手拉', note: '学生抄尺' };

test('threading and removing tape require both power off and clamp open', () => {
  assert.equal(tickerTapeHandlingNotice(false, false), null);
  assert.match(tickerTapeHandlingNotice(false, true), /打开固定夹/);
  assert.match(tickerTapeHandlingNotice(true, false), /关闭计时器电源/);
  assert.match(tickerTapeHandlingNotice(true, true), /关闭计时器电源/);
});

test('pointer positions at real event times determine uniform and variable-speed dot spacing at 50 and 60 Hz', () => {
  for (const hz of [50, 60]) {
    const scene = setup(); scene.equipment[0].parameters.frequencyHz = hz;
    const first = advanceTapePosition(startTape(scene, 'pointer'), .3, .12), second = advanceTapePosition(first, .1, .2);
    assert.equal(second.dots.length, .4 * hz + 1);
    close(first.dots[hz / 10].displacementM, .04);
    close(second.dots[hz * .4].displacementM, .2);
    close(second.dots[hz * .4].displacementM - second.dots[hz * .3].displacementM, .08);
    assert.equal(second.interaction, 'pointer.v2');
  }
});

test('rendering a stationary preview does not mutate the last pointer anchor or the next interpolated segment', () => {
  const scene = setup(), anchor = advanceTapePosition(startTape(scene, 'anchor'), .1, .04);
  const frozen = structuredClone(anchor);
  for (let frame = 1; frame <= 12; frame++) advanceTapePosition(anchor, frame / 120, .04);
  assert.deepEqual(anchor, frozen);
  const moved = advanceTapePosition(anchor, .1, .08);
  close(moved.dots[6].displacementM, .048); close(moved.dots[10].displacementM, .08);
});

test('pointer motion follows distances above the former fixed-speed limit, rejects reversal and clamps the clock', () => {
  const scene = setup(), initial = startTape(scene, 'fast'), fast = advanceTapePosition(initial, .2, .4);
  close(fast.displacementM, .4); close(fast.dots[5].displacementM, .2);
  for (const [dt, x] of [[0, .1], [-1, .1], [NaN, .1], [.1, -.1], [.1, .81], [.1, Infinity]]) assert.throws(() => advanceTapePosition(initial, dt, x), /TICKER_INVALID_POINTER_MOTION/);
  assert.throws(() => advanceTapePosition(fast, .1, .3), /TICKER_INVALID_POINTER_MOTION/);
  const limited = advanceTapePosition(initial, 24, .8);
  assert.equal(limited.timeS, 12); close(limited.displacementM, .4); assert.equal(limited.dots.length, 601);
});

test('a tape must physically lie above a horizontal ruler and both points must be within its actual ticks', () => {
  const scene = setup(), run = advanceTapePosition(startTape(scene, 'ruler'), .3, .12);
  const paper = { xM: .4, yM: -.11 }, readings = tapeRulerPlacement(scene, run, paper, 5, 10);
  close(readings.originM, .54); close(readings.targetM, .50);
  for (const bad of [null, { xM: .4, yM: .1 }, { xM: -.15, yM: -.11 }, { xM: 2, yM: -.11 }, { xM: NaN, yM: -.11 }]) assert.equal(tapeRulerPlacement(scene, run, bad, 5, 10), null);
  scene.equipment[1].pose.rotationRad = .1; assert.equal(tapeRulerPlacement(scene, run, paper, 5, 10), null);
  scene.equipment[1].pose.rotationRad = 0; scene.equipment[1].pose.xM = .5;
  assert.equal(tapeRulerPlacement(scene, run, paper, 5, 10), null);
});

test('direct manipulation captures preserve actual tape and ruler placement and remain compatible with existing documents', () => {
  const scene = setup(), run = advanceTapePosition(startTape(scene, 'capture'), .3, .12), paper = { xM: .4, yM: -.11 };
  assert.equal(buildTickerMeasurement(scene, run, true, input, 'sample', time).ok, false);
  const result = buildTickerMeasurement(scene, run, true, input, 'sample', time, paper);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.snapshot.modelVersion, TICKER_DIRECT_MODEL);
  const note = JSON.parse(result.snapshot.note); assert.deepEqual(note.placement, [.4, -.11]); close(note.ruler[0] - note.ruler[1], .04);
  close(result.records[2].value, .041); close(result.records[2].context.physicalValue, .04);
  const saved = appendMeasurements(scene, registry, result.records, result.snapshot, time);
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.deepEqual(parseSceneJson(serializeScene(saved.document, registry), registry).document, saved.document);
  scene.equipment[1].pose.xM = 2;
  assert.equal(buildTickerMeasurement(scene, run, true, input, 'moved', time, paper).ok, false);
});

test('a foreground ruler may overlap or lie above the tape without changing the measured distance', () => {
  const scene = setup(), run = advanceTapePosition(startTape(scene, 'overlap'), .3, .12), paper = { xM: .4, yM: -.11 };
  for (const rulerY of [-.11, -.10, -.08, -.14]) {
    scene.equipment[1].pose.yM = rulerY;
    const readings = tapeRulerPlacement(scene, run, paper, 5, 10);
    close(readings.originM, .54); close(readings.targetM, .50);
    const captured = buildTickerMeasurement(scene, run, true, input, 'sample', time, paper);
    assert.equal(captured.ok, true); close(captured.records[2].context.physicalValue, .04);
  }
  scene.equipment[1].pose.yM = 0;
  assert.equal(tapeRulerPlacement(scene, run, paper, 5, 10), null);
});
