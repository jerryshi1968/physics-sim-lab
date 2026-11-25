import test from 'node:test';
import assert from 'node:assert/strict';
import { createInductionExperiment } from '../../src/experiments/induction.ts';
import { inductionSource } from '../../src/equipment/induction/model.ts';
import { GALVANOMETER, MAGNET, INDUCTION_EXPERIMENT } from '../../src/equipment/induction/definitions.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentAvailability } from '../../src/equipment/support.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { buildInductionReading, inductionRows } from '../../src/equipment/induction/measure.ts';
import { appendMeasurements, correctManualMeasurement } from '../../src/core/measurements/records.ts';
import { measurementsCsv } from '../../src/core/measurements/csv.ts';

const time = '2026-11-24T00:00:00.000Z', registry = createWorkbenchRegistry();
const make = () => createInductionExperiment('induction.test', time);
const item = (s, id) => s.equipment.find(i => i.id === id);
const near = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
function moving(vx = .1, vy = 0) { const s = make(); Object.assign(item(s, 'G').parameters, { resistanceOhm: 0, maximumA: .001, resolutionA: .00005 }); item(s, 'S').parameters.closed = true; Object.assign(item(s, 'M').parameters, { velocityXMPerS: vx, velocityYMPerS: vy }); return s; }
const reading = s => { const o = simulateElectrical(s); assert.equal(o.result.ok, true, JSON.stringify(o)); return o.meters[0]; };

test('junior induction reuses metal wire, switch and real leads, with a separate center-zero galvanometer and magnet', () => {
  const s = make(); assert.equal(s.experimentId, INDUCTION_EXPERIMENT); assert.equal(s.equipment.length, 4); assert.equal(s.connections.length, 3);
  assert.equal(s.equipment.some(i => i.type === 'electrical.ammeter' || i.type === 'electrical.power-supply'), false);
  assert.equal(item(s, 'G').parameters.resistanceOhm, 100); assert.equal(item(s, 'G').parameters.maximumA, .0002); assert.equal(item(s, 'G').parameters.resolutionA, .00001);
  assert.equal(item(s, 'S').parameters.closed, false); assert.equal(item(s, 'G').type, GALVANOMETER); assert.equal(item(s, 'B').type, MAGNET);
  assert.equal(validateSceneDocument(s, registry).ok, true); assert.equal(s.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
  for (const t of [MAGNET, GALVANOMETER, 'electrical.ammeter', 'electrical.power-supply']) assert.equal(equipmentAvailability(s, t).enabled, false);
  const removed = { ...s, equipment: s.equipment.filter(i => i.type !== GALVANOMETER) }; assert.equal(equipmentAvailability(removed, GALVANOMETER).enabled, true);
});
test('independent motional emf benchmark: 0.1 T × 0.20 m × 0.10 m/s = 2 mV, through 4 ohm yields 0.5 mA', () => {
  const s = moving(), source = inductionSource(s, item(s, 'M')); near(source.voltageV, .002); near(source.resistanceOhm, 4);
  const m = reading(s); near(m.trueValue, .0005); near(m.displayValue, .0005); near(m.needleFraction, .75); assert.equal(m.status, 'valid');
});
test('negative deflection is valid, changing either velocity or magnet polarity reverses sign; swapping both restores it', () => {
  const s = moving(-.1), m = reading(s); near(m.trueValue, -.0005); near(m.displayValue, -.0005); near(m.needleFraction, .25); assert.equal(m.reverse, false); assert.equal(m.measurementUsable, true);
  item(s, 'B').parameters.reversed = true; near(reading(s).trueValue, .0005);
  item(s, 'M').parameters.velocityXMPerS = .1; near(reading(s).trueValue, -.0005);
});
test('stationary wire, static stronger magnet, axial motion and a conductor outside the field all give zero', () => {
  for (const fieldT of [.05, .1, .2]) { const s = moving(0); item(s, 'B').parameters.fieldT = fieldT; near(reading(s).trueValue, 0); near(reading(s).needleFraction, .5); }
  near(reading(moving(0, .2)).trueValue, 0);
  const s = moving(); item(s, 'M').pose.xM = .1; near(reading(s).trueValue, 0);
});
test('relative motion, partial overlap and field/speed factors use geometry rather than a preset current', () => {
  let s = moving(.2); near(reading(s).trueValue, .001);
  item(s, 'B').parameters.fieldT = .2; assert.equal(reading(s).status, 'over-range'); assert.equal(reading(s).displayValue, null);
  s = moving(0); item(s, 'B').parameters.velocityXMPerS = -.1; near(reading(s).trueValue, .0005);
  item(s, 'M').parameters.velocityXMPerS = -.1; near(reading(s).trueValue, 0);
  s = moving(); item(s, 'M').parameters.inductionPerspective = false; item(s, 'M').pose.yM = item(s, 'B').pose.yM + .16; near(inductionSource(s, item(s, 'M')).voltageV, .001);
});
test('open switch and genuinely removed/loose leads prevent current even with nonzero motional emf', () => {
  const s = moving(); item(s, 'S').parameters.closed = false; near(reading(s).trueValue, 0);
  item(s, 'S').parameters.closed = true; s.connections.pop(); near(reading(s).trueValue, 0);
  s.connections = make().connections; s.connections[0].to = null; s.connections[0].freeToWorldM = { x: .7, y: .02 }; const m = reading(s); assert.equal(m.status, 'disconnected'); assert.equal(m.displayValue, null); near(m.needleFraction, .5);
});
test('stationary multi-turn coil and a complete coil translating inside uniform field have zero emf', () => {
  for (const turns of [1, 10, 50]) {
    const s = moving(); Object.assign(item(s, 'M').parameters, { inductionShape: 'coil', turns });
    near(inductionSource(s, item(s, 'M')).voltageV, 0); near(reading(s).trueValue, 0);
    item(s, 'M').parameters.velocityXMPerS = 0; item(s, 'B').parameters.fieldT = .2; near(reading(s).trueValue, 0);
  }
});
test('coil entry/exit follow -N dPhi/dt; resistance includes the entire winding and polarity reverses at opposite edges', () => {
  const s = moving(); Object.assign(item(s, 'M').parameters, { inductionShape: 'coil', turns: 10 });
  item(s, 'M').pose.xM = .02; let source = inductionSource(s, item(s, 'M')); near(source.voltageV, -.02); near(source.resistanceOhm, 128); near(reading(s).trueValue, -.02 / 128);
  item(s, 'M').pose.xM = -.46; source = inductionSource(s, item(s, 'M')); near(source.voltageV, .02); near(reading(s).trueValue, .02 / 128);
  item(s, 'M').pose.xM = -.22; item(s, 'M').pose.yM = .18; item(s, 'M').parameters.velocityXMPerS = 0; item(s, 'M').parameters.velocityYMPerS = .1;
  item(s, 'M').parameters.inductionPerspective = false; near(inductionSource(s, item(s, 'M')).voltageV, -.012);
});
test('invalid geometry, NaN and impossible galvanometer scales never produce usable normal readings', () => {
  for (const [id, key, value] of [['M', 'lengthM', 0], ['B', 'fieldT', NaN], ['G', 'resolutionA', .0007]]) {
    const s = moving(); item(s, id).parameters[key] = value; assert.equal(simulateElectrical(s).result.ok, false); assert.deepEqual(simulateElectrical(s).meters, []);
  }
  for (const id of ['M', 'B']) { const s = moving(); item(s, id).pose.rotationRad = .3; assert.equal(simulateElectrical(s).result.ok, false); }
  const duplicate = moving(); duplicate.equipment.push({ ...structuredClone(item(duplicate, 'B')), id: 'B2' }); assert.equal(simulateElectrical(duplicate).result.ok, false);
});
test('moving observations freeze actual motion and base state, signed manual SI values remain correctable, export and reload retain sources', () => {
  const base = make(); item(base, 'S').parameters.closed = true; const view = structuredClone(base);
  Object.assign(item(view, 'M').parameters, { velocityXMPerS: -.1, velocityYMPerS: 0 }); item(view, 'M').pose.xM -= .01;
  const built = buildInductionReading(base, view, simulateElectrical(view), { group: '第1组', observation: '向左偏转', current: '-.00002', note: '反向移动' }, 'capture', time);
  assert.equal(built.ok, true); const appended = appendMeasurements(base, registry, built.records, built.snapshot, time); assert.equal(appended.ok, true, JSON.stringify(appended));
  const s = appended.document; assert.equal(s.measurementRecords[0].value, -.00002); near(inductionRows(s)[0].vx, -.1);
  assert.deepEqual(s.measurementSnapshots[0].equipment, view.equipment); assert.deepEqual(s.measurementSnapshots[0].captureState.equipment, base.equipment);
  const corrected = correctManualMeasurement(s, registry, 'capture.I', '-.00001', time); assert.equal(corrected.ok, true); near(corrected.document.measurementRecords[0].value, -.00001);
  const outside = correctManualMeasurement(s, registry, 'capture.I', '-.002', time); assert.equal(outside.ok, true); assert.equal(outside.document.measurementRecords[0].measurementStatus, 'over-range'); assert.equal(outside.document.measurementRecords[0].value, null);
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
  const csv = measurementsCsv(s); for (const text of ['向左偏转', 'velocityXMPerS', 'induction-motion', '反向移动']) assert.ok(csv.includes(text));
  const missing = buildInductionReading(base, base, simulateElectrical(base), { group: '第1组', observation: '未判断', current: '', note: '' }, 'missing', time); assert.equal(missing.ok, true); assert.equal(missing.records[0].measurementStatus, 'invalid'); assert.equal(missing.records[0].value, null);
});

test('dynamic induction snapshots cannot claim unrelated model versions or introduce a power source', () => {
  const s = moving(), built = buildInductionReading(s, s, simulateElectrical(s), { group: '第1组', observation: '向右偏转', current: '.0005', note: '' }, 'source', time);
  assert.equal(built.ok, true);
  const wrongModel = structuredClone(built.snapshot); wrongModel.modelVersion = 'dc-mna.v2';
  assert.equal(appendMeasurements(s, registry, built.records, wrongModel, time).ok, false);
  const wrongType = structuredClone(built.snapshot); wrongType.equipment.push({ id: 'power', type: 'electrical.power-supply', definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { voltageV: 3 } });
  assert.equal(appendMeasurements(s, registry, built.records, wrongType, time).ok, false);
});
