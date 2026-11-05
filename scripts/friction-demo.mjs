import assert from 'node:assert/strict';
import { initialFrictionMotion, stepFriction, frictionForces } from '../src/core/mechanical/friction/model.ts';
import { createFrictionExperiment } from '../src/experiments/friction.ts';
import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { compileFriction } from '../src/equipment/mechanical/frictionScene.ts';
import { createFrictionAdapter } from '../src/core/mechanical/friction/matterAdapter.ts';
function run(config, dt) {
  let state = initialFrictionMotion();
  for (let i = 0; i < Math.round(2 / dt); i++) { const next = stepFriction(config, state, dt); assert.equal(next.ok, true); state = next.state; }
  return { dt, state, forces: frictionForces(config, state) };
}
const base = { massKg: .5, gravityMPerS2: 10, staticCoefficient: .5, kineticCoefficient: .2, mode: 'speed', pullN: 0, targetMPerS: .1 };
const baselines = [[.5, .2, 5, 1], [1, .2, 10, 2], [.5, .4, 5, 2]].map(([massKg, kineticCoefficient, expectedNormalN, expectedPullN]) => {
  const result = run({ ...base, massKg, kineticCoefficient }, 1 / 120); assert.ok(result.forces.ok && result.forces.steady); assert.ok(Math.abs(result.forces.normalN - expectedNormalN) < 1e-6 && Math.abs(result.forces.pullN - expectedPullN) < 1e-6);
  return { expectedNormalN, expectedPullN, ...result };
});
const convergence = [1 / 60, 1 / 120, 1 / 240].map(dt => run(base, dt));
const rig = compileFriction(createFrictionExperiment('adapter-demo', '2026-11-04T14:00:00Z'), createWorkbenchRegistry()); assert.equal(rig.ok, true);
const adapter = createFrictionAdapter(rig), sync = adapter.sync({ ...baselines[0].state, xM: -.3 }, rig.dt); assert.equal(sync.ok, true); adapter.dispose();
console.log(JSON.stringify({ note: '真实模型运行结果；预期值来自 N=mg、F=μkN 手算，不是课堂实测。', baselines, convergence, adapter: sync }, null, 2));
