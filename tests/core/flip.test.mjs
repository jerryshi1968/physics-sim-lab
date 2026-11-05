import test from 'node:test';
import assert from 'node:assert/strict';
import { createElectricalRegistry } from '../../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../../src/equipment/electrical/dcAdapters.ts';
import { solveDcScene } from '../../src/core/electrical/compile.ts';
import { endpointWorld, localToWorld, wireWorldPoints } from '../../src/core/workbench/geometry.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { parseSceneJson, serializeScene } from '../../src/core/scene/transfer.ts';
import { linearScene } from './dc-fixtures.mjs';

const registry = createElectricalRegistry();
const timestamp = '2026-11-04T03:00:00.000Z';
test('horizontal reflection happens in local coordinates before rotation and moves actual posts and connected wires', () => {
  const point = localToWorld({ x: .075, y: .02 }, { xM: 1, yM: 2, rotationRad: Math.PI / 2, flippedX: true });
  assert.ok(Math.abs(point.xM - .98) < 1e-12); assert.ok(Math.abs(point.yM - 1.925) < 1e-12);
  const scene = linearScene();
  const original = endpointWorld({ equipmentId: 'E', portId: 'positive' }, scene.equipment, registry);
  scene.equipment[0].pose.flippedX = true;
  const flipped = endpointWorld({ equipmentId: 'E', portId: 'positive' }, scene.equipment, registry);
  assert.ok(Math.abs(flipped.xM + original.xM) < 1e-12);
  assert.deepEqual(wireWorldPoints(scene.connections[0], scene.equipment, registry)[0], flipped);
});

test('flip is undoable, survives JSON round-trip, and cannot change the circuit current', () => {
  const scene = linearScene();
  const before = solveDcScene(scene, registry, createDcModelAdapters());
  const edited = executeCommand(createHistory(scene), { type: 'update-equipment', id: 'E', pose: { ...scene.equipment[0].pose, flippedX: true }, parameters: scene.equipment[0].parameters }, registry, timestamp);
  assert.equal(edited.ok, true);
  const imported = parseSceneJson(serializeScene(edited.history.present, registry), registry);
  assert.equal(imported.ok, true); assert.equal(imported.document.equipment[0].pose.flippedX, true);
  assert.deepEqual(solveDcScene(imported.document, registry, createDcModelAdapters()), before);
  const undone = travelHistory(edited.history, 'undo', registry, timestamp);
  assert.equal(undone.history.present.equipment[0].pose.flippedX, undefined);
  const redone = travelHistory(undone.history, 'redo', registry, timestamp);
  assert.equal(redone.history.present.equipment[0].pose.flippedX, true);
});

test('old scenes without a flip remain valid, malformed flags fail and v1 does not silently accept the new pose field', () => {
  const scene = linearScene();
  assert.equal(parseSceneJson(JSON.stringify(scene), registry).ok, true);
  scene.equipment[0].pose.flippedX = 'true';
  assert.equal(parseSceneJson(JSON.stringify(scene), registry).ok, false);
  scene.equipment[0].pose.flippedX = true; scene.schemaVersion = 1;
  assert.equal(parseSceneJson(JSON.stringify(scene), registry).ok, false);
});
