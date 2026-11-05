import { createProjectileExperiment } from '../src/experiments/projectile.ts';
import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { beginProjectileFlight,projectileAt } from '../src/equipment/projectile/simulate.ts';
const registry=createWorkbenchRegistry(),scene=createProjectileExperiment('projectile-demo','2026-11-05T03:00:00.000Z'),launch=beginProjectileFlight(scene,registry,'projectile-demo-run');
if(!launch.ok)throw new Error(launch.code);
const rows=[.1,.2,.3,.5,.73].map(t=>{const sample=projectileAt(launch.flight,t);if(!sample.ok)throw new Error(sample.code);return{requestedTimeS:t,...sample.flight.point};});
console.log(JSON.stringify({kind:'calculated_demo_not_student_measurements',rows},null,2));
