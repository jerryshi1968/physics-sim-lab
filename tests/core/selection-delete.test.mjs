import test from 'node:test';
import assert from 'node:assert/strict';
import { removeEquipment, removeEquipmentMany } from '../../src/core/workbench/edit.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { wireWorldPoints } from '../../src/core/workbench/geometry.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { changeSelection, equipmentSelectionIds } from '../../src/app/workbench/shared.ts';
import { connectedScene, fixtureRegistry, measurement, timestamp } from './fixtures.mjs';

const registry = fixtureRegistry();

test('Shift adds and toggles equipment selection, ordinary selection replaces and wire selection stays separate', () => {
  const r1 = { kind: 'equipment', id: 'r1' }, r2 = { kind: 'equipment', id: 'r2' };
  assert.deepEqual(changeSelection(null, r1, true), r1);
  const selected = changeSelection(r1, r2, true);
  assert.deepEqual(equipmentSelectionIds(selected), ['r1', 'r2']);
  assert.deepEqual(changeSelection(selected, r1, true), r2);
  assert.equal(changeSelection(r1, r1, true), null);
  assert.deepEqual(changeSelection(selected, r1), r1);
  assert.equal(changeSelection(selected, null), null);
  assert.deepEqual(changeSelection({ kind: 'connection', id: 'w1' }, r1, true), r1);
  assert.deepEqual(changeSelection(selected, { kind: 'connection', id: 'w1' }, true), { kind: 'connection', id: 'w1' });
  assert.deepEqual(selected, { kind: 'equipment-group', ids: ['r1', 'r2'] });
});

test('deleting rotated flipped equipment keeps endpoints at their original world positions and preserves every bend', () => {
  const scene = connectedScene();
  scene.equipment[0].pose = { xM: -.3, yM: .2, rotationRad: Math.PI / 3, flippedX: true };
  scene.connections.push({ id: 'partial', kind: 'wire', from: null, freeFromWorldM: { x: -.6, y: -.2 }, to: { equipmentId: 'r1', portId: 'a' }, routeWorldM: [{ x: -.5, y: .1 }] });
  const before = structuredClone(scene);
  const points = scene.connections.map(wire => wireWorldPoints(wire, scene.equipment, registry));
  const result = removeEquipment(scene, registry, 'r1', timestamp);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(scene, before);
  assert.equal(result.document.connections.length, 2);
  result.document.connections.forEach((wire, index) => assert.deepEqual(wireWorldPoints(wire, result.document.equipment, registry), points[index]));
  assert.equal(result.document.connections[0].from, null);
  assert.deepEqual(result.document.connections[0].to, scene.connections[0].to);
  assert.equal(result.document.connections[1].from, null);
  assert.equal(result.document.connections[1].to, null);
  assert.equal(validateSceneDocument(result.document, registry).ok, true);
  assert.equal(parseSceneJson(serializeScene(result.document, registry), registry).ok, true);
});

test('batch deletion frees both ends of shared wires in one revision and one reversible history transaction', () => {
  const scene = connectedScene(), history = createHistory(scene);
  const points = wireWorldPoints(scene.connections[0], scene.equipment, registry);
  const result = executeCommand(history, { type: 'remove-equipment-batch', ids: ['r1', 'r2'] }, registry, timestamp);
  assert.equal(result.ok, true, JSON.stringify(result));
  const deleted = result.history;
  assert.equal(deleted.present.revision, scene.revision + 1);
  assert.equal(deleted.undo.length, 1);
  assert.equal(deleted.present.equipment.length, 0);
  assert.equal(deleted.present.connections.length, 1);
  assert.equal(deleted.present.connections[0].from, null);
  assert.equal(deleted.present.connections[0].to, null);
  assert.deepEqual(wireWorldPoints(deleted.present.connections[0], [], registry), points);
  const restored = travelHistory(deleted, 'undo', registry, timestamp);
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.history.present.equipment, scene.equipment);
  assert.deepEqual(restored.history.present.connections, scene.connections);
  const redone = travelHistory(restored.history, 'redo', registry, timestamp);
  assert.equal(redone.ok, true);
  assert.deepEqual(redone.history.present.connections, deleted.present.connections);
  assert.equal(redone.history.present.equipment.length, 0);
});

test('unknown IDs and equipment with measurement records reject the entire batch without partial changes', () => {
  const scene = connectedScene();
  scene.measurementRecords.push(measurement(scene));
  assert.equal(validateSceneDocument(scene, registry).ok, true);
  const before = structuredClone(scene);
  for (const ids of [[], ['r2', 'absent'], ['r2', 'r1']]) {
    const result = removeEquipmentMany(scene, registry, ids, timestamp);
    assert.equal(result.ok, false);
    assert.equal('document' in result, false);
    assert.deepEqual(scene, before);
  }
});
