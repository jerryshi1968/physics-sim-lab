import { useEffect, useMemo, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { cartSignature, cartView, compileCart } from '../../equipment/cart/simulate.ts';
import type { CartRun } from '../../equipment/cart/simulate.ts';

export function useCartSimulation(scene: SceneDocument, registry: EquipmentRegistry, enabled: boolean) {
  const rig = useMemo(() => enabled ? compileCart(scene, registry) : null, [enabled, registry, scene]);
  const signature = enabled ? cartSignature(scene) : '';
  const [stored, setRun] = useState<CartRun | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const run = stored && stored.signature === signature ? stored : null;
  if (stored && !run) setRun(null);
  const running = !!run && run.id === runningId && run.timeS < run.rig.endTimeS;
  const id = run?.id;

  useEffect(() => {
    if (!running) return;
    let handle = 0, previous: number | undefined;
    function tick(now: number) {
      const elapsed = previous === undefined ? 0 : (now - previous) / 2000;
      previous = now;
      if (elapsed > 0) setRun(current => current && current.id === id ? { ...current, timeS: Math.min(current.rig.endTimeS, current.timeS + elapsed) } : current);
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [id, running]);

  function release() {
    if (!rig?.ok) return;
    const id = `cart-${crypto.randomUUID()}`;
    setRun({ rig, id, signature, timeS: 0 });
    setRunningId(id);
  }

  function step() {
    if (!run) return;
    setRunningId(null);
    const dt = run.rig.ticker ? 1 / Number(run.rig.ticker.parameters.frequencyHz) : .02;
    setRun({ ...run, timeS: Math.min(run.rig.endTimeS, run.timeS + dt) });
  }

  return { rig, run, running, viewScene: cartView(scene, run), release, step, pause: () => setRunningId(null),
    resume: () => setRunningId(run?.id ?? null), reset: () => { setRun(null); setRunningId(null); } };
}

export type CartSimulation = ReturnType<typeof useCartSimulation>;
