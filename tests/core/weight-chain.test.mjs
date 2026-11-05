import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { simulateLever, mechanicalViewScene, mechanicalDrop, leverZeroReference } from '../../src/equipment/mechanical/simulate.ts';
import { weightAttachment, weightBottom, weightHookDrop, detachedWeightUpdates, validWeightTargets } from '../../src/equipment/mechanical/weightChain.ts';
import { leverPresentationScene } from '../../src/app/mechanical/leverPresentation.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { buildLeverMeasurements } from '../../src/equipment/mechanical/measure.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-04T13:00:00.000Z';
const get = (scene, id) => scene.equipment.find(item => item.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function setup() {
  const scene = createLeverExperiment('chain', time), lever = get(scene, 'lever');
  lever.parameters.leftNutOffsetM = .024; lever.parameters.zeroReference = leverZeroReference(scene, lever);
  Object.assign(get(scene, 'left').parameters, { leverId: 'lever', hookIndex: -4 });
  Object.assign(get(scene, 'right').parameters, { leverId: 'lever', hookIndex: 2 });
  scene.equipment.push({ ...structuredClone(get(scene, 'right')), id: 'third', parameters: { massKg: .1, leverId: '', hookIndex: 0, parentWeightId: 'right' } });
  return scene;
}

test('two serial 0.1 kg weights at +2 balance 0.1 kg at -4 with exactly 3 N support reaction', () => {
  const scene = setup(), source = structuredClone(scene), result = simulateLever(scene, registry);
  assert.equal(result.ok, true); assert.equal(result.balanced, true); assert.equal(result.calibrated, true);
  near(result.totalTorqueNm, 0); near(result.reactionN.y, 3); assert.equal(result.loads.length, 3);
  const child = result.loads.find(load => load.id === 'third'); near(child.forceN, 1); near(child.armM, .1); near(child.torqueNm, -.1); assert.equal(child.hookIndex, 2);
  assert.equal(result.ignoredLoads, 1); assert.deepEqual(scene, source);
});

test('chains keep vertical separation through tilt, mass changes, parent moves and arbitrary equipment order', () => {
  const scene = setup(); get(scene, 'left').parameters.massKg = .2;
  scene.equipment.reverse(); let result = simulateLever(scene, registry), view = leverPresentationScene(scene, result);
  assert.equal(result.ok, true); assert.equal(result.balanced, false);
  near(get(view, 'third').pose.xM, get(view, 'right').pose.xM); near(get(view, 'right').pose.yM - get(view, 'third').pose.yM, .064);
  get(scene, 'right').parameters.massKg = .3; view = mechanicalViewScene(scene);
  near(get(view, 'right').pose.yM - get(view, 'third').pose.yM, .108);
  const preview = mechanicalViewScene(scene, { id: 'right', point: { xM: .7, yM: .6 } });
  near(get(preview, 'third').pose.xM, .7); near(get(preview, 'third').pose.yM, .492);
  result = simulateLever(preview, registry); assert.equal(result.loads.filter(load => load.kind === 'weight').length, 1);
  assert.equal(result.ignoredLoads, 3);
});

test('drag to a lower hook appends at the tail, occupied lever hooks are refused and dragging a child away detaches its subtree', () => {
  const scene = setup(), fourth = { ...structuredClone(get(scene, 'third')), id: 'fourth', parameters: { massKg: .1, leverId: '', hookIndex: 0 } }; scene.equipment.push(fourth);
  const visible = leverPresentationScene(scene, simulateLever(scene, registry));
  let change = mechanicalDrop(scene, fourth, weightBottom(get(visible, 'third')), visible); assert.equal(change.parameters.parentWeightId, 'third'); assert.equal(change.parameters.leverId, '');
  change = mechanicalDrop(scene, fourth, get(visible, 'right').pose, visible); assert.ok(change.notice); assert.deepEqual(change.pose, fourth.pose); assert.deepEqual(change.parameters, fourth.parameters);
  assert.equal(weightAttachment(scene, fourth, 'lever', 2), null);
  change = mechanicalDrop(scene, get(scene, 'third'), { xM: .8, yM: .8 }, visible); assert.equal(change.parameters.parentWeightId, ''); assert.equal(change.parameters.leverId, '');
  assert.equal(validWeightTargets(scene, get(scene, 'right')).some(item => ['right', 'third'].includes(item.id)), false);
  assert.equal(weightAttachment(scene, get(scene, 'right'), '', 0, 'third').parentWeightId, '');
});

test('old same-hook documents display separately without rewriting references and require explicit repair before calculation', () => {
  const scene = setup(), child = get(scene, 'third'); delete child.parameters.parentWeightId; child.parameters.leverId = 'lever'; child.parameters.hookIndex = 2;
  const copy = structuredClone(scene), view = mechanicalViewScene(scene), result = simulateLever(scene, registry);
  near(get(view, 'right').pose.yM - get(view, 'third').pose.yM, weightHookDrop(get(scene, 'right')));
  assert.equal(result.ok, false); assert.equal(result.code, 'WEIGHT_HOOK_OCCUPIED'); assert.equal('loads' in result, false); assert.deepEqual(scene, copy);
});

test('invalid parent types, dangling references, dual mounts, cycles and forked chains yield no normal solution', () => {
  for (const [patch, code] of [
    [{ parentWeightId: 'missing' }, 'WEIGHT_CHAIN_REFERENCE'], [{ parentWeightId: 'meter' }, 'WEIGHT_CHAIN_REFERENCE'],
    [{ parentWeightId: 'third' }, 'WEIGHT_CHAIN_CYCLE'], [{ leverId: 'lever' }, 'WEIGHT_CHAIN_REFERENCE'],
  ]) {
    const scene = setup(); Object.assign(get(scene, 'third').parameters, patch); const result = simulateLever(scene, registry);
    assert.equal(result.ok, false); assert.equal(result.code, code); assert.equal('loads' in result, false);
  }
  const cycle = setup(); Object.assign(get(cycle, 'right').parameters, { leverId: '', parentWeightId: 'third' }); assert.equal(simulateLever(cycle, registry).code, 'WEIGHT_CHAIN_CYCLE');
  const branch = setup(); branch.equipment.push({ ...structuredClone(get(branch, 'third')), id: 'fourth' }); assert.equal(simulateLever(branch, registry).code, 'WEIGHT_CHAIN_BRANCH');
  const overload = setup(); get(overload, 'support').parameters.capacityN = 2; assert.equal(simulateLever(overload, registry).code, 'SUPPORT_OVERLOAD');
});

test('deleting a parent preserves its children at their visible positions atomically and undo restores the complete chain', () => {
  const scene = setup(); scene.equipment.push({ ...structuredClone(get(scene, 'third')), id: 'fourth', parameters: { massKg: .1, leverId: '', hookIndex: 0, parentWeightId: 'third' } });
  const view = leverPresentationScene(scene, simulateLever(scene, registry)), updates = detachedWeightUpdates(scene, ['right'], view);
  const deleted = executeCommand(createHistory(scene), { type: 'remove-equipment-batch', ids: ['right'], updates }, registry, time); assert.equal(deleted.ok, true);
  assert.equal(get(deleted.history.present, 'third').parameters.parentWeightId, ''); assert.equal(get(deleted.history.present, 'fourth').parameters.parentWeightId, 'third');
  assert.deepEqual(get(deleted.history.present, 'third').pose, get(view, 'third').pose);
  const after = simulateLever(deleted.history.present, registry); assert.equal(after.ok, true); assert.equal(after.loads.filter(load => load.kind === 'weight').length, 1);
  const restored = travelHistory(deleted.history, 'undo', registry, time); assert.deepEqual(restored.history.present.equipment, scene.equipment);
  const multi = executeCommand(createHistory(scene), { type: 'remove-equipment-batch', ids: ['right', 'third'], updates: detachedWeightUpdates(scene, ['right', 'third'], view) }, registry, time); assert.equal(get(multi.history.present, 'fourth').parameters.parentWeightId, '');
});

test('chain references survive JSON and snapshots; each individual weight contributes one independent recorded force and moment', () => {
  const scene = setup(), restored = parseSceneJson(serializeScene(scene, registry), registry); assert.equal(restored.ok, true); assert.deepEqual(restored.document.equipment, scene.equipment);
  const capture = buildLeverMeasurements(scene, registry, { entries: [{ equipmentId: 'third', forceRaw: '1', armRaw: '.1', turn: 'cw' }], setupLabel: '串接', observation: '平衡', note: '' }, 'chain-sample', time);
  assert.equal(capture.ok, true); near(capture.records[0].context.physicalValue, 1); near(capture.records[2].value, -.1); assert.equal(get(capture.snapshot, 'third').parameters.parentWeightId, 'right');
  const free = setup(); get(free, 'right').parameters.leverId = ''; const result = simulateLever(free, registry); assert.equal(result.ok, true); near(result.reactionN.y, 1); assert.equal(result.ignoredLoads, 3);
});
