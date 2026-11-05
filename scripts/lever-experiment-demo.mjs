import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { createLeverExperiment } from '../src/experiments/lever.ts';
import { leverZeroReference, simulateLever } from '../src/equipment/mechanical/simulate.ts';

const registry = createWorkbenchRegistry();
function demo(mode) {
  const scene = createLeverExperiment(`demo-${mode}`, '2026-11-04T08:00:00.000Z'), lever = scene.equipment.find(item => item.id === 'lever');
  lever.parameters.leftNutOffsetM = .024; lever.parameters.rightNutOffsetM = .02; lever.parameters.zeroReference = leverZeroReference(scene, lever);
  Object.assign(scene.equipment.find(item => item.id === 'left').parameters, { leverId: 'lever', hookIndex: -4 });
  const target = scene.equipment.find(item => item.id === (mode === 'weights' ? 'right' : 'meter'));
  Object.assign(target.parameters, { leverId: 'lever', hookIndex: 2 }, mode === 'weights' ? { massKg: .2 } : { forceN: mode === 'inclined' ? 4 : 2, directionDeg: mode === 'inclined' ? -30 : mode === 'zero-arm' ? 0 : -90 });
  const outcome = simulateLever(scene, registry);
  if (!outcome.ok) return outcome;
  return { balanced: outcome.balanced, calibrated: outcome.calibrated, totalTorqueNm: outcome.totalTorqueNm, reactionN: outcome.reactionN, loads: outcome.loads, meters: outcome.meters, target: outcome.target };
}
process.stdout.write(JSON.stringify(Object.fromEntries(['weights', 'vertical', 'inclined', 'zero-arm'].map(mode => [mode, demo(mode)])), null, 2) + '\n');
