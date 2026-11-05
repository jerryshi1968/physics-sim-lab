import type { OpticalOutcome } from '../../core/optical/bench.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';

export function OpticalRays({ outcome, view, size }: { outcome: OpticalOutcome; view: Viewport; size: { width: number; height: number } }) {
  if (!outcome.ok) return null;
  const { candle, lens, bench, screen } = outcome.setup;
  const point = (xM: number, yM: number) => { const p = worldToScreen({ xM, yM }, view, size); return `${p.x},${p.y}`; };
  const end = screen.xM > lens.xM ? screen.xM : bench.xM + bench.lengthM;
  return <g data-optical-rays="true" pointerEvents="none">
    <path d={`M${point(bench.xM, lens.yM)}L${point(bench.xM + bench.lengthM, lens.yM)}`} stroke="#8aabb3" strokeDasharray="5 5" strokeWidth="1" />
    {outcome.rays.filter((_, index) => index % 40 === 0).map((ray, index) => <g key={index}>
      <path d={`M${point(candle.xM, ray.objectYM)}L${point(lens.xM, ray.apertureYM)}L${point(end, ray.apertureYM + (end - lens.xM) * ray.slope)}`} fill="none" stroke={index % 2 ? '#c78f38' : '#5aa2b3'} strokeWidth="1" opacity=".75" />
      {outcome.image.kind === 'virtual' && outcome.imageInBench && <path data-virtual-ray="true" d={`M${point(lens.xM, ray.apertureYM)}L${point(lens.xM + outcome.image.imageDistanceM, ray.apertureYM + outcome.image.imageDistanceM * ray.slope)}`} fill="none" stroke="#9679ae" strokeDasharray="4 4" strokeWidth="1" />}
    </g>)}
  </g>;
}
