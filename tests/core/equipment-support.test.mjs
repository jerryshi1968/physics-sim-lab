import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';
import { equipmentSupport, equipmentAvailability } from '../../src/equipment/support.ts';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { simulateLever } from '../../src/equipment/mechanical/simulate.ts';

const registry = createWorkbenchRegistry(), time = '2026-11-11T08:00:00.000Z';
function sceneFor(id) { const scene = createEmptyScene('support-audit', time); scene.experimentId = id; return scene; }
function add(scene, type) { scene.equipment.push({ id: `item-${scene.equipment.length}`, type, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { ...registry.get(type, 1).defaultParameters } }); }

test('formal blank experiments keep their own apparatus and reject the reported cross-experiment selections', () => {
  const examples = [
    ['J-MECH-03', 'mechanical.force-meter', 'mechanical.spring'],
    ['H-MECH-02', 'mechanical.projectile-scale', 'mechanical.density-balance'],
    ['J-MECH-02', 'mechanical.weights', 'mechanical.friction-block'],
    ['J-MECH-01', 'mechanical.friction-load', 'mechanical.lever'],
    ['H-MECH-01', 'mechanical.spring', 'mechanical.force-meter'],
    ['H-MECH-03', 'mechanical.cart-photogate', 'mechanical.weights'],
    ['J-MEAS-01', 'mechanical.density-beaker', 'mechanical.ruler'],
    ['J-MEAS-01-L', 'mechanical.density-specimen', 'mechanical.buoyancy-body'],
    ['J-OPT-01', 'optical.protractor', 'optical.ruler'],
    ['J-OPT-02', 'optical.ruler', 'optical.plane-mirror'],
    ['J-OPT-03', 'optical.screen', 'optical.convex-lens'],
    ['J-ELEC-01', 'electrical.wire', 'mechanical.force-meter'],
  ];
  for (const [id, supported, unsupported] of examples) {
    const scene = sceneFor(id), before = structuredClone(scene);
    assert.equal(equipmentAvailability(scene, supported).enabled, true, `${id} ${supported}`);
    const result = equipmentAvailability(scene, unsupported);
    assert.equal(result.enabled, false, `${id} ${unsupported}`);
    assert.ok(result.reason.includes('暂不支持'));
    assert.deepEqual(scene, before);
  }
});

test('quantity limits release after removal and never affect repeatable rulers, loads or wires', () => {
  const limits = [
    ['J-MECH-03', 'mechanical.force-meter', 1], ['J-MECH-03', 'mechanical.support', 1],
    ['J-MECH-02', 'mechanical.lever', 1], ['J-MECH-01', 'mechanical.friction-block', 1],
    ['H-MECH-01', 'mechanical.spring', 1], ['H-MECH-02', 'mechanical.projectile-ball', 1],
    ['H-MECH-03', 'mechanical.cart-photogate', 6], ['H-MECH-03', 'mechanical.cart-ticker', 1],
    ['J-MEAS-01', 'mechanical.density-beaker', 1], ['J-MEAS-01-L', 'mechanical.density-cylinder', 1],
    ['J-OPT-01', 'optical.plane-mirror', 1], ['J-OPT-02', 'optical.convex-lens', 1],
    ['J-OPT-03', 'optical.observation-eye', 1],
  ];
  for (const [id, type, maximum] of limits) {
    const scene = sceneFor(id);
    for (let index = 0; index < maximum; index++) { assert.equal(equipmentAvailability(scene, type).enabled, true); add(scene, type); }
    assert.match(equipmentAvailability(scene, type).reason, /已达上限/);
    scene.equipment.pop(); assert.equal(equipmentAvailability(scene, type).enabled, true);
  }
  for (const [id, type] of [['J-MECH-02', 'mechanical.weights'], ['H-MECH-01', 'mechanical.ruler'], ['J-OPT-03', 'optical.ruler'], ['J-ELEC-01', 'electrical.resistor']]) {
    const scene = sceneFor(id); for (let index = 0; index < 10; index++) add(scene, type);
    assert.equal(equipmentAvailability(scene, type).enabled, true);
  }
  assert.equal(equipmentAvailability(sceneFor('J-ELEC-01'), 'electrical.wire').enabled, true);
});

test('unassigned empty work starts in any domain and an imported incompatible scene is not silently rewritten', () => {
  const scene = createEmptyScene('unassigned', time);
  assert.equal(equipmentSupport(scene), null);
  for (const item of registry.list()) assert.equal(equipmentAvailability(scene, item.type).enabled, true);
  assert.equal(equipmentAvailability(scene, 'unknown.equipment').enabled, false);
  add(scene, 'mechanical.cart'); assert.equal(equipmentSupport(scene).key, 'cart');
  assert.equal(equipmentAvailability(scene, 'mechanical.cart-track').enabled, true);
  const formal = sceneFor('J-MECH-02'); add(formal, 'mechanical.spring');
  const before = structuredClone(formal);
  assert.equal(equipmentSupport(formal).key, 'lever');
  assert.equal(equipmentAvailability(formal, 'mechanical.spring').enabled, false);
  assert.deepEqual(formal, before);
});

test('lever calculation rejects unhandled imported apparatus instead of silently ignoring it', () => {
  const scene = createLeverExperiment('lever-support', time);
  assert.equal(simulateLever(scene, registry).ok, true);
  add(scene, 'mechanical.friction-load');
  assert.equal(simulateLever(scene, registry).code, 'LEVER_MIXED_DOMAIN');
});
