import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advanceThermal, thermalInitial, thermalReading, thermalRig } from '../../equipment/thermal/simulate.ts';
import type { ThermalState } from '../../equipment/thermal/simulate.ts';

interface Run { signature: string; id: string; state: ThermalState; heating: boolean; running: boolean }
function advanceRun(current: Run, rig: ReturnType<typeof thermalRig>, dt: number): Run {
  const next = advanceThermal(current.state, rig.config, current.heating && rig.contact, Math.max(0, Math.min(dt, 7200 - current.state.timeS)));
  return { ...current, state: next, running: current.running && next.massKg > 0 && next.timeS < 7200, heating: current.heating && next.massKg > 0 };
}
export function useThermalSimulation(scene: SceneDocument, enabled: boolean) {
  const rig = thermalRig(scene), signature = enabled && rig.ok ? rig.signature : '';
  const [cycleId, setCycleId] = useState(() => crypto.randomUUID());
  const [stored, setStored] = useState<Run | null>(null), [rate, setRate] = useState(20), [stepS, setStepS] = useState(30);
  const state = stored?.signature === signature ? stored.state : rig.ok ? thermalInitial(rig.config) : { timeS: 0, temperatureK: 293.15, massKg: 0 };
  const heating = stored?.signature === signature && stored.heating && state.massKg > 0;
  const running = !!signature && stored?.signature === signature && stored.running && state.massKg > 0 && state.timeS < 7200;
  const context = useRef({ rig, signature, rate });
  useLayoutEffect(() => { context.current = { rig, signature, rate }; });
  useEffect(() => {
    if (!running) return;
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => {
      if (previous !== null) {
        const dt = Math.max(0, Math.min(.1, (now - previous) / 1000)) * context.current.rate;
        setStored(current => current?.signature === context.current.signature ? advanceRun(current, context.current.rig, dt) : current);
      }
      previous = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  const change = (update: (run: Run) => Run) => {
    if (!signature) return;
    setStored(current => update(current?.signature === signature ? current : { signature, id: cycleId, state: thermalInitial(rig.config), heating: false, running: false }));
  };
  const resolution = Number(rig.timer?.parameters.resolutionS ?? .1), displayS = Number((Math.round(state.timeS / resolution) * resolution).toPrecision(12));
  return { rig, state, heating, running, rate, setRate, stepS, setStepS, displayS, clockText: displayS.toFixed(Math.max(0, Math.min(4, Math.ceil(-Math.log10(resolution))))), reading: thermalReading(rig, state), seriesId: stored?.signature === signature ? stored.id : cycleId,
    heat: () => change(current => ({ ...current, heating: !current.heating, running: true })),
    pause: () => change(current => ({ ...current, running: false })),
    resume: () => change(current => ({ ...current, running: true })),
    step: () => change(current => advanceRun({ ...current, running: false }, rig, stepS)),
    reset: () => { setStored(null); setCycleId(crypto.randomUUID()); },
  };
}
export type ThermalSimulation = ReturnType<typeof useThermalSimulation>;
