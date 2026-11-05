import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLever, requiredLeverForce } from '../../src/physics/samples/lever.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

const pivot = { xM: 0, yM: 0 };
const leftLoad = { point: { xM: -0.2, yM: 0 }, fxN: 0, fyN: -1 };

test('opposite 0.20 N m moments and 3 N support reaction', () => {
  const value = ok(evaluateLever(pivot, [leftLoad, { point: { xM: 0.1, yM: 0 }, fxN: 0, fyN: -2 }]));
  close(value.torquesNm[0], 0.2, 1e-9);
  close(value.torquesNm[1], -0.2, 1e-9);
  close(value.totalTorqueNm, 0, 1e-9);
  close(value.reactionN.y, 3);
  assert.equal(value.balanced, true);
  finiteJSON(value);
});

test('vertical pull requires 2 N; downward 30 degree pull requires 4 N and 0.05 m arm', () => {
  const vertical = ok(requiredLeverForce(pivot, [leftLoad], { xM: 0.1, yM: 0 }, { x: 0, y: -1 }));
  close(vertical.forceN, 2, 1e-6);
  close(vertical.armM, 0.1);
  const oblique = ok(requiredLeverForce(pivot, [leftLoad], { xM: 0.1, yM: 0 }, { x: Math.sqrt(3), y: -1 }));
  close(oblique.forceN, 4, 1e-6);
  close(oblique.armM, 0.05, 1e-9);
  close(oblique.equilibrium.reactionN.x, -2 * Math.sqrt(3), 1e-9);
  close(oblique.equilibrium.reactionN.y, 3);
  assert.equal(oblique.equilibrium.balanced, true);
});

test('same-direction moments remain unbalanced, optional self-weight is an explicit force', () => {
  const value = ok(evaluateLever(pivot, [leftLoad, { point: { xM: 0.1, yM: 0 }, fxN: 0, fyN: 2 }]));
  close(value.totalTorqueNm, 0.4);
  assert.equal(value.balanced, false);
  const withWeight = ok(evaluateLever(pivot, [leftLoad, { point: { xM: 0.1, yM: 0 }, fxN: 0, fyN: -1 }]));
  close(withWeight.totalTorqueNm, 0.1);
  assert.equal(withWeight.balanced, false);
});

test('force line through pivot has zero moment; inverse problem diagnoses zero arm', () => {
  const radial = { point: { xM: 0.1, yM: 0 }, fxN: 4, fyN: 0 };
  close(ok(evaluateLever(pivot, [radial])).armsM[0], 0);
  invalid(requiredLeverForce(pivot, [leftLoad], radial.point, { x: 1, y: 0 }), 'ZERO_MOMENT_ARM');
  invalid(requiredLeverForce(pivot, [], pivot, { x: 0, y: -1 }), 'ZERO_MOMENT_ARM');
  invalid(requiredLeverForce(pivot, [leftLoad], { xM: 0.1, yM: 0 }, { x: 0, y: 1 }), 'DIRECTION_CANNOT_BALANCE');
});

test('translated and rotated apparatus preserve the 0.20 N m torque', () => {
  close(ok(evaluateLever({ xM: 2, yM: 3 }, [
    { point: { xM: 1.8, yM: 3 }, fxN: 0, fyN: -1 },
  ])).totalTorqueNm, 0.2, 1e-9);
  close(ok(evaluateLever(pivot, [{ point: { xM: 0, yM: -0.2 }, fxN: 1, fyN: 0 }])).totalTorqueNm, 0.2, 1e-9);
  close(ok(evaluateLever({ xM: -0.1, yM: 0 }, [leftLoad])).totalTorqueNm, 0.1, 1e-9);
});

test('missing support, bad direction and non-finite geometry have no reading', () => {
  invalid(evaluateLever(pivot, [leftLoad], false), 'MISSING_SUPPORT');
  invalid(evaluateLever({ xM: NaN, yM: 0 }, []), 'INVALID_LEVER_PARAMETERS');
  invalid(requiredLeverForce(pivot, [leftLoad], pivot, { x: 0, y: 0 }), 'INVALID_FORCE_DIRECTION');
  invalid(evaluateLever(pivot, [{ point: { xM: 1e308, yM: 0 }, fxN: 0, fyN: 1e308 }]), 'NUMERIC_RANGE');
});
