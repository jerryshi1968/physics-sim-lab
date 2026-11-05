import test from 'node:test';
import assert from 'node:assert/strict';
import { endNutBalance } from '../../src/core/mechanical/lever.ts';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateLever, leverZeroReference, mechanicalViewScene } from '../../src/equipment/mechanical/simulate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
const input = { halfLengthM: .3, pivotM: 0, massKg: .1, comM: .002, leftM: .02, rightM: .02 };
const registry = createWorkbenchRegistry(), time = '2026-11-04T10:00:00.000Z';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('equal end nuts retain the real bare-rod bias; moving either nut gives the correct direction and a horizontal solution', () => {
  const before = endNutBalance(input); assert.equal(before.ok, true); near(before.firstMomentKgM, .0002); near(before.angleRad, -Math.atan(.1));
  const level = endNutBalance({ ...input, leftM: .024 }); near(level.firstMomentKgM, 0); near(level.angleRad, 0);
  near(endNutBalance({ ...input, rightM: .016 }).angleRad, 0);
  assert.ok(endNutBalance({ ...input, rightM: .024 }).angleRad < before.angleRad);
  assert.ok(endNutBalance({ ...input, leftM: .028 }).angleRad > 0);
  assert.equal(endNutBalance({ ...input, leftM: .061 }).ok, false); assert.equal(endNutBalance({ ...input, rightM: NaN }).ok, false);
});
test('end-nut adjustment changes the mounted angle, never silently moves nuts to balance, and preserves source geometry', () => {
  const scene = createLeverExperiment('nuts', time), before = structuredClone(scene), lever = scene.equipment.find(item => item.id === 'lever');
  let result = simulateLever(scene, registry); assert.equal(result.ok, true); assert.equal(result.horizontal, false); assert.equal(result.canZero, false); assert.deepEqual(scene, before);
  lever.parameters.leftNutOffsetM = .024; result = simulateLever(scene, registry); assert.equal(result.canZero, true); near(result.lever.pose.rotationRad, 0); near(result.totalTorqueNm, 0);
  lever.parameters.zeroReference = leverZeroReference(scene, lever); const left = scene.equipment.find(item => item.id === 'left'); Object.assign(left.parameters, { leverId: 'lever', hookIndex: -4 });
  result = simulateLever(scene, registry); assert.equal(result.calibrated, true); assert.equal(result.balanced, false); near(result.totalTorqueNm, .2); near(result.lever.pose.rotationRad, 0);
});
test('legacy saved rods remain loadable, lose the obsolete zero reference, and have no hidden central trim force', () => {
  const scene = createLeverExperiment('legacy-nuts', time), lever = scene.equipment.find(item => item.id === 'lever');
  delete lever.parameters.leftNutOffsetM; delete lever.parameters.rightNutOffsetM; lever.parameters.zeroReference = 'old-centre-trim'; lever.parameters.trimPositionM = -.1;
  const restored = parseSceneJson(serializeScene(scene, registry), registry); assert.equal(restored.ok, true);
  let result = simulateLever(restored.document, registry); assert.equal(result.ok, true); assert.equal(result.calibrated, false); assert.equal(result.loads.some(load => load.id.endsWith(':trim')), false);
  const savedLever = restored.document.equipment.find(item => item.id === 'lever'); savedLever.parameters.trimPositionM = .2;
  result = simulateLever(restored.document, registry); near(result.lever.pose.rotationRad, mechanicalViewScene(scene).equipment.find(item => item.id === 'lever').pose.rotationRad);
});
test('self-weight mode keeps both actual end nut forces and invalidates zero after adjusting a nut or changing the pivot', () => {
  const scene = createLeverExperiment('nut-weight', time), lever = scene.equipment.find(item => item.id === 'lever');
  Object.assign(lever.parameters, { leftNutOffsetM: .024, includeSelfWeight: true }); lever.parameters.zeroReference = leverZeroReference(scene, lever);
  let result = simulateLever(scene, registry); assert.equal(result.ok, true); near(result.reactionN.y, 2); assert.equal(result.loads.filter(load => load.kind === 'trim').length, 2); assert.equal(result.calibrated, true);
  lever.parameters.leftNutOffsetM = .025; result = simulateLever(scene, registry); assert.equal(result.calibrated, false); assert.equal(result.horizontal, false);
  lever.parameters.pivotIndex = 1; result = simulateLever(scene, registry); assert.equal(result.calibrated, false); assert.ok(result.lever.pose.rotationRad > 0);
});
