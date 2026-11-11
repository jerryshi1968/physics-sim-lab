import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBuoyancyExperiment } from '../../src/experiments/buoyancy.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateBuoyancy, buoyancyTransition, buoyancyViewScene, buoyancyDetached } from '../../src/equipment/buoyancy/simulate.ts';
import { captureBuoyancy, calculateBuoyancy } from '../../src/equipment/buoyancy/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { parseSceneJson } from '../../src/core/scene/transfer.ts';
import { displayMeasurement } from '../../src/core/measurements/display.ts';

const time = '2026-11-11T00:00:00.000Z', registry = createWorkbenchRegistry();
const setup = (method = 'factors') => createBuoyancyExperiment('test-buoyancy', time, method);
const item = (scene, id) => scene.equipment.find(peer => peer.id === `buoy-${id}`);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function lower(scene, height) { item(scene, 'meter').parameters.mountHeightM = height; return buoyancyTransition(scene); }
function fill(scene) { Object.assign(item(scene, 'overflow').parameters, { liquidM3: .00048, initialLiquidM3: .00048, spilledM3: 0, lostM3: 0, trialId: 'trial-one' }); }

test('air, partial immersion, full immersion, depth and liquid density match independent values', () => {
  let scene = setup();
  close(simulateBuoyancy(scene, registry).forceN, 1);
  scene = lower(scene, .39125);
  let result = simulateBuoyancy(scene, registry);
  assert.equal(result.ok, true);
  close(result.submergedM3, .000025);
  close(result.tensionN, .75);
  scene = lower(scene, .35);
  close(simulateBuoyancy(scene, registry).tensionN, .5);
  scene = lower(scene, .33);
  close(simulateBuoyancy(scene, registry).tensionN, .5);
  item(scene, 'vessel').parameters.liquidDensityKgPerM3 = 1200;
  close(simulateBuoyancy(scene, registry).tensionN, .4);
});

test('overflow conserves liquid and withdrawal never draws collected water back', () => {
  let scene = setup('archimedes'); fill(scene);
  scene = lower(scene, .35);
  close(item(scene, 'receiver').parameters.liquidM3, .00005);
  close(item(scene, 'overflow').parameters.liquidM3, .00043);
  close(item(scene, 'overflow').parameters.spilledM3, .00005);
  scene = lower(scene, .60);
  close(item(scene, 'receiver').parameters.liquidM3, .00005);
  close(item(scene, 'overflow').parameters.liquidM3, .00043);
  scene = lower(scene, .35);
  close(item(scene, 'receiver').parameters.liquidM3, .00005);
  assert.equal(parseSceneJson(JSON.stringify(scene), registry).ok, true);
});

test('the filled beaker starts displacing liquid at its physical rim', () => {
  const scene = setup();
  item(scene, 'vessel').parameters.liquidM3 = .0006;
  const dipped = lower(scene, .455), outcome = simulateBuoyancy(dipped, registry);
  assert.equal(outcome.ok, true);
  close(outcome.submergedM3, .000005);
  close(outcome.tensionN, .95);
  close(item(dipped, 'vessel').parameters.liquidM3, .000595);
});

test('insufficient initial water, missed receiver and receiver capacity are accounted for', () => {
  let scene = setup('archimedes');
  item(scene, 'overflow').parameters.liquidM3 = .0002;
  scene = lower(scene, .35);
  close(item(scene, 'receiver').parameters.liquidM3, 0);
  scene = lower(scene, .6); fill(scene); item(scene, 'receiver').pose.xM = .5;
  scene = lower(scene, .35);
  close(item(scene, 'overflow').parameters.lostM3, .00005);
  scene = lower(scene, .6); fill(scene); item(scene, 'receiver').pose.xM = -.06;
  item(scene, 'receiver').parameters.liquidM3 = .00024;
  scene = lower(scene, .35);
  close(item(scene, 'receiver').parameters.liquidM3, .00025);
  close(item(scene, 'overflow').parameters.lostM3, .00004);
});

test('contact, slack string and overloaded meter have no valid normal reading', () => {
  let scene = lower(setup(), .305);
  assert.equal(simulateBuoyancy(scene, registry).code, 'BUOY_CONTACT');
  scene = lower(setup(), .35);
  item(scene, 'body').parameters.massKg = .005;
  assert.equal(simulateBuoyancy(scene, registry).code, 'BUOY_SLACK');
  scene = setup(); item(scene, 'body').parameters.massKg = .5;
  assert.equal(simulateBuoyancy(scene, registry).code, 'BUOY_OVER_RANGE');
  assert.equal(captureBuoyancy(scene, registry, 'air', '5', '组1', 'buoyancy-bad', time).ok, false);
});

test('manual estimates and optional immersed-height records remain independent of model truth', () => {
  let scene = setup();
  function capture(phase, raw, name) {
    const result = captureBuoyancy(scene, registry, phase, raw, '第1组', `buoyancy-${name}`, time);
    assert.equal(result.ok, true, result.message);
    const appended = appendMeasurements(scene, registry, result.records, result.snapshot, time);
    assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics)); scene = appended.document;
    return result.records[0].id;
  }
  const air = capture('air', '1', 'air'); scene = lower(scene, .35); scene.revision++;
  const wet = capture('immersed', '.55', 'wet'), depth = capture('depth', '5', 'depth');
  const calculated = calculateBuoyancy(scene, 'force', [air, wet, depth], '第1组', 'buoyancy-result', time);
  assert.equal(calculated.ok, true, calculated.message);
  close(calculated.records[0].value, .45); close(calculated.records[0].context.physicalValue, .5);
  close(calculated.records[2].value, .00005);
  assert.equal(displayMeasurement(calculated.records[2]).value, 50);
  const appended = appendMeasurements(scene, registry, calculated.records, calculated.snapshot, time);
  assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics));
  assert.equal(parseSceneJson(JSON.stringify(appended.document), registry).ok, true);
  item(scene, 'body').parameters.massKg = .11;
  scene.revision++;
  const changed = capture('immersed', '.65', 'changed');
  assert.equal(calculateBuoyancy(scene, 'force', [air, changed], '第1组', 'buoyancy-mismatch', time).ok, false);
});

test('Archimedes comparison uses independently weighed collected liquid and traceable sources', () => {
  let scene = setup('archimedes');
  function capture(phase, raw, name) {
    const built = captureBuoyancy(scene, registry, phase, raw, '组1', `buoyancy-${name}`, time);
    assert.equal(built.ok, true, built.message);
    const appended = appendMeasurements(scene, registry, built.records, built.snapshot, time);
    assert.equal(appended.ok, true, JSON.stringify(appended.diagnostics)); scene = appended.document; return built.records[0].id;
  }
  item(scene, 'balance').parameters.zeroTrimKg = .0006;
  item(scene, 'receiver').parameters.targetId = 'buoy-balance'; item(scene, 'masses').parameters.mask = 20;
  const empty = capture('empty', '30', 'empty'), air = capture('air', '1', 'air');
  item(scene, 'receiver').parameters.targetId = ''; fill(scene); scene = lower(scene, .35); scene.revision++;
  const wet = capture('immersed', '.5', 'wet');
  const force = calculateBuoyancy(scene, 'force', [air, wet], '组1', 'buoyancy-force', time);
  assert.equal(force.ok, true, force.message);
  const added = appendMeasurements(scene, registry, force.records, force.snapshot, time); assert.equal(added.ok, true); scene = added.document;
  item(scene, 'receiver').parameters.targetId = 'buoy-balance'; item(scene, 'masses').parameters.mask = 22; scene.revision++;
  const full = capture('full', '80', 'full');
  const comparison = calculateBuoyancy(scene, 'weight', [force.records[0].id, empty, full], '组1', 'buoyancy-comparison', time);
  assert.equal(comparison.ok, true, comparison.message);
  close(comparison.records[0].value, .5); close(comparison.records[1].value, .5);
  assert.equal(appendMeasurements(scene, registry, comparison.records, comparison.snapshot, time).ok, true);
});

test('detaching apparatus preserves the displayed position of its suspended child', () => {
  const scene = setup(), shown = buoyancyViewScene(scene), updates = buoyancyDetached(scene, ['buoy-meter']);
  const child = updates.find(peer => peer.id === 'buoy-body');
  assert.equal(child.parameters.meterId, '');
  assert.deepEqual(child.pose, item(shown, 'body').pose);
});
