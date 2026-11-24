import test from 'node:test';
import assert from 'node:assert/strict';
import { createParallelCurrentExperiment, configureParallelCurrent, parallelCurrentSetup, parallelCurrentRows, parallelCurrentPoint, parallelPositions } from '../../src/experiments/parallel-current.ts';
import { createLampCircuitExperiment } from '../../src/experiments/lamp-circuits.ts';
import { experimentChoices, createCatalogExperiment } from '../../src/experiments/catalog.ts';
import { equipmentAvailability } from '../../src/equipment/support.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildElectricalMeasurements } from '../../src/equipment/electrical/measure.ts';
import { appendMeasurements, correctManualMeasurement } from '../../src/core/measurements/records.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';

const time = '2026-11-24T00:00:00.000Z', registry = createWorkbenchRegistry();
const make = () => createParallelCurrentExperiment('parallel.current', time);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function change(scene, settings) {
  const command = configureParallelCurrent(scene, settings); assert.ok(command);
  const result = executeCommand(createHistory(scene), command, registry, time); assert.equal(result.ok, true);
  return result.history.present;
}
function closed(scene) { const copy = structuredClone(scene); copy.equipment.find(i => i.id === 'S').parameters.closed = true; return copy; }
function capture(scene, id, value) {
  const outcome = simulateElectrical(scene); assert.equal(outcome.result.ok, true);
  const built = buildElectricalMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: scene.revision, sequence: 1, runId: 'parallel-run', payload: outcome }, { source: 'manual', setupLabel: '第1组', note: '', sampleId: id, timestamp: time, choices: [{ id: id + '.A', equipmentId: 'A', pointLabel: parallelCurrentPoint(scene), rawInput: value }] });
  assert.equal(built.ok, true); const result = appendMeasurements(scene, registry, built.records, built.snapshot, time); assert.equal(result.ok, true); return result.document;
}

test('one parallel option uses five original appliances, no voltmeter, ideal current meter and compatible old aliases', () => {
  assert.deepEqual(experimentChoices.filter(c => c.id.startsWith('parallel-')).map(c => c.id), ['parallel-current']);
  const s = make(); assert.equal(s.equipment.length, 5); assert.equal(s.connections.length, 6);
  assert.equal(validateSceneDocument(s, registry).ok, true); assert.equal(s.equipment.find(i => i.id === 'A').parameters.resistanceOhm, 0);
  assert.equal(parallelCurrentSetup(s).position, 'main'); assert.equal(parallelCurrentSetup(s).lamps, 'different');
  assert.equal(parallelCurrentSetup(s).closed, false); assert.equal(equipmentAvailability(s, 'electrical.voltmeter').enabled, false);
  assert.equal(s.curriculumRef.textbookMappings[0].status, 'pending_teacher_review');
  for (const lamps of ['same', 'different']) assert.equal(parallelCurrentSetup(createCatalogExperiment('parallel-' + lamps, 'old', time)).lamps, lamps);
  assert.equal(createLampCircuitExperiment('legacy', time, 'parallel-same').equipment.length, 6);
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
});

test('three actual circuits measure I, I1 and I2 independently with KCL for both lamp combinations', () => {
  for (const lamps of ['same', 'different']) for (const p of parallelPositions) {
    const s = closed(change(make(), { lamps, position: p.id })), out = simulateElectrical(s);
    assert.equal(out.result.ok, true); assert.equal(parallelCurrentSetup(s).position, p.id);
    const b = id => out.result.solution.branches.find(item => item.id === id);
    const second = lamps === 'same' ? .3 : .2, total = .3 + second;
    near(b('L1').currentA, -.3); near(b('L2').currentA, -second); near(b('E').currentA, -total);
    near(b('A').currentA, p.id === 'main' ? total : p.id === 'branch1' ? .3 : second);
    near(b('L1').voltageV, -3); near(b('L2').voltageV, -3);
    assert.equal(out.meters.find(m => m.id === 'A').status, 'valid');
    near(out.meters.find(m => m.id === 'A').displayValue, p.id === 'main' ? total : p.id === 'branch1' ? .3 : second);
  }
});

test('position change opens the switch in one undo and preserves source, appliance poses, ranges and history', () => {
  const s = closed(make()); s.equipment.find(i => i.id === 'A').pose.yM -= .02;
  s.equipment.find(i => i.id === 'E').parameters.voltageV = 4;
  s.connections.forEach(c => { for (const end of ['from', 'to']) if (c[end]?.equipmentId === 'A' && c[end].portId === 'low') c[end].portId = 'high'; });
  const result = executeCommand(createHistory(s), configureParallelCurrent(s, { position: 'branch2' }), registry, time);
  assert.equal(result.ok, true); assert.equal(result.history.undo.length, 1);
  const changed = result.history.present; assert.equal(parallelCurrentSetup(changed).meterPort, 'high');
  assert.equal(parallelCurrentSetup(changed).closed, false); assert.deepEqual(changed.equipment.map(i => i.pose), s.equipment.map(i => i.pose));
  assert.deepEqual(changed.equipment.find(i => i.id === 'E'), s.equipment.find(i => i.id === 'E'));
  const undo = travelHistory(result.history, 'undo', registry, time); assert.equal(undo.ok, true); assert.deepEqual(undo.history.present.connections, s.connections);
  assert.equal(parallelCurrentSetup(undo.history.present).closed, true);
  assert.equal(parallelCurrentSetup(travelHistory(undo.history, 'redo', registry, time).history.present).position, 'branch2');
});

test('lamp changes retain every source parameter and wiring at arbitrary source voltages', () => {
  for (const voltage of [0, 2, 3, 4]) {
    let s = change(make(), { position: 'branch1' }); s.equipment.find(i => i.id === 'E').parameters.voltageV = voltage;
    const source = structuredClone(s.equipment.find(i => i.id === 'E')), wires = structuredClone(s.connections);
    for (const lamps of ['same', 'different', 'same']) {
      s = change(closed(s), { lamps }); assert.equal(parallelCurrentSetup(s).lamps, lamps); assert.equal(parallelCurrentSetup(s).closed, false);
      assert.deepEqual(s.equipment.find(i => i.id === 'E'), source); assert.deepEqual(s.connections, wires);
    }
  }
});

test('custom wiring is explicit, IDs and wire ordering can change, and legacy six-appliance scenes stay intact', () => {
  const s = make(), rename = id => 'custom-' + id;
  s.equipment = s.equipment.map(i => ({ ...i, id: rename(i.id) }));
  s.connections = s.connections.reverse().map((c, index) => ({ ...c, id: 'custom-wire-' + index, from: { ...c.to, equipmentId: rename(c.to.equipmentId) }, to: { ...c.from, equipmentId: rename(c.from.equipmentId) } }));
  s.experimentId = 'J-ELEC-01'; assert.equal(parallelCurrentSetup(s).position, 'main');
  assert.equal(equipmentAvailability(s, 'electrical.voltmeter').enabled, false);
  assert.equal(parallelCurrentSetup(change(s, { position: 'branch1' })).position, 'branch1');
  s.connections.pop(); assert.equal(configureParallelCurrent(s, { position: 'branch2' }), null);
  assert.equal(parallelCurrentSetup(change(s, { restore: true })).position, 'main');
  for (const kind of ['series-same', 'parallel-different']) {
    const legacy = createLampCircuitExperiment('legacy', time, kind), before = structuredClone(legacy);
    assert.equal(configureParallelCurrent(legacy, { restore: true }), null); assert.deepEqual(legacy, before);
  }
});

test('six manual readings group by actual saved setup, retain original sources and support missing and corrected readings', () => {
  let s = make();
  for (const lamps of ['same', 'different']) for (const p of parallelPositions) {
    const expected = p.id === 'main' ? lamps === 'same' ? '.6' : '.5' : p.id === 'branch1' || lamps === 'same' ? '.3' : '.2';
    s = capture(closed(change(s, { lamps, position: p.id })), lamps + '.' + p.id, expected);
  }
  assert.equal(s.measurementRecords.length, 6); assert.equal(s.measurementSnapshots.length, 6);
  assert.deepEqual(parallelCurrentRows(s).map(r => r.values), [{ main: .6, branch1: .3, branch2: .3 }, { main: .5, branch1: .3, branch2: .2 }]);
  const snapshots = structuredClone(s.measurementSnapshots), fix = correctManualMeasurement(s, registry, 'same.branch1.A', '.28', time);
  assert.equal(fix.ok, true); s = fix.document; near(parallelCurrentRows(s)[0].values.branch1, .28); assert.deepEqual(s.measurementSnapshots, snapshots);
  s = capture(closed(s), 'missing', ''); assert.equal(parallelCurrentRows(s)[1].values.branch2, null);
  assert.deepEqual(change(s, { lamps: 'same' }).measurementRecords, s.measurementRecords);
  assert.deepEqual(parseSceneJson(serializeScene(s, registry), registry).document, s);
});
