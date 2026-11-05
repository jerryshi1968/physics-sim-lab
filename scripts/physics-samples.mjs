import { solveResistors, solveLamps } from '../src/physics/samples/electrical.ts';
import { solveThinLens } from '../src/physics/samples/optical.ts';
import { requiredLeverForce } from '../src/physics/samples/lever.ts';
import { evaluateFriction } from '../src/physics/samples/friction.ts';
import { solveSpring } from '../src/physics/samples/spring.ts';
import { createProjectileLaunch } from '../src/physics/samples/projectile.ts';

const lamp = { ratedVoltageV: 3, ratedCurrentA: 0.3, coldResistanceOhm: 2, maxCurrentA: 0.6 };
const launch = createProjectileLaunch({ x0M: 0, y0M: 1.25, groundYM: 0, speedMPerS: 2, gravityMPerS2: 10, horizontal: true });
const samples = {
  resistorSeries: solveResistors('series', 3, [10, 20]),
  lampSeries6V: solveLamps('series', 6, [lamp, lamp]),
  lampParallel3V: solveLamps('parallel', 3, [lamp, lamp]),
  lens: [0.3, 0.2, 0.15, 0.1, 0.05].map(u => ({ objectDistanceM: u, result: solveThinLens(0.1, u) })),
  lever30Degrees: requiredLeverForce({ xM: 0, yM: 0 }, [
    { point: { xM: -0.2, yM: 0 }, fxN: 0, fyN: -1 },
  ], { xM: 0.1, yM: 0 }, { x: Math.sqrt(3), y: -1 }),
  friction: evaluateFriction({ massKg: 0.5, gravityMPerS2: 10, staticCoefficient: 0.3,
    kineticCoefficient: 0.2, velocityMPerS: 0.1, pullN: 1 }),
  spring: solveSpring({ originalLengthM: 0.1, stiffnessNPerM: 20, hangingMassKg: 0.1,
    trayMassKg: 0, gravityMPerS2: 10, maxExtensionM: 0.06, ratedLoadN: 1.2, supported: true, transitioning: false }),
  projectile: launch.status === 'ok' ? [0.1, 0.2, 0.3, 0.51].map(t => launch.value.sample(t)) : launch,
};
console.log(JSON.stringify(samples, null, 2));
