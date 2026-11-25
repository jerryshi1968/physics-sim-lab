import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { simulateElectrical } from '../../equipment/electrical/simulate.ts';
import { inductionParts } from '../../equipment/induction/model.ts';
import { inductionMotionBounds, clampInductionPoint, reflectedMotion } from '../../equipment/induction/motion.ts';
import type { MotionBounds } from '../../equipment/induction/motion.ts';

export interface InductionDrag { id: string; point: WorldPoint; at: number; phase: 'start' | 'move' }
interface Motion { signature: string; id: string; point: WorldPoint; positions: Record<string, WorldPoint>; bounds: MotionBounds; vx: number; vy: number; running: boolean; drag: boolean; at: number; timeS: number }
export function useInduction(scene: SceneDocument, enabled: boolean) {
  const physicalScene = useMemo(() => !enabled ? scene : { ...scene, equipment: scene.equipment.map(i => i.parameters.inductionShape ? { ...i, parameters: { ...i.parameters, inductionPerspective: true } } : i) }, [enabled, scene]);
  const signature = enabled ? JSON.stringify([scene.documentId, scene.equipment, scene.connections, scene.simulationConfig]) : '';
  const [stored, setStored] = useState<Motion | null>(null), context = useRef(signature);
  useLayoutEffect(() => { context.current = signature; });
  const motion = signature && stored?.signature === signature ? stored : null;
  const live = !!motion && (motion.running || motion.drag);
  useEffect(() => {
    if (!live) return;
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => {
      const dt = previous === null ? 0 : Math.max(0, Math.min(.05, (now - previous) / 1000)); previous = now;
      setStored(m => {
        if (!m || m.signature !== context.current) return m;
        if (m.drag) return now - m.at > 150 && (m.vx || m.vy) ? { ...m, vx: 0, vy: 0 } : m;
        if (!m.running) return m;
        const x = reflectedMotion(m.point.xM, m.vx, m.bounds.minX, m.bounds.maxX, dt), y = reflectedMotion(m.point.yM, m.vy, m.bounds.minY, m.bounds.maxY, dt);
        return { ...m, point: { xM: x.position, yM: y.position }, vx: x.velocity, vy: y.velocity, timeS: m.timeS + dt };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [live]);
  const viewScene = useMemo(() => !motion ? physicalScene : { ...physicalScene, equipment: physicalScene.equipment.map(i => {
    const point = i.id === motion.id ? motion.point : motion.positions[i.id];
    return !point ? i : { ...i, pose: { ...i.pose, ...point }, parameters: { ...i.parameters, velocityXMPerS: i.id === motion.id ? motion.vx : 0, velocityYMPerS: i.id === motion.id ? motion.vy : 0 } };
  }) }, [physicalScene, motion]);
  const outcome = useMemo(() => enabled ? simulateElectrical({ ...viewScene, measurementRecords: [], measurementSnapshots: [] }) : null, [enabled, viewScene]);
  const start = (target: 'wire' | 'magnet', vx: number, vy: number) => {
    const item = inductionParts(viewScene)[target]; if (!enabled || !item) return;
    const bounds = inductionMotionBounds(scene, item.id, viewScene); if (!bounds) return;
    setStored({ signature, id: item.id, bounds, point: clampInductionPoint(item.pose, bounds), positions: motion ? { ...motion.positions, [motion.id]: motion.point } : {}, vx, vy, running: true, drag: false, at: performance.now(), timeS: motion?.timeS ?? 0 });
  };
  const stop = () => setStored(m => m ? { ...m, running: false, drag: false, vx: 0, vy: 0 } : null);
  const onDrag = (event: InductionDrag | null) => {
    if (!event) { setStored(m => m?.drag ? null : m); return; }
    const item = inductionParts(scene); if (![item.wire?.id, item.magnet?.id].includes(event.id)) return;
    const bounds = motion?.drag && motion.id === event.id ? motion.bounds : inductionMotionBounds(scene, event.id, viewScene); if (!bounds) return;
    const point = clampInductionPoint(event.point, bounds);
    setStored(m => {
      const previous = m?.signature === signature && m.id === event.id ? m : null;
      const dt = previous ? (event.at - previous.at) / 1000 : 0;
      return { signature, id: event.id, point, bounds, positions: m?.signature === signature ? { ...m.positions, [m.id]: m.point } : {}, vx: event.phase === 'move' && dt > 0 ? (point.xM - (previous?.point.xM ?? point.xM)) / dt : 0,
        vy: event.phase === 'move' && dt > 0 ? (point.yM - (previous?.point.yM ?? point.yM)) / dt : 0, running: false, drag: true, at: event.at, timeS: previous?.timeS ?? 0 };
    });
    return point;
  };
  return { viewScene, outcome, motion, running: !!motion?.running, start, stop, reset: () => setStored(null), onDrag };
}
export type InductionSimulation = ReturnType<typeof useInduction>;
