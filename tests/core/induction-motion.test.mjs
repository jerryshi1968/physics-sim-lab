import test from 'node:test';
import assert from 'node:assert/strict';
import { reflectedMotion, inductionMotionBounds, clampInductionPoint } from '../../src/equipment/induction/motion.ts';
import { createInductionExperiment } from '../../src/experiments/induction.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { endpointWorld, wireWorldPoints } from '../../src/core/workbench/geometry.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const make = () => createInductionExperiment('reciprocal.test', '2026-11-24T00:00:00.000Z');
test('reflection uses the full elapsed distance at either boundary, including multiple reversals', () => {
  for (const [start, velocity, dt, position, endVelocity] of [[0, 1, .5, .5, 1], [0, 1, 1, 1, -1], [0, 1, 1.5, .5, -1], [0, 1, 3, -1, 1], [.8, 2, .3, .6, -2], [-.8, -2, .3, -.6, 2], [0, 1, 9.5, .5, -1]]) {
    const out = reflectedMotion(start, velocity, -1, 1, dt); near(out.position, position); near(out.velocity, endVelocity);
  }
  for (const dt of [.01, 1000, 1e6]) { const out = reflectedMotion(.01, -.2, -.055, .055, dt); assert.ok(out.position >= -.055 && out.position <= .055); }
  assert.throws(() => reflectedMotion(0, .1, 1, -1, 1)); assert.throws(() => reflectedMotion(0, Infinity, -1, 1, 1));
});
test('30 and 60 FPS repeated motion stay bounded and agree, without a 20-second stop', () => {
  const schedule = step => { let state = { position: 0, velocity: .1 }; for (let i = 0; i < 30 / step; i++) { state = reflectedMotion(state.position, state.velocity, -.23, .23, step); assert.ok(state.position >= -.23 && state.position <= .23); } return state; };
  const a = schedule(1 / 30), b = schedule(1 / 60); near(a.position, b.position); near(a.velocity, b.velocity); near(a.position, .22); near(a.velocity, -.1);
});
test('rod and magnet limits constrain both the original workspace and their relative gap; drag clamping stays inside', () => {
  const s = make(), limits = inductionMotionBounds(s, 'M'); near(limits.minX, -.45); near(limits.maxX, .01); near(limits.minY, -.025); near(limits.maxY, .085);
  assert.deepEqual(clampInductionPoint({ xM: 5, yM: -5 }, limits), { xM: limits.maxX, yM: limits.minY });
  const v = structuredClone(s); v.equipment.find(i => i.id === 'M').pose.xM += .1;
  const magnet = inductionMotionBounds(s, 'B', v); near(magnet.minX, -.35); near(magnet.maxX, .01); assert.equal(inductionMotionBounds(s, 'G'), null);
});
test('oblique conductor terminals and actual lead endpoints share the same projection', () => {
  const s = make(), registry = createWorkbenchRegistry();
  const a = endpointWorld({ equipmentId: 'M', portId: 'a' }, s.equipment, registry), b = endpointWorld({ equipmentId: 'M', portId: 'b' }, s.equipment, registry);
  near(a.xM, -.35); near(a.yM, -.045); near(b.xM, -.09); near(b.yM, .105);
  assert.deepEqual(wireWorldPoints(s.connections[0], s.equipment, registry)[0], a);
  assert.deepEqual(wireWorldPoints(s.connections[2], s.equipment, registry).at(-1), b);
});
test('perspective motion follows the real vertical field: up/down motion of rods or coils never creates a cutting emf', () => {
  for (const shape of ['rod', 'coil']) for (const y of [-.02, .03, .08]) {
    const s = make(), wire = s.equipment.find(i => i.id === 'M'); s.equipment.find(i => i.id === 'S').parameters.closed = true;
    Object.assign(wire.parameters, { inductionShape: shape, velocityXMPerS: 0, velocityYMPerS: .2 }); wire.pose.yM = y;
    near(simulateElectrical(s).meters[0].trueValue, 0);
  }
  const s = make(); s.equipment.find(i => i.id === 'S').parameters.closed = true;
  const wire = s.equipment.find(i => i.id === 'M'); wire.parameters.velocityXMPerS = .1; wire.pose.yM += .055;
  near(simulateElectrical(s).meters[0].trueValue, .002 / 104);
  wire.parameters.velocityXMPerS = -.1; near(simulateElectrical(s).meters[0].trueValue, -.002 / 104);
});
