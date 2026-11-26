import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { SurfaceSize, Viewport } from '../../core/workbench/geometry.ts';
import { CartTether } from '../cart/CartGraphic.tsx';
import { TickerControl } from '../ticker/TickerOverlay.tsx';
import type { CartVelocitySimulation } from './useCartVelocity.ts';

export function CartVelocityOverlay({ simulation: c, view, size, interactive, onViewport }: { simulation: CartVelocitySimulation; view: Viewport; size: SurfaceSize; interactive: boolean; onViewport: (v: Viewport) => void }) {
  const rig = c.rig;
  if (!rig?.ok) return null;
  const at = worldToScreen({ xM: c.coupling.carRear.xM + .11, yM: rig.track.pose.yM + .08 }, view, size);
  return <g data-testid="cart-velocity-apparatus" data-attached={c.coupling.attached} data-moving={c.moving} data-released={!!c.motion} data-trial={c.trial} pointerEvents={interactive ? undefined : 'none'}>
    <CartTether rig={{ ...rig, ticker: undefined }} run={c.motion?.run ?? null} view={view} size={size} />
    {!c.motion && c.ticker.powered && <TickerControl label="放开小车" action={() => { c.release(); const b = c.coupling.bounds; if (b && c.coupling.attached && c.ticker.fixed) { const pixelsPerM = Math.min(600, (size.width - 60) / (b.maxX - b.minX), (size.height - 95) / (b.maxY - b.minY)); onViewport({ centerXM: (b.minX + b.maxX) / 2, centerYM: (b.minY + b.maxY) / 2 + 25 / pixelsPerM, pixelsPerM }); } }}><rect data-testid="cart-release-hit" x={at.x - .11 * view.pixelsPerM} y={at.y - .07 * view.pixelsPerM} width={.22 * view.pixelsPerM} height={Math.max(32, .12 * view.pixelsPerM)} rx="5" fill="transparent" /><text x={at.x} y={at.y - .09 * view.pixelsPerM} textAnchor="middle" fontSize="12" fill="#346e6a">点击车身放开</text></TickerControl>}
    {c.ticker.taken ? <TickerControl label="左右翻转纸带" pressed={!!c.ticker.paper?.flippedX} transform="translate(282 38)" action={c.flipPaper}><rect width="76" height="26" rx="5" fill="#edf6f1" stroke="#b1c9c4" /><text x="38" y="18" textAnchor="middle" fontSize="12" fill="#28636a">左右翻转</text></TickerControl> : <TickerControl label="查看计时器安装区" transform="translate(282 38)" action={() => onViewport({ centerXM: rig.ticker!.pose.xM + .10, centerYM: rig.ticker!.pose.yM + .02, pixelsPerM: Math.min(900, (size.width - 45) / .65) })}><rect width="76" height="26" rx="5" fill="#edf6f1" stroke="#b1c9c4" /><text x="38" y="18" textAnchor="middle" fontSize="12" fill="#28636a">查看计时器</text></TickerControl>}
  </g>;
}
