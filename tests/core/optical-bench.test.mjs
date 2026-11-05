import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from '../../src/equipment/optical/definitions.ts';
import { createOpticalExperiment } from '../../src/experiments/optical-bench.ts';
import { simulateOptical } from '../../src/equipment/optical/simulate.ts';
import { solveOpticalBench } from '../../src/core/optical/bench.ts';
import { buildOpticalMeasurements } from '../../src/equipment/optical/measure.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { POWER } from '../../src/equipment/electrical/definitions.ts';

const registry = createWorkbenchRegistry(), timestamp = '2026-11-04T00:00:00.000Z';
function scene(u = .3, s = .15) {
  const value = createOpticalExperiment('optical.test', timestamp);
  value.equipment.find(item => item.id === 'candle').pose = { xM: .5 - u, yM: .06, rotationRad: 0 };
  value.equipment.find(item => item.id === 'lens').pose.yM = .06;
  value.equipment.find(item => item.id === 'screen').pose = { xM: .5 + s, yM: .06, rotationRad: 0 };
  return value;
}
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance + Math.abs(b) * 1e-6, `${a} != ${b}`);
function solved(value) { const result = simulateOptical(value, registry); assert.equal(result.ok, true, JSON.stringify(result)); return result; }
const input = { rulerId: 'ruler', rawPositions: ['.101', '.401', '.552'], nature: '实像', orientation: '倒立', size: '缩小', clarity: '清晰', note: '自己找焦后读尺', setupLabel: '第1组' };

test('five real optical definitions, strict parameter bounds, empty entry and unaligned/unfocused initial kit are valid', () => {
  for (const type of [BENCH, CANDLE, LENS, SCREEN, RULER]) {
    const definition = registry.get(type, 1); assert.equal(definition.domain, 'optical'); assert.deepEqual(definition.ports, []);
  }
  const kit = createOpticalExperiment('kit', timestamp), empty = createOpticalExperiment('blank', timestamp, true);
  assert.equal(validateSceneDocument(kit, registry).ok, true); assert.deepEqual(empty.equipment, []); assert.deepEqual(kit.measurementRecords, []);
  const initial = solved(kit); assert.equal(initial.aligned, false); assert.notEqual(initial.screenStatus, 'sharp');
  assert.equal(empty.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  kit.equipment.find(item => item.type === LENS).parameters.focalLengthM = 0;
  assert.equal(validateSceneDocument(kit, registry).ok, false);
});

test('three real-image classes meet independent 10 cm lens benchmarks and rays meet at the same inverted image', () => {
  for (const [u, v, magnification] of [[.3, .15, -.5], [.2, .2, -1], [.15, .3, -2]]) {
    const result = solved(scene(u, v)); assert.equal(result.image.kind, 'real'); close(result.image.imageDistanceM, v); close(result.image.magnification, magnification);
    assert.equal(result.screenStatus, 'sharp'); close(result.spotRadiusM, 0); close(result.capturedFraction, 1);
    for (const ray of result.rays) close(ray.screenYM, .06 + magnification * (ray.objectYM - .06));
    const upper = result.rays.filter(ray => ray.screenYM > .06), lower = result.rays.filter(ray => ray.screenYM < .06);
    assert.ok(Math.max(...upper.map(ray => Math.abs(ray.zM))) > Math.max(...lower.map(ray => Math.abs(ray.zM))));
    const residual = 1 / .1 - 1 / result.objectDistanceM - 1 / result.image.imageDistanceM; close(residual, 0, 1e-12);
  }
});

test('focal plane is null rather than infinity and parallel outgoing slopes agree for each object point', () => {
  const result = solved(scene(.1)); assert.equal(result.image.kind, 'no-finite-image'); assert.equal(result.image.imageDistanceM, null); assert.equal(result.image.magnification, null);
  assert.equal(result.screenStatus, 'diffuse');
  for (const y of new Set(result.rays.map(ray => ray.objectYM))) {
    const bundle = result.rays.filter(ray => ray.objectYM === y); bundle.forEach(ray => close(ray.slope, bundle[0].slope));
  }
  assert.equal(/NaN|Infinity/.test(JSON.stringify(result)), false);
});

test('virtual case has upright double theoretical image while actual right-hand screen receives divergent spots', () => {
  const result = solved(scene(.05)); assert.equal(result.image.kind, 'virtual'); close(result.image.imageDistanceM, -.1); close(result.image.magnification, 2);
  assert.equal(result.screenStatus, 'diffuse'); close(result.spotRadiusM, .015);
  assert.ok(result.rays.some(ray => ray.visible)); assert.ok(result.sharpness < .01);
});

test('screen displacement produces continuous symmetric circle-of-confusion growth, independent of theoretical image', () => {
  const near = solved(scene(.3, .12)), focus = solved(scene(.3, .15)), far = solved(scene(.3, .18));
  close(near.spotRadiusM, .0012); close(far.spotRadiusM, .0012); close(near.sharpness, 1 / (1 + 2.4 ** 2));
  assert.ok(focus.sharpness > near.sharpness); assert.equal(near.screenStatus, 'defocused'); assert.equal(far.screenStatus, 'defocused');
  assert.deepEqual(near.image, far.image);
});

test('off-height source shifts image rather than teleporting it; screen height and wrong side control actual capture', () => {
  const value = scene(); value.equipment.find(item => item.id === 'candle').pose.yM += .01;
  const shifted = solved(value); assert.equal(shifted.aligned, false);
  for (const ray of shifted.rays) close(ray.screenYM, .06 - .5 * (ray.objectYM - .06));
  value.equipment.find(item => item.id === 'screen').pose.yM = .2;
  const missed = solved(value); assert.equal(missed.screenStatus, 'missed'); close(missed.capturedFraction, 0);
  const wrong = solved(scene(.3, -.1)); assert.equal(wrong.screenStatus, 'wrong-side'); close(wrong.capturedFraction, 0);
});

test('near-focus sides remain distinct, finite and explicitly beyond the bench instead of becoming a fake finite focus', () => {
  for (const delta of [-1e-10, 1e-10]) {
    const result = solved(scene(.1 + delta)); assert.equal(result.image.kind, delta > 0 ? 'real' : 'virtual');
    assert.ok(Number.isFinite(result.image.imageDistanceM)); assert.equal(result.imageInBench, false);
    assert.equal(/NaN|Infinity/.test(JSON.stringify(result)), false);
  }
});

test('coincident/wrong-side object, bench bounds, duplicate or missing apparatus, nonparaxial, tilt and mixed scenes fail without normal payload', () => {
  const cases = [
    [value => { value.equipment.find(item => item.id === 'candle').pose.xM = .5; }, 'OPTICAL_OBJECT_SIDE'],
    [value => { value.equipment.find(item => item.id === 'screen').pose.xM = 1.3; }, 'OPTICAL_BENCH_RANGE'],
    [value => { value.equipment.find(item => item.id === 'candle').pose.yM = .3; }, 'OPTICAL_NON_PARAXIAL'],
    [value => { value.equipment.find(item => item.id === 'lens').pose.rotationRad = .01; }, 'OPTICAL_ORIENTATION'],
    [value => { value.equipment.push({ ...structuredClone(value.equipment[1]), id: 'duplicate' }); }, 'OPTICAL_MULTIPLE_APPARATUS'],
    [value => { value.equipment = value.equipment.filter(item => item.id !== 'lens'); }, 'OPTICAL_MISSING_APPARATUS'],
    [value => { value.equipment.push({ id: 'E', type: POWER, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { voltageV: 3 } }); }, 'OPTICAL_MIXED_DOMAIN'],
  ];
  for (const [mutate, code] of cases) { const value = scene(); mutate(value); const result = simulateOptical(value, registry); assert.deepEqual(result, { ok: false, code }); }
  const setup = solved(scene()).setup; setup.lens.apertureRadiusM = NaN; assert.deepEqual(solveOpticalBench(setup), { ok: false, code: 'OPTICAL_NON_FINITE' });
});

test('independent ruler translation and placement do not change rays, formula or screen; manual zero shifts cancel in distances', () => {
  const value = scene(), before = solved(value); value.equipment.find(item => item.id === 'ruler').pose.xM += .05;
  assert.deepEqual(solved(value), before);
  const first = buildOpticalMeasurements(scene(), registry, input, 'sample.1', timestamp);
  const second = buildOpticalMeasurements(value, registry, { ...input, rawPositions: ['.051', '.351', '.502'] }, 'sample.2', timestamp);
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  first.records.slice(3, 5).forEach((record, index) => close(record.value, second.records[index + 3].value));
  close(first.records[0].context.physicalValue, .1); close(second.records[0].context.physicalValue, .05);
});

test('manual positions, derived distances and chosen observations stay separate from model truth through snapshot/history/JSON/CSV', () => {
  const value = scene(), built = buildOpticalMeasurements(value, registry, input, 'sample.1', timestamp); assert.equal(built.ok, true);
  close(built.records[4].value, .151); close(built.records[4].context.physicalValue, .15);
  const saved = appendMeasurements(value, registry, built.records, built.snapshot, timestamp); assert.equal(saved.ok, true);
  const target = saved.document.equipment.find(item => item.id === 'screen');
  const moved = executeCommand(createHistory(saved.document), { type: 'update-equipment', id: target.id, parameters: target.parameters, pose: { ...target.pose, xM: .8 } }, registry, timestamp); assert.equal(moved.ok, true);
  assert.deepEqual(moved.history.present.measurementRecords, saved.document.measurementRecords);
  const undo = travelHistory(moved.history, 'undo', registry, timestamp); assert.equal(undo.ok, true); close(solved(undo.history.present).spotRadiusM, 0);
  const restored = parseSceneJson(serializeScene(moved.history.present, registry), registry); assert.equal(restored.ok, true);
  assert.deepEqual(restored.document.measurementSnapshots[0], built.snapshot); assert.equal(JSON.parse(built.snapshot.note).observations.orientation, '倒立');
  assert.ok(measurementsCsv(restored.document).includes('自己找焦后读尺'));
  const profile = { id: 'optical', available: true, x: { quantity: 'length', unit: 'm', pointLabel: '物距u' }, y: { quantity: 'length', unit: 'm', pointLabel: '屏距s' } };
  const series = measurementSeries(restored.document, profile); assert.equal(series.length, 1); close(series[0].points[0].x, .3); close(series[0].points[0].y, .151);
});

test('missing or invalid manual inputs are never filled, overflow is rejected, and out-of-range ruler cannot produce normal derived distances', () => {
  const value = scene(), missing = buildOpticalMeasurements(value, registry, { ...input, rawPositions: ['', '', ''] }, 'sample.1', timestamp);
  assert.equal(missing.ok, true); assert.ok(missing.records.every(record => record.value === null));
  assert.equal(buildOpticalMeasurements(value, registry, { ...input, rawPositions: ['=1+1', '0', '0'] }, 'sample.2', timestamp).ok, false);
  assert.equal(buildOpticalMeasurements(value, registry, { ...input, rawPositions: ['-1e308', '1e308', '1e308'] }, 'sample.3', timestamp).ok, false);
  assert.equal(buildOpticalMeasurements(value, registry, input, 'a'.repeat(80), timestamp).ok, false);
  value.equipment.find(item => item.id === 'ruler').pose.xM = .6;
  const out = buildOpticalMeasurements(value, registry, input, 'sample.4', timestamp); assert.equal(out.ok, true);
  assert.equal(out.records[3].value, null); assert.equal(out.records[4].value, null);
  for (const u of [.1, .05]) {
    const unavailable = buildOpticalMeasurements(scene(u), registry, { ...input, rawImageDistance: '.3' }, 'sample.5', timestamp);
    assert.equal(unavailable.ok, true); assert.equal(unavailable.records[5].value, null); assert.equal(unavailable.records[5].context.physicalValue, null);
  }
  const focused = buildOpticalMeasurements(scene(), registry, { ...input, rawImageDistance: '.151' }, 'sample.6', timestamp);
  assert.equal(focused.ok, true); close(focused.records[5].value, .151); close(focused.records[5].context.physicalValue, .15);
});

test('all five image classes including nulls and off-screen outcomes round trip without NaN or Infinity', () => {
  for (const u of [.3, .2, .15, .1, .05]) {
    const value = scene(u), text = serializeScene(value, registry), restored = parseSceneJson(text, registry); assert.equal(restored.ok, true);
    assert.deepEqual(solved(restored.document), solved(value)); assert.equal(/NaN|Infinity/.test(text), false);
  }
});
