import test from 'node:test';
import assert from 'node:assert/strict';
import { createElectricalRegistry, POWER, RESISTOR, RHEOSTAT, AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../../src/equipment/electrical/dcAdapters.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { compileDcScene, solveDcScene } from '../../src/core/electrical/compile.ts';
import { RheostatParametersSchema, rheostatResistances } from '../../src/core/electrical/rheostat.ts';
import { rheostatLocalXM, rheostatPointerPosition, rheostatWiperXM } from '../../src/core/workbench/rheostat.ts';
import { endpointWorld, localToWorld, wireWorldPoints } from '../../src/core/workbench/geometry.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildElectricalMeasurements } from '../../src/equipment/electrical/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';

const registry = createElectricalRegistry(), adapters = createDcModelAdapters(), timestamp = '2026-11-04T10:00:00.000Z';
function circuit(from = 'a', to = 'c', position = .5) {
  const scene = createEmptyScene('rheostat.test', timestamp);
  scene.equipment = [[POWER, 'E'], [RESISTOR, 'R'], [RHEOSTAT, 'RH']].map(([type, id], index) => ({
    id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: .2 * index, yM: 0, rotationRad: 0 },
  }));
  scene.equipment[0].parameters.voltageV = 6; scene.equipment[2].parameters.position = position;
  scene.connections = [['E', 'positive', 'R', 'a'], ['R', 'b', 'RH', from], ['RH', to, 'E', 'negative']].map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  return scene;
}
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 + 1e-6 * Math.abs(b), `${a} != ${b}`);
function solved(scene) {
  const result = solveDcScene(scene, registry, adapters); assert.equal(result.ok, true, JSON.stringify(result));
  for (const key of ['normalizedKcl', 'normalizedConstitutive', 'normalizedPower']) assert.ok(result.solution.residuals[key] <= 1e-6);
  return result;
}
const value = (result, id) => result.solution.branches.find(branch => branch.id === id);

test('four real terminals, defaults, split resistances and invalid/underflow parameters follow the registered model', () => {
  const definition = registry.get(RHEOSTAT, 1);
  assert.deepEqual(definition.ports.map(port => port.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(definition.defaultParameters, { maxResistanceOhm: 20, position: .5 });
  assert.deepEqual(rheostatResistances({ maxResistanceOhm: 20, position: .25 }), { asOhm: 5, sbOhm: 15 });
  for (const spec of [{ maxResistanceOhm: 0, position: .5 }, { maxResistanceOhm: Infinity, position: .5 }, { maxResistanceOhm: 20, position: -1e-9 },
    { maxResistanceOhm: 20, position: 1.01 }, { maxResistanceOhm: 20, position: NaN }, { maxResistanceOhm: Number.MIN_VALUE, position: .5 }]) assert.equal(RheostatParametersSchema.safeParse(spec).success, false);
});

test('one upper and one lower terminal give opposite adjustable series resistance laws for A and B', () => {
  for (const position of [0, .25, .5, .75, 1]) {
    for (const upper of ['c', 'd']) {
      close(value(solved(circuit('a', upper, position)), 'R').currentA, 6 / (10 + 20 * position));
      close(value(solved(circuit('b', upper, position)), 'R').currentA, 6 / (10 + 20 * (1 - position)));
    }
  }
});

test('A-B stays at full resistance and C-D is an ideal conductor regardless of wiper position', () => {
  for (const position of [0, .25, .5, .75, 1]) {
    close(value(solved(circuit('a', 'b', position)), 'R').currentA, .2);
    close(value(solved(circuit('c', 'd', position)), 'R').currentA, .6);
  }
});

test('zero endpoint segments are merged ideal links with no hidden epsilon and expose a real ideal-source short', () => {
  for (const [from, to, position] of [['a', 'c', 0], ['b', 'd', 1], ['c', 'd', .5]]) {
    const scene = circuit(from, to, position); scene.equipment = scene.equipment.filter(item => item.id !== 'R');
    scene.connections[0].to = { equipmentId: 'RH', portId: from }; scene.connections.splice(1, 1);
    const result = solveDcScene(scene, registry, adapters); assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, 'IDEAL_SOURCE_SHORT');
    const compiled = compileDcScene(scene, registry, adapters); assert.equal(compiled.ok, true);
    assert.ok(compiled.netlist.branches.some(branch => branch.kind === 'wire' && branch.resistanceOhm === 0));
  }
});

test('all four terminals participate in a loaded divider instead of a guessed two-terminal mode', () => {
  const scene = circuit('a', 'b', .25);
  scene.connections = [
    ['E', 'positive', 'RH', 'a'], ['RH', 'b', 'E', 'negative'], ['RH', 'c', 'R', 'a'], ['R', 'b', 'RH', 'b'],
  ].map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  const result = solved(scene);
  close(value(result, 'R').voltageV, 36 / 11); close(value(result, 'R').currentA, 18 / 55); close(value(result, 'E').currentA, -6 / 11);
  const c = result.solution.nodes.find(node => node.terminals.includes(JSON.stringify(['RH', 'c'])));
  assert.ok(c.terminals.includes(JSON.stringify(['RH', 'd'])));
});

test('generated segment IDs remain valid and unique with maximal user IDs and deliberate prefix collisions', () => {
  const scene = circuit();
  scene.equipment[2].id = 'r'.repeat(80); scene.connections.forEach(wire => { for (const side of ['from', 'to']) if (wire[side].equipmentId === 'RH') wire[side].equipmentId = 'r'.repeat(80); });
  scene.connections[0].id = 'rheostat.0.as';
  scene.equipment.push({ ...structuredClone(scene.equipment[2]), id: 'rheostat.0.cd' });
  const compiled = compileDcScene(scene, registry, adapters); assert.equal(compiled.ok, true, JSON.stringify(compiled));
  assert.equal(new Set(compiled.netlist.branches.map(branch => branch.id)).size, compiled.netlist.branches.length);
  assert.ok(compiled.netlist.branches.every(branch => branch.id.length <= 80));
  const reordered = structuredClone(scene); reordered.equipment.reverse();
  assert.deepEqual(compileDcScene(reordered, registry, adapters).netlist, compiled.netlist);
  close(value(solved(scene), 'R').currentA, .3);
});

test('wiper inverse geometry handles rotation, reflection, grab offset and bounds without moving the apparatus', () => {
  for (const rotationRad of [0, Math.PI / 2, -.7]) for (const flippedX of [false, true]) {
    const pose = { xM: .4, yM: -.3, rotationRad, flippedX };
    for (const position of [0, .25, .5, 1]) {
      const point = localToWorld({ x: rheostatWiperXM(position) + .006, y: .04 }, pose);
      close(rheostatLocalXM(point, pose), rheostatWiperXM(position) + .006);
      close(rheostatPointerPosition(point, pose, .006), position);
    }
    assert.equal(rheostatPointerPosition(localToWorld({ x: -.2, y: 0 }, pose), pose, 0), 0);
    assert.equal(rheostatPointerPosition(localToWorld({ x: .2, y: 0 }, pose), pose, 0), 1);
  }
  assert.throws(() => rheostatPointerPosition({ xM: Infinity, yM: 0 }, { xM: 0, yM: 0, rotationRad: 0 }, 0), /INVALID_RHEOSTAT/);
});

test('committed sliding is one reversible command, preserves ports/wires and survives JSON including all four connections', () => {
  const scene = circuit(), points = scene.connections.map(wire => wireWorldPoints(wire, scene.equipment, registry));
  const instance = scene.equipment[2];
  const result = executeCommand(createHistory(scene), { type: 'update-equipment', id: 'RH', pose: instance.pose, parameters: { ...instance.parameters, position: 1 } }, registry, timestamp);
  assert.equal(result.ok, true); assert.equal(result.history.undo.length, 1); assert.equal(result.history.present.revision, 1);
  assert.deepEqual(result.history.present.connections, scene.connections);
  for (const port of registry.get(RHEOSTAT, 1).ports) assert.deepEqual(endpointWorld({ equipmentId: 'RH', portId: port.id }, result.history.present.equipment, registry), endpointWorld({ equipmentId: 'RH', portId: port.id }, scene.equipment, registry));
  assert.deepEqual(result.history.present.connections.map(wire => wireWorldPoints(wire, result.history.present.equipment, registry)), points);
  close(value(solved(parseSceneJson(serializeScene(result.history.present, registry), registry).document), 'R').currentA, .2);
  const undone = travelHistory(result.history, 'undo', registry, timestamp); assert.equal(undone.ok, true); close(value(solved(undone.history.present), 'R').currentA, .3);
  const redone = travelHistory(undone.history, 'redo', registry, timestamp); assert.equal(redone.ok, true); close(value(solved(redone.history.present), 'R').currentA, .2);
});

test('measurement snapshots keep the sampled rheostat setting after later sliding and reloading', () => {
  const scene = circuit();
  scene.equipment.push(...[[AMMETER, 'I'], [VOLTMETER, 'V']].map(([type, id]) => ({ id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: 0, yM: .2, rotationRad: 0 } })));
  scene.connections[0].to = { equipmentId: 'I', portId: 'low' };
  scene.connections.push({ id: 'measure.I', kind: 'wire', from: { equipmentId: 'I', portId: 'common' }, to: { equipmentId: 'R', portId: 'a' } },
    { id: 'measure.Va', kind: 'wire', from: { equipmentId: 'V', portId: 'low' }, to: { equipmentId: 'R', portId: 'a' } },
    { id: 'measure.Vb', kind: 'wire', from: { equipmentId: 'V', portId: 'common' }, to: { equipmentId: 'R', portId: 'b' } });
  const payload = simulateElectrical(scene), built = buildElectricalMeasurements(scene, registry, { commandType: 'result', documentId: scene.documentId, documentRevision: 0, runId: 'run.test', sequence: 1, payload },
    { source: 'instrument', sampleId: 'sample.1', setupLabel: '变阻器 .5', note: '', timestamp, choices: [{ id: 'record.1', equipmentId: 'I', pointLabel: 'I', rawInput: '' }] });
  assert.equal(built.ok, true); const recorded = appendMeasurements(scene, registry, built.records, built.snapshot, timestamp); assert.equal(recorded.ok, true);
  const instance = recorded.document.equipment.find(item => item.id === 'RH');
  const changed = executeCommand(createHistory(recorded.document), { type: 'update-equipment', id: 'RH', pose: instance.pose, parameters: { ...instance.parameters, position: 1 } }, registry, timestamp);
  assert.equal(changed.ok, true); const loaded = parseSceneJson(serializeScene(changed.history.present, registry), registry); assert.equal(loaded.ok, true);
  assert.equal(loaded.document.measurementSnapshots[0].equipment.find(item => item.id === 'RH').parameters.position, .5);
  assert.equal(loaded.document.measurementRecords[0].value, .3);
  close(value(solved(loaded.document), 'R').currentA, .2);
});

test('four-post apparatus maximum and free wire terminals fit scene limits without weakening the MNA component bound', () => {
  const scene = createEmptyScene('rheostat.limits', timestamp);
  scene.equipment = Array.from({ length: 200 }, (_, index) => ({ id: `RH${index}`, type: RHEOSTAT, definitionVersion: 1, parameters: { maxResistanceOhm: 20, position: .5 }, pose: { xM: 0, yM: 0, rotationRad: 0 } }));
  scene.connections = Array.from({ length: 500 }, (_, index) => ({ id: `wire${index}`, kind: 'wire', from: null, to: null, freeFromWorldM: { x: 0, y: 0 }, freeToWorldM: { x: .1, y: 0 } }));
  const compiled = compileDcScene(scene, registry, adapters); assert.equal(compiled.ok, true, JSON.stringify(compiled)); assert.equal(compiled.netlist.terminals.length, 1800);
});
