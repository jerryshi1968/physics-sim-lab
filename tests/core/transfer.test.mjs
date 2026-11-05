import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSceneJson, serializeScene, utf8ByteLength, MAX_DOCUMENT_BYTES } from '../../src/core/scene/transfer.ts';
import { migrateSceneDocument } from '../../src/core/scene/migrate.ts';
import { connectedScene, fixtureRegistry, measurement } from './fixtures.mjs';
import { createElectricalRegistry, JUNCTION } from '../../src/equipment/electrical/definitions.ts';

const registry = fixtureRegistry();
const parse = document => parseSceneJson(JSON.stringify(document), registry);

test('JSON round-trip preserves all initial state, free wires, metadata, records and viewport', () => {
  const scene = connectedScene();
  scene.viewport = { centerXM: -.2, centerYM: .3, pixelsPerM: 875 };
  scene.measurementRecords.push(measurement(scene));
  scene.connections.push({ id: 'loose', kind: 'wire', from: null, to: null,
    freeFromWorldM: { x: -1, y: 2 }, freeToWorldM: { x: .5, y: -.5 }, routeWorldM: [{ x: .2, y: .3 }] });
  const text = serializeScene(scene, registry);
  const result = parseSceneJson(text, registry);
  assert.equal(result.ok, true);
  assert.equal(result.fromVersion, 2);
  assert.deepEqual(result.document, scene);
  result.document.connections[0].routeWorldM[0].x = 3;
  assert.equal(scene.connections[0].routeWorldM[0].x, .1);
});

test('UTF-8 byte limit includes Chinese and surrogate pairs, rejects over 5 MiB and accepts exact byte boundary', () => {
  for (const text of ['', 'abc', '汉字', '😃', '\ud800']) assert.equal(utf8ByteLength(text), Buffer.byteLength(text));
  assert.equal(parseSceneJson(' '.repeat(MAX_DOCUMENT_BYTES + 1), registry).ok, false);
  assert.match(parseSceneJson('汉'.repeat(Math.floor(MAX_DOCUMENT_BYTES / 3) + 1), registry).message, /5 MiB/);
  const text = JSON.stringify(connectedScene());
  const exact = text + ' '.repeat(MAX_DOCUMENT_BYTES - utf8ByteLength(text));
  assert.equal(parseSceneJson(exact, registry).ok, true);
});

test('malformed JSON, wrong top-level values and unknown schema versions fail without mutation', () => {
  const original = connectedScene();
  const before = structuredClone(original);
  for (const text of ['{', 'null', '[]', '"hello"', '{"schemaVersion":999}', '{"schemaVersion":"2"}']) {
    assert.equal(parseSceneJson(text, registry).ok, false);
  }
  const newer = { ...original, schemaVersion: 3 };
  assert.match(parse(newer).message, /不支持此场景版本/);
  assert.deepEqual(original, before);
});

test('limits of 200 apparatus, 500 connections and 10000 records are enforced before migration', () => {
  for (const [key, length] of [['equipment', 201], ['connections', 501], ['measurementRecords', 10001]]) {
    const result = parse({ ...connectedScene(), [key]: Array(length).fill({}) });
    assert.equal(result.ok, false);
    assert.match(result.message, /数量超过上限/);
  }
});

test('duplicate IDs, missing references, invalid ports, parameters and self-connections are rejected', () => {
  const cases = [
    [scene => { scene.connections[0].id = 'r1'; }, 'DUPLICATE_ID'],
    [scene => { scene.connections[0].from.equipmentId = 'missing'; }, 'DANGLING_ENDPOINT'],
    [scene => { scene.connections[0].from.portId = 'unknown'; }, 'UNKNOWN_PORT'],
    [scene => { scene.equipment[0].parameters.resistanceOhm = 0; }, 'INVALID_EQUIPMENT_PARAMETERS'],
    [scene => { scene.connections[0].to = { ...scene.connections[0].from }; }, 'SELF_CONNECTION'],
    [scene => { scene.measurementRecords = [{ ...measurement(scene), equipmentId: 'missing' }]; }, 'DANGLING_MEASUREMENT'],
  ];
  for (const [change, code] of cases) {
    const scene = connectedScene();
    change(scene);
    const before = structuredClone(scene);
    const result = parse(scene);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.some(item => item.code === code), true, code);
    assert.deepEqual(scene, before);
  }
});

test('unknown equipment, definition versions and connection kinds are never silently discarded', () => {
  for (const change of [scene => { scene.equipment[0].type = 'future.device'; },
    scene => { scene.equipment[0].definitionVersion = 2; }, scene => { scene.connections[0].kind = 'rope'; }]) {
    const scene = connectedScene();
    change(scene);
    assert.equal(parse(scene).ok, false);
    assert.throws(() => serializeScene(scene, registry));
  }
});

test('v1 migration preserves IDs, connections, routes, parameters and original metadata without mutating input', () => {
  const scene = { ...connectedScene(), schemaVersion: 1 };
  scene.measurementRecords = [measurement(scene)];
  const before = structuredClone(scene);
  const migrated = migrateSceneDocument(scene);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.fromVersion, 1);
  assert.deepEqual(migrated.value, { ...before, schemaVersion: 2 });
  assert.deepEqual(scene, before);
  const result = parse(scene);
  assert.equal(result.ok, true);
  assert.equal(result.document.schemaVersion, 2);
  assert.deepEqual(result.document.connections, scene.connections);
});

test('v1 cannot smuggle v2 free ends or unknown fields, and migrated unknown apparatus still fails', () => {
  for (const change of [scene => { scene.connections[0].from = null; scene.connections[0].freeFromWorldM = { x: 0, y: 0 }; },
    scene => { scene.unknownField = 'must not disappear'; }, scene => { scene.equipment[0].type = 'future.device'; }]) {
    const scene = { ...connectedScene(), schemaVersion: 1 };
    change(scene);
    assert.equal(parse(scene).ok, false);
  }
});

test('a known historical junction is retained by migration without adding a library entry', () => {
  const scene = { ...connectedScene(), schemaVersion: 1 };
  scene.equipment = [{ id: 'junction', type: JUNCTION, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: {} }];
  scene.connections = [];
  const result = parseSceneJson(JSON.stringify(scene), createElectricalRegistry());
  assert.equal(result.ok, true);
  assert.equal(result.document.equipment[0].type, JUNCTION);
});

test('HTML remains inert text; code-like input and prototype fields are never executed or accepted as extra keys', () => {
  const scene = connectedScene();
  scene.title = '<img src=x onerror="globalThis.importExecuted=true">';
  const result = parse(scene);
  assert.equal(result.ok, true);
  assert.equal(result.document.title, scene.title);
  assert.equal(globalThis.importExecuted, undefined);
  assert.equal(parseSceneJson('globalThis.importExecuted=true', registry).ok, false);
  const malicious = JSON.stringify(scene).replace('"parameters":{"resistanceOhm":10}', '"parameters":{"resistanceOhm":10,"__proto__":"pollute"}');
  assert.equal(parseSceneJson(malicious, registry).ok, false);
  assert.equal({}.pollute, undefined);
});

test('missing or ambiguous free endpoint positions and overlong routes cannot be loaded', () => {
  const scene = connectedScene();
  scene.connections[0].freeFromWorldM = { x: 0, y: 0 };
  assert.equal(parse(scene).ok, false);
  delete scene.connections[0].freeFromWorldM;
  scene.connections[0].from = null;
  assert.equal(parse(scene).ok, false);
  scene.connections[0].freeFromWorldM = { x: 0, y: 0 };
  scene.connections[0].routeWorldM = Array(101).fill({ x: 0, y: 0 });
  assert.equal(parse(scene).ok, false);
});
