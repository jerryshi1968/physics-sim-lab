import { createLampCircuitExperiment, lampCircuitStarts } from '../src/experiments/lamp-circuits.ts';
import { simulateElectrical } from '../src/equipment/electrical/simulate.ts';

const output = lampCircuitStarts.slice(1).map(start => {
  const scene = createLampCircuitExperiment(`demo.${start.id}`, '2026-11-04T00:00:00.000Z', start.id);
  scene.equipment.find(item => item.id === 'S').parameters.closed = true;
  const outcome = simulateElectrical(scene);
  if (!outcome.result.ok) { process.exitCode = 1; return { start: start.id, result: outcome.result }; }
  return { start: start.id, documentId: scene.documentId, sourceVoltageV: scene.equipment[0].parameters.voltageV,
    lamps: outcome.result.solution.branches.filter(item => ['L1', 'L2'].includes(item.id)), meters: outcome.meters,
    residuals: outcome.result.solution.residuals, curriculumStatus: scene.curriculumRef.textbookMappings[0].status };
});
console.log(JSON.stringify(output, null, 2));
