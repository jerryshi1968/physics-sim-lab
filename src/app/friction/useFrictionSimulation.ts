import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { compileFriction, frictionSample, frictionView } from '../../equipment/mechanical/frictionScene.ts';
import { BLOCK, DRIVE } from '../../equipment/mechanical/frictionDefinitions.ts';
import { FORCE_METER } from '../../equipment/mechanical/definitions.ts';
import { createFrictionAdapter } from '../../core/mechanical/friction/matterAdapter.ts';
import { initialFrictionMotion, stepFriction } from '../../core/mechanical/friction/model.ts';
import type { FrictionMotion } from '../../core/mechanical/friction/model.ts';

export function useFrictionSimulation(scene: SceneDocument, registry: EquipmentRegistry, enabled: boolean) {
  const manualMeterId = scene.equipment.find(item => item.type === BLOCK && !item.parameters.driverId)?.parameters.meterId;
  const key = enabled ? JSON.stringify([scene.documentId, scene.equipment.map(item => item.type === DRIVE ? { ...item, parameters: { ...item.parameters, mode: null, pullN: null, targetMPerS: null } } : item.type === FORCE_METER && item.id === manualMeterId ? { ...item, parameters: { ...item.parameters, forceN: null, directionDeg: Math.abs(Math.sin(Number(item.parameters.directionDeg) * Math.PI / 180)) < 1e-8 ? 0 : item.parameters.directionDeg } } : item), scene.simulationConfig]) : '';
  const rig = enabled ? compileFriction(scene, registry) : null;
  const context = useRef({ scene, registry, key, rig });
  useLayoutEffect(() => { context.current = { scene, registry, key, rig }; }, [scene, registry, key, rig]);
  const runtime = useRef<{ key: string; state: FrictionMotion; adapter: ReturnType<typeof createFrictionAdapter>; runId: string } | null>(null);
  const [frame, setFrame] = useState<{ key: string; state: FrictionMotion; runId: string; error: string | null } | null>(null), [runningKey, setRunningKey] = useState<string | null>(null);
  useEffect(() => {
    runtime.current?.adapter.dispose(); runtime.current = null;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setFrame(null); setRunningKey(null); } });
    const current = context.current;
    if (current.key && current.rig?.ok) runtime.current = { key: current.key, state: current.rig.initial, adapter: createFrictionAdapter(current.rig), runId: `friction-${crypto.randomUUID()}` };
    return () => { cancelled = true; runtime.current?.adapter.dispose(); runtime.current = null; };
  }, [key]);
  const advance = useCallback((count: number) => {
    const current = context.current, active = runtime.current;
    if (!current.rig?.ok || !active || active.key !== current.key) return;
    let error: string | null = null;
    for (let i = 0; i < count; i++) {
      const next = stepFriction(current.rig.config, active.state, current.rig.dt);
      if (!next.ok) { error = next.code; break; }
      active.state = next.state;
      const sample = frictionSample(current.scene, current.registry, active.state);
      if (!sample.ok) { error = sample.code; break; }
      const synchronized = active.adapter.sync(active.state, current.rig.dt);
      if (!synchronized.ok || Math.abs(synchronized.velocityMPerS - active.state.velocityMPerS) > 1e-8) { error = 'FRICTION_ADAPTER'; break; }
    }
    setFrame({ key: active.key, state: { ...active.state }, runId: active.runId, error });
    if (error) setRunningKey(null);
  }, []);
  useEffect(() => {
    if (!key || runningKey !== key) return;
    let handle = 0, previous = 0, accumulator = 0;
    function tick(time: number) {
      const dt = context.current.rig?.ok ? context.current.rig.dt : 1 / 120;
      if (previous) accumulator += Math.min(.1, (time - previous) / 1000);
      previous = time; const steps = Math.min(120, Math.floor((accumulator + 1e-12) / dt));
      if (steps) { advance(steps); accumulator -= steps * dt; }
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [key, runningKey, advance]);
  const state = frame?.key === key ? frame.state : rig?.ok ? rig.initial : initialFrictionMotion();
  const error = frame?.key === key ? frame.error : null;
  const sample = enabled ? error ? { ok: false as const, code: error } : frictionSample(scene, registry, state) : null;
  const viewScene = rig?.ok ? frictionView(scene, rig, state) : scene;
  return { sample, state, rig, viewScene, running: !!key && runningKey === key, runId: frame?.key === key ? frame.runId : '',
    start: () => { if (runtime.current?.key === key && rig?.ok && !error) setRunningKey(key); }, pause: () => setRunningKey(null),
    step: () => { setRunningKey(null); advance(1); },
    reset: () => { setRunningKey(null); setFrame(null); if (runtime.current && rig?.ok) { runtime.current.state = rig.initial; runtime.current.runId = `friction-${crypto.randomUUID()}`; runtime.current.adapter.sync(rig.initial, rig.dt); setFrame({ key, state: rig.initial, runId: runtime.current.runId, error: null }); } },
  };
}
export type FrictionSimulation = ReturnType<typeof useFrictionSimulation>;
