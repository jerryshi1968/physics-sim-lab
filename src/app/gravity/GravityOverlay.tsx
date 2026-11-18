import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { GravityOutcome } from '../../equipment/gravity/simulate.ts';
export function GravityOverlay({ outcome, view, size }: { outcome: GravityOutcome; view: NonNullable<SceneDocument['viewport']>; size: { width: number; height: number } }) {
  if (!outcome.meter || !outcome.support) return null;
  const start = worldToScreen({ xM: outcome.support.pose.xM, yM: outcome.meter.pose.yM }, view, size), end = worldToScreen(outcome.meter.pose, view, size);
  return <path data-gravity-bracket="true" pointerEvents="none" d={`M${start.x} ${start.y}H${end.x}`} stroke="#678b8b" strokeWidth="4" />;
}
