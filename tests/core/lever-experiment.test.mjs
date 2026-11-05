import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from '../../src/equipment/mechanical/definitions.ts';
import { BLOCK, SURFACE, DRIVE, LOAD } from '../../src/equipment/mechanical/frictionDefinitions.ts';
import { RULER } from '../../src/equipment/optical/definitions.ts';
import { simulateLever, leverZeroReference, mechanicalViewScene, mechanicalDrop, hookWorld } from '../../src/equipment/mechanical/simulate.ts';
import { solveLever, targetLeverForce, forceReading } from '../../src/core/mechanical/lever.ts';
import { buildLeverMeasurements } from '../../src/equipment/mechanical/measure.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-04T08:00:00.000Z';
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function kit() { return createLeverExperiment('lever-test', time); }
function item(scene, id) { return scene.equipment.find(item => item.id === id); }
function zero(scene) { const lever = item(scene, 'lever'); lever.parameters.leftNutOffsetM = .024; lever.parameters.rightNutOffsetM = .02; lever.parameters.zeroReference = leverZeroReference(scene, lever); return scene; }
function attach(scene, id, hook, params = {}) { Object.assign(item(scene, id).parameters, { leverId: 'lever', hookIndex: hook, ...params }); return scene; }
function solved(scene) { const result = simulateLever(scene, registry); assert.equal(result.ok, true, result.code); return result; }
const load = (id, xM, yM, fxN, fyN) => ({ id, point: { xM, yM }, fxN, fyN, kind: 'weight', hookIndex: 0 });

test('mechanical registry has physical apparatus and an independent copy of the optical ruler without changing optical definitions', () => {
  assert.deepEqual(registry.list().filter(item => item.domain === 'mechanical').map(item => item.type), [LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER, BLOCK, SURFACE, DRIVE, LOAD, 'mechanical.spring', 'mechanical.projectile-launcher', 'mechanical.projectile-ball', 'mechanical.projectile-timer', 'mechanical.projectile-scale', 'mechanical.projectile-ground']);
  const optical = registry.get(RULER, 1), ruler = registry.get(MECHANICAL_RULER, 1);
  assert.deepEqual(ruler.defaultParameters, optical.defaultParameters); assert.equal(ruler.domain, 'mechanical'); assert.equal(optical.domain, 'optical');
  assert.equal(registry.validateParameters(ruler, { lengthM: 0 }), false); assert.equal(registry.validateParameters(ruler, { lengthM: 1.2 }), true);
  assert.equal(createLeverExperiment('empty', time, true).equipment.length, 0);
  assert.equal(kit().curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
});
test('r cross F, perpendicular arms, reaction and translation invariance match independent hand calculations', () => {
  const loads = [load('left', -.2, 0, 0, -1), load('right', .1, 0, 0, -2)], result = solveLever({ xM: 0, yM: 0 }, loads, 100);
  assert.equal(result.ok, true); near(result.counterclockwiseNm, .2); near(result.clockwiseNm, .2); near(result.reactionN.y, 3); assert.equal(result.balanced, true);
  const translated = solveLever({ xM: 10, yM: -7 }, loads.map(item => ({ ...item, point: { xM: item.point.xM + 10, yM: item.point.yM - 7 } })), 100);
  near(translated.totalTorqueNm, 0); near(translated.loads[0].armM, .2);
  const angled = solveLever({ xM: 0, yM: 0 }, [load('a', .1, 0, 2 * Math.sqrt(3), -2)], 100); near(angled.loads[0].armM, .05); near(angled.totalTorqueNm, -.2);
});
test('invalid constraints, numerical overflow and over-capacity never produce normal solutions', () => {
  assert.equal(solveLever({ xM: 0, yM: 0 }, [], 0).ok, false);
  assert.equal(solveLever({ xM: 0, yM: 0 }, [load('a', 1e308, 0, 0, 1e308)], 100).code, 'NUMERIC_RANGE');
  assert.equal(solveLever({ xM: 0, yM: 0 }, [load('a', .1, 0, 0, -3)], 2).code, 'SUPPORT_OVERLOAD');
  assert.equal(targetLeverForce({ xM: 0, yM: 0 }, [], { xM: 0, yM: 0 }, -90).code, 'ZERO_MOMENT_ARM');
  assert.equal(targetLeverForce({ xM: 0, yM: 0 }, [load('a', 1e308, 0, 0, 1e308)], { xM: .1, yM: 0 }, -90).code, 'NUMERIC_RANGE');
  assert.equal(targetLeverForce({ xM: 0, yM: 0 }, [load('a', 1, 0, 0, 1e308), load('b', 1, 0, 0, -1e308)], { xM: .1, yM: 0 }, -90).code, 'NUMERIC_RANGE');
});
test('empty leveling is explicit, survives ordinary loading and is invalidated by pivot, gravity or self-weight changes', () => {
  const scene = kit(); assert.equal(solved(scene).canZero, false); zero(scene); assert.equal(solved(scene).canZero, true); assert.equal(solved(scene).calibrated, true);
  attach(scene, 'left', -4); const loaded = solved(scene); assert.equal(loaded.calibrated, true); assert.equal(loaded.canZero, false); assert.equal(loaded.balanced, false);
  item(scene, 'lever').parameters.pivotIndex = 1; assert.equal(solved(scene).calibrated, false);
  item(scene, 'lever').parameters.pivotIndex = 0; scene.simulationConfig.gravityMPerS2 = 9.8; assert.equal(solved(scene).calibrated, false);
  scene.simulationConfig.gravityMPerS2 = 10; item(scene, 'lever').parameters.includeSelfWeight = true; assert.equal(solved(scene).calibrated, false);
});
test('two hung masses balance at distinct hooks and same-side torques remain unbalanced without changing apparatus', () => {
  const scene = attach(attach(zero(kit()), 'left', -4), 'right', 2, { massKg: .2 }); const before = structuredClone(scene), result = solved(scene);
  assert.equal(result.balanced, true); near(result.reactionN.y, 3); near(result.loads[0].torqueNm, .2); near(result.loads[1].torqueNm, -.2); assert.deepEqual(scene, before);
  item(scene, 'right').parameters.hookIndex = -2; assert.equal(solved(scene).balanced, false); near(solved(scene).totalTorqueNm, .4);
  item(scene, 'right').parameters.hookIndex = 2; item(scene, 'lever').parameters.pivotIndex = 1; near(solved(scene).totalTorqueNm, .15); assert.equal(solved(scene).calibrated, false);
});
test('vertical 2 N and inclined 4 N use actual force lines, while ambiguous, zero-arm and impossible targets are diagnosed', () => {
  const scene = attach(attach(zero(kit()), 'left', -4), 'meter', 2, { forceN: 2 }); let result = solved(scene);
  assert.equal(result.balanced, true); near(result.target.value.forceN, 2); near(result.meters[0].displayN, 2);
  Object.assign(item(scene, 'meter').parameters, { forceN: 4, directionDeg: -30 }); result = solved(scene); near(result.target.value.forceN, 4, 1e-6); near(result.target.value.armM, .05); near(result.reactionN.x, -2 * Math.sqrt(3)); near(result.reactionN.y, 3);
  item(scene, 'meter').parameters.directionDeg = 0; assert.equal(solved(scene).target.code, 'ZERO_MOMENT_ARM'); assert.equal(solved(scene).meters[0].displayN, null);
  item(scene, 'meter').parameters.directionDeg = 90; assert.equal(solved(scene).target.code, 'DIRECTION_CANNOT_BALANCE');
  Object.assign(item(scene, 'meter').parameters, { forceN: 0, directionDeg: -90 }); item(scene, 'support').parameters.capacityN = 1; assert.equal(solved(scene).target.code, 'SUPPORT_OVERLOAD'); item(scene, 'support').parameters.capacityN = 100;
  const second = structuredClone(item(scene, 'meter')); second.id = 'second'; scene.equipment.push(second); assert.equal(solved(scene).target.code, 'UNDERDETERMINED_FORCES');
});
test('optional self-weight and trim are actual loads, cannot hide subsequently added torque and respect shifted pivots', () => {
  const scene = zero(kit()), lever = item(scene, 'lever'); Object.assign(lever.parameters, { includeSelfWeight: true, comOffsetM: .02, leftNutOffsetM: .06 });
  let result = solved(scene); near(result.totalTorqueNm, 0); assert.equal(result.canZero, true); near(result.reactionN.y, 2);
  lever.parameters.zeroReference = leverZeroReference(scene, lever); attach(scene, 'left', -4); result = solved(scene); near(result.totalTorqueNm, .2); assert.equal(result.balanced, false);
  lever.parameters.pivotIndex = 1; assert.equal(solved(scene).calibrated, false);
});
test('mounted geometry follows support and lever; drag attachment uses real world hooks and leaves the input unchanged', () => {
  const scene = zero(kit()), before = structuredClone(scene), lever = mechanicalViewScene(scene).equipment.find(item => item.id === 'lever'), point = hookWorld(lever, -4);
  const update = mechanicalDrop(scene, item(scene, 'left'), point); assert.equal(update.parameters.leverId, 'lever'); assert.equal(update.parameters.hookIndex, -4); assert.deepEqual(scene, before);
  attach(scene, 'left', -4); item(scene, 'support').pose.xM = .4; item(scene, 'support').pose.yM = .1;
  const view = mechanicalViewScene(scene); near(item(view, 'left').pose.xM, .2); near(item(view, 'left').pose.yM, .42);
  const detached = mechanicalDrop(scene, item(scene, 'left'), { xM: 1, yM: 1 }); assert.equal(detached.parameters.leverId, '');
  assert.equal(mechanicalViewScene(scene, { id: 'left', point: { xM: .7, yM: .1 } }).equipment.find(item => item.id === 'left').parameters.leverId, '');
});
test('missing support, deleted attachments, duplicate levers, invalid hook limits and mixed domains explicitly fail', () => {
  let scene = zero(kit()); item(scene, 'lever').parameters.supportId = ''; assert.equal(simulateLever(scene, registry).code, 'MISSING_SUPPORT');
  scene = zero(kit()); item(scene, 'left').parameters.leverId = 'deleted'; assert.equal(simulateLever(scene, registry).code, 'LEVER_DANGLING_ATTACHMENT');
  scene = zero(kit()); attach(scene, 'left', 7); assert.equal(simulateLever(scene, registry).code, 'LEVER_HOOK_RANGE');
  scene = zero(kit()); scene.equipment.push({ ...structuredClone(item(scene, 'lever')), id: 'other' }); assert.equal(simulateLever(scene, registry).code, 'LEVER_MULTIPLE');
  scene = zero(kit()); item(scene, 'ruler').type = RULER; assert.equal(simulateLever(scene, registry).code, 'LEVER_MIXED_DOMAIN');
});
test('force indicator has separate range/resolution and availability, with no stale or normal over-range reading', () => {
  assert.deepEqual(forceReading(2.04, 5, .1, true), { status: 'valid', displayN: 2 });
  assert.equal(forceReading(6, 5, .1, true).displayN, null); assert.equal(forceReading(2, 5, .1, false).displayN, null);
  assert.equal(forceReading(2, 1, 2, true).status, 'invalid'); assert.equal(forceReading(NaN, 5, .1, true).status, 'invalid');
});
test('manual F/d creates traceable signed moments, immutable snapshots, JSON/CSV and history without filling physical truth into student inputs', () => {
  const scene = attach(attach(zero(kit()), 'left', -4), 'right', 2, { massKg: .2 });
  const built = buildLeverMeasurements(scene, registry, { entries: [{ equipmentId: 'left', forceRaw: '1.01', armRaw: '.2', turn: 'ccw' }, { equipmentId: 'right', forceRaw: '2', armRaw: '.1', turn: 'cw' }], setupLabel: '第1组', observation: '平衡', note: '自己读尺' }, 'sample1', time);
  assert.equal(built.ok, true); near(built.records[2].value, .202); near(built.records[2].context.physicalValue, .2); near(built.records[5].value, -.2);
  const committed = executeCommand(createHistory(scene), { type: 'record-measurements', records: built.records, snapshot: built.snapshot }, registry, time); assert.equal(committed.ok, true);
  assert.equal(travelHistory(committed.history, 'undo', registry, time).history.present.measurementRecords.length, 0);
  const restored = parseSceneJson(serializeScene(committed.history.present, registry), registry); assert.equal(restored.ok, true); assert.deepEqual(restored.document.measurementRecords, built.records);
  assert.ok(measurementsCsv(restored.document).includes('力矩')); assert.equal(measurementSeries(restored.document, { id: 'lever', label: '力矩', available: true, x: 'sample', y: { quantity: 'torque', unit: 'N·m', label: '力矩' } }).length, 2);
  const snapshot = structuredClone(built.snapshot); item(scene, 'left').parameters.massKg = .2; assert.deepEqual(built.snapshot, snapshot); assert.equal(validateSceneDocument(restored.document, registry).ok, true);
});
test('unleveled captures are blocked; missing, overflow and unavailable force remain explicit instead of normal zero records', () => {
  const input = { entries: [{ equipmentId: 'meter', forceRaw: '', armRaw: '.1', turn: 'cw' }], setupLabel: '组', observation: '未判定', note: '' };
  assert.equal(buildLeverMeasurements(kit(), registry, input, 'sample2', time).ok, false);
  const scene = attach(zero(kit()), 'meter', 2, { forceN: 6 }); let built = buildLeverMeasurements(scene, registry, input, 'sample2', time);
  assert.equal(built.ok, true); assert.equal(built.records[0].value, null); assert.equal(built.records[0].measurementStatus, 'over-range'); assert.equal(built.records[1].value, .1);
  input.entries[0].forceRaw = '1e308'; input.entries[0].armRaw = '1e308'; assert.equal(buildLeverMeasurements(scene, registry, input, 'sample3', time).ok, false);
  item(scene, 'meter').parameters.forceN = 2; input.entries[0].forceRaw = '10'; input.entries[0].armRaw = '.1'; built = buildLeverMeasurements(scene, registry, input, 'sample4', time); assert.equal(built.records[0].measurementStatus, 'over-range'); assert.equal(built.records[2].value, null);
  input.entries[0].forceRaw = '-1'; built = buildLeverMeasurements(scene, registry, input, 'sample5', time); assert.equal(built.records[0].measurementStatus, 'reverse'); assert.equal(built.records[2].value, null);
});
