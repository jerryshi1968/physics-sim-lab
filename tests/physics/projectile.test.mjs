import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectileLaunch } from '../../src/physics/samples/projectile.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

const base = { x0M: 0, y0M: 1.25, groundYM: 0, speedMPerS: 2, gravityMPerS2: 10, horizontal: true };

for (const [t, x, drop, y] of [[0.1, 0.2, 0.05, 1.2], [0.2, 0.4, 0.2, 1.05], [0.3, 0.6, 0.45, 0.8]]) {
  test(`projectile at ${t} s matches independent position and velocity`, () => {
    const value = ok(ok(createProjectileLaunch(base)).sample(t));
    close(value.xM, x, 1e-6);
    close(value.dropM, drop, 1e-6);
    close(value.yM, y, 1e-6);
    close(value.vxMPerS, 2);
    close(value.vyMPerS, -10 * t, 1e-9);
    const energyPerMass = (value.vxMPerS ** 2 + value.vyMPerS ** 2) / 2 + 10 * value.yM;
    close((energyPerMass - 14.5) / 14.5, 0, 1e-6);
    assert.equal(value.state, 'flying');
    finiteJSON(value);
  });
}

test('impact exactly at 0.5 s and range 1 m; a frame beyond impact is truncated', () => {
  const launch = ok(createProjectileLaunch(base));
  close(launch.impactTimeS, 0.5, 1e-6);
  for (const requestedTime of [0.5, 0.51, 5]) {
    const value = ok(launch.sample(requestedTime));
    close(value.timeS, 0.5, 1e-6);
    close(value.rangeM, 1, 1e-6);
    close(value.xM, 1, 1e-6);
    close(value.yM, 0, 1e-6);
    close(value.dropM, 1.25, 1e-6);
    assert.equal(value.state, 'landed');
    finiteJSON(value);
  }
});

test('zero horizontal speed permits free-fall control and translated ground', () => {
  const launch = ok(createProjectileLaunch({ ...base, speedMPerS: 0, x0M: 3, y0M: 3.25, groundYM: 2 }));
  const value = ok(launch.sample(1));
  close(value.xM, 3);
  close(value.yM, 2);
  close(value.rangeM, 0);
  close(value.dropM, 1.25);
});

test('initial sample is at launch position with zero drop and round-trippable velocity', () => {
  const value = ok(ok(createProjectileLaunch(base)).sample(0));
  close(value.yM, 1.25);
  close(value.xM, 0);
  close(value.dropM, 0);
  close(value.vyMPerS, 0);
  assert.equal(value.state, 'flying');
  finiteJSON(value);
});

test('launch copies its initial parameters; changing next launch does not rewrite old trajectory', () => {
  const config = { ...base };
  const first = ok(createProjectileLaunch(config));
  config.speedMPerS = 4;
  const second = ok(createProjectileLaunch(config));
  close(ok(first.sample(0.2)).xM, 0.4, 1e-6);
  close(ok(second.sample(0.2)).xM, 0.8, 1e-6);
  assert.ok(Object.isFrozen(first.initial));
  assert.deepEqual(ok(first.sample(0.1)), ok(first.sample(0.1)));
});

test('30 and 60 FPS schedules share analytic samples and the same impact event', () => {
  const launch = ok(createProjectileLaunch(base));
  for (const [fps, frame] of [[30, 6], [60, 12]]) {
    const value = ok(launch.sample(frame / fps));
    close(value.xM, 0.4, 1e-6);
    close(value.dropM, 0.2, 1e-6);
    const impact = ok(launch.sample(Math.ceil(0.5 * fps + 1) / fps));
    close(impact.timeS, 0.5, 1e-6);
    close(impact.xM, 1, 1e-6);
  }
});

test('rejects invalid launch conditions, sampling times and numerical overflow', () => {
  for (const patch of [{ y0M: 0 }, { y0M: -1 }, { gravityMPerS2: 0 }, { speedMPerS: -1 }, { x0M: NaN }]) {
    invalid(createProjectileLaunch({ ...base, ...patch }), 'INVALID_LAUNCH_PARAMETERS');
  }
  invalid(createProjectileLaunch({ ...base, horizontal: false }), 'NON_HORIZONTAL_LAUNCH');
  const launch = ok(createProjectileLaunch(base));
  for (const t of [-1, Infinity, NaN]) invalid(launch.sample(t), 'INVALID_SAMPLE_TIME');
  invalid(createProjectileLaunch({ ...base, y0M: 1e308, groundYM: -1e308 }), 'NUMERIC_RANGE');
});
