import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDcScene, solveDcScene } from '../../src/core/electrical/compile.ts';
import { solveDcNetlist } from '../../src/core/electrical/solve.ts';
import { createElectricalRegistry, POWER, JUNCTION } from '../../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../../src/equipment/electrical/dcAdapters.ts';
import { endpointKey } from '../../src/core/workbench/geometry.ts';
import { wiringNodes } from '../../src/core/workbench/graph.ts';
import { connectedScene, fixtureRegistry } from './fixtures.mjs';
import { linearScene } from './dc-fixtures.mjs';

const registry = createElectricalRegistry();
const adapters = createDcModelAdapters();
const solve = scene => solveDcScene(scene, registry, adapters);
function success(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
const reading = (result, id) => result.solution.branches.find(branch => branch.id === id);
function close(actual, expected) { assert.equal(typeof actual, 'number'); assert.ok(Math.abs(actual - expected) <= 1e-9 + 1e-6 * Math.abs(expected), `${actual} != ${expected}`); }

test('real registered SceneDocument compiles source/resistors/switch and all connection IDs into MNA', () => {
  const scene = linearScene();
  const before = structuredClone(scene);
  const compiled = success(compileDcScene(scene, registry, adapters));
  assert.equal(compiled.netlist.branches.length, 8);
  assert.deepEqual(new Set(compiled.netlist.branches.map(branch => branch.id)), new Set([...scene.equipment.map(item => item.id), ...scene.connections.map(item => item.id)]));
  const result = success(solve(scene));
  close(reading(result, 'R1').currentA, .1); close(reading(result, 'R2').currentA, .1);
  close(reading(result, 'R1').voltageV, 1); close(reading(result, 'R2').voltageV, 2);
  const compiledGroups = result.solution.nodes.map(node => node.terminals).sort((a, b) => a[0].localeCompare(b[0]));
  assert.ok(compiledGroups.length < wiringNodes(scene, registry).length);
  assert.deepEqual(scene, before);
});

test('parallel connections are determined by endpoints, not document title or a preset topology field', () => {
  const scene = linearScene(true);
  scene.title = '故意命名为串联电路'; scene.experimentId = 'unrelated.template';
  const result = success(solve(scene));
  close(reading(result, 'R1').currentA, .3); close(reading(result, 'R2').currentA, .15); close(reading(result, 'E').currentA, -.45);
});

test('scene translation, rotation, viewport, connection routes and ordering preserve all branch readings', () => {
  const scene = linearScene();
  const before = success(solve(scene)).solution;
  scene.viewport = { centerXM: 9, centerYM: -4, pixelsPerM: 1900 };
  scene.equipment.reverse().forEach((item, index) => { item.pose = { xM: index * -.7, yM: index * .3, rotationRad: Math.PI * (index + .25) }; });
  scene.connections.reverse().forEach(item => { item.routeWorldM = [{ x: -9, y: 12 }, { x: 20, y: -30 }]; });
  assert.deepEqual(success(solve(scene)).solution, before);
});

test('opening the real switch or removing a connection changes the circuit rather than reusing old readings', () => {
  const scene = linearScene();
  close(reading(success(solve(scene)), 'E').currentA, -.1);
  scene.equipment.find(item => item.id === 'S').parameters.closed = false;
  const opened = success(solve(scene));
  close(reading(opened, 'R1').currentA, 0); close(reading(opened, 'S').voltageV, 3);
  scene.equipment.find(item => item.id === 'S').parameters.closed = true;
  scene.connections.pop();
  const disconnected = success(solve(scene));
  close(reading(disconnected, 'E').currentA, 0);
});

test('one/two free wire ends stay explicit open branches and cannot short two apparatus nodes', () => {
  const scene = linearScene();
  scene.connections.push({ id: 'free1', kind: 'wire', from: { equipmentId: 'E', portId: 'positive' }, to: null,
    freeToWorldM: { x: 0, y: 0 }, routeWorldM: [{ x: .2, y: .3 }] });
  scene.connections.push({ id: 'free2', kind: 'wire', from: null, to: null, freeFromWorldM: { x: 0, y: 0 }, freeToWorldM: { x: .1, y: 0 } });
  const compiled = success(compileDcScene(scene, registry, adapters));
  assert.equal(compiled.netlist.branches.filter(branch => branch.kind === 'open').length, 2);
  const result = success(solve(scene));
  close(reading(result, 'R1').currentA, .1); close(reading(result, 'free1').currentA, 0);
  assert.equal(reading(result, 'free1').voltageV, null);
  assert.equal(result.diagnostics.filter(item => item.code === 'OPEN_CONNECTION').length, 2);
});

test('redundant real connection and crossing route shapes do not invent or modify electrical junctions', () => {
  const scene = linearScene();
  scene.connections.push({ ...structuredClone(scene.connections[0]), id: 'duplicate-wire' });
  for (const item of scene.connections) item.routeWorldM = [{ x: 0, y: 0 }];
  const result = success(solve(scene));
  close(reading(result, 'R1').currentA, .1);
  assert.ok(result.diagnostics.some(item => item.code === 'REDUNDANT_IDEAL_LINK'));
});

test('known legacy junction participates only through its actual port and explicit wires', () => {
  const scene = linearScene();
  scene.equipment.push({ id: 'junction', type: JUNCTION, definitionVersion: 1, parameters: {}, pose: { xM: 0, yM: 0, rotationRad: 0 } });
  scene.connections[0].to = { equipmentId: 'junction', portId: 'node' };
  scene.connections.push({ id: 'junction-wire', kind: 'wire', from: { equipmentId: 'junction', portId: 'node' }, to: { equipmentId: 'R1', portId: 'a' } });
  close(reading(success(solve(scene)), 'R1').currentA, .1);
});

test('invalid scenes, unknown model adapters and adapter exceptions emit no partial netlist or solution', () => {
  const invalid = linearScene(); invalid.connections[0].to.portId = 'missing';
  const result = compileDcScene(invalid, registry, adapters);
  assert.equal(result.ok, false); assert.equal('netlist' in result, false); assert.equal(result.measurementUsable, false);
  const unknown = solveDcScene(connectedScene(), fixtureRegistry(), adapters);
  assert.equal(unknown.ok, false); assert.equal(unknown.diagnostics[0].code, 'UNSUPPORTED_DC_MODEL');
  const brokenAdapters = new Map(adapters);
  brokenAdapters.set(`${POWER}.uncompiled.v1`, () => { throw new Error('adapter failed'); });
  const broken = compileDcScene(linearScene(), registry, brokenAdapters);
  assert.equal(broken.ok, false); assert.equal(broken.diagnostics[0].code, 'DC_ADAPTER_FAILED');
});

test('a custom registered model adapter can emit tested measurement or finite-resistance branches without hardcoding a scene ID', () => {
  const customRegistry = fixtureRegistry();
  const scene = connectedScene();
  const customAdapters = new Map([['test.resistor.model.v1', instance => [{ id: instance.id, kind: 'resistor',
    from: endpointKey({ equipmentId: instance.id, portId: 'a' }), to: endpointKey({ equipmentId: instance.id, portId: 'b' }), resistanceOhm: instance.parameters.resistanceOhm }]]]);
  const compiled = success(compileDcScene(scene, customRegistry, customAdapters));
  compiled.netlist.branches.push({ id: 'external-source', kind: 'voltage-source', from: endpointKey({ equipmentId: 'r1', portId: 'a' }),
    to: endpointKey({ equipmentId: 'r2', portId: 'b' }), voltageV: 3, resistanceOhm: .5 });
  const result = success(solveDcNetlist(compiled.netlist));
  close(reading(result, 'r1').currentA, 3 / 20.5);
});

test('apparatus mode is rejected until its scene adapters explicitly supply the requested physical parameters', () => {
  const scene = linearScene(); scene.simulationConfig.electricalMode = 'apparatus';
  const result = solve(scene);
  assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, 'UNCONFIGURED_APPARATUS_MODE');
  assert.equal('solution' in result, false);
});
