import { createEmptyScene } from '../src/core/scene/create.ts';
import { createElectricalRegistry, POWER, LAMP, SWITCH, AMMETER, VOLTMETER } from '../src/equipment/electrical/definitions.ts';
import { simulateElectrical } from '../src/equipment/electrical/simulate.ts';

const registry = createElectricalRegistry();
function circuit(parallel) {
  const scene = createEmptyScene('electrical.demo', '2026-11-04T00:00:00.000Z');
  scene.equipment = [[POWER, 'E'], [LAMP, 'L1'], [LAMP, 'L2'], [SWITCH, 'S'], [AMMETER, 'A'], [VOLTMETER, 'V']].map(([type, id], index) => ({
    id, type, definitionVersion: 1, parameters: registry.get(type, 1).defaultParameters, pose: { xM: .2 * index, yM: 0, rotationRad: 0 },
  }));
  scene.equipment[0].parameters.voltageV = parallel ? 3 : 6;
  scene.equipment[3].parameters.closed = true;
  const pairs = parallel ? [
    ['E', 'positive', 'S', 'a'], ['S', 'b', 'A', 'high'], ['A', 'common', 'L1', 'a'], ['A', 'common', 'L2', 'a'], ['L1', 'b', 'E', 'negative'], ['L2', 'b', 'E', 'negative'],
  ] : [
    ['E', 'positive', 'A', 'high'], ['A', 'common', 'L1', 'a'], ['L1', 'b', 'L2', 'a'], ['L2', 'b', 'S', 'a'], ['S', 'b', 'E', 'negative'],
  ];
  pairs.push(['V', 'low', 'L1', 'a'], ['V', 'common', 'L1', 'b']);
  scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `wire-${index}`, kind: 'wire',
    from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  return scene;
}
const series = circuit(false), parallel = circuit(true), different = circuit(false);
different.equipment[0].parameters.voltageV = 28 / 9;
different.equipment[2].parameters = { ratedVoltageV: 2, ratedCurrentA: .2, coldResistanceOhm: 2, maxCurrentA: .9 };
const multiRange = circuit(true);
multiRange.connections.push({ id: 'wrong-range', kind: 'wire', from: { equipmentId: 'A', portId: 'low' }, to: { equipmentId: 'E', portId: 'positive' } });
const output = { series: simulateElectrical(series), parallel: simulateElectrical(parallel), different: simulateElectrical(different),
  nonConvergence: simulateElectrical(series, { maxIterations: 1 }), multiRange: simulateElectrical(multiRange) };
console.log(JSON.stringify(output, null, 2));
if (!output.series.result.ok || !output.parallel.result.ok || !output.different.result.ok || output.nonConvergence.result.ok || output.multiRange.result.ok) process.exitCode = 1;
