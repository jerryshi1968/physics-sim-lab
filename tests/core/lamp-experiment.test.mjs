import test from 'node:test';
import assert from 'node:assert/strict';
import { createLampCircuitExperiment, LAMP_CIRCUIT_EXPERIMENT, lampCircuitStarts, lampCircuitHints } from '../../src/experiments/lamp-circuits.ts';
import { createElectricalRegistry, LAMP, POWER, RESISTOR } from '../../src/equipment/electrical/definitions.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { buildElectricalMeasurements } from '../../src/equipment/electrical/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';

const registry = createElectricalRegistry(), timestamp = '2026-11-04T00:00:00.000Z';
const create = start => createLampCircuitExperiment(`experiment.${start}`, timestamp, start);
const closed = start => { const scene = create(start); scene.equipment.find(item => item.id === 'S').parameters.closed = true; return scene; };
const branch = (outcome, id) => outcome.result.solution.branches.find(item => item.id === id);
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 + 1e-6 * Math.abs(b), `${a} != ${b}`);
function solved(scene) {
  const outcome = simulateElectrical(scene); assert.equal(outcome.result.ok, true, JSON.stringify(outcome));
  for (const key of ['normalizedKcl', 'normalizedConstitutive', 'normalizedPower']) assert.ok(outcome.result.solution.residuals[key] <= 1e-6);
  return outcome;
}

test('formal blank entry contains no apparatus, connections or fabricated records and retains pending curriculum evidence', () => {
  const scene = create('blank'); assert.equal(validateSceneDocument(scene, registry).ok, true);
  assert.equal(scene.experimentId, LAMP_CIRCUIT_EXPERIMENT);
  assert.deepEqual([scene.equipment, scene.connections, scene.measurementRecords], [[], [], []]);
  assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  assert.equal(scene.curriculumRef.textbookMappings[0].reviewedBy, null);
  assert.equal(scene.curriculumRef.textbookMappings[0].reviewedAt, null);
  assert.throws(() => create('not-a-template'), /UNKNOWN_LAMP_CIRCUIT_START/);
});

test('all four template instances are independent, editable lamp apparatus with open switches and explicit distinct supplies', () => {
  const expectedSources = [6, 9, 3, 3];
  for (const [index, start] of lampCircuitStarts.slice(1).entries()) {
    const scene = create(start.id); assert.equal(validateSceneDocument(scene, registry).ok, true);
    assert.equal(scene.provenance.origin, 'template'); assert.equal(scene.equipment.filter(item => item.type === LAMP).length, 2);
    assert.equal(scene.equipment.some(item => item.type === RESISTOR), false);
    assert.equal(scene.equipment.find(item => item.id === 'S').parameters.closed, false);
    assert.equal(scene.equipment.find(item => item.type === POWER).parameters.voltageV, expectedSources[index]);
    assert.deepEqual(scene.measurementRecords, []);
    scene.equipment[0].parameters.voltageV = 99; scene.connections.pop();
    assert.equal(create(start.id).equipment[0].parameters.voltageV, expectedSources[index]);
    assert.notEqual(create(start.id).connections.length, scene.connections.length);
  }
});

test('closed same/different lamp templates match independent rated-point KCL/KVL and nonlinear power benchmarks', () => {
  const cases = [
    ['series-same', .3, 6, [.3, .3], [3, 3]], ['series-different', .3, 9, [.3, .3], [3, 6]],
    ['parallel-same', .6, 3, [.3, .3], [3, 3]], ['parallel-different', .5, 3, [.3, .2], [3, 3]],
  ];
  for (const [start, total, voltage, currents, voltages] of cases) {
    const outcome = solved(closed(start)); close(branch(outcome, 'A').currentA, total);
    close(branch(outcome, 'V').voltageV, voltage);
    for (const [index, id] of ['L1', 'L2'].entries()) {
      const lamp = branch(outcome, id); close(lamp.currentA, currents[index]); close(lamp.voltageV, voltages[index]);
      close(lamp.powerW, currents[index] * voltages[index]); close(lamp.brightness, lamp.powerW / (lamp.powerW + .9));
    }
  }
});

test('open switch, open branch and meter mistakes affect real template graphs without normal stale results', () => {
  for (const item of lampCircuitStarts.slice(1)) {
    const outcome = solved(create(item.id)); close(branch(outcome, 'A').currentA, 0);
    for (const id of ['L1', 'L2']) close(branch(outcome, id).brightness, 0);
  }
  const opened = closed('parallel-different'); opened.connections = opened.connections.filter(wire => !(wire.to.equipmentId === 'L1' && wire.to.portId === 'a'));
  close(branch(solved(opened), 'A').currentA, .2);
  const reversed = closed('parallel-same'); reversed.connections.forEach(wire => { for (const side of ['from', 'to']) if (wire[side].equipmentId === 'A') wire[side].portId = wire[side].portId === 'high' ? 'common' : 'high'; });
  assert.equal(solved(reversed).meters.find(item => item.id === 'A').status, 'reverse');
  const invalid = closed('series-same'); invalid.connections.push({ id: 'bad-range', kind: 'wire', from: { equipmentId: 'A', portId: 'low' }, to: { equipmentId: 'S', portId: 'b' } });
  assert.equal(simulateElectrical(invalid).result.ok, false); assert.deepEqual(simulateElectrical(invalid).meters, []);
  const short = closed('parallel-same'); short.connections.push(...[['high', 'positive'], ['common', 'negative']].map(([ap, ep], index) => ({ id: `short-${index}`, kind: 'wire', from: { equipmentId: 'A', portId: ap }, to: { equipmentId: 'E', portId: ep } })));
  assert.equal(simulateElectrical(short).result.diagnostics[0].code, 'INCONSISTENT_VOLTAGE_CONSTRAINT');
});

test('template identity, name, layout and ordering never choose circuit results; real parameter edits do', () => {
  const scene = closed('series-different'), expected = solved(scene).result.solution.branches;
  scene.experimentId = null; scene.title = '并联标题不决定接法'; scene.equipment.reverse(); scene.connections.reverse();
  scene.equipment.forEach((item, index) => { item.pose = { xM: index * .4, yM: -.5, rotationRad: .7, flippedX: true }; });
  assert.deepEqual(solved(scene).result.solution.branches, expected);
  scene.equipment.find(item => item.id === 'E').parameters.voltageV = 0;
  close(branch(solved(scene), 'A').currentA, 0);
});

test('blank and four templates round trip through the existing document format with separate supply configurations', () => {
  for (const start of lampCircuitStarts) {
    const scene = create(start.id), restored = parseSceneJson(serializeScene(scene, registry), registry);
    assert.equal(restored.ok, true); assert.deepEqual(restored.document, scene); assert.equal(scene.schemaVersion, 2);
    assert.equal(restored.document.curriculumRef.textbookMappings[0].chapter, null);
  }
});

test('formal experiment records retain comments, lamp/supply snapshots and original readings after editable-template changes', () => {
  const scene = closed('series-different'), outcome = solved(scene), hints = JSON.stringify(lampCircuitHints);
  const built = buildElectricalMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: scene.revision, runId: 'run.1', sequence: 1, payload: outcome }, {
    source: 'manual', setupLabel: '串联不同灯泡第1组', note: '观察：两灯电压不同', timestamp, sampleId: 'sample.1',
    choices: [{ id: 'record.1', equipmentId: 'A', pointLabel: 'I总', rawInput: '.29' }, { id: 'record.2', equipmentId: 'V', pointLabel: 'U总', rawInput: '9' }],
  });
  assert.equal(built.ok, true); const added = appendMeasurements(scene, registry, built.records, built.snapshot, timestamp); assert.equal(added.ok, true);
  added.document.equipment.find(item => item.id === 'E').parameters.voltageV = 0;
  const loaded = parseSceneJson(serializeScene(added.document, registry), registry); assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.document.measurementRecords.map(item => item.value), [.29, 9]);
  assert.equal(loaded.document.measurementSnapshots[0].equipment.find(item => item.id === 'E').parameters.voltageV, 9);
  assert.equal(loaded.document.measurementSnapshots[0].note, '观察：两灯电压不同');
  close(branch(solved(loaded.document), 'A').currentA, 0); assert.equal(JSON.stringify(lampCircuitHints), hints);
});
