import type { RefractionOutcome } from '../../equipment/refraction/simulate.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Ray2 } from '../../core/optical/refraction.ts';
export function RefractionRays({ outcome: o, view, size, reflection }: { outcome: RefractionOutcome; view: Viewport; size: { width: number; height: number }; reflection: boolean }) {
  if (!o.ok) return null;
  const end = (d: Ray2, length: number) => ({ x: o.hit.x + d.x * length, y: o.hit.y + d.y * length });
  const segments = [{ kind: 'incident', a: o.source, b: o.hit, color: '#d87a23' }, ...(o.transmitted ? [{ kind: 'refracted', a: o.hit, b: end(o.transmitted, o.transmittedLengthM), color: '#bd385b' }] : []), ...(reflection || o.kind === 'total-reflection' ? [{ kind: 'reflected', a: o.hit, b: end(o.reflected, o.reflectedLengthM), color: '#718aa4' }] : [])];
  return <g pointerEvents="none" stroke="none" data-refraction-rays={o.kind}>{segments.map(s => { const a = worldToScreen({ xM: s.a.x, yM: s.a.y }, view, size), b = worldToScreen({ xM: s.b.x, yM: s.b.y }, view, size), angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; return <g key={s.kind} data-refraction-ray={s.kind}><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke={s.color} strokeWidth="2.6" /><path d="M-6-4L0 0l-6 4" fill="none" stroke={s.color} strokeWidth="1.8" transform={`translate(${a.x + (b.x - a.x) * .55} ${a.y + (b.y - a.y) * .55}) rotate(${angle})`} /></g>; })}<circle cx={worldToScreen({ xM: o.hit.x, yM: o.hit.y }, view, size).x} cy={worldToScreen({ xM: o.hit.x, yM: o.hit.y }, view, size).y} r="3" fill="#315d66" /></g>;
}
