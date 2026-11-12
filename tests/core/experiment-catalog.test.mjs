import test from 'node:test';
import assert from 'node:assert/strict';
import { experimentChoices, createCatalogExperiment, fitCatalogViewport } from '../../src/experiments/catalog.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentSupport, equipmentAvailability, FREE_OPTICAL_EXPERIMENT } from '../../src/equipment/support.ts';
import { validateSceneDocument } from '../../src/core/scene/validate.ts';
import { serializeScene, parseSceneJson } from '../../src/core/scene/transfer.ts';
import { createHistory, executeCommand, travelHistory } from '../../src/core/workbench/history.ts';
import { MIRROR, PAPER, EMITTER } from '../../src/equipment/reflection/definitions.ts';
import { LENS, RULER, SCREEN } from '../../src/equipment/optical/definitions.ts';
import { TARGET } from '../../src/equipment/mirrorImage/definitions.ts';
import { POWER, RESISTOR } from '../../src/equipment/electrical/definitions.ts';
import { simulateReflection } from '../../src/equipment/reflection/simulate.ts';
import { createReflectionExperiment } from '../../src/experiments/reflection.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-12T00:00:00.000Z';
const create = choice => createCatalogExperiment(choice, `catalog.${choice}`, time);
const add = (scene, type) => scene.equipment.push({ id: `equipment.${scene.equipment.length}`, type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { ...registry.get(type, 1).defaultParameters } });

test('catalogue contains exactly 34 distinct options in the requested stage/domain distribution', () => {
  assert.equal(experimentChoices.length, 34); assert.equal(new Set(experimentChoices.map(choice => choice.id)).size, 34);
  assert.equal(experimentChoices.some(choice => choice.id === 'ohm-blank'), false);
  assert.equal(experimentChoices.filter(choice => choice.stage === 'junior' && choice.domain === 'electrical' && choice.id.endsWith('-blank')).length, 1);
  for (const [stage, domain, count] of [['junior', 'mechanical', 10], ['junior', 'electrical', 8], ['junior', 'optical', 4], ['senior', 'mechanical', 8], ['senior', 'electrical', 4], ['senior', 'optical', 0]]) assert.equal(experimentChoices.filter(choice => choice.stage === stage && choice.domain === domain).length, count);
});

test('every catalogue option produces an independent valid pending-review scene and round trips its actual apparatus', () => {
  for (const choice of experimentChoices) {
    const scene = create(choice.id), fresh = create(choice.id);
    assert.equal(scene.title, choice.title); assert.equal(scene.curriculumRef.stage, choice.stage); assert.deepEqual(scene.measurementRecords, []);
    assert.equal(scene.curriculumRef.textbookMappings[0].status, 'pending_teacher_review'); assert.equal(validateSceneDocument(scene, registry).ok, true, choice.id);
    assert.deepEqual(parseSceneJson(serializeScene(scene, registry), registry).document, scene);
    if (choice.id.endsWith('-blank')) assert.equal(scene.equipment.length, 0, choice.id);
    if (scene.equipment.length) { scene.equipment[0].pose.xM = 99; assert.notEqual(fresh.equipment[0].pose.xM, 99); }
  }
  assert.throws(() => create('missing'), /UNKNOWN_EXPERIMENT_CHOICE/);
});

test('density starts keep the requested samples separate and liquid starts with an empty cylinder', () => {
  const solid = create('density-solid'), liquid = create('density-liquid');
  assert.equal(solid.equipment.some(item => item.type === 'mechanical.density-beaker'), false);
  assert.equal(liquid.equipment.some(item => item.type === 'mechanical.density-specimen'), false);
  assert.equal(liquid.equipment.find(item => item.type === 'mechanical.density-cylinder').parameters.liquidM3, 0);
  assert.equal(solid.equipment.find(item => item.type === 'mechanical.density-cylinder').parameters.liquidM3, .00005);
});

test('school-specific electrical blanks remain general circuits without binding to lamp or EMF record flows', () => {
  const junior = create('electrical-blank'), senior = create('current-blank');
  assert.equal(junior.experimentId, 'J-ELEC-FREE'); assert.equal(senior.experimentId, 'H-ELEC-FREE');
  for (const scene of [junior, senior]) {
    assert.equal(equipmentSupport(scene).key, 'electrical'); assert.equal(scene.equipment.length, 0);
    for (const type of [POWER, RESISTOR, 'electrical.ammeter', 'electrical.voltmeter', 'electrical.rheostat']) assert.equal(equipmentAvailability(scene, type).enabled, true);
    assert.equal(equipmentAvailability(scene, LENS).enabled, false);
  }
  const source = create('emf-inner').equipment.find(item => item.type === POWER); assert.equal(source.parameters.internalResistanceOhm, 2);
  assert.equal(create('emf-reference').equipment.find(item => item.type === 'electrical.voltmeter').parameters.finiteInput, false);
});

test('free optics delays a single model choice for common items, then honors the first incompatible apparatus', () => {
  const scene = create('optical-blank'); assert.equal(scene.experimentId, FREE_OPTICAL_EXPERIMENT); assert.equal(scene.viewport.centerXM, 0);
  assert.equal(equipmentSupport(scene).key, 'opticalFree'); add(scene, RULER); assert.equal(equipmentSupport(scene).key, 'opticalFree');
  add(scene, MIRROR); assert.equal(equipmentSupport(scene).key, 'opticalFree'); assert.equal(equipmentAvailability(scene, LENS).enabled, false);
  assert.equal(equipmentAvailability(scene, PAPER).enabled, true); assert.equal(equipmentAvailability(scene, TARGET).enabled, true);
  add(scene, PAPER); assert.equal(equipmentSupport(scene).key, 'reflection'); assert.equal(equipmentAvailability(scene, TARGET).enabled, false);
  scene.equipment.pop(); add(scene, TARGET); assert.equal(equipmentSupport(scene).key, 'mirrorImage'); assert.equal(equipmentAvailability(scene, PAPER).enabled, false);
  const lens = create('optical-blank'); add(lens, LENS); assert.equal(equipmentSupport(lens).key, 'optical'); assert.equal(equipmentAvailability(lens, MIRROR).enabled, false);
  const screen = create('optical-blank'); add(screen, SCREEN); assert.equal(equipmentSupport(screen).key, 'opticalFree'); add(screen, MIRROR); assert.equal(equipmentSupport(screen).key, 'mirrorImage');
});

test('free optical identity, conflict rules, removal and undo remain consistent after JSON save/reload', () => {
  const scene = create('optical-blank'); add(scene, LENS);
  let history = createHistory(scene);
  const removed = executeCommand(history, { type: 'remove-equipment', id: scene.equipment[0].id }, registry, time);
  assert.equal(removed.ok, true); history = removed.history; assert.equal(equipmentSupport(history.present).key, 'opticalFree');
  const undone = travelHistory(history, 'undo', registry, time).history; assert.equal(undone.present.experimentId, FREE_OPTICAL_EXPERIMENT); assert.equal(equipmentSupport(undone.present).key, 'optical');
  const loaded = parseSceneJson(serializeScene(undone.present, registry), registry).document; assert.equal(equipmentAvailability(loaded, MIRROR).enabled, false);
  add(loaded, MIRROR); assert.equal(equipmentSupport(loaded).key, 'opticalFree'); assert.equal(equipmentAvailability(loaded, LENS).enabled, false);
});

test('an independent ruler is a passive tool in free reflection without altering reflection physics', () => {
  const scene = createReflectionExperiment('reflection-with-ruler', time), emitter = scene.equipment.find(item => item.type === EMITTER);
  emitter.pose = { xM: -.24, yM: .24 * Math.sqrt(3), rotationRad: -Math.PI / 3 };
  const reference = simulateReflection(scene, registry); assert.equal(reference.ok, true);
  scene.experimentId = FREE_OPTICAL_EXPERIMENT; add(scene, RULER);
  assert.equal(equipmentSupport(scene).key, 'reflection'); assert.deepEqual(simulateReflection(scene, registry), reference);
  assert.equal(parseSceneJson(serializeScene(scene, registry), registry).ok, true);
});

test('catalogue viewport fitting preserves the established mobile scale and short-window cart/buoyancy fitting', () => {
  for (const [id, scale] of [['lens', 240], ['emf-inner', 260], ['ohm-voltage', 260], ['spring', 360], ['friction', 180], ['current-blank', 320], ['projectile', 128]]) {
    const scene = create(id), before = structuredClone(scene.equipment); fitCatalogViewport(scene, experimentChoices.find(choice => choice.id === id), 390, 844); assert.equal(scene.viewport.pixelsPerM, scale); assert.deepEqual(scene.equipment, before);
  }
  const cart = create('cart'); fitCatalogViewport(cart, experimentChoices.find(choice => choice.id === 'cart'), 1440, 768); assert.equal(cart.viewport.pixelsPerM, 130);
});
