import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFriction } from '../../src/physics/samples/friction.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

const base = { massKg: 0.5, gravityMPerS2: 10, staticCoefficient: 0.5, kineticCoefficient: 0.2,
  velocityMPerS: 0.1, pullN: 1 };

for (const [massKg, muk, expectedNormal, expectedFriction] of [[0.5, 0.2, 5, 1], [1, 0.2, 10, 2], [0.5, 0.4, 5, 2]]) {
  test(`steady horizontal friction: mass=${massKg}, muk=${muk}`, () => {
    const value = ok(evaluateFriction({ ...base, massKg, kineticCoefficient: muk, pullN: expectedFriction }));
    close(value.normalN, expectedNormal, 1e-6);
    close(value.frictionN, -expectedFriction, 1e-6);
    close(value.pullN, expectedFriction, 1e-6);
    close(value.accelerationMPerS2, 0);
    assert.equal(value.state, 'sliding-steady');
    finiteJSON(value);
  });
}

test('static friction matches demand instead of always taking its maximum', () => {
  const value = ok(evaluateFriction({ ...base, velocityMPerS: 0, pullN: 0.4 }));
  assert.equal(value.state, 'static');
  close(value.frictionN, -0.4, 1e-6);
  close(value.netForceN, 0);
  close(ok(evaluateFriction({ ...base, velocityMPerS: 0, pullN: -0.4 })).frictionN, 0.4);
});

test('exact static threshold holds; exceeding it starts sliding with kinetic friction', () => {
  assert.equal(ok(evaluateFriction({ ...base, velocityMPerS: 0, pullN: 2.5 })).state, 'static');
  const value = ok(evaluateFriction({ ...base, velocityMPerS: 0, pullN: 2.6 }));
  assert.equal(value.state, 'sliding-accelerating');
  close(value.frictionN, -1, 1e-6);
  close(value.accelerationMPerS2, 3.2, 1e-9);
});

test('friction opposes velocity even when applied pull reverses', () => {
  const negative = ok(evaluateFriction({ ...base, velocityMPerS: -0.1, pullN: -1 }));
  close(negative.frictionN, 1);
  assert.equal(negative.state, 'sliding-steady');
  const braking = ok(evaluateFriction({ ...base, pullN: -1 }));
  close(braking.frictionN, -1);
  close(braking.accelerationMPerS2, -4);
});

test('nonzero near-zero velocity remains sliding; exact rest can stick', () => {
  assert.equal(ok(evaluateFriction({ ...base, velocityMPerS: 1e-12 })).state, 'sliding-steady');
  assert.equal(ok(evaluateFriction({ ...base, velocityMPerS: 0 })).state, 'static');
});

test('invalid physical parameters and arithmetic overflow are rejected', () => {
  for (const patch of [{ massKg: 0 }, { gravityMPerS2: 0 }, { kineticCoefficient: -1 },
    { staticCoefficient: 0.1 }, { velocityMPerS: NaN }, { pullN: Infinity }]) {
    invalid(evaluateFriction({ ...base, ...patch }), 'INVALID_FRICTION_PARAMETERS');
  }
  invalid(evaluateFriction({ ...base, massKg: 1e308, gravityMPerS2: 1e308 }), 'NUMERIC_RANGE');
});
