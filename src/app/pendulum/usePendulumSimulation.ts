import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advancePendulum, pendulumAngle, pendulumRig, pendulumViewScene } from '../../equipment/pendulum/simulate.ts';
import type { PendulumRun } from '../../equipment/pendulum/simulate.ts';

export function usePendulumSimulation(scene: SceneDocument, enabled: boolean) {
  const rig = pendulumRig(scene), signature = enabled && rig.ok ? rig.signature : '';
  const [stored, setStored] = useState<PendulumRun | null>(null), [runningSignature, setRunning] = useState(''), [cycles, setCycles] = useState(20), [rate, setRate] = useState(1);
  const context = useRef({ signature, rig, rate });
  useLayoutEffect(() => { context.current = { signature, rig, rate }; });
  const run = stored?.signature === signature && signature ? stored : null, running = !!run && !run.completed && runningSignature === signature;
  useEffect(() => {
    if (!running) return;
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => {
      if (previous !== null) {
        const dt = Math.max(0, Math.min(.1, (now - previous) / 1000)) * context.current.rate;
        setStored(current => current?.signature === context.current.signature ? advancePendulum(current, dt) : current);
      }
      previous = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  const reset = () => { setRunning(''); setStored(null); };
  const release = () => {
    const current = context.current;
    if (!current.signature || !current.rig.ok || !current.rig.timer || Math.abs(current.rig.amplitudeRad) < 1e-10) return;
    setStored({ signature: current.signature, timeS: 0, targetCycles: cycles, periodS: current.rig.periodS, completed: false }); setRunning(current.signature);
  };
  const timeS = run?.timeS ?? 0, resolution = rig.ok && rig.timer ? Number(rig.timer.parameters.resolutionS) : .001;
  const displayS = Number((Math.round(timeS / resolution) * resolution).toPrecision(12));
  return { rig, run, running, cycles, setCycles, rate, setRate, release, reset,
    pause: () => setRunning(''), resume: () => { if (run && !run.completed) setRunning(signature); },
    step: () => { setRunning(''); const delta = rig.ok && rig.timer ? Number(rig.timer.parameters.intervalS) : .1; setStored(current => current?.signature === signature ? advancePendulum(current, delta) : current); },
    viewScene: pendulumViewScene(scene), displayS,
    angleRad: rig.ok ? pendulumAngle(rig.lengthM, rig.gravity, rig.amplitudeRad, timeS) : 0,
    countedCycles: run ? Math.min(run.targetCycles, Math.floor((run.timeS + 1e-10) / run.periodS)) : 0,
  };
}
export type PendulumSimulation = ReturnType<typeof usePendulumSimulation>;
