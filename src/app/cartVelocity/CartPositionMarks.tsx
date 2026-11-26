import { useEffect, useRef } from 'react';
import { tapePointXM } from '../../equipment/ticker/simulate.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { SurfaceSize, Viewport } from '../../core/workbench/geometry.ts';
import type { CartVelocitySimulation } from './useCartVelocity.ts';

export function CartPositionMarks({ simulation: c, view, size, onViewport }: { simulation: CartVelocitySimulation; view: Viewport; size: SurfaceSize; onViewport: (view: Viewport) => void }) {
  const s = c.ticker, q = c.positions, lastFocus = useRef('');
  const key = `${s.run?.id}:${q.zero}:${q.stride}:${q.selected}:${q.speed}:${s.paper?.flippedX}`, selected = s.run?.dots[q.zero + q.selected * q.stride];
  useEffect(() => {
    if (!s.taken || !s.paper || !selected || lastFocus.current === key) return;
    lastFocus.current = key;
    const point = { xM: tapePointXM(s.paper, selected.displacementM), yM: s.paper.yM }, screen = worldToScreen(point, view, size);
    if (screen.x < 40 || screen.x > size.width - 40 || screen.y < 125 || screen.y > size.height - 60) onViewport({ ...view, centerXM: point.xM, centerYM: point.yM + (150 - size.height / 2) / view.pixelsPerM });
  }, [key, s.taken, s.paper, selected, view, size, onViewport]);
  if (!s.taken || !s.paper || !s.run) return null;
  const p = worldToScreen(s.paper, view, size), dots = s.run.dots;
  const highlighted = q.speed ? [q.selected - 1, q.selected + 1] : [q.selected];
  return <g pointerEvents="none" data-testid="cart-position-marks" data-zero={q.zero} data-selected={q.selected} aria-label="纸带计数点编号">
    {q.numbers.filter(n => n >= 0).map(n => { const index = q.zero + n * q.stride, dot = dots[index]; if (!dot) return null; const x = p.x + (s.paper!.flippedX ? 1 : -1) * dot.displacementM * view.pixelsPerM, focus = highlighted.includes(n), previous = dots[index - q.stride];
      if (x < 5 || x > size.width - 5 || p.y < 120 || p.y > size.height - 15) return null;
      const label = focus || n === 0 || !previous || (dot.displacementM - previous.displacementM) * view.pixelsPerM >= 38;
      const labelY = Math.max(focus ? 116 : 132, p.y - (focus ? 58 : 37));
      return <g key={n} data-cart-count={n} data-highlighted={focus}><circle cx={x} cy={p.y} r={focus ? 7 : 4} fill="none" stroke={focus ? '#2673ad' : '#508d77'} strokeWidth={focus ? 2 : 1} />{label && <><path d={`M${x} ${p.y - 9}V${labelY + 5}`} stroke={focus ? '#2673ad' : '#508d77'} /><text x={x} y={labelY} textAnchor="middle" fontSize="12" fill={focus ? '#205f91' : '#386959'}>{n < 0 ? '辅助−1' : `计数${n}`}</text></>}</g>;
    })}
  </g>;
}
