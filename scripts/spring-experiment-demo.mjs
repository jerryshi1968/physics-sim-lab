import { createSpringExperiment } from '../src/experiments/spring.ts';
import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { springSample } from '../src/equipment/spring/simulate.ts';
const registry = createWorkbenchRegistry(), rows = [];
for (const massKg of [0, .025, .05, .075, .1]) {
  const scene = createSpringExperiment('spring-demo', '2026-11-05T02:00:00.000Z');
  const weight = scene.equipment.find(item => item.id === 'weight');
  weight.parameters.springId = massKg ? 'spring' : ''; if (massKg) weight.parameters.massKg = massKg;
  const result = springSample(scene, registry);
  rows.push({ massKg, result: result.ok ? result.value : result.code });
}
console.log(JSON.stringify({ kind: 'calculated_demo_not_student_measurements', rows }, null, 2));
