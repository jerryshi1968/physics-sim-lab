import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateLever, leverZeroReference, hookWorld, mechanicalDrop } from '../../src/equipment/mechanical/simulate.ts';
import { leverPresentationScene, leverTrendAngle } from '../../src/app/mechanical/leverPresentation.ts';
const registry = createWorkbenchRegistry(), time = '2026-11-04T11:00:00.000Z';
const get = (scene, id) => scene.equipment.find(item => item.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function setup() {
  const scene = createLeverExperiment('presentation', time), lever = get(scene, 'lever');
  lever.parameters.leftNutOffsetM = .024; lever.parameters.zeroReference = leverZeroReference(scene, lever);
  Object.assign(get(scene, 'left').parameters, { leverId: 'lever', hookIndex: -4 }); Object.assign(get(scene, 'right').parameters, { leverId: 'lever', hookIndex: 2 }); return scene;
}
test('larger left or right moment lowers that end visibly while balanced apparatus returns to its actual pose', () => {
  const scene = setup(); let result = simulateLever(scene, registry), view = leverPresentationScene(scene, result);
  assert.ok(leverTrendAngle(result) > 0); assert.ok(hookWorld(get(view, 'lever'), -6).yM < hookWorld(get(view, 'lever'), 6).yM);
  get(scene, 'right').parameters.massKg = .2; result = simulateLever(scene, registry); view = leverPresentationScene(scene, result);
  assert.equal(leverTrendAngle(result), 0); near(get(view, 'lever').pose.rotationRad, 0);
  get(scene, 'right').parameters.massKg = .3; result = simulateLever(scene, registry); view = leverPresentationScene(scene, result);
  assert.ok(leverTrendAngle(result) < 0); assert.ok(hookWorld(get(view, 'lever'), 6).yM < hookWorld(get(view, 'lever'), -6).yM);
});
test('presentation preserves pivot, hanging references, vertical apparatus, source snapshots and all numerical physics', () => {
  const scene = setup(), source = structuredClone(scene), before = simulateLever(scene, registry); const view = leverPresentationScene(scene, before), pivot = hookWorld(get(view, 'lever'), 0);
  near(pivot.xM, before.pivot.xM); near(pivot.yM, before.pivot.yM); near(get(view, 'left').pose.yM, hookWorld(get(view, 'lever'), -4).yM);
  assert.equal(get(view, 'left').pose.rotationRad, 0); assert.equal(get(view, 'left').parameters.leverId, 'lever'); assert.deepEqual(scene, source);
  assert.deepEqual(simulateLever(scene, registry), before); near(before.totalTorqueNm, .1); near(before.lever.pose.rotationRad, 0);
  assert.equal(leverTrendAngle({ ok: false, code: 'MISSING_SUPPORT' }), 0);
});
test('drag snap accepts the displayed outer hook rather than the displaced original hook', () => {
  const scene = setup(); get(scene, 'right').parameters.leverId = '';
  const result = simulateLever(scene, registry), view = leverPresentationScene(scene, result), hook = hookWorld(get(view, 'lever'), 6);
  assert.ok(Math.abs(hook.yM - result.lever.pose.yM) > .04);
  const moved = mechanicalDrop(scene, get(scene, 'right'), hook, view); assert.equal(moved.parameters.leverId, 'lever'); assert.equal(moved.parameters.hookIndex, 6);
  const preview = leverPresentationScene(scene, result, { id: 'right', point: { xM: .8, yM: .2 } }); near(get(preview, 'right').pose.xM, .8); assert.equal(get(preview, 'right').parameters.leverId, '');
});
