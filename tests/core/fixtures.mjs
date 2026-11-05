import { z } from 'zod';
import { EquipmentRegistry } from '../../src/core/equipment/registry.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';

export const timestamp = '2026-11-03T08:00:00.000Z';

export function definition() {
  return {
    type: 'test.resistor', definitionVersion: 1, label: '测试电阻', domain: 'electrical',
    ports: [
      { id: 'a', kind: 'electrical-terminal', localPositionM: { x: -0.02, y: 0 } },
      { id: 'b', kind: 'electrical-terminal', localPositionM: { x: 0.02, y: 0 } },
    ],
    parameterSchemaId: 'test.resistor.parameters.v1', modelAdapterId: 'test.resistor.model.v1',
    viewId: 'test.resistor.view.v1', defaultParameters: { resistanceOhm: 10 },
  };
}

export function fixtureRegistry() {
  const registry = new EquipmentRegistry();
  registry.registerParameterSchema('test.resistor.parameters.v1', z.strictObject({ resistanceOhm: z.number().finite().positive() }));
  registry.register(definition());
  return registry;
}

export function connectedScene() {
  const document = createEmptyScene('test.scene', timestamp);
  document.equipment = ['r1', 'r2'].map(id => ({ id, type: 'test.resistor', definitionVersion: 1,
    pose: { xM: id === 'r1' ? 0 : 0.2, yM: 0, rotationRad: 0 }, parameters: { resistanceOhm: 10 } }));
  document.connections = [{ id: 'w1', kind: 'wire', from: { equipmentId: 'r1', portId: 'b' },
    to: { equipmentId: 'r2', portId: 'a' }, routeWorldM: [{ x: 0.1, y: 0.05 }] }];
  return document;
}

export function measurement(document) {
  return {
    id: 'measurement.1', source: 'manual', quantity: 'current', unit: 'A', value: 0.1, rawInput: ' 0.10 ',
    equipmentId: 'r1', range: { min: 0, max: 0.6, resolution: 0.02 }, measurementStatus: 'valid',
    recordedAt: timestamp, documentRevision: 0, runId: 'run.1', sequence: 0,
    modelConfigSnapshot: structuredClone(document.simulationConfig),
  };
}
