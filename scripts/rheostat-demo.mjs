import { createEmptyScene } from '../src/core/scene/create.ts';
import { createElectricalRegistry, POWER, RESISTOR, RHEOSTAT } from '../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../src/equipment/electrical/dcAdapters.ts';
import { solveDcScene } from '../src/core/electrical/compile.ts';

const registry = createElectricalRegistry(), adapters = createDcModelAdapters();
function circuit(from, to, position) {
  const scene = createEmptyScene('rheostat.demo', '2026-11-04T00:00:00.000Z');
  scene.equipment = [[POWER, 'E'], [RESISTOR, 'R'], [RHEOSTAT, 'RH']].map(([type, id], index) => ({
    id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: index * .2, yM: 0, rotationRad: 0 },
  }));
  scene.equipment[0].parameters.voltageV = 6; scene.equipment[2].parameters.position = position;
  scene.connections = [['E', 'positive', 'R', 'a'], ['R', 'b', 'RH', from], ['RH', to, 'E', 'negative']].map(([a, ap, b, bp], index) => ({
    id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp },
  }));
  return scene;
}
function describe(scene) {
  const result = solveDcScene(scene, registry, adapters);
  if (!result.ok) { process.exitCode = 1; return result; }
  const load = result.solution.branches.find(branch => branch.id === 'R');
  return { currentA: load.currentA, loadVoltageV: load.voltageV, residuals: result.solution.residuals };
}
const series = ['a-c', 'b-d', 'a-b', 'c-d'].map(pair => ({ pair, readings: [0, .5, 1].map(position => ({ position, ...describe(circuit(...pair.split('-'), position)) })) }));
const divider = circuit('a', 'b', .25);
divider.connections = [['E', 'positive', 'RH', 'a'], ['RH', 'b', 'E', 'negative'], ['RH', 'c', 'R', 'a'], ['R', 'b', 'RH', 'b']].map(([a, ap, b, bp], index) => ({
  id: `w${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp },
}));
console.log(JSON.stringify({ sourceVoltageV: 6, loadResistanceOhm: 10, maxResistanceOhm: 20, series, loadedDivider: describe(divider) }, null, 2));
