import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { initialFrictionMotion, stepFriction, frictionForces } from '../../src/core/mechanical/friction/model.ts';
import { createFrictionAdapter } from '../../src/core/mechanical/friction/matterAdapter.ts';
import { createFrictionExperiment } from '../../src/experiments/friction.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { compileFriction, frictionSample, frictionView, frictionDrop } from '../../src/equipment/mechanical/frictionScene.ts';
import { buildFrictionMeasurements } from '../../src/equipment/mechanical/frictionMeasure.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';
import { measurementSeries } from '../../src/core/measurements/charts.ts';
import { correctManualMeasurement } from '../../src/core/measurements/records.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-04T14:00:00.000Z';
const kit = () => createFrictionExperiment('friction-test', time);
const get = (s, id) => s.equipment.find(item => item.id === id);
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const config = { massKg: .5, gravityMPerS2: 10, staticCoefficient: .5, kineticCoefficient: .2, mode: 'force', pullN: 0, targetMPerS: .1 };
function run(c, duration = 1, dt = 1 / 120, initial = initialFrictionMotion()) {
  let state = initial;
  for (let i = 0; i < Math.round(duration / dt); i++) { const next = stepFriction(c, state, dt); assert.equal(next.ok, true, next.code); state = next.state; }
  return state;
}
const capture = { source: 'instrument', pressureRaw: '', pullRaw: '', frictionRaw: '', setupLabel: '对照', note: '' };

test('configured rig and three independent SI baselines reach a real 0.3 s steady window', () => {
  for (const [mass, muk, normal, force] of [[.5, .2, 5, 1], [1, .2, 10, 2], [.5, .4, 5, 2]]) {
    const c = { ...config, massKg: mass, staticCoefficient: .5, kineticCoefficient: muk, mode: 'speed' }, state = run(c, 2), result = frictionForces(c, state);
    assert.equal(result.ok, true); assert.equal(result.steady, true); near(result.normalN, normal); near(result.pullN, force, 1e-6); near(result.frictionN, -force, 1e-6); near(state.velocityMPerS, .1);
  }
  const scene = kit(); assert.equal(compileFriction(scene, registry).ok, true); assert.equal(kit().curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.equal(createFrictionExperiment('empty', time, true).equipment.length, 0);
});
test('a traction actuator is optional: the real spring meter can directly control signed horizontal pull', () => {
  const scene = kit(); get(scene, 'block').parameters.driverId = ''; scene.equipment = scene.equipment.filter(item => item.id !== 'drive');
  Object.assign(get(scene, 'friction-meter').parameters, { forceN: 2.6, directionDeg: 0 }); let rig = compileFriction(scene, registry); assert.equal(rig.ok, true); assert.equal(rig.config.mode, 'force'); near(rig.config.pullN, 2.6);
  let state = run(rig.config, .1, rig.dt, rig.initial); assert.ok(state.velocityMPerS > 0);
  get(scene, 'friction-meter').parameters.directionDeg = 180; rig = compileFriction(scene, registry); near(rig.config.pullN, -2.6); state = run(rig.config, .5, rig.dt, state); assert.ok(state.velocityMPerS < 0);
});
test('static friction matches demand, holds at 2.5 N and breaks at 2.6 N with 3.2 m/s²', () => {
  for (const pullN of [.4, 2.5, -2.5]) { const c = { ...config, pullN }, state = run(c); near(state.velocityMPerS, 0); near(state.xM, 0); near(frictionForces(c, state).frictionN, -pullN); }
  const c = { ...config, pullN: 2.6 }, state = run(c, .1, .01); near(state.velocityMPerS, .32); near(state.xM, .016); near(frictionForces(c, state).accelerationMPerS2, 3.2); assert.equal(frictionForces(c, state).steady, false);
});
test('event-based stopping preserves tiny velocities then rests without repeated sign flips or energy creation', () => {
  const c = { ...config, pullN: 0 }, tiny = initialFrictionMotion(0, 1e-12), first = stepFriction(c, tiny, .01);
  assert.equal(first.ok, true); near(first.state.velocityMPerS, 0); assert.ok(first.state.xM > 0); assert.ok(first.state.xM < 1e-20);
  const stopped = run(c, 2, .01, first.state); assert.equal(stopped.velocityMPerS, 0); assert.equal(stopped.xM, first.state.xM);
  const initial = initialFrictionMotion(0, .2), final = run(c, 1, .01, initial); near(final.xM, .01); near(final.velocityMPerS, 0);
});
test('reversal opposes current motion first, crosses zero exactly and only then reverses friction', () => {
  const c = { ...config, pullN: -3 }, initial = initialFrictionMotion(0, .2); near(frictionForces(c, initial).frictionN, -1);
  const next = stepFriction(c, initial, .05); assert.equal(next.ok, true); near(next.state.xM, .00125); near(next.state.velocityMPerS, -.1); near(frictionForces(c, next.state).frictionN, 1);
  const negative = { ...config, mode: 'speed', targetMPerS: -.1 }, steady = run(negative, 2); near(steady.velocityMPerS, -.1); near(frictionForces(negative, steady).pullN, -1); assert.equal(frictionForces(negative, steady).steady, true);
});
test('velocity drive stops exactly at zero without persistent microscopic creep and a changed control resets the steady window', () => {
  const moving = { ...config, mode: 'speed' }, initial = run(moving, 1), stopped = run({ ...moving, targetMPerS: 0 }, 2, 1 / 120, initial);
  assert.equal(stopped.velocityMPerS, 0); assert.equal(frictionForces({ ...moving, targetMPerS: 0 }, stopped).state, 'static');
  assert.equal(frictionForces({ ...moving, targetMPerS: -.1 }, initial).steady, false);
});
test('halved steps converge for startup and exact force integration conserves the analytic trajectory', () => {
  const c = { ...config, mode: 'speed' }, coarse = run(c, 2, 1 / 60), medium = run(c, 2, 1 / 120), fine = run(c, 2, 1 / 240);
  assert.ok(Math.abs(medium.xM - fine.xM) < Math.abs(coarse.xM - medium.xM));
  near(frictionForces(c, medium).pullN, frictionForces(c, fine).pullN); near(medium.velocityMPerS, fine.velocityMPerS);
  for (const dt of [1 / 60, 1 / 120, 1 / 240]) { const s = run({ ...config, pullN: 2.6 }, 1, dt); near(s.xM, 1.6); near(s.velocityMPerS, 3.2); }
});
test('mass, material and area controls are independent; unloaded weights do not contribute to N', () => {
  const scene = kit(); let rig = compileFriction(scene, registry); near(rig.config.massKg, .5);
  Object.assign(get(scene, 'load').parameters, { blockId: 'block' }); rig = compileFriction(scene, registry); near(rig.config.massKg, 1);
  const state = run(rig.config), before = frictionForces(rig.config, state); get(scene, 'block').parameters.areaM2 = .004; const changed = compileFriction(scene, registry);
  assert.deepEqual(changed.config, rig.config); near(frictionForces(changed.config, state).pullN, before.pullN);
  Object.assign(get(scene, 'surface').parameters, { material: 'cloth', staticCoefficient: .5, kineticCoefficient: .4 }); near(frictionForces(compileFriction(scene, registry).config, state).pullN, 4);
});
test('invalid attachments, material mismatches, angled pulls, lost contact and unsupported domains have no normal sample', () => {
  for (const [id, field, value, code] of [['block', 'surfaceId', 'absent', 'FRICTION_ATTACHMENT'], ['surface', 'kineticCoefficient', .25, 'FRICTION_MATERIAL'], ['friction-meter', 'directionDeg', -30, 'FRICTION_ORIENTATION'], ['load', 'blockId', 'absent', 'FRICTION_ATTACHMENT']]) {
    const s = kit(); get(s, id).parameters[field] = value; const result = compileFriction(s, registry); assert.equal(result.ok, false); assert.equal(result.code, code); assert.equal('config' in result, false);
  }
  const lifted = kit(); get(lifted, 'block').pose.yM += .01; assert.equal(compileFriction(lifted, registry).code, 'FRICTION_CONTACT');
  assert.equal(frictionSample(kit(), registry, initialFrictionMotion(2, .1)).code, 'FRICTION_EDGE');
  const noisy = kit(); Object.assign(noisy.simulationConfig.randomError, { enabled: true, distribution: 'normal' }); assert.equal(compileFriction(noisy, registry).code, 'FRICTION_RANDOM_UNSUPPORTED');
  for (const c of [{ ...config, massKg: 0 }, { ...config, kineticCoefficient: .6 }, { ...config, gravityMPerS2: Infinity }]) assert.equal(stepFriction(c, initialFrictionMotion(), .01).ok, false);
  assert.equal(stepFriction(config, initialFrictionMotion(), 0).ok, false); assert.equal(stepFriction(config, { ...initialFrictionMotion(), timeS: 300 }, .01).code, 'FRICTION_RANGE');
});
test('Matter static representation follows SI motion and contact with no second integration, friction force or scale dependence', () => {
  const scene = kit(), rig = compileFriction(scene, registry), adapter = createFrictionAdapter(rig); let state = rig.initial;
  try {
    assert.equal(adapter.block.isStatic, true); assert.equal(adapter.block.friction, 0); assert.equal(adapter.block.frictionAir, 0); assert.equal(adapter.block.frictionStatic, 0);
    for (let i = 0; i < 240; i++) { state = stepFriction(rig.config, state, rig.dt).state; const result = adapter.sync(state, rig.dt); assert.equal(result.ok, true); assert.equal(result.contacts, 1); near(result.xM, state.xM); near(result.velocityMPerS, state.velocityMPerS); }
    const position = { ...adapter.block.position }; for (let i = 0; i < 10; i++) Matter.Engine.update(adapter.engine, 1000 / 120); assert.deepEqual(adapter.block.position, position);
    const clone = structuredClone(scene); clone.viewport.pixelsPerM *= 3; assert.deepEqual(compileFriction(clone, registry).config, rig.config);
    assert.equal(adapter.sync({ ...state, xM: 5 }, rig.dt).ok, false);
  } finally { adapter.dispose(); assert.equal(adapter.engine.world.bodies.length, 0); }
});
test('constraint view follows block, meter and loaded masses without modifying the saved initial apparatus', () => {
  const scene = kit(); get(scene, 'load').parameters.blockId = 'block'; const before = structuredClone(scene), rig = compileFriction(scene, registry), state = run(rig.config, 1, rig.dt, rig.initial), view = frictionView(scene, rig, state);
  near(get(view, 'block').pose.xM, state.xM); near(get(view, 'load').pose.xM, state.xM); near(get(view, 'friction-meter').pose.yM, .04); assert.deepEqual(scene, before);
  const attached = frictionDrop(scene, get(scene, 'load'), { xM: -.6, yM: .08 }); assert.equal(attached.parameters.blockId, 'block'); assert.equal(frictionDrop(scene, get(scene, 'load'), { xM: 1, yM: 1 }).parameters.blockId, '');
});
test('steady captures freeze conditions and runtime, round-trip JSON/CSV, plot F-N and preserve records through reset/editing', () => {
  const scene = kit(), rig = compileFriction(scene, registry), state = run(rig.config, 1, rig.dt, rig.initial), built = buildFrictionMeasurements(scene, registry, state, 'run', capture, 'sample', time);
  assert.equal(built.ok, true); assert.deepEqual(built.records.map(r => r.value), [5, 1, 1]); assert.deepEqual(built.snapshot.equipment, scene.equipment); assert.equal(JSON.parse(built.snapshot.note).steady, true);
  const applied = executeCommand(createHistory(scene), { type: 'record-measurements', records: built.records, snapshot: built.snapshot }, registry, time); assert.equal(applied.ok, true);
  const restored = parseSceneJson(serializeScene(applied.history.present, registry), registry); assert.equal(restored.ok, true); assert.deepEqual(restored.document.measurementRecords, built.records); assert.ok(measurementsCsv(restored.document).includes('areaM2'));
  const chart = { id: 'friction', label: 'F-N', available: true, x: { quantity: 'force', unit: 'N', label: 'N', pointLabel: '压力' }, y: { quantity: 'force', unit: 'N', label: 'F', pointLabel: '滑动摩擦力' } }; const series = measurementSeries(restored.document, chart); near(series[0].points[0].x, 5); near(series[0].points[0].y, 1);
  get(scene, 'block').parameters.massKg = 1; assert.equal(built.snapshot.equipment.find(item => item.id === 'block').parameters.massKg, .5);
});
test('non-steady instrument/manual data retain labels, exclude invalid friction points and corrections never turn transients into steady observations', () => {
  const scene = kit(); Object.assign(get(scene, 'drive').parameters, { mode: 'force', pullN: 2 }); const rig = compileFriction(scene, registry), state = run(rig.config, .05, rig.dt, rig.initial);
  const built = buildFrictionMeasurements(scene, registry, state, 'run', capture, 'transient', time); assert.equal(built.ok, true); assert.equal(built.records[1].measurementStatus, 'non-steady'); near(built.records[1].value, 2); assert.equal(built.records[2].measurementStatus, 'out-of-model'); assert.equal(built.records[2].value, null);
  const manual = buildFrictionMeasurements(scene, registry, state, 'run', { ...capture, source: 'manual', pressureRaw: '5', pullRaw: '', frictionRaw: '2' }, 'manual', time); assert.equal(manual.ok, true); assert.equal(manual.records[1].value, null);
  const applied = executeCommand(createHistory(scene), { type: 'record-measurements', records: manual.records, snapshot: manual.snapshot }, registry, time); const corrected = correctManualMeasurement(applied.history.present, registry, 'manual.1', '2', time); assert.equal(corrected.ok, true); assert.equal(corrected.document.measurementRecords[1].measurementStatus, 'non-steady');
  const over = buildFrictionMeasurements(scene, registry, state, 'run', { ...capture, source: 'manual', pullRaw: '20' }, 'over', time); assert.equal(over.records[1].measurementStatus, 'over-range');
});
test('over-range tension is not a normal zero and malformed or initial-state measurements are rejected', () => {
  const scene = kit(); Object.assign(get(scene, 'surface').parameters, { material: 'custom', staticCoefficient: 1, kineticCoefficient: .8 }); get(scene, 'block').parameters.massKg = 1;
  const rig = compileFriction(scene, registry), state = run(rig.config, 1, rig.dt, rig.initial), result = frictionSample(scene, registry, state); assert.equal(result.reading.status, 'over-range'); assert.equal(result.reading.displayN, null);
  const built = buildFrictionMeasurements(scene, registry, state, 'run', capture, 'over', time); assert.equal(built.ok, true); assert.equal(built.records[1].value, null); assert.equal(built.records[2].value, null);
  assert.equal(buildFrictionMeasurements(scene, registry, rig.initial, 'run', capture, 'initial', time).ok, false);
  assert.equal(buildFrictionMeasurements(scene, registry, state, 'run', { ...capture, source: 'manual', pullRaw: 'NaN' }, 'bad', time).ok, false);
});
test('assembly updates are atomic, undoable and reject unknown equipment without partial mutation', () => {
  const scene = kit(), source = structuredClone(scene), block = get(scene, 'block'), meter = get(scene, 'friction-meter');
  const updates = [{ id: block.id, pose: block.pose, parameters: { ...block.parameters, massKg: 1 } }, { id: meter.id, pose: meter.pose, parameters: { ...meter.parameters, rangeN: 10 } }];
  const applied = executeCommand(createHistory(scene), { type: 'update-equipment-batch', updates }, registry, time); assert.equal(applied.ok, true); assert.equal(applied.history.present.revision, scene.revision + 1); assert.deepEqual(travelHistory(applied.history, 'undo', registry, time).history.present.equipment, scene.equipment);
  updates[1].id = 'missing'; assert.equal(executeCommand(createHistory(scene), { type: 'update-equipment-batch', updates }, registry, time).ok, false); assert.deepEqual(scene, source);
});
