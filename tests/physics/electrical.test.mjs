import test from 'node:test';
import assert from 'node:assert/strict';
import { solveResistors, solveLamps } from '../../src/physics/samples/electrical.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

const lamp = { ratedVoltageV: 3, ratedCurrentA: 0.3, coldResistanceOhm: 2, maxCurrentA: 0.6 };

function checkConservation(value, topology, sourceV, coefficients) {
  const { totalCurrentA: total, branchCurrentsA: currents, branchVoltagesV: voltages, branchPowersW: powers } = value;
  const currentScale = Math.max(1, Math.abs(total) + currents.reduce((sum, i) => sum + Math.abs(i), 0));
  const voltageScale = Math.max(1, Math.abs(sourceV) + voltages.reduce((sum, u) => sum + Math.abs(u), 0));
  const powerScale = Math.max(1, Math.abs(sourceV * total) + powers.reduce((sum, p) => sum + Math.abs(p), 0));
  if (topology === 'series') {
    currents.forEach(i => close((i - total) / currentScale, 0, 1e-6));
    close((voltages.reduce((sum, u) => sum + u, 0) - sourceV) / voltageScale, 0, 1e-6);
  } else {
    close((currents.reduce((sum, i) => sum + i, 0) - total) / currentScale, 0, 1e-6);
    voltages.forEach(u => close((u - sourceV) / voltageScale, 0, 1e-6));
  }
  close((powers.reduce((sum, p) => sum + p, 0) - sourceV * total) / powerScale, 0, 1e-6);
  coefficients?.forEach(([r, a], index) => {
    const i = currents[index];
    const predictedV = r * i + a * i ** 3;
    close((voltages[index] - predictedV) / Math.max(1, Math.abs(voltages[index]), Math.abs(predictedV)), 0, 1e-6);
  });
  finiteJSON(value);
}

test('resistors: 3 V, 10/20 ohm series benchmark', () => {
  const value = ok(solveResistors('series', 3, [10, 20]));
  close(value.totalCurrentA, 0.1, 1e-9, 1e-6);
  value.branchVoltagesV.forEach((u, index) => close(u, [1, 2][index], 1e-9, 1e-6));
  close(value.sourcePowerW, 0.3);
  checkConservation(value, 'series', 3);
});

test('resistors: parallel benchmark and independent branch currents', () => {
  const value = ok(solveResistors('parallel', 3, [10, 20]));
  close(value.totalCurrentA, 0.45, 1e-9, 1e-6);
  value.branchCurrentsA.forEach((i, index) => close(i, [0.3, 0.15][index], 1e-9, 1e-6));
  assert.deepEqual(value.branchVoltagesV, [3, 3]);
  checkConservation(value, 'parallel', 3);
});

test('lamps: same lamps series at 6 V and parallel at 3 V', () => {
  for (const [topology, sourceV, expectedTotal] of [['series', 6, 0.3], ['parallel', 3, 0.6]]) {
    const value = ok(solveLamps(topology, sourceV, [lamp, lamp]));
    close(value.totalCurrentA, expectedTotal, 1e-9, 1e-6);
    value.branchCurrentsA.forEach(i => close(i, 0.3, 1e-9, 1e-6));
    value.branchVoltagesV.forEach(u => close(u, 3, 1e-9, 1e-6));
    value.branchPowersW.forEach(p => close(p, 0.9, 1e-9, 1e-6));
    checkConservation(value, topology, sourceV, [[2, 800 / 9], [2, 800 / 9]]);
  }
});

test('different series lamps share current but do not share voltage equally', () => {
  const second = { ...lamp, ratedVoltageV: 1, coldResistanceOhm: 1 };
  const value = ok(solveLamps('series', 4, [lamp, second]));
  close(value.totalCurrentA, 0.3, 1e-9, 1e-6);
  value.branchVoltagesV.forEach((u, index) => close(u, [3, 1][index], 1e-9, 1e-6));
  checkConservation(value, 'series', 4, [[2, 800 / 9], [1, 700 / 27]]);
});

test('different parallel lamps share voltage but have different currents', () => {
  const second = { ...lamp, ratedCurrentA: 0.15, coldResistanceOhm: 10 };
  const value = ok(solveLamps('parallel', 3, [lamp, second]));
  value.branchCurrentsA.forEach((i, index) => close(i, [0.3, 0.15][index], 1e-9, 1e-6));
  close(value.totalCurrentA, 0.45, 1e-9, 1e-6);
  checkConservation(value, 'parallel', 3, [[2, 800 / 9], [10, 4000 / 9]]);
});

test('off-rated mixed lamp network satisfies independent cubic and conservation checks', () => {
  for (const topology of ['series', 'parallel']) {
    const value = ok(solveLamps(topology, 1.7, [lamp, { ...lamp, ratedVoltageV: 1, coldResistanceOhm: 1 }]));
    checkConservation(value, topology, 1.7, [[2, 800 / 9], [1, 700 / 27]]);
  }
});

test('zero voltage, reversed polarity and linear limiting lamp', () => {
  for (const topology of ['series', 'parallel']) {
    close(ok(solveLamps(topology, 0, [lamp, lamp])).totalCurrentA, 0);
    const negative = ok(solveLamps(topology, topology === 'series' ? -6 : -3, [lamp, lamp]));
    negative.branchCurrentsA.forEach(i => close(i, -0.3, 1e-9, 1e-6));
    negative.branchPowersW.forEach(p => assert.ok(p >= 0));
    checkConservation(negative, topology, topology === 'series' ? -6 : -3, [[2, 800 / 9], [2, 800 / 9]]);
  }
  close(ok(solveLamps('parallel', 1, [{ ...lamp, ratedVoltageV: 0.6 }])).totalCurrentA, 0.5, 1e-9);
  close(ok(solveResistors('series', -3, [10, 20])).totalCurrentA, -0.1);
});

test('rejects invalid resistor parameters instead of inventing ideal zero-ohm behavior', () => {
  for (const resistances of [[], [0], [-1], [NaN], [Infinity]]) {
    invalid(solveResistors('series', 3, resistances), 'INVALID_CIRCUIT_PARAMETERS');
  }
  invalid(solveResistors('mesh', 3, [10]), 'INVALID_CIRCUIT_PARAMETERS');
  invalid(solveResistors('parallel', NaN, [10]), 'INVALID_CIRCUIT_PARAMETERS');
  invalid(solveResistors('parallel', 1e308, [1e-308]), 'NUMERIC_RANGE');
});

test('lamp parameters, range and iteration failures return no partial readings', () => {
  for (const patch of [{ ratedCurrentA: 0 }, { coldResistanceOhm: 0 }, { ratedVoltageV: 0.5 },
    { maxCurrentA: 0.2 }, { maxCurrentA: Infinity }, { ratedVoltageV: NaN }]) {
    invalid(solveLamps('series', 3, [{ ...lamp, ...patch }]), 'INVALID_LAMP_PARAMETERS');
  }
  invalid(solveLamps('series', 3, []), 'INVALID_CIRCUIT_PARAMETERS');
  invalid(solveLamps('parallel', 30, [lamp]), 'LAMP_MODEL_RANGE');
  invalid(solveLamps('parallel', 1, [lamp], 1), 'NON_CONVERGENCE');
  invalid(solveLamps('parallel', 1, [lamp], 0), 'INVALID_CIRCUIT_PARAMETERS');
});
