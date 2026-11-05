import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';

export function LeverForces({ outcome, view, size }: { outcome: LeverOutcome; view: Viewport; size: { width: number; height: number } }) {
  if (!outcome.ok) return null;
  const pivot = worldToScreen(outcome.pivot, view, size);
  return <g data-lever-forces="true" pointerEvents="none">{outcome.loads.filter(load => load.forceN > 0).map(load => {
    const point = worldToScreen(load.point, view, size), dx = load.fxN / load.forceN, dy = -load.fyN / load.forceN;
    const t = (pivot.x - point.x) * dx + (pivot.y - point.y) * dy, foot = { x: point.x + t * dx, y: point.y + t * dy };
    return <g key={load.id}><path d={`M${point.x - dx * 100} ${point.y - dy * 100}L${point.x + dx * 180} ${point.y + dy * 180}`} stroke="#6a9fa4" strokeWidth="1" strokeDasharray="5 4" /><path d={`M${point.x} ${point.y}l${dx * 65} ${dy * 65}m${-dx * 9 - dy * 5} ${-dy * 9 + dx * 5}l${dx * 9 + dy * 5} ${dy * 9 - dx * 5}l${-dx * 9 + dy * 5} ${-dy * 9 - dx * 5}`} stroke="#bd6949" strokeWidth="2" fill="none" /><path d={`M${pivot.x} ${pivot.y}L${foot.x} ${foot.y}`} stroke="#8e73a1" strokeWidth="2" strokeDasharray="3 3" /></g>;
  })}</g>;
}
