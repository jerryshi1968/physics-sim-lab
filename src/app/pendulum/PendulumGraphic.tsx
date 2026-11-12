import { useRef, useState } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';

export function pendulumBounds(item: EquipmentInstance) {
  const length = Number(item.parameters.stringLengthM) + Number(item.parameters.bobRadiusM);
  return { x: -length * .88 - .03, y: -.025, width: length * 1.76 + .06, height: length + .065 };
}
export function PendulumGraphic({ item, angleRad, onAngle, onSelect }: { onSelect?: ((id: string, additive?: boolean) => void) | undefined; item: EquipmentInstance; angleRad?: number | undefined; onAngle?: ((id: string, degrees: number) => void) | undefined }) {
  const [drag, setDrag] = useState<{ pointer: number; angle: number } | null>(null), group = useRef<SVGGElement>(null);
  const p = item.parameters, length = Number(p.stringLengthM) + Number(p.bobRadiusM), radius = Number(p.bobRadiusM);
  const angle = drag?.angle ?? angleRad ?? Number(p.initialAngleDeg) * Math.PI / 180, x = length * Math.sin(angle), y = length * Math.cos(angle);
  return <g ref={group} className="real-apparatus" data-appearance="physical" data-pendulum-angle-rad={angle} stroke="none">
    {p.supportId !== '' && <path d="M-.12 0H0" stroke="#708b8c" strokeWidth="5" />}
    <rect x="-.018" y="-.018" width=".036" height=".03" rx=".005" fill="#526d70" />
    <path d={`M0 0L${x} ${y}`} stroke="#7e7e64" strokeWidth="1.3" />
    <circle cx={x} cy={y} r={radius} fill="#bd8a46" stroke="#78582e" strokeWidth="1" />
    <circle cx={x - radius * .25} cy={y - radius * .3} r={radius * .28} fill="#f7d89a" />
    <circle data-pendulum-bob="true" aria-label="拖动摆球调整释放摆角" cx={x} cy={y} r={Math.max(radius, .027)} fill="transparent" pointerEvents="all" style={{ cursor: onAngle ? 'grab' : 'default', touchAction: 'none' }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.stopPropagation(); onSelect?.(item.id, event.shiftKey); if (!onAngle) return; event.currentTarget.setPointerCapture(event.pointerId); setDrag({ pointer: event.pointerId, angle }); }}
      onPointerMove={event => {
        if (!drag || drag.pointer !== event.pointerId) return;
        event.stopPropagation(); const ctm = group.current?.getScreenCTM(); if (!ctm) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
        setDrag({ ...drag, angle: Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan2(point.x, point.y))) });
      }} onPointerUp={event => { if (!drag || drag.pointer !== event.pointerId) return; event.stopPropagation(); onAngle?.(item.id, Number((drag.angle * 180 / Math.PI).toFixed(2))); setDrag(null); }}
      onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)} onClick={event => event.stopPropagation()} />
  </g>;
}
