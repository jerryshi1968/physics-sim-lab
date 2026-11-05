import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, executeCommand, MAX_HISTORY_ENTRIES, setHistoryViewport, travelHistory } from '../../src/core/workbench/history.ts';
import { positionWireEnd } from '../../src/core/workbench/edit.ts';
import { serializeScene } from '../../src/core/scene/transfer.ts';
import { createElectricalRegistry, POWER, RESISTOR } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { timestamp } from './fixtures.mjs';

const registry = createElectricalRegistry();
const later = '2026-11-03T09:00:00.000Z';
const initial = () => createEmptyScene('history.test', timestamp);
function execute(history, command) {
  const result = executeCommand(history, command, registry, later);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.history;
}
function travel(history, direction) {
  const result = travelHistory(history, direction, registry, later);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.history;
}
function source(history) {
  return execute(history, { type: 'add-equipment', equipmentType: POWER, id: 'battery', point: { xM: 0, yM: 0 } });
}

test('rename trims only outer whitespace, validates names, supports history and exports the restored title', () => {
  const original = source(createHistory(initial()));
  let history = execute(original, { type: 'rename', title: '  串联电路  实验  ' });
  assert.equal(history.present.title, '串联电路  实验');
  assert.deepEqual(history.present.equipment, original.present.equipment);
  assert.equal(original.present.title, '未命名实验');
  for (const title of ['', ' \t\n ', '名'.repeat(201)]) {
    assert.equal(executeCommand(history, { type: 'rename', title }, registry, later).ok, false);
  }
  assert.equal(executeCommand(history, { type: 'rename', title: '串联电路  实验' }, registry, later).history, history);
  history = travel(history, 'undo');
  assert.equal(JSON.parse(serializeScene(history.present, registry)).title, '未命名实验');
  history = travel(history, 'redo');
  assert.equal(history.present.title, '串联电路  实验');
});

test('a committed move is one transaction; undo and redo restore pose, parameters and increasing revision', () => {
  let history = source(createHistory(initial()));
  const old = structuredClone(history);
  history = execute(history, { type: 'update-equipment', id: 'battery', pose: { xM: .25, yM: -.1, rotationRad: Math.PI / 2 }, parameters: { voltageV: 9 } });
  assert.equal(history.undo.length, 2);
  assert.equal(history.present.revision, 2);
  assert.deepEqual(old.present.equipment[0].parameters, { voltageV: 3 });
  const undone = travel(history, 'undo');
  assert.deepEqual(undone.present.equipment[0], old.present.equipment[0]);
  assert.equal(undone.present.revision, 3);
  const redone = travel(undone, 'redo');
  assert.deepEqual(redone.present.equipment, history.present.equipment);
  assert.equal(redone.present.revision, 4);
  assert.equal(undone.redo.length, 1);
});

test('deleting then undoing restores exact IDs, apparatus, attached/free wire ends and bend points', () => {
  let history = source(createHistory(initial()));
  history = execute(history, { type: 'add-equipment', equipmentType: RESISTOR, id: 'resistor', point: { xM: .4, yM: 0 } });
  history = execute(history, { type: 'connect', id: 'attached', from: { equipmentId: 'battery', portId: 'positive' }, to: { equipmentId: 'resistor', portId: 'a' } });
  history = execute(history, { type: 'add-wire', id: 'partial', point: { xM: -.3, yM: .2 } });
  const loose = history.present.connections.find(wire => wire.id === 'partial');
  history = execute(history, { type: 'reshape-wire', wire: positionWireEnd(loose, 'from', { equipmentId: 'battery', portId: 'negative' }, { xM: 0, yM: 0 }) });
  history = execute(history, { type: 'route', id: 'attached', points: [{ x: -.15, y: .3 }, { x: .35, y: .2 }] });
  const expected = structuredClone(history.present);
  history = execute(history, { type: 'remove-equipment', id: 'battery' });
  assert.equal(history.present.equipment.length, 1);
  assert.equal(history.present.connections.length, 2);
  assert.ok(history.present.connections.every(wire => wire.from === null));
  assert.deepEqual(history.present.connections[0].freeFromWorldM, { x: -.075, y: 0 });
  assert.deepEqual(history.present.connections[1].freeFromWorldM, { x: .075, y: 0 });
  history = travel(history, 'undo');
  const exported = JSON.parse(serializeScene(history.present, registry));
  assert.deepEqual(exported.equipment, expected.equipment);
  assert.deepEqual(exported.connections, expected.connections);
  history = travel(history, 'redo');
  assert.equal(history.present.connections.length, 2);
  assert.ok(history.present.connections.every(wire => wire.from === null));
});

test('wire route, free endpoints, unplug and removal are independently reversible', () => {
  let history = source(createHistory(initial()));
  history = execute(history, { type: 'add-wire', id: 'loose', point: { xM: .3, yM: .1 } });
  const loose = structuredClone(history.present.connections[0]);
  history = execute(history, { type: 'reshape-wire', wire: positionWireEnd(loose, 'to', { equipmentId: 'battery', portId: 'positive' }, { xM: 0, yM: 0 }) });
  const attached = structuredClone(history.present.connections[0]);
  history = execute(history, { type: 'reshape-wire', wire: positionWireEnd(attached, 'to', null, { xM: .6, yM: -.2 }) });
  assert.deepEqual(history.present.connections[0].freeToWorldM, { x: .6, y: -.2 });
  history = travel(history, 'undo');
  assert.deepEqual(history.present.connections[0], attached);
  history = travel(history, 'undo');
  assert.deepEqual(history.present.connections[0], loose);
  history = execute(history, { type: 'remove-wire', id: 'loose' });
  assert.equal(history.present.connections.length, 0);
  history = travel(history, 'undo');
  assert.deepEqual(history.present.connections[0], loose);
});

test('invalid and unchanged commands do not add history or clear redo; a new edit does', () => {
  let history = source(createHistory(initial()));
  history = execute(history, { type: 'add-wire', id: 'loose', point: { xM: .2, yM: 0 } });
  history = travel(history, 'undo');
  const before = structuredClone(history);
  const instance = history.present.equipment[0];
  const noop = executeCommand(history, { type: 'update-equipment', id: instance.id, pose: instance.pose, parameters: instance.parameters }, registry, later);
  assert.equal(noop.history, history);
  const invalid = executeCommand(history, { type: 'update-equipment', id: instance.id, pose: instance.pose, parameters: { voltageV: -1 } }, registry, later);
  assert.equal(invalid.ok, false);
  assert.deepEqual(history, before);
  history = execute(history, { type: 'add-wire', id: 'different', point: { xM: -.2, yM: 0 } });
  assert.equal(history.redo.length, 0);
});

test('view changes are saved but do not create or consume history and survive undo/redo', () => {
  let history = source(createHistory(initial()));
  const viewport = { centerXM: -.12, centerYM: .3, pixelsPerM: 750 };
  history = setHistoryViewport(history, viewport);
  assert.equal(history.undo.length, 1);
  history = travel(history, 'undo');
  assert.deepEqual(history.present.viewport, viewport);
  history = setHistoryViewport(history, { ...viewport, centerYM: 1 });
  assert.equal(history.redo.length, 1);
  history = travel(history, 'redo');
  assert.equal(history.present.viewport.centerYM, 1);
  assert.equal(history.present.equipment.length, 1);
});

test('history is bounded and empty traversal is harmless; replacing documents resets both stacks', () => {
  const empty = createHistory(initial());
  assert.equal(travelHistory(empty, 'undo', registry, later).history, empty);
  let history = source(empty);
  for (let step = 1; step <= MAX_HISTORY_ENTRIES + 5; step++) {
    history = execute(history, { type: 'update-equipment', id: 'battery', pose: { xM: step / 100, yM: 0, rotationRad: 0 }, parameters: { voltageV: 3 } });
  }
  assert.equal(history.undo.length, MAX_HISTORY_ENTRIES);
  history = travel(history, 'undo');
  const loaded = createHistory(history.present);
  assert.deepEqual(loaded.present, history.present);
  assert.equal(loaded.undo.length, 0);
  assert.equal(loaded.redo.length, 0);
  loaded.present.equipment[0].parameters.voltageV = 12;
  assert.equal(history.present.equipment[0].parameters.voltageV, 3);
});
