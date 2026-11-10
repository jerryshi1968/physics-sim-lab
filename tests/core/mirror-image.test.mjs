import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMirrorImageExperiment } from '../../src/experiments/mirrorImage.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateMirrorImage } from '../../src/equipment/mirrorImage/simulate.ts';
import { buildMirrorImageMeasurements } from '../../src/equipment/mirrorImage/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { displayMeasurement, measurementInputInSI } from '../../src/core/measurements/display.ts';
import { parseSceneJson } from '../../src/core/scene/transfer.ts';

const timestamp = '2026-11-09T00:00:00.000Z';
const template = () => createMirrorImageExperiment('test-mirror', timestamp);
const part = (scene, id) => scene.equipment.find(item => item.id === id);
const read = { setupLabel: '第1组', objectDistance: '22', imageDistance: '22.1', objectHeight: '12', imageHeight: '12', screenObservation: '0' };
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('vertical mirror makes an upright equal-size image, seen only through its finite aperture', () => {
  const scene = template(), result = simulateMirrorImage(scene);
  assert.equal(result.ok, true);
  close(result.image.bottom.xM, .22);
  close(result.image.top.xM, .22);
  close(result.image.bottom.yM, .02);
  close(result.image.top.yM, .14);
  close(result.objectDistanceM, .22);
  close(result.imageDistanceM, .22);
  close(result.imageProjection.bottom.yM, .081311475410);
  close(result.imageProjection.top.yM, .158032786885);
  assert.equal(result.imageProjection.complete, true);
  part(scene, 'image-mirror').pose.xM = .05;
  part(scene, 'image-object').parameters.heightM = .16;
  const movedMirror = simulateMirrorImage(scene);
  close(movedMirror.image.bottom.xM, .32);
  close(movedMirror.imageDistanceM, .27);
  close(movedMirror.image.top.yM - movedMirror.image.bottom.yM, .16);
  part(scene, 'image-eye').pose.yM = 1.2;
  assert.equal(simulateMirrorImage(scene).imageProjection.visible, false);
  part(scene, 'image-eye').pose.xM = .06;
  assert.deepEqual(simulateMirrorImage(scene), { ok: false, code: 'MIRROR_FRONT' });
});

test('parallax exposes a false match that overlaps at one eye position', () => {
  const scene = template(), match = part(scene, 'image-match'), eye = part(scene, 'image-eye');
  match.pose.xM = .32;
  const ratio = .71 / .61;
  match.pose.yM = .19 + (.08 - .19) * ratio;
  match.parameters.heightM = .12 * ratio;
  let outcome = simulateMirrorImage(scene);
  close(outcome.matchProjection.top.yM, outcome.imageProjection.top.yM);
  eye.pose.yM += .1;
  outcome = simulateMirrorImage(scene);
  assert.ok(Math.abs(outcome.matchProjection.top.yM - outcome.imageProjection.top.yM) > .005);
  Object.assign(match.pose, { xM: .22, yM: .08 });
  match.parameters.heightM = .12;
  outcome = simulateMirrorImage(scene);
  assert.deepEqual(outcome.matchProjection, outcome.imageProjection);
});

test('screen evidence requires image-plane placement and coverage, and measurements keep the manual SI values', () => {
  const scene = template(), registry = createWorkbenchRegistry(), screen = part(scene, 'image-screen');
  assert.equal(simulateMirrorImage(scene).screenTest, false);
  const initial = buildMirrorImageMeasurements(scene, read, 'mirror-image-unplaced', timestamp);
  assert.equal(initial.records.at(-1).measurementStatus, 'out-of-model');
  assert.equal(initial.records.at(-1).value, null);
  Object.assign(part(scene, 'image-match').pose, { xM: .22, yM: .08 });
  Object.assign(screen.pose, { xM: .22, yM: .08 });
  screen.parameters.heightM = .08;
  assert.equal(simulateMirrorImage(scene).screenTest, false);
  screen.parameters.heightM = .18;
  assert.equal(simulateMirrorImage(scene).screenTest, true);
  const built = buildMirrorImageMeasurements(scene, read, 'mirror-image-placed', timestamp);
  assert.equal(built.ok, true);
  close(built.records[1].value, .221);
  close(built.records[1].context.physicalValue, .22);
  assert.equal(built.records[4].value, 0);
  const appended = appendMeasurements(scene, registry, built.records, built.snapshot, timestamp);
  assert.equal(appended.ok, true);
  assert.equal(parseSceneJson(JSON.stringify(appended.document), registry).ok, true);
  assert.equal(displayMeasurement(built.records[1]).unit, 'cm');
  assert.equal(displayMeasurement(built.records[1]).value, 22.1);
  assert.equal(measurementInputInSI(built.records[1], '23'), '0.23');
  scene.equipment = scene.equipment.filter(item => item.id !== 'height-ruler');
  const missingRuler = buildMirrorImageMeasurements(scene, read, 'mirror-image-no-ruler', timestamp);
  assert.equal(missingRuler.records[2].measurementStatus, 'out-of-model');
  assert.equal(missingRuler.records[0].measurementStatus, 'valid');
});
