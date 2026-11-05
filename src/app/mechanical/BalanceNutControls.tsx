import { useRef } from 'react';
export type NutSide = 'left' | 'right';
export interface NutPreview { id: string; side: NutSide; offsetM: number }
export function BalanceNutControls({ id, leftM, rightM, enabled, onPreview, onChange }: { id: string; leftM: number; rightM: number; enabled: boolean; onPreview: (value: NutPreview | null) => void; onChange: (value: NutPreview) => void }) {
  const dragging = useRef<NutSide | null>(null), cancelled = useRef(false);
  return <fieldset className="balance-nut-controls" disabled={!enabled}><legend>空载调节两端平衡螺母</legend>
    {(['left', 'right'] as const).map(side => {
      const label = side === 'left' ? '左端平衡螺母' : '右端平衡螺母', value = side === 'left' ? leftM : rightM;
      return <div key={side}><label>{label}：伸出 {Number((value * 1000).toFixed(3))} mm<input type="range" aria-label={label} min="0" max="60" step="1" value={value * 1000}
        onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; dragging.current = side; cancelled.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
        onChange={event => { if (cancelled.current) return; const next = { id, side, offsetM: Number(event.target.value) / 1000 }; if (dragging.current) onPreview(next); else onChange(next); }}
        onPointerUp={event => { const active = dragging.current; dragging.current = null; if (active && !cancelled.current) onChange({ id, side, offsetM: Number(event.currentTarget.value) / 1000 }); else onPreview(null); cancelled.current = false; }}
        onPointerCancel={() => { dragging.current = null; cancelled.current = false; onPreview(null); }}
        onLostPointerCapture={() => { if (dragging.current) { dragging.current = null; onPreview(null); } }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled.current = dragging.current !== null; dragging.current = null; onPreview(null); } }} /></label>
        <div className="nut-step-buttons"><button type="button" aria-label={`${label}向内调 1 mm`} onClick={() => onChange({ id, side, offsetM: Math.max(0, Math.round(value * 1000) - 1) / 1000 })}>向内 −</button><button type="button" aria-label={`${label}向外调 1 mm`} onClick={() => onChange({ id, side, offsetM: Math.min(60, Math.round(value * 1000) + 1) / 1000 })}>向外 ＋</button></div>
      </div>;
    })}
    <p>拖动滑条、用方向键或每次调 1 mm；空载时观察哪端下沉。调至水平后再确认，挂载期间请先卸载。</p>
  </fieldset>;
}
