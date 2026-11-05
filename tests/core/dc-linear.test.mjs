import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinearSystem, solveLinearSystem, stampAffineConductance, stampVoltageBranch } from '../../src/core/electrical/linear.ts';

test('equilibrated partial pivoting handles a zero diagonal and never changes the input matrix', () => {
  const system = { matrix: [[0, 2], [3, 4]], rhs: [4, 11] };
  const before = structuredClone(system);
  const result = solveLinearSystem(system);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.values[0] - 1) < 1e-12);
  assert.ok(Math.abs(result.values[1] - 2) < 1e-12);
  assert.ok(result.relativeResidual <= 1e-8);
  assert.deepEqual(system, before);
});

test('singular, badly conditioned and malformed matrices return no solution vector', () => {
  for (const [system, code] of [
    [{ matrix: [[1, 1], [2, 2]], rhs: [1, 2] }, 'SINGULAR_MATRIX'],
    [{ matrix: [[1, 1], [1, 1 + 1e-14]], rhs: [2, 2] }, 'ILL_CONDITIONED_MATRIX'],
    [{ matrix: [[0]], rhs: [1] }, 'SINGULAR_MATRIX'],
    [{ matrix: [[1, 2]], rhs: [1] }, 'NUMERIC_RANGE'],
    [{ matrix: [[Infinity]], rhs: [1] }, 'NUMERIC_RANGE'],
  ]) {
    const result = solveLinearSystem(system);
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.equal('values' in result, false);
  }
});

test('affine companion stamp exposes a tested nonlinear integration boundary without implementing Newton yet', () => {
  const system = createLinearSystem(2);
  stampAffineConductance(system, 0, undefined, .1, .1);
  stampVoltageBranch(system, 0, undefined, 1, 3, 0);
  const result = solveLinearSystem(system);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.values[0] - 3) < 1e-12);
  assert.ok(Math.abs(result.values[1] + .4) < 1e-12);
});
