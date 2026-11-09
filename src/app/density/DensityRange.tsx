import { useRef } from 'react';
export function DensityRange({ label, value, min, max, step, disabled, onPreview, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled?: boolean; onPreview: (value: number | null) => void; onChange: (value: number) => void }) {
  const drag = useRef(false);
  return <label>{label}<input aria-label={label} type="range" min={min} max={max} step={step} disabled={disabled} value={value} style={{ touchAction: 'none' }}
    onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; drag.current = true; event.currentTarget.setPointerCapture(event.pointerId); onPreview(value); }}
    onChange={event => { const next = Number(event.currentTarget.value); if (drag.current) onPreview(next); else onChange(next); }}
    onPointerUp={event => { if (!drag.current) return; drag.current = false; onChange(Number(event.currentTarget.value)); onPreview(null); }}
    onPointerCancel={() => { drag.current = false; onPreview(null); }} onLostPointerCapture={() => { if (drag.current) { drag.current = false; onPreview(null); } }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); drag.current = false; onPreview(null); } }}/></label>;
}
