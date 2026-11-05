import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createElectricalRegistry, POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { addEquipment, connectEndpoints, editMessage, removeConnection, removeEquipment, updateEquipment, updateWireRoute } from '../../src/core/workbench/edit.ts';
import { DEFAULT_VIEWPORT, endpointKey, endpointWorld, localToWorld, panViewport, screenToWorld, wireWorldPoints, worldToScreen, zoomViewport } from '../../src/core/workbench/geometry.ts';
import { wiringNodes } from '../../src/core/workbench/graph.ts';
import { close } from '../physics/helpers.mjs';

const registry = createElectricalRegistry();
const time = '2026-11-03T08:00:00.000Z';
const empty = () => createEmptyScene('scene.workbench', time);
const ep = (equipmentId, portId) => ({ equipmentId, portId });

function accepted(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.document;
}

function rejected(result, code) {
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === code), JSON.stringify(result));
  assert.equal('document' in result, false);
}

function circuit() {
  let scene = empty();
  for (const [type, id, xM, yM] of [[POWER, 'power', -0.2, 0.1], [RESISTOR, 'resistor', 0.2, 0.1], [SWITCH, 'switch', 0, -0.15]]) {
    scene = accepted(addEquipment(scene, registry, type, id, { xM, yM }, time));
  }
  const lever = scene.equipment[2];
  scene = accepted(updateEquipment(scene, registry, 'switch', lever.pose, { closed: true }, time));
  for (const [id, from, to] of [
    ['wire1', ep('power', 'positive'), ep('resistor', 'a')],
    ['wire2', ep('resistor', 'b'), ep('switch', 'a')],
    ['wire3', ep('switch', 'b'), ep('power', 'negative')],
  ]) scene = accepted(connectEndpoints(scene, registry, id, from, to, time));
  return scene;
}

test('production registry keeps original apparatus and adds lamp and dual-range meters with SI defaults', () => {
  assert.deepEqual(registry.list().map(item => item.type), [POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT]);
  assert.deepEqual(registry.get(POWER, 1).ports.map(port => port.id), ['positive', 'negative']);
  assert.equal(registry.get(POWER, 1).defaultParameters.voltageV, 3);
  assert.equal(registry.get(RESISTOR, 1).defaultParameters.resistanceOhm, 10);
  assert.equal(registry.get(SWITCH, 1).defaultParameters.closed, false);
  assert.deepEqual(registry.get(JUNCTION, 1).ports.map(port => port.id), ['node']);
});

test('from a blank document the source/resistor/closed-switch form the intended connection graph', () => {
  const scene = circuit();
  assert.equal(validateSceneDocument(scene, registry).ok, true);
  assert.equal(scene.equipment.length, 3);
  assert.equal(scene.connections.length, 3);
  assert.equal(scene.equipment[2].parameters.closed, true);
  const groups = wiringNodes(scene, registry);
  assert.equal(groups.length, 3);
  for (const [from, to] of [[ep('power', 'positive'), ep('resistor', 'a')], [ep('resistor', 'b'), ep('switch', 'a')], [ep('switch', 'b'), ep('power', 'negative')]]) {
    assert.ok(groups.some(group => group.includes(endpointKey(from)) && group.includes(endpointKey(to))));
  }
  assert.equal(scene.measurementRecords.length, 0);
  assert.equal('currentA' in scene, false);
});

test('world/screen coordinates use upward world y and invert independently at varied sizes', () => {
  assert.deepEqual(worldToScreen({ xM: 0.1, yM: 0.2 }, { centerXM: 0, centerYM: 0, pixelsPerM: 500 }, { width: 800, height: 600 }), { x: 450, y: 200 });
  for (const size of [{ width: 800, height: 600 }, { width: 360, height: 400 }]) {
    const world = { xM: -0.123, yM: 0.456 };
    const view = { centerXM: 0.1, centerYM: -0.1, pixelsPerM: 1200 };
    const roundTrip = screenToWorld(worldToScreen(world, view, size), view, size);
    close(roundTrip.xM, world.xM, 1e-12);
    close(roundTrip.yM, world.yM, 1e-12);
  }
});

test('zoom preserves the world anchor, clamps scale, and pan changes only viewport values', () => {
  const size = { width: 800, height: 600 };
  const anchor = { x: 100, y: 150 };
  const before = screenToWorld(anchor, DEFAULT_VIEWPORT, size);
  const after = screenToWorld(anchor, zoomViewport(DEFAULT_VIEWPORT, 2, anchor, size), size);
  close(after.xM, before.xM, 1e-12);
  close(after.yM, before.yM, 1e-12);
  assert.equal(zoomViewport(DEFAULT_VIEWPORT, 100, anchor, size).pixelsPerM, 2400);
  assert.equal(zoomViewport(DEFAULT_VIEWPORT, 0.001, anchor, size).pixelsPerM, 100);
  const pan = panViewport(DEFAULT_VIEWPORT, 60, 120);
  close(pan.centerXM, -0.1, 1e-12);
  close(pan.centerYM, 0.2, 1e-12);
  assert.throws(() => worldToScreen({ xM: 0, yM: 0 }, { ...DEFAULT_VIEWPORT, pixelsPerM: 0 }, size), /INVALID_VIEWPORT/);
  assert.throws(() => zoomViewport(DEFAULT_VIEWPORT, -1, anchor, size), /INVALID_ZOOM/);
});

test('rotating apparatus transforms physical ports and connected wire endpoints', () => {
  const result = localToWorld({ x: 0.075, y: 0 }, { xM: 1, yM: 2, rotationRad: Math.PI / 2 });
  close(result.xM, 1, 1e-12);
  close(result.yM, 2.075, 1e-12);
  const scene = circuit();
  const moved = accepted(updateEquipment(scene, registry, 'power', { xM: -0.1, yM: 0.2, rotationRad: Math.PI / 2 }, { voltageV: 3 }, time));
  const end = wireWorldPoints(moved.connections[0], moved.equipment, registry)[0];
  close(end.xM, -0.1, 1e-12);
  close(end.yM, 0.125, 1e-12);
  assert.deepEqual(wiringNodes(moved, registry), wiringNodes(scene, registry));
});

test('movement, zoom, route bends and duplicate wires do not invent electrical nodes', () => {
  const scene = circuit();
  const original = structuredClone(scene);
  const routed = accepted(updateWireRoute(scene, registry, 'wire1', [{ x: 0.3, y: -0.4 }, { x: 0.1, y: -0.2 }], time));
  const duplicate = accepted(connectEndpoints(routed, registry, 'wire4', ep('resistor', 'a'), ep('power', 'positive'), time));
  duplicate.viewport = zoomViewport(DEFAULT_VIEWPORT, 2, { x: 100, y: 100 }, { width: 800, height: 600 });
  assert.deepEqual(wiringNodes(duplicate, registry), wiringNodes(scene, registry));
  assert.deepEqual(scene, original);
  assert.deepEqual(duplicate.equipment.map(item => item.parameters), scene.equipment.map(item => item.parameters));
});

test('visually crossing routes stay separate until explicitly wired to a junction', () => {
  let scene = circuit();
  scene = accepted(updateWireRoute(scene, registry, 'wire1', [{ x: 0, y: 0 }], time));
  scene = accepted(updateWireRoute(scene, registry, 'wire2', [{ x: 0, y: 0 }], time));
  assert.equal(wiringNodes(scene, registry).length, 3);
  scene = accepted(addEquipment(scene, registry, JUNCTION, 'junction', { xM: 0, yM: 0 }, time));
  assert.equal(wiringNodes(scene, registry).length, 4);
  scene = accepted(connectEndpoints(scene, registry, 'join1', ep('power', 'positive'), ep('junction', 'node'), time));
  scene = accepted(connectEndpoints(scene, registry, 'join2', ep('resistor', 'b'), ep('junction', 'node'), time));
  assert.equal(wiringNodes(scene, registry).length, 2);
  assert.equal(scene.connections.filter(wire => wire.to.equipmentId === 'junction').length, 2);
});

test('delete apparatus detaches and preserves its wires; delete one wire preserves other connections', () => {
  const scene = circuit();
  const deleted = accepted(removeEquipment(scene, registry, 'resistor', time));
  assert.equal(deleted.equipment.length, 2);
  assert.deepEqual(deleted.connections.map(wire => wire.id), ['wire1', 'wire2', 'wire3']);
  assert.equal(deleted.connections[0].to, null);
  assert.deepEqual(deleted.connections[0].freeToWorldM, { x: .125, y: .1 });
  assert.equal(deleted.connections[1].from, null);
  assert.deepEqual(deleted.connections[1].freeFromWorldM, { x: .275, y: .1 });
  assert.deepEqual(deleted.connections[2], scene.connections[2]);
  const oneWire = accepted(removeConnection(scene, registry, 'wire2', time));
  assert.deepEqual(oneWire.connections.map(wire => wire.id), ['wire1', 'wire3']);
  assert.equal(oneWire.equipment.length, 3);
  assert.equal(scene.connections.length, 3);
});

test('invalid edits return explanations, preserve input and carry no partial document', () => {
  const scene = circuit();
  const before = structuredClone(scene);
  rejected(addEquipment(scene, registry, 'unknown', 'x', { xM: 0, yM: 0 }, time), 'UNKNOWN_EQUIPMENT_VERSION');
  rejected(updateEquipment(scene, registry, 'resistor', scene.equipment[1].pose, { resistanceOhm: 0 }, time), 'INVALID_EQUIPMENT_PARAMETERS');
  rejected(updateEquipment(scene, registry, 'power', { xM: NaN, yM: 0, rotationRad: 0 }, { voltageV: 3 }, time), 'SCHEMA_INVALID');
  rejected(connectEndpoints(scene, registry, 'new', ep('power', 'positive'), ep('power', 'positive'), time), 'SELF_CONNECTION');
  rejected(connectEndpoints(scene, registry, 'new', ep('power', 'missing'), ep('resistor', 'a'), time), 'UNKNOWN_PORT');
  rejected(connectEndpoints(scene, registry, 'new', ep('missing', 'a'), ep('resistor', 'a'), time), 'DANGLING_ENDPOINT');
  rejected(updateWireRoute(scene, registry, 'wire1', [{ x: Infinity, y: 0 }], time), 'SCHEMA_INVALID');
  assert.deepEqual(scene, before);
});

test('wrong-type port gets an actionable explanation instead of a silently corrected wire', () => {
  const mixedRegistry = createElectricalRegistry();
  mixedRegistry.registerParameterSchema('test.optical.params', z.strictObject({}));
  mixedRegistry.register({ type: 'test.optical', definitionVersion: 1, label: '测试光学安装座', domain: 'optical',
    ports: [{ id: 'mount', kind: 'optical-mount', localPositionM: { x: 0, y: 0 } }],
    parameterSchemaId: 'test.optical.params', modelAdapterId: 'test.optical.model', viewId: 'test.optical.view', defaultParameters: {} });
  const scene = accepted(addEquipment(circuit(), mixedRegistry, 'test.optical', 'mount', { xM: 0, yM: 0 }, time));
  rejected(connectEndpoints(scene, mixedRegistry, 'invalid', ep('power', 'positive'), ep('mount', 'mount'), time), 'INCOMPATIBLE_PORT');
  assert.match(editMessage('INCOMPATIBLE_PORT'), /导线只能连接电气接线柱/);
});

test('accepted placement/update changes revision once and keeps unrelated scene state', () => {
  const scene = empty();
  const placed = accepted(addEquipment(scene, registry, RESISTOR, 'r', { xM: 0.1, yM: 0.2 }, time));
  assert.equal(placed.revision, 1);
  const updated = accepted(updateEquipment(placed, registry, 'r', { xM: -0.2, yM: 0.3, rotationRad: 0 }, { resistanceOhm: 20 }, time));
  assert.equal(updated.revision, 2);
  assert.equal(updated.simulationConfig.gravityMPerS2, 10);
  assert.equal(scene.revision, 0);
  assert.equal(scene.equipment.length, 0);
  assert.throws(() => endpointWorld(ep('missing', 'a'), placed.equipment, registry), /UNKNOWN_ENDPOINT/);
});
