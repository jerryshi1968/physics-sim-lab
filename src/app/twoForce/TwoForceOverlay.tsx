import { useRef } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { TwoForceSimulation } from './useTwoForce.ts';
import { CART, TRACK, cartHalfLengthM } from '../../equipment/cart/definitions.ts';
export function TwoForceOverlay({ simulation: sim, view, size, selected, previewAngle, onYaw, onPreview }: { simulation: TwoForceSimulation; view: NonNullable<SceneDocument['viewport']>; size: { width: number; height: number }; selected: boolean; previewAngle?: number | null | undefined; onYaw: (degrees: number) => void; onPreview: (degrees: number | null) => void }) {
  const drag = useRef<number | null>(null), table = sim.viewScene.equipment.find(item => item.type === TRACK), cart = sim.viewScene.equipment.find(item => item.type === CART);
  const rig = sim.rig, sample = sim.sample;
  if (!table || !cart) return null;
  const center = worldToScreen(cart.pose, view, size), angle = previewAngle === null || previewAngle === undefined ? cart.pose.rotationRad : previewAngle * Math.PI / 180, radius = Math.min(Math.max(64, .22 * view.pixelsPerM), Math.max(64, Math.min(size.width, size.height) / 2 - 28)), handle = { x: center.x + radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) };
  const degrees = (event: { clientX: number; clientY: number; currentTarget: SVGGElement }) => { const svg = event.currentTarget.ownerSVGElement!, point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; const local = point.matrixTransform(svg.getScreenCTM()!.inverse()); return Math.max(-60, Math.min(60, Math.atan2(center.y - local.y, local.x - center.x) * 180 / Math.PI)); };
  return <g data-two-force-overlay="true" data-two-force-time={sim.displayS} data-two-force-torque={sample?.ok ? sample.torque : undefined}>
    {rig.ok && sample?.ok && [-1, 1].map((side, i) => {
      const q = sim.run?.state ?? rig.state, end = worldToScreen({ xM: table.pose.xM + side * rig.half, yM: table.pose.yM }, view, size), point = worldToScreen({ xM: table.pose.xM + q[0] + side * cartHalfLengthM * Math.cos(q[2]), yM: table.pose.yM + q[1] + side * cartHalfLengthM * Math.sin(q[2]) }, view, size), hanging = worldToScreen({ xM: table.pose.xM + side * (rig.half + .07), yM: table.pose.yM - .16 - sample.heights[i]! }, view, size);
      return <path key={side} d={`M${point.x} ${point.y}L${end.x} ${end.y}H${hanging.x}V${hanging.y}`} fill="none" stroke={i ? '#177f76' : '#ba853f'} strokeWidth="2" pointerEvents="none" />;
    })}
    <text x="16" y="24" fontSize="11" fill="#5f7770" pointerEvents="none">小车与水平台俯视 · 两侧钩码侧视示意</text>
    {selected && !sim.run && <g><circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#8ab8ac" strokeDasharray="4 5" pointerEvents="none" /><g role="slider" tabIndex={0} aria-label="小车扭转角（俯视）" aria-valuemin={-60} aria-valuemax={60} aria-valuenow={Number((angle * 180 / Math.PI).toFixed(3))} data-two-force-yaw-handle="true" onClick={event => event.stopPropagation()} style={{ touchAction: 'none', cursor: 'grab' }}
      onPointerDown={event => { event.stopPropagation(); event.preventDefault(); drag.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); onPreview(degrees(event)); }}
      onPointerMove={event => { if (drag.current !== event.pointerId) return; event.stopPropagation(); onPreview(degrees(event)); }}
      onPointerUp={event => { if (drag.current !== event.pointerId) return; event.stopPropagation(); const value = degrees(event); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onPreview(null); onYaw(value); }}
      onPointerCancel={event => { event.stopPropagation(); drag.current = null; onPreview(null); }} onLostPointerCapture={() => { if (drag.current !== null) { drag.current = null; onPreview(null); } }}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); drag.current = null; onPreview(null); return; } if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const value = event.key === 'Home' ? -60 : event.key === 'End' ? 60 : angle * 180 / Math.PI + (event.key === 'ArrowLeft' ? -5 : 5); onYaw(Math.max(-60, Math.min(60, value))); }}>
      <circle cx={handle.x} cy={handle.y} r="23" fill="#f5faf7" stroke="#408d7d" strokeWidth="1.4" /><text x={handle.x} y={handle.y + 7} textAnchor="middle" fontSize="25" fill="#237d6c" pointerEvents="none">↻</text>
    </g></g>}
  </g>;
}
