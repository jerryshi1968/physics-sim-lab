import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { createOpticalExperiment } from '../src/experiments/optical-bench.ts';
import { simulateOptical } from '../src/equipment/optical/simulate.ts';

const registry = createWorkbenchRegistry();
function run(u, s) {
  const scene = createOpticalExperiment('optical.demo', '2026-11-04T00:00:00.000Z');
  scene.equipment.find(item => item.id === 'candle').pose.xM = .5 - u;
  scene.equipment.find(item => item.id === 'lens').pose.yM = .06;
  scene.equipment.find(item => item.id === 'screen').pose.xM = .5 + s;
  const result = simulateOptical(scene, registry);
  if (!result.ok) { process.exitCode = 1; return result; }
  return { uM: result.objectDistanceM, screenDistanceM: result.screenDistanceM, image: result.image, spotRadiusM: result.spotRadiusM,
    sharpness: result.sharpness, capturedFraction: result.capturedFraction, screenStatus: result.screenStatus, rayCount: result.rays.length, imageInBench: result.imageInBench };
}
console.log(JSON.stringify({ fiveCases: [[.3, .15], [.2, .2], [.15, .3], [.1, .2], [.05, .2]].map(([u, s]) => run(u, s)),
  defocus: [.12, .15, .18].map(s => run(.3, s)) }, null, 2));
