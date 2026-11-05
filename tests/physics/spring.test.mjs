import test from 'node:test';
import { solveSpring } from '../../src/physics/samples/spring.ts';
import { close, finiteJSON, invalid, ok } from './helpers.mjs';

const base = { originalLengthM: 0.1, stiffnessNPerM: 20, trayMassKg: 0, hangingMassKg: 0,
  gravityMPerS2: 10, maxExtensionM: 0.06, ratedLoadN: 1.2, supported: true, transitioning: false };

for (const [mass, force, extension, length] of [[0, 0, 0, 0.1], [0.025, 0.25, 0.0125, 0.1125],
  [0.05, 0.5, 0.025, 0.125], [0.075, 0.75, 0.0375, 0.1375], [0.1, 1, 0.05, 0.15]]) {
  test(`spring benchmark mass=${mass} kg distinguishes extension from total length`, () => {
    const value = ok(solveSpring({ ...base, hangingMassKg: mass }));
    close(value.forceN, force, 1e-9);
    close(value.extensionM, extension, 1e-6);
    close(value.lengthM, length, 1e-6);
    finiteJSON(value);
  });
}

test('five calculated points have independently specified slope 20 N/m', () => {
  const values = [0, 0.025, 0.05, 0.075, 0.1].map(m => ok(solveSpring({ ...base, hangingMassKg: m })));
  const meanX = values.reduce((s, p) => s + p.extensionM, 0) / values.length;
  const meanY = values.reduce((s, p) => s + p.forceN, 0) / values.length;
  const numerator = values.reduce((s, p) => s + (p.extensionM - meanX) * (p.forceN - meanY), 0);
  const denominator = values.reduce((s, p) => s + (p.extensionM - meanX) ** 2, 0);
  close(numerator / denominator, 20, 0, 1e-6);
});

test('tray mass counts toward load; unload returns to original length', () => {
  const loaded = ok(solveSpring({ ...base, trayMassKg: 0.025, hangingMassKg: 0.025 }));
  close(loaded.totalMassKg, 0.05);
  close(loaded.forceN, 0.5);
  close(loaded.extensionM, 0.025, 1e-6);
  close(ok(solveSpring(base)).lengthM, 0.1, 1e-6);
});

test('linear and rated boundaries are inclusive; overlimits return no extrapolated length', () => {
  close(ok(solveSpring({ ...base, hangingMassKg: 0.12 })).extensionM, 0.06, 1e-6);
  invalid(solveSpring({ ...base, hangingMassKg: 0.120001 }), 'RATED_LOAD_EXCEEDED');
  invalid(solveSpring({ ...base, hangingMassKg: 0.13, ratedLoadN: 2 }), 'LINEAR_RANGE_EXCEEDED');
});

test('missing support, transition, invalid stiffness and invalid mass prohibit readings', () => {
  invalid(solveSpring({ ...base, supported: false }), 'MISSING_SUPPORT');
  invalid(solveSpring({ ...base, transitioning: true }), 'TRANSITIONING');
  for (const patch of [{ stiffnessNPerM: 0 }, { stiffnessNPerM: -1 }, { hangingMassKg: -1 },
    { trayMassKg: -1 }, { maxExtensionM: -1 }, { ratedLoadN: 0 }, { gravityMPerS2: NaN }]) {
    invalid(solveSpring({ ...base, ...patch }), 'INVALID_SPRING_PARAMETERS');
  }
});
