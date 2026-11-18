import type { PointerEvent, KeyboardEvent } from 'react';
import type { Pose2D } from '../../core/equipment/schema.ts';
import type { LightOrbit } from '../../core/workbench/lightOrbit.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';
export function LightOrbitControl({ orbit, pose, view, size, onStart, onKey }: { orbit: LightOrbit; pose: Pose2D; view: Viewport; size: { width: number; height: number }; onStart: (e: PointerEvent<SVGGElement>) => void; onKey: (e: KeyboardEvent<SVGGElement>) => void }) {
  const center = worldToScreen(orbit.center, view, size), source = worldToScreen(pose, view, size), ux = (source.x - center.x) / (orbit.radiusM * view.pixelsPerM), uy = (source.y - center.y) / (orbit.radiusM * view.pixelsPerM), offset = .10 * view.pixelsPerM + 28;
  const x = Math.max(24, Math.min(size.width - 24, source.x + ux * offset)), y = Math.max(24, Math.min(size.height - 24, source.y + uy * offset));
  const arc = Array.from({ length: 49 }, (_, i) => { const angle = orbit.minRad + (orbit.maxRad - orbit.minRad) * i / 48; return worldToScreen({ xM: orbit.center.xM + orbit.radiusM * Math.cos(angle), yM: orbit.center.yM + orbit.radiusM * Math.sin(angle) }, view, size); });
  return <g data-light-orbit="true" data-pivot-x-m={orbit.center.xM} data-pivot-y-m={orbit.center.yM} data-radius-m={orbit.radiusM}>
    <g pointerEvents="none" fill="none" stroke="#679c9488" strokeWidth="1.2"><path d={arc.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} strokeDasharray="4 5" /><path d={`M${source.x} ${source.y}L${x} ${y}`} strokeDasharray="3 3" /><circle cx={center.x} cy={center.y} r="6" /></g>
    <g role="button" tabIndex={0} aria-label="绕入射点旋转光源" data-testid="light-orbit-handle" transform={`translate(${x} ${y})`} style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onStart} onKeyDown={onKey} onClick={e => e.stopPropagation()}><title>绕当前入射点旋转光源；方向键微调，Esc 取消</title><circle r="23" fill="#f3faf6" fillOpacity=".95" stroke="#4d8d7f" strokeWidth="1.5" /><path d="M-8 4A9 9 0 1 1 8 4M8-3V5H0" fill="none" stroke="#247666" strokeWidth="2" /></g>
  </g>;
}
