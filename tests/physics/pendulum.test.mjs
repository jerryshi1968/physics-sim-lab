import test from 'node:test';
import assert from 'node:assert/strict';
import { pendulumPeriod, pendulumAngle, advancePendulum, pendulumRig } from '../../src/equipment/pendulum/simulate.ts';
import { createPendulumExperiment } from '../../src/experiments/pendulum.ts';

const close = (actual, expected, tolerance = 1e-11) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
test('pendulum periods match an independent 55-digit binomial-series benchmark, including the small-angle limit', () => {
  for (const [degrees, expected] of [[0, '1.4192268951137287478'], [5, '1.4199026919125544424'], [30, '1.4439339288735007393'], [60, '1.5230887678985118490']]) {
    close(pendulumPeriod(.5, 9.8, degrees * Math.PI / 180), Number(expected));
    close(pendulumPeriod(.5, 9.8, -degrees * Math.PI / 180), Number(expected));
  }
  close(pendulumPeriod(.2, 9.8, .1) / pendulumPeriod(.8, 9.8, .1), .5);
  close(pendulumPeriod(.5, 2.45, .1) / pendulumPeriod(.5, 9.8, .1), 2);
  for (const args of [[0, 9.8, .1], [.5, 0, .1], [.5, 9.8, NaN], [.5, 9.8, Math.PI / 2]]) assert.throws(() => pendulumPeriod(...args));
});
test('nonlinear trajectory obeys quarter-cycle phases, symmetry and the independent differential equation', () => {
  const angle = Math.PI / 3, period = pendulumPeriod(.5, 9.8, angle);
  for (const [fraction, expected] of [[0, angle], [.25, 0], [.5, -angle], [.75, 0], [1, angle], [100, angle]]) close(pendulumAngle(.5, 9.8, angle, fraction * period), expected, 1e-8);
  for (const t of [.11, .32, .67, 1.1]) {
    const h = .0001, value = pendulumAngle(.5, 9.8, angle, t);
    const acceleration = (pendulumAngle(.5, 9.8, angle, t + h) - 2 * value + pendulumAngle(.5, 9.8, angle, t - h)) / h ** 2;
    close(acceleration, -9.8 / .5 * Math.sin(value), .0001);
    close(pendulumAngle(.5, 9.8, -angle, t), -value);
  }
  assert.equal(pendulumAngle(.5, 9.8, 0, 50), 0);
  assert.throws(() => pendulumAngle(.5, 9.8, .1, -1));
});
test('multi-cycle timing clips the terminal event independently of frame partition and mass', () => {
  const scene = createPendulumExperiment('pendulum', '2026-11-12T00:00:00Z'); scene.simulationConfig.gravityMPerS2 = 9.8; const rig = pendulumRig(scene);
  assert.equal(rig.ok, true);
  const initial = { signature: rig.signature, timeS: 0, targetCycles: 20, periodS: rig.periodS, completed: false };
  let run = initial; for (let i = 0; i < 1000; i++) run = advancePendulum(run, .037);
  const one = advancePendulum(initial, 40);
  assert.deepEqual(run, one); close(run.timeS, Number('28.3980538382510888')); assert.equal(run.completed, true);
  scene.equipment.find(item => item.id === 'pendulum').parameters.massKg = .2;
  close(pendulumRig(scene).periodS, rig.periodS);
  assert.throws(() => advancePendulum(initial, NaN));
  assert.throws(() => advancePendulum({ ...initial, targetCycles: 0 }, 1));
});
