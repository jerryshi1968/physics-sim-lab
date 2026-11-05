import test from 'node:test';
import assert from 'node:assert/strict';
import { solveThinLens } from '../../src/physics/samples/optical.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

for (const [u, v, m, kind] of [[0.3, 0.15, -0.5, 'real'], [0.2, 0.2, -1, 'real'],
  [0.15, 0.3, -2, 'real'], [0.05, -0.1, 2, 'virtual']]) {
  test(`f=0.10 m, u=${u} m: independent image distance and magnification`, () => {
    const value = ok(solveThinLens(0.1, u));
    assert.equal(value.kind, kind);
    close(value.imageDistanceM, v, 1e-6);
    close(value.magnification, m, 1e-9);
    finiteJSON(value);
  });
}

test('at focus uses an explicit no-finite-image state and JSON nulls', () => {
  const value = ok(solveThinLens(0.1, 0.1));
  assert.deepEqual(value, { kind: 'no-finite-image', imageDistanceM: null, magnification: null, nearFocus: true });
  finiteJSON(value);
});

test('both sides near focus preserve image classification without clamping to focus', () => {
  for (const [u, kind, sign] of [[0.10000000001, 'real', 1], [0.09999999999, 'virtual', -1]]) {
    const value = ok(solveThinLens(0.1, u));
    assert.equal(value.kind, kind);
    assert.equal(value.nearFocus, true);
    assert.equal(Math.sign(value.imageDistanceM), sign);
    close(1 / u + 1 / value.imageDistanceM, 10, 1e-12);
    finiteJSON(value);
  }
});

test('rejects coincident object and invalid or non-finite parameters', () => {
  for (const [f, u] of [[0, 0.1], [-0.1, 0.1], [0.1, 0], [0.1, -1], [NaN, 1], [0.1, Infinity]]) {
    invalid(solveThinLens(f, u), 'INVALID_LENS_PARAMETERS');
  }
});

test('extreme finite inputs do not silently convert an overflowed ratio into a zero image', () => {
  invalid(solveThinLens(Number.MIN_VALUE, 1e308), 'NUMERIC_RANGE');
});
