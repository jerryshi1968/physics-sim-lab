import test from 'node:test';
import assert from 'node:assert/strict';
import { solveDcNetlist } from '../../src/core/electrical/solve.ts';
import { LampParametersSchema, lampCoefficient, lampBrightness } from '../../src/core/electrical/lamp.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { createElectricalRegistry, POWER, RESISTOR, AMMETER, VOLTMETER, LAMP } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { network, source, resistor } from './dc-fixtures.mjs';

const lamp = (id, from, to, spec = {}) => ({ id, kind: 'lamp', from, to, ratedVoltageV: 3, ratedCurrentA: .3, coldResistanceOhm: 2, maxCurrentA: .9, ...spec });
const value = (result, id) => result.solution.branches.find(branch => branch.id === id);
function close(actual, expected) { assert.equal(typeof actual, 'number'); assert.ok(Math.abs(actual - expected) <= 1e-9 + 1e-6 * Math.abs(expected), `${actual} != ${expected}`); }
function success(input, options) {
  const result = solveDcNetlist(input, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const name of ['normalizedKcl', 'normalizedConstitutive', 'normalizedPower']) assert.ok(result.solution.residuals[name] <= 1e-6);
  return result;
}

test('two rated nonlinear lamps in series at 6 V each have 3 V, .3 A, .9 W and rated brightness', () => {
  const input = network(source('E', 'p', 'n', 6), lamp('L1', 'p', 'm'), lamp('L2', 'm', 'n'));
  const before = structuredClone(input);
  const result = success(input);
  for (const id of ['L1', 'L2']) { close(value(result, id).currentA, .3); close(value(result, id).voltageV, 3); close(value(result, id).powerW, .9); close(value(result, id).brightness, .5); }
  close(value(result, 'E').currentA, -.3);
  assert.ok(result.solution.iterations > 1);
  assert.deepEqual(input, before);
});

test('two parallel nonlinear lamps at 3 V draw .3 A each and .6 A total', () => {
  const result = success(network(source(), lamp('L1', 'p', 'n'), lamp('L2', 'p', 'n')));
  close(value(result, 'L1').currentA, .3); close(value(result, 'L2').currentA, .3); close(value(result, 'E').currentA, -.6);
});

test('different series lamps satisfy independent cubic and KVL values instead of equal voltage', () => {
  const result = success(network(source('E', 'p', 'n', 28 / 9), lamp('L1', 'p', 'm'), lamp('L2', 'm', 'n', { ratedVoltageV: 2, ratedCurrentA: .2 })));
  close(value(result, 'L1').currentA, .2); close(value(result, 'L2').currentA, .2);
  close(value(result, 'L1').voltageV, 10 / 9); close(value(result, 'L2').voltageV, 2);
  close(value(result, 'L1').brightness, 20 / 101);
  close(value(result, 'L2').brightness, 4 / 13);
  assert.ok(value(result, 'L1').brightness < value(result, 'L2').brightness);
});

test('different parallel ratings yield unequal currents at the same voltage', () => {
  const result = success(network(source(), lamp('L1', 'p', 'n'), lamp('L2', 'p', 'n', { ratedCurrentA: .2 })));
  close(value(result, 'L1').currentA, .3); close(value(result, 'L2').currentA, .2); close(value(result, 'E').currentA, -.5);
  close(value(result, 'L1').powerW, .9); close(value(result, 'L2').powerW, .6);
  close(value(result, 'L1').brightness, .5); close(value(result, 'L2').brightness, .4);
});

test('lamp brightness follows actual power below and above rating on one shared display scale', () => {
  for (const [voltage, current, power, brightness] of [[.6, .15, .09, 1 / 11], [3, .3, .9, .5], [9, .45, 4.05, 9 / 11]]) {
    const branch = value(success(network(source('E', 'p', 'n', voltage), lamp('L', 'p', 'n'))), 'L');
    close(branch.currentA, current); close(branch.powerW, power); close(branch.brightness, brightness);
  }
  close(lampBrightness(0), 0);
  assert.ok(lampBrightness(.09) < lampBrightness(.9));
  assert.ok(lampBrightness(.9) < lampBrightness(4.05));
  assert.ok(lampBrightness(4.05) < lampBrightness(9));
  assert.ok(lampBrightness(9) < 1);
});

test('mixed lamp/resistor/finite source is solved by the same full MNA', () => {
  const result = success(network(source('E', 'p', 'n', 6.15, .5), lamp('L', 'p', 'm'), resistor('R', 'm', 'n', 10)));
  close(value(result, 'L').currentA, .3); close(value(result, 'L').voltageV, 3); close(value(result, 'R').voltageV, 3);
  close(value(result, 'E').internalLossW, .045);
});

test('reversal, zero voltage and the permitted zero cubic coefficient have finite physical results', () => {
  close(value(success(network(source('E', 'p', 'n', -3), lamp('L', 'p', 'n'))), 'L').currentA, -.3);
  close(value(success(network(source('E', 'p', 'n', 0), lamp('L', 'p', 'n'))), 'L').brightness, 0);
  close(value(success(network(source('E', 'p', 'n', .6), lamp('L', 'p', 'n', { ratedVoltageV: .6 }))), 'L').currentA, .3);
});

test('iteration exhaustion and model range failures return no normal solution or old brightness', () => {
  const input = network(source(), lamp('L', 'p', 'n'));
  const good = success(input);
  const failed = solveDcNetlist(input, { maxIterations: 1 });
  assert.equal(failed.ok, false); assert.equal(failed.diagnostics[0].code, 'NON_CONVERGENCE'); assert.equal('solution' in failed, false);
  const outside = solveDcNetlist(network(source('E', 'p', 'n', 1000), lamp('L', 'p', 'n')));
  assert.equal(outside.ok, false); assert.equal(outside.diagnostics[0].code, 'LAMP_MODEL_RANGE');
  close(value(good, 'L').brightness, .5);
  for (const options of [{ maxIterations: 0 }, { maxIterations: 1.5 }, { maxBacktracks: -1 }]) assert.equal(solveDcNetlist(input, options).ok, false);
});

test('invalid lamp parameters and non-finite derived coefficients are rejected', () => {
  const spec = { ratedVoltageV: 3, ratedCurrentA: .3, coldResistanceOhm: 2, maxCurrentA: .9 };
  close(lampCoefficient(spec), 800 / 9);
  for (const change of [{ coldResistanceOhm: 0 }, { coldResistanceOhm: 20 }, { maxCurrentA: .1 }, { ratedCurrentA: 1e-200 }, { ratedVoltageV: Infinity }]) {
    assert.equal(LampParametersSchema.safeParse({ ...spec, ...change }).success, false);
    assert.equal(solveDcNetlist(network(source(), lamp('L', 'p', 'n', change))).ok, false);
  }
});

export function instrumentScene() {
  const registry = createElectricalRegistry();
  const scene = createEmptyScene('instruments.test', '2026-11-04T02:00:00.000Z');
  scene.equipment = [[POWER, 'E'], [RESISTOR, 'R'], [AMMETER, 'A'], [VOLTMETER, 'V']].map(([type, id]) => ({ id, type, definitionVersion: 1,
    parameters: registry.get(type, 1).defaultParameters, pose: { xM: 0, yM: 0, rotationRad: 0 } }));
  const pairs = [['E', 'positive', 'A', 'low'], ['A', 'common', 'R', 'a'], ['R', 'b', 'E', 'negative'], ['V', 'low', 'R', 'a'], ['V', 'common', 'R', 'b']];
  scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  return scene;
}

test('both real instruments use the physically connected range and keep true and quantized display values separate', () => {
  const scene = instrumentScene(); scene.equipment[0].parameters.voltageV = 3.14;
  const outcome = simulateElectrical(scene);
  assert.equal(outcome.result.ok, true);
  const ammeter = outcome.meters.find(item => item.id === 'A');
  close(ammeter.trueValue, .314); close(ammeter.displayValue, .32); assert.equal(ammeter.range, 'low');
  close(ammeter.needleFraction, .32 / .6);
  const voltmeter = outcome.meters.find(item => item.id === 'V');
  assert.equal(voltmeter.status, 'over-range'); assert.equal(voltmeter.displayValue, null);
  scene.connections.find(w => w.from.equipmentId === 'V' && w.from.portId === 'low').from.portId = 'high';
  const high = simulateElectrical(scene).meters.find(item => item.id === 'V');
  assert.equal(high.range, 'high'); close(high.trueValue, 3.14); close(high.displayValue, 3);
  assert.equal(scene.measurementRecords.length, 0);
});

test('over-range and reverse give explicit unavailable readings and bounded needle positions', () => {
  const scene = instrumentScene(); scene.equipment[0].parameters.voltageV = 9;
  let reading = simulateElectrical(scene).meters.find(item => item.id === 'A');
  assert.equal(reading.status, 'over-range'); assert.equal(reading.measurementUsable, false); assert.equal(reading.displayValue, null); close(reading.needleFraction, 1.05);
  scene.equipment[0].parameters.voltageV = 3;
  scene.connections[0].to.portId = 'common'; scene.connections[1].from.portId = 'low';
  reading = simulateElectrical(scene).meters.find(item => item.id === 'A');
  assert.equal(reading.status, 'reverse'); close(reading.trueValue, -.3); assert.equal(reading.displayValue, null); close(reading.needleFraction, -.05);
});

test('simultaneously connected positive range ports fail rather than silently picking a range', () => {
  const scene = instrumentScene();
  scene.connections.push({ id: 'wrong-high', kind: 'wire', from: { equipmentId: 'A', portId: 'high' }, to: { equipmentId: 'E', portId: 'positive' } });
  const outcome = simulateElectrical(scene);
  assert.equal(outcome.result.ok, false); assert.equal(outcome.result.diagnostics[0].code, 'METER_MULTI_RANGE'); assert.deepEqual(outcome.meters, []);
  assert.equal(scene.connections.length, 6);
});

test('finite meter impedances load the network explicitly, with no arbitrary inactive-port connections', () => {
  const scene = instrumentScene();
  scene.equipment[0].parameters.voltageV = 6;
  scene.equipment[2].parameters.resistanceOhm = 1;
  scene.equipment[3].parameters.finiteInput = true; scene.equipment[3].parameters.inputResistanceOhm = 10;
  scene.connections[0].to.portId = 'high'; scene.connections[3].from.portId = 'high';
  const outcome = simulateElectrical(scene);
  assert.equal(outcome.result.ok, true);
  close(outcome.meters.find(item => item.id === 'A').trueValue, 1); close(outcome.meters.find(item => item.id === 'V').trueValue, 5);
});

test('disconnected meters show no fabricated zero value and schemas reject invalid scales', () => {
  const scene = instrumentScene(); scene.connections = [];
  const outcome = simulateElectrical(scene);
  for (const item of outcome.meters) { assert.equal(item.status, 'disconnected'); assert.equal(item.displayValue, null); assert.equal(item.trueValue, null); }
  const registry = createElectricalRegistry();
  for (const type of [AMMETER, VOLTMETER]) {
    const def = registry.get(type, 1);
    assert.equal(registry.validateParameters(def, { ...def.defaultParameters, lowResolution: 0 }), false);
    assert.equal(registry.validateParameters(def, { ...def.defaultParameters, highRange: .1 }), false);
  }
  assert.equal(registry.get(LAMP, 1).ports.length, 2);
});

test('a real dual-range voltmeter across independent components has undefined voltage, not a reference-zero subtraction', () => {
  const scene = instrumentScene();
  scene.equipment.push({ ...structuredClone(scene.equipment[0]), id: 'E2', parameters: { voltageV: 6 } });
  scene.connections[4].to = { equipmentId: 'E2', portId: 'positive' };
  const reading = simulateElectrical(scene).meters.find(item => item.id === 'V');
  assert.equal(reading.status, 'undefined'); assert.equal(reading.trueValue, null); assert.equal(reading.displayValue, null);
});
