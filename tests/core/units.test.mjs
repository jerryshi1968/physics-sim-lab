import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnit, dimensionOf, toSI } from '../../src/core/units/units.ts';
import { close } from '../physics/helpers.mjs';

test('display length converts to SI without changing physical magnitude', () => {
  close(convertUnit(10, 'cm', 'm'), 0.1, 1e-12);
  close(convertUnit(0.1, 'm', 'mm'), 100, 1e-12);
  assert.deepEqual(toSI({ value: 30, unit: 'cm' }), { value: 0.3, unit: 'm' });
});

test('mass, time, current, resistance and angle conversions have independent expected values', () => {
  close(convertUnit(25, 'g', 'kg'), 0.025, 1e-12);
  close(convertUnit(120, 'ms', 's'), 0.12, 1e-12);
  close(convertUnit(300, 'mA', 'A'), 0.3, 1e-12);
  close(convertUnit(2, 'kΩ', 'Ω'), 2000, 1e-12);
  close(convertUnit(180, 'deg', 'rad'), Math.PI, 1e-12);
  assert.equal(dimensionOf('m/s²'), 'acceleration');
  assert.equal(dimensionOf('N·m'), 'torque');
});

test('signed values and zero survive SI conversion', () => {
  assert.deepEqual(toSI({ value: -20, unit: 'cm' }), { value: -0.2, unit: 'm' });
  assert.deepEqual(toSI({ value: 0, unit: 'A' }), { value: 0, unit: 'A' });
});

test('cross-dimension, unknown, non-finite and overflowing conversions are rejected', () => {
  assert.throws(() => convertUnit(1, 'm', 'N'), /INCOMPATIBLE_UNITS/);
  assert.throws(() => convertUnit(1, 'constructor', 'm'), /UNKNOWN_UNIT/);
  assert.throws(() => toSI({ value: NaN, unit: 'm' }), /NON_FINITE_QUANTITY/);
  assert.throws(() => convertUnit(Infinity, 'm', 'cm'), /NON_FINITE_QUANTITY/);
  assert.throws(() => convertUnit(1e308, 'm', 'mm'), /QUANTITY_OVERFLOW/);
});
