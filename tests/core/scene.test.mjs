import test from 'node:test';
import assert from 'node:assert/strict';
import { EquipmentRegistry } from '../../src/core/equipment/registry.ts';
import { SceneDocumentSchema } from '../../src/core/scene/schema.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { connectedScene, definition, fixtureRegistry, measurement, timestamp } from './fixtures.mjs';

function fails(document, code, registry = fixtureRegistry()) {
  const result = validateSceneDocument(document, registry);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === code), JSON.stringify(result));
  assert.ok(result.diagnostics.every(diagnostic => diagnostic.measurementUsable === false));
  assert.equal('document' in result, false);
}

test('empty scene is valid with explicit SI defaults, null references and no measurements', () => {
  const scene = createEmptyScene('scene.1', timestamp);
  const result = validateSceneDocument(scene, new EquipmentRegistry());
  assert.equal(result.ok, true);
  assert.equal(scene.schemaVersion, 2);
  assert.equal(scene.simulationConfig.gravityMPerS2, 10);
  assert.equal(scene.simulationConfig.randomError.enabled, false);
  assert.equal(scene.experimentId, null);
  assert.equal(scene.curriculumRef, null);
  assert.deepEqual(scene.measurementRecords, []);
});

test('registered scene and route geometry round trip without modifying input', () => {
  const scene = connectedScene();
  const before = structuredClone(scene);
  const result = validateSceneDocument(JSON.parse(JSON.stringify(scene)), fixtureRegistry());
  assert.equal(result.ok, true);
  assert.deepEqual(result.document, scene);
  result.document.equipment[0].pose.xM = 100;
  assert.deepEqual(scene, before);
});

test('independent empty documents do not share mutable defaults', () => {
  const first = createEmptyScene('first', timestamp);
  const second = createEmptyScene('second', timestamp);
  first.simulationConfig.randomError.seed = 10;
  assert.equal(second.simulationConfig.randomError.seed, 0);
  assert.throws(() => createEmptyScene('bad id', timestamp));
  assert.throws(() => createEmptyScene('valid', 'not-a-date'));
});

test('missing required data, unknown versions and unknown fields are never silently stripped', () => {
  for (const value of [null, {}, { ...connectedScene(), schemaVersion: 999 }, { ...connectedScene(), unexpected: true }]) {
    fails(value, 'SCHEMA_INVALID');
  }
  const missing = connectedScene();
  delete missing.simulationConfig;
  fails(missing, 'SCHEMA_INVALID');
});

test('non-finite geometry, scalar parameters and viewport zoom are invalid', () => {
  const pose = connectedScene();
  pose.equipment[0].pose.xM = Infinity;
  fails(pose, 'SCHEMA_INVALID');
  const parameter = connectedScene();
  parameter.equipment[0].parameters.resistanceOhm = NaN;
  fails(parameter, 'SCHEMA_INVALID');
  fails({ ...connectedScene(), viewport: { centerXM: 0, centerYM: 0, pixelsPerM: 0 } }, 'SCHEMA_INVALID');
});

test('duplicate apparatus and cross-collection IDs are rejected', () => {
  const scene = connectedScene();
  scene.equipment[1].id = 'r1';
  fails(scene, 'DUPLICATE_ID');
  const collision = connectedScene();
  collision.connections[0].id = 'r1';
  fails(collision, 'DUPLICATE_ID');
});

test('unknown apparatus versions and invalid domain parameters are explicit diagnostics', () => {
  const unknown = connectedScene();
  unknown.equipment[0].definitionVersion = 2;
  fails(unknown, 'UNKNOWN_EQUIPMENT_VERSION');
  const badParameter = connectedScene();
  badParameter.equipment[0].parameters.resistanceOhm = '10';
  fails(badParameter, 'INVALID_EQUIPMENT_PARAMETERS');
  badParameter.equipment[0].parameters = { resistanceOhm: -1 };
  fails(badParameter, 'INVALID_EQUIPMENT_PARAMETERS');
  badParameter.equipment[0].parameters = { resistanceOhm: 10, hidden: true };
  fails(badParameter, 'INVALID_EQUIPMENT_PARAMETERS');
});

test('dangling endpoint and missing port are rejected', () => {
  const dangling = connectedScene();
  dangling.connections[0].to.equipmentId = 'absent';
  fails(dangling, 'DANGLING_ENDPOINT');
  const missingPort = connectedScene();
  missingPort.connections[0].from.portId = 'absent';
  fails(missingPort, 'UNKNOWN_PORT');
});

test('wire cannot connect an optical mount; rope is disabled even if both endpoint IDs exist', () => {
  const registry = fixtureRegistry();
  const optical = definition();
  optical.type = 'test.optical';
  optical.domain = 'optical';
  optical.ports[0].kind = 'optical-mount';
  registry.register(optical);
  const scene = connectedScene();
  scene.equipment[1].type = 'test.optical';
  fails(scene, 'INCOMPATIBLE_PORT', registry);
  scene.connections[0].kind = 'rope';
  fails(scene, 'UNSUPPORTED_CONNECTION_KIND', registry);
});

test('manual input retains original text and separate validated SI value', () => {
  const scene = connectedScene();
  scene.measurementRecords = [measurement(scene)];
  const result = validateSceneDocument(scene, fixtureRegistry());
  assert.equal(result.ok, true);
  assert.equal(result.document.measurementRecords[0].rawInput, ' 0.10 ');
  assert.equal(result.document.measurementRecords[0].value, 0.1);
  assert.notEqual(result.document.simulationConfig, result.document.measurementRecords[0].modelConfigSnapshot);
});

test('invalid readings carry null; non-steady readings can retain their explicit value', () => {
  const scene = connectedScene();
  scene.measurementRecords = [{ ...measurement(scene), measurementStatus: 'over-range', value: null }];
  assert.equal(validateSceneDocument(scene, fixtureRegistry()).ok, true);
  scene.measurementRecords[0].value = 0.1;
  fails(scene, 'SCHEMA_INVALID');
  scene.measurementRecords[0].measurementStatus = 'non-steady';
  assert.equal(validateSceneDocument(scene, fixtureRegistry()).ok, true);
});

test('measurements reject dimension mismatch, missing manual text, reversed range and broken references', () => {
  const scene = connectedScene();
  for (const patch of [{ unit: 'm' }, { rawInput: null }, { range: { min: 1, max: 0, resolution: 0.1 } }, { value: null }]) {
    scene.measurementRecords = [{ ...measurement(scene), ...patch }];
    fails(scene, 'SCHEMA_INVALID');
  }
  scene.measurementRecords = [{ ...measurement(scene), equipmentId: 'gone' }];
  fails(scene, 'DANGLING_MEASUREMENT');
  scene.measurementRecords = [{ ...measurement(scene), documentRevision: 1 }];
  fails(scene, 'FUTURE_MEASUREMENT_REVISION');
});

test('pending textbook metadata stays null and cannot claim verified without review evidence', () => {
  const scene = connectedScene();
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022',
    topic: '电学实验与测量', clause: null }, textbookMappings: [{ publisher: '人民教育出版社',
    edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  assert.equal(validateSceneDocument(scene, fixtureRegistry()).ok, true);
  scene.curriculumRef.textbookMappings[0].status = 'verified';
  fails(scene, 'SCHEMA_INVALID');
});

test('document limits, seed bounds, invalid error configuration and unsafe parameter keys are rejected', () => {
  const scene = connectedScene();
  scene.equipment = Array.from({ length: 201 }, (_, i) => ({ ...scene.equipment[0], id: `r${i}` }));
  fails(scene, 'SCHEMA_INVALID');
  const config = connectedScene();
  config.simulationConfig.randomError.seed = -1;
  fails(config, 'SCHEMA_INVALID');
  config.simulationConfig.randomError.seed = 0;
  config.simulationConfig.randomError.enabled = true;
  fails(config, 'SCHEMA_INVALID');
  const unsafe = connectedScene();
  unsafe.equipment[0].parameters = JSON.parse('{"constructor": 1}');
  fails(unsafe, 'SCHEMA_INVALID');
  assert.equal(SceneDocumentSchema.safeParse({ ...connectedScene(), equipment: [{ ...connectedScene().equipment[0], extra: 1 }] }).success, false);
});
