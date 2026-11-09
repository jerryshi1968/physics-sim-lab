import assert from 'node:assert/strict';
import test from 'node:test';
import { createCartExperiment } from '../../src/experiments/cart.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { CART, GATE, TICKER, TRACK } from '../../src/equipment/cart/definitions.ts';
import { cartDisplacement, cartDropPoint, cartEstimate, cartSamples, cartSignature, compileCart } from '../../src/equipment/cart/simulate.ts';
import { buildCartMeasurement, cartProfiles } from '../../src/equipment/cart/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';

const registry = createWorkbenchRegistry();
const timestamp = '2026-11-09T00:00:00.000Z';
const setup = () => createCartExperiment('cart-test', timestamp);
const apparatus = (scene, type) => scene.equipment.find(item => item.type === type);
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

function run(scene, time) {
  const rig = compileCart(scene, registry);
  assert.equal(rig.ok, true, JSON.stringify(rig));
  return { rig, id: 'test-run', signature: cartSignature(scene), timeS: time ?? rig.endTimeS };
}

test('cart control-variable benchmarks include hanging mass and stop at the first limit', () => {
  const scene = setup();
  const base = run(scene).rig;
  close(base.systemKg, .5);
  close(base.forceN, .5);
  close(base.acceleration, 1);
  close(base.endTimeS, Math.sqrt(2.8));
  close(cartDisplacement(base, .4), .08);
  close(cartDisplacement(base, 9), 1.4);
  close(base.startXM + base.travelM, .7);
  assert.match(base.stopReason, /下落限位/);

  const cart = apparatus(scene, CART);
  Object.assign(cart.parameters, { loadMassKg: .05, hangerMassKg: .1 });
  const doubleForce = run(scene).rig;
  close(doubleForce.systemKg, .5);
  close(doubleForce.forceN, 1);
  close(doubleForce.acceleration, 2);

  Object.assign(cart.parameters, { loadMassKg: .6, hangerMassKg: .05 });
  const doubleMass = run(scene).rig;
  close(doubleMass.systemKg, 1);
  close(doubleMass.forceN, .5);
  close(doubleMass.acceleration, .5);
  apparatus(scene, TRACK).parameters.dropLimitM = 2;
  const railEnd = run(scene).rig;
  close(railEnd.travelM, 1.49);
  assert.match(railEnd.stopReason, /轨道末端/);
});

test('photogate events require complete flag passage and use event timing independent of frames', () => {
  const scene = setup();
  const first = run(scene, .61);
  assert.deepEqual(cartSamples(first, 'gate', 5), []);
  const afterFirst = run(scene, .67);
  const [reading] = cartSamples(afterFirst, 'gate', 5);
  close(reading.inS, .6);
  close(reading.outS, .66332);
  close(reading.velocity, .04 / .06332);
  assert.equal(cartEstimate(afterFirst, 'gate', 5), null);
  const full = run(scene);
  close(cartEstimate(full, 'gate', 5), 1, .002);
  assert.equal(cartSamples(full, 'gate', 5).length, 2);
  const secondGate = scene.equipment.find(item => item.id === 'gate-b');
  secondGate.pose.xM = .39;
  assert.equal(cartSamples(run(scene), 'gate', 5).length, 2);
  apparatus(scene, TRACK).parameters.dropLimitM = .9;
  assert.equal(cartSamples(run(scene), 'gate', 5).length, 1);
  apparatus(scene, TRACK).parameters.dropLimitM = 1.4;
  apparatus(scene, GATE).pose.yM = .2;
  assert.equal(cartSamples(run(scene), 'gate', 5).length, 1);
  assert.equal(cartEstimate(run(scene), 'gate', 5), null);
});

test('paper tape works without photogates at 50 and 60 Hz, including a zero-force control', () => {
  const scene = setup();
  scene.equipment = scene.equipment.filter(item => item.type !== GATE);
  for (const frequency of [50, 60]) {
    apparatus(scene, TICKER).parameters.frequencyHz = frequency;
    const samples = cartSamples(run(scene, .3), 'tape', frequency / 10);
    assert.deepEqual(samples.map(({ timeS, displacementM }) => [timeS, displacementM]), [[0, 0], [.1, .005], [.2, .02], [.3, .045]]);
    close(cartEstimate(run(scene, .3), 'tape', frequency / 10), 1);
  }
  apparatus(scene, CART).parameters.hangerMassKg = 0;
  close(cartEstimate(run(scene), 'tape', 6), 0);
  assert.ok(cartSamples(run(scene), 'tape', 1).every(point => point.displacementM === 0));
  assert.deepEqual(cartSamples(run(scene, Infinity), 'tape', 1), []);
});

test('invalid assemblies are diagnosed and only nearby equipment snaps to the rail', () => {
  const scene = setup();
  const point = { xM: .2, yM: .08 };
  assert.deepEqual(cartDropPoint(scene, GATE, point), { xM: .2, yM: 0 });
  assert.equal(cartDropPoint(scene, TICKER, point), point);
  apparatus(scene, CART).pose.yM = .2;
  assert.equal(compileCart(scene, registry).code, 'CART_OFF_TRACK');
  apparatus(scene, CART).pose.yM = 0;
  scene.equipment.push({ ...apparatus(scene, TICKER), id: 'duplicate-ticker' });
  assert.equal(compileCart(scene, registry).code, 'CART_APPARATUS');
});

test('both measurement methods create validated snapshots, charts and stale-run protection', () => {
  let scene = setup();
  const frame = run(scene);
  const input = { method: 'gate', stride: 5, group: '力的对照', note: '', index: null };
  for (const [id, overrides] of [['gate', {}], ['tape', { method: 'tape' }], ['position', { method: 'tape', index: 2 }]]) {
    const captured = buildCartMeasurement(scene, frame, { ...input, ...overrides }, id, timestamp);
    assert.equal(captured.ok, true);
    const saved = appendMeasurements(scene, registry, captured.records, captured.snapshot, timestamp);
    assert.equal(saved.ok, true, JSON.stringify(saved));
    scene = saved.document;
  }
  assert.equal(scene.measurementSnapshots.length, 3);
  assert.equal(measurementSeries(scene, cartProfiles[0])[0].points[0].x, .5);
  close(measurementSeries(scene, cartProfiles[1])[0].points[0].x, 2);
  close(measurementSeries(scene, cartProfiles[2])[0].points[0].x, .2);
  close(measurementSeries(scene, cartProfiles[3])[0].points[0].x, .04);
  apparatus(scene, CART).parameters.loadMassKg = .2;
  assert.equal(buildCartMeasurement(scene, frame, input, 'stale', timestamp).code, 'CART_STALE');
});
