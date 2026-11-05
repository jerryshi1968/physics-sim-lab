import { createEmptyScene } from '../src/core/scene/create.ts';
import { createElectricalRegistry, POWER, RESISTOR } from '../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../src/equipment/electrical/dcAdapters.ts';
import { solveDcScene } from '../src/core/electrical/compile.ts';
import { solveDcNetlist } from '../src/core/electrical/solve.ts';

const registry = createElectricalRegistry();
const adapters = createDcModelAdapters();
function scene(parallel) {
  const document = createEmptyScene('dc.demo', '2026-11-04T00:00:00.000Z');
  document.equipment = [
    { id: 'E', type: POWER, parameters: { voltageV: 3 } },
    { id: 'R1', type: RESISTOR, parameters: { resistanceOhm: 10 } },
    { id: 'R2', type: RESISTOR, parameters: { resistanceOhm: 20 } },
  ].map((item, index) => ({ ...item, definitionVersion: 1, pose: { xM: index * .2, yM: 0, rotationRad: 0 } }));
  const pairs = parallel ? [['E', 'positive', 'R1', 'a'], ['E', 'positive', 'R2', 'a'], ['R1', 'b', 'E', 'negative'], ['R2', 'b', 'E', 'negative']]
    : [['E', 'positive', 'R1', 'a'], ['R1', 'b', 'R2', 'a'], ['R2', 'b', 'E', 'negative']];
  document.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `wire-${index}`, kind: 'wire', from: { equipmentId: a, portId: ap }, to: { equipmentId: b, portId: bp } }));
  return document;
}
const short = { terminals: ['p', 'n'], branches: [
  { id: 'E', kind: 'voltage-source', from: 'p', to: 'n', voltageV: 3, resistanceOhm: 0 },
  { id: 'short', kind: 'wire', from: 'p', to: 'n', resistanceOhm: 0 },
] };
const output = { series: solveDcScene(scene(false), registry, adapters), parallel: solveDcScene(scene(true), registry, adapters),
  idealShort: solveDcNetlist(short), finiteShort: solveDcNetlist({ ...short, branches: [{ ...short.branches[0], resistanceOhm: .5 }, short.branches[1]] }) };
console.log(JSON.stringify(output, null, 2));
if (!output.series.ok || !output.parallel.ok || output.idealShort.ok || !output.finiteShort.ok) process.exitCode = 1;
