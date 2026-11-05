import test from 'node:test';
import assert from 'node:assert/strict';
import { addEquipment, addLooseWire, positionWireEnd, updateEquipment, updateWireShape } from '../../src/core/workbench/edit.ts';
import { curvedWirePath, nearestElectricalPort, translateLooseWire } from '../../src/core/workbench/wire.ts';
import { endpointKey, wireWorldPoints } from '../../src/core/workbench/geometry.ts';
import { wiringNodes } from '../../src/core/workbench/graph.ts';
import { SceneDocumentSchema } from '../../src/core/scene/schema.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { createElectricalRegistry, POWER, RESISTOR } from '../../src/equipment/electrical/definitions.ts';
import { close } from '../physics/helpers.mjs';

const registry = createElectricalRegistry();
const time = '2026-11-03T10:00:00.000Z';
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.document; }
function fixture() {
  let scene = createEmptyScene('loose.scene', time);
  scene = ok(addEquipment(scene, registry, POWER, 'power', { xM: -0.2, yM: 0 }, time));
  scene = ok(addEquipment(scene, registry, RESISTOR, 'resistor', { xM: 0.2, yM: 0 }, time));
  return ok(addLooseWire(scene, registry, 'wire', { xM: 0, yM: 0 }, time));
}
const a = { equipmentId: 'power', portId: 'positive' };
const b = { equipmentId: 'resistor', portId: 'a' };

test('wire can exist independently with two finite free ends and initial bend controls', () => {
  const scene = fixture();
  const wire = scene.connections[0];
  assert.equal(scene.schemaVersion, 2);
  assert.equal(wire.from, null);
  assert.equal(wire.to, null);
  assert.deepEqual(wire.freeFromWorldM, { x: -0.1, y: 0 });
  assert.deepEqual(wire.freeToWorldM, { x: 0.1, y: 0 });
  assert.equal(wire.routeWorldM.length, 2);
  assert.equal(validateSceneDocument(scene, registry).ok, true);
  assert.equal(wiringNodes(scene, registry).length, 4);
});

test('ambiguous/missing/non-finite free-end states and free mechanical mounts are rejected', () => {
  for (const patch of [{ freeFromWorldM: undefined }, { freeFromWorldM: { x: Infinity, y: 0 } }, { kind: 'rigid-mount' }, { from: a }]) {
    const scene = fixture();
    Object.assign(scene.connections[0], patch);
    assert.equal(validateSceneDocument(scene, registry).ok, false);
  }
  assert.equal(SceneDocumentSchema.safeParse({ ...fixture(), schemaVersion: 1 }).success, false);
});

test('one attached end does not conduct; two attached ends connect actual ports; unplug breaks it', () => {
  let scene = fixture();
  let wire = positionWireEnd(scene.connections[0], 'from', a, { xM: 0, yM: 0 });
  scene = ok(updateWireShape(scene, registry, wire, time));
  assert.equal(wiringNodes(scene, registry).length, 4);
  assert.equal(scene.connections[0].freeFromWorldM, undefined);
  wire = positionWireEnd(scene.connections[0], 'to', b, { xM: 0, yM: 0 });
  scene = ok(updateWireShape(scene, registry, wire, time));
  assert.ok(wiringNodes(scene, registry).some(group => group.includes(endpointKey(a)) && group.includes(endpointKey(b))));
  wire = positionWireEnd(scene.connections[0], 'from', null, { xM: -0.275, yM: 0 });
  scene = ok(updateWireShape(scene, registry, wire, time));
  assert.equal(wiringNodes(scene, registry).length, 4);
  assert.equal(scene.connections[0].from, null);
});

test('moving the whole loose wire translates ends/control points without mutation or attachment', () => {
  const scene = fixture();
  const original = structuredClone(scene);
  const moved = translateLooseWire(scene.connections[0], { xM: 0.2, yM: -0.1 });
  close(moved.freeFromWorldM.x, 0.1);
  close(moved.freeToWorldM.x, 0.3);
  close(moved.routeWorldM[0].x, 0.16);
  close(moved.routeWorldM[0].y, -0.05);
  assert.deepEqual(scene, original);
  const result = ok(updateWireShape(scene, registry, moved, time));
  assert.equal(result.revision, scene.revision + 1);
  assert.deepEqual(wiringNodes(result, registry), wiringNodes(scene, registry));
});

test('attached end follows its apparatus while the other end remains at its explicit free point', () => {
  let scene = fixture();
  scene = ok(updateWireShape(scene, registry, positionWireEnd(scene.connections[0], 'from', a, { xM: 0, yM: 0 }), time));
  assert.throws(() => translateLooseWire(scene.connections[0], { xM: 1, yM: 0 }), /WIRE_HAS_ATTACHED_END/);
  scene = ok(updateEquipment(scene, registry, 'power', { xM: 0, yM: 0.1, rotationRad: 0 }, { voltageV: 3 }, time));
  const points = wireWorldPoints(scene.connections[0], scene.equipment, registry);
  close(points[0].xM, -0.075);
  close(points[0].yM, 0.1);
  assert.deepEqual(points[points.length - 1], { xM: 0.1, yM: 0 });
});

test('snapping selects the nearest electrical post within the visible target radius only', () => {
  const scene = fixture();
  assert.deepEqual(nearestElectricalPort({ xM: -0.27, yM: 0.005 }, scene.equipment, registry, 0.03), a);
  assert.equal(nearestElectricalPort({ xM: 0, yM: 0.3 }, scene.equipment, registry, 0.03), null);
});

test('same post on both ends or an unknown post is rejected without replacing the scene', () => {
  const scene = fixture();
  const before = structuredClone(scene);
  let wire = positionWireEnd(scene.connections[0], 'from', a, { xM: 0, yM: 0 });
  wire = positionWireEnd(wire, 'to', a, { xM: 0, yM: 0 });
  assert.equal(updateWireShape(scene, registry, wire, time).diagnostics[0].code, 'SELF_CONNECTION');
  wire = positionWireEnd(wire, 'to', { equipmentId: 'power', portId: 'absent' }, { xM: 0, yM: 0 });
  assert.equal(updateWireShape(scene, registry, wire, time).ok, false);
  assert.deepEqual(scene, before);
});

test('curved wire paths preserve terminal endpoints and bending does not create topology', () => {
  const path = curvedWirePath([{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]);
  assert.ok(path.startsWith('M0,0'));
  assert.ok(path.endsWith(' 100,0'));
  assert.match(path, /C/);
  assert.match(path, / 50,50 C/);
  assert.match(curvedWirePath([{ x: 0, y: 0 }, { x: 100, y: 0 }]), /C/);
  assert.doesNotMatch(curvedWirePath([{ x: 0, y: 0 }, { x: 0, y: 0 }]), /NaN|Infinity/);
  const scene = fixture();
  const wire = { ...scene.connections[0], routeWorldM: [{ x: -0.2, y: 0 }, { x: 0.2, y: 0 }] };
  const bent = ok(updateWireShape(scene, registry, wire, time));
  assert.deepEqual(wiringNodes(scene, registry), wiringNodes(bent, registry));
});
