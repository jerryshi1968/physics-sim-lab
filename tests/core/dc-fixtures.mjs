import { createEmptyScene } from '../../src/core/scene/create.ts';
import { POWER, RESISTOR, SWITCH } from '../../src/equipment/electrical/definitions.ts';

export const source = (id = 'E', from = 'p', to = 'n', voltageV = 3, resistanceOhm = 0) => ({ id, kind: 'voltage-source', from, to, voltageV, resistanceOhm });
export const resistor = (id, from, to, resistanceOhm) => ({ id, kind: 'resistor', from, to, resistanceOhm });
export const wire = (id, from, to, resistanceOhm = 0) => ({ id, kind: 'wire', from, to, resistanceOhm });
export const meter = (id, from, to, resistanceOhm = 0) => ({ id, kind: 'current-meter', from, to, resistanceOhm });
export const probe = (id, from, to, inputResistanceOhm = null) => ({ id, kind: 'voltage-probe', from, to, inputResistanceOhm });
export const network = (...branches) => ({ terminals: [...new Set(branches.flatMap(branch => [branch.from, branch.to]))], branches });

export function linearScene(parallel = false) {
  const scene = createEmptyScene('dc.scene', '2026-11-04T01:00:00.000Z');
  scene.equipment = [
    { id: 'E', type: POWER, parameters: { voltageV: 3 } },
    { id: 'R1', type: RESISTOR, parameters: { resistanceOhm: 10 } },
    { id: 'R2', type: RESISTOR, parameters: { resistanceOhm: 20 } },
    { id: 'S', type: SWITCH, parameters: { closed: true } },
  ].map((item, index) => ({ ...item, definitionVersion: 1, pose: { xM: index * .2, yM: 0, rotationRad: 0 } }));
  const pairs = parallel ? [
    ['E', 'positive', 'S', 'a'], ['S', 'b', 'R1', 'a'], ['S', 'b', 'R2', 'a'], ['R1', 'b', 'E', 'negative'], ['R2', 'b', 'E', 'negative'],
  ] : [['E', 'positive', 'R1', 'a'], ['R1', 'b', 'R2', 'a'], ['R2', 'b', 'S', 'a'], ['S', 'b', 'E', 'negative']];
  scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `wire-${index}`, kind: 'wire',
    from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp }, routeWorldM: [{ x: index * .1, y: .2 }] }));
  return scene;
}
