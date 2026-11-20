import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { advanceTwoForce, startTwoForce, twoForceDynamics, twoForceRig, twoForceView } from '../../equipment/twoForce/simulate.ts';
import type { TwoForceRun } from '../../equipment/twoForce/simulate.ts';
export function useTwoForce(scene: SceneDocument, registry: EquipmentRegistry, enabled: boolean) {
  const rig = twoForceRig(scene, registry), signature = enabled && rig.ok ? rig.signature : '';
  const [stored, setStored] = useState<TwoForceRun | null>(null), [active, setActive] = useState(''), [rate, setRate] = useState(1), context = useRef({ signature, rate });
  useLayoutEffect(() => { context.current = { signature, rate }; });
  const run = stored?.signature === signature && signature ? stored : null, running = !!run && !run.reason && active === run.id;
  useEffect(() => {
    if (!running) return;
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => { if (previous !== null) { const dt = Math.max(0, Math.min(.1, (now - previous) / 1000)) * context.current.rate; setStored(current => current?.signature === context.current.signature ? advanceTwoForce(current, dt) : current); } previous = now; frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [running]);
  const release = () => { if (!enabled || !rig.ok) return; const next = startTwoForce(rig, crypto.randomUUID()); setStored(next); setActive(next.id); };
  return { rig, run, running, rate, setRate, release, reset: () => { setStored(null); setActive(''); }, pause: () => setActive(''), resume: () => { if (run && !run.reason) setActive(run.id); }, step: () => { if (!enabled || !rig.ok) return; setActive(''); setStored(current => advanceTwoForce(current?.signature === signature ? current : startTwoForce(rig, crypto.randomUUID()), .1)); }, viewScene: twoForceView(scene, rig, run), sample: rig.ok ? twoForceDynamics(rig, run?.state ?? rig.state) : null, displayS: Number((run?.timeS ?? 0).toFixed(3)) };
}
export type TwoForceSimulation = ReturnType<typeof useTwoForce>;
