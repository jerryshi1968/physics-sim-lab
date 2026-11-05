import { useId } from 'react';
import type { OpticalOutcome } from '../../core/optical/bench.ts';

export function OpticalProjection({ outcome }: { outcome: Extract<OpticalOutcome, { ok: true }> }) {
  const id = useId(), { screen } = outcome.setup, radius = .0007 + Math.min(.03, outcome.spotRadiusM / 3);
  return <g data-screen-projection={outcome.screenStatus}>
    <defs><clipPath id={`${id}-projection`}><rect x={-screen.widthM / 2} y={-screen.heightM / 2} width={screen.widthM} height={screen.heightM} /></clipPath></defs>
    <rect x={-screen.widthM / 2} y={-screen.heightM / 2} width={screen.widthM} height={screen.heightM} fill="#fffdf1" />
    <g clipPath={`url(#${id}-projection)`} data-screen-real-image={outcome.image.kind === 'real' && outcome.capturedFraction > 0 && outcome.screenDistanceM > 0 ? 'true' : undefined}>
      {outcome.rays.filter(ray => ray.visible).map((ray, index) => <circle key={index} cx={ray.zM} cy={screen.yM - ray.screenYM} r={radius}
        fill={ray.objectYM > outcome.setup.candle.yM ? '#f5b832' : '#e87d19'} opacity={.18 * (.0007 / radius) ** 2} />)}
    </g>
  </g>;
}
