import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { SurfaceSize, Viewport } from '../../core/workbench/geometry.ts';
import type { TickerSimulation } from '../ticker/useTicker.ts';
import type { TapeSpeedSelection } from './useTapeSpeedSelection.ts';

export function TapeSpeedMarks({ scene, ticker, selection, view, size }: { scene: SceneDocument; ticker: TickerSimulation; selection: TapeSpeedSelection; view: Viewport; size: SurfaceSize }) {
  if (!ticker.taken || !ticker.run || !ticker.paper || !scene.equipment.length) return null;
  const p = worldToScreen(ticker.paper, view, size), dots = ticker.run.dots;
  return <g pointerEvents="none" aria-label="纸带计数点与目标点标注" data-testid="tape-speed-marks">
    {dots.flatMap((dot, index) => {
      const target = selection.mode === 'instant' && index === selection.at, counted = index >= selection.zero && (index - selection.zero) % selection.stride === 0;
      if (!target && !counted) return [];
      const x = p.x - dot.displacementM * view.pixelsPerM, previous = dots[Math.max(selection.zero, index - selection.stride)];
      if (x < 10 || x > size.width - 10 || p.y < 122 || p.y > size.height - 22 || !target && index !== selection.zero && previous && (dot.displacementM - previous.displacementM) * view.pixelsPerM < 42) return [];
      const labelY = Math.max(112, p.y - (target ? 94 : 68));
      return <g key={index} data-counted-dot={counted ? (index - selection.zero) / selection.stride : undefined} data-target-e={target || undefined}><path d={`M${x} ${p.y - 5}V${labelY + 7}`} stroke={target ? '#356ca5' : '#506f6c'} strokeWidth="1" /><text x={x} y={labelY} textAnchor="middle" fontSize="12" fill={target ? '#225d9b' : '#395f5c'}>{target ? `E · 原始${index}` : `计数${(index - selection.zero) / selection.stride}`}</text>{target && <circle cx={x} cy={p.y} r="8" fill="none" stroke="#356ca5" strokeWidth="2" />}</g>;
    })}
  </g>;
}
