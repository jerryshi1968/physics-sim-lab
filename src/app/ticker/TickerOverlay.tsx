import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { screenToWorld, worldToScreen } from '../../core/workbench/geometry.ts';
import type { SurfaceSize, Viewport } from '../../core/workbench/geometry.ts';
import { TICKER } from '../../equipment/cart/definitions.ts';
import { tapeRulerPlacement, tapeSelection } from '../../equipment/ticker/simulate.ts';
import type { TapePlacement } from '../../equipment/ticker/simulate.ts';
import type { TickerSimulation } from './useTicker.ts';
import { TickerRuler, tickerMaximumZoom } from './TickerRuler.tsx';

type Drag = { pointerId: number; kind: 'paper' | 'pull' | 'ruler'; pointer: TapePlacement; paper: TapePlacement; installed: boolean; taken: boolean; storedPaper: TapePlacement | null; displacementM: number; view: Viewport; moved: boolean; dot: number | null };

function TickerControl({ label, action, pressed, transform, children }: { label: string; action: () => void; pressed?: boolean; transform?: string; children: ReactNode }) {
  const touchClick = useRef(false);
  return <g role="button" tabIndex={0} aria-label={label} aria-pressed={pressed} transform={transform}
    onPointerDown={event => { event.stopPropagation(); touchClick.current = false; event.currentTarget.focus({ preventScroll: true }); }}
    onPointerUp={event => { if (event.isPrimary && event.pointerType !== 'mouse') { event.preventDefault(); event.stopPropagation(); touchClick.current = true; action(); } }}
    onPointerCancel={() => { touchClick.current = false; }}
    onClick={event => { event.preventDefault(); event.stopPropagation(); if (touchClick.current && event.detail !== 0) { touchClick.current = false; return; } action(); }}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) action(); } }}>{children}</g>;
}

export function TickerOverlay({ scene, simulation: s, view, size, interactive, onViewport, onMove, onPreview, onSelect }: { scene: SceneDocument; simulation: TickerSimulation; view: Viewport; size: SurfaceSize; interactive: boolean; onViewport: (view: Viewport) => void; onMove: (id: string, point: TapePlacement) => void; onPreview: (preview: { id: string; point: TapePlacement } | null) => void; onSelect: (id: string) => void }) {
  const root = useRef<SVGGElement>(null), active = useRef<Drag | null>(null);
  const [rulerPreview, setRulerPreview] = useState<TapePlacement | null>(null);
  const ticker = scene.equipment.find(item => item.type === TICKER);
  if (!ticker || !s.rig?.ok) return null;
  const start = worldToScreen({ xM: ticker.pose.xM, yM: ticker.pose.yM }, view, size), scale = view.pixelsPerM;
  const displacement = s.run?.displacementM ?? 0, mountedOrigin = { xM: ticker.pose.xM + displacement, yM: ticker.pose.yM };
  const paper = s.installed ? mountedOrigin : s.paper ?? { xM: ticker.pose.xM + .22, yM: ticker.pose.yM + .13 };
  const p = worldToScreen(paper, view, size), endX = start.x + (Math.max(.12, .058 + 40 / scale) + displacement) * scale;
  const left = s.installed ? start.x + .084 * scale : p.x - (s.run ? displacement + .04 : .14) * scale;
  const right = s.installed ? endX : p.x + (s.run ? .06 : .14) * scale;
  const originalRuler = s.rig.ruler;
  const ruler = originalRuler && rulerPreview ? { ...originalRuler, pose: { ...originalRuler.pose, ...rulerPreview } } : originalRuler;
  const aligned = s.taken && s.run ? tapeRulerPlacement(scene, s.run, s.paper, s.origin, s.target) : null;
  const position = (event: PointerEvent<SVGGElement>, viewport = view) => {
    const rect = root.current!.ownerSVGElement!.getBoundingClientRect();
    return screenToWorld({ x: (event.clientX - rect.left) * size.width / rect.width, y: (event.clientY - rect.top) * size.height / rect.height }, viewport, size);
  };
  function begin(event: PointerEvent<SVGGElement>, kind: Drag['kind'], dot: number | null = null) {
    if (!interactive || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); root.current!.focus({ preventScroll: true });
    if (kind === 'paper' && (s.powered || s.installed && s.fixed)) { s.movePaper(paper); return; }
    const pointer = position(event);
    const selectedDot = s.taken && s.run ? s.run.dots.reduce((best, point, index, dots) => Math.abs(paper.xM - point.displacementM - pointer.xM) < Math.abs(paper.xM - dots[best]!.displacementM - pointer.xM) ? index : best, 0) : dot;
    const nearDot = selectedDot !== null && s.run?.dots[selectedDot] && Math.abs(paper.yM - pointer.yM) * scale <= 12 && Math.abs(paper.xM - s.run.dots[selectedDot]!.displacementM - pointer.xM) * scale <= 12;
    active.current = { pointerId: event.pointerId, kind, pointer, paper: kind === 'ruler' && ruler ? ruler.pose : paper, storedPaper: s.paper, installed: s.installed, taken: s.taken, displacementM: displacement, view: { ...view }, moved: false, dot: kind === 'ruler' && !nearDot ? null : selectedDot };
    if (kind === 'ruler' && ruler) onSelect(ruler.id);
    root.current!.setPointerCapture(event.pointerId);
    if (kind === 'pull' && s.powered) s.beginPull();
  }
  function move(event: PointerEvent<SVGGElement>, finish = false) {
    const drag = active.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const at = position(event, drag.view), dx = at.xM - drag.pointer.xM, dy = at.yM - drag.pointer.yM;
    drag.moved ||= Math.hypot(dx, dy) * drag.view.pixelsPerM > 3;
    const next = { xM: drag.paper.xM + dx, yM: drag.paper.yM + dy };
    if (drag.kind === 'ruler' && ruler && drag.moved) { setRulerPreview(next); onPreview({ id: ruler.id, point: next }); }
    else if (drag.kind === 'pull' && s.powered) s.pullTo(drag.displacementM + dx);
    else if (drag.moved && !s.powered) s.movePaper(next);
    if (!finish) return;
    active.current = null;
    if (root.current!.hasPointerCapture(event.pointerId)) root.current!.releasePointerCapture(event.pointerId);
    if (drag.kind === 'ruler') { if (drag.moved && ruler) onMove(ruler.id, next); else if (drag.dot !== null) s.choose(drag.dot); setRulerPreview(null); onPreview(null); }
    else if (drag.kind === 'pull') s.endPull();
    else if (drag.moved) s.dropPaper(next);
    else if (drag.dot !== null) s.choose(drag.dot);
  }
  function cancel() {
    const drag = active.current;
    active.current = null;
    if (!drag) { if (s.dragging) s.endPull(); return; }
    if (root.current?.hasPointerCapture(drag.pointerId)) root.current.releasePointerCapture(drag.pointerId);
    if (drag.kind === 'ruler') { setRulerPreview(null); onPreview(null); }
    else if (drag.kind === 'pull') s.endPull();
    else s.restorePaper(drag.storedPaper, drag.installed, drag.taken);
  }
  function paperKey(event: KeyboardEvent<SVGGElement>) {
    const step = event.shiftKey ? .001 : .01;
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, number[]>)[event.key];
    if (delta) {
      event.preventDefault(); event.stopPropagation();
      if (s.powered) { if (event.key === 'ArrowRight') { if (!s.dragging) s.beginPull(); s.pullTo(displacement + step); } }
      else s.movePaper({ xM: paper.xM + delta[0]!, yM: paper.yM + delta[1]! });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (!s.powered) s.dropPaper(paper);
    }
  }
  function readView() {
    if (!ruler || !s.run) return;
    const a = s.run.dots[s.origin]?.displacementM ?? 0, b = s.run.dots[s.target]?.displacementM ?? a;
    const pixelsPerM = Math.min(tickerMaximumZoom, Math.max(8000, view.pixelsPerM * 1.6));
    onViewport({ centerXM: paper.xM - (a + b) / 2, centerYM: ruler.pose.yM + (Math.max(125, size.height * .55) - size.height / 2) / pixelsPerM, pixelsPerM });
  }
  function overview(fresh = false) {
    const visiblePaper = fresh ? { xM: ticker!.pose.xM + .22, yM: ticker!.pose.yM + .13 } : paper;
    const xs = [ticker!.pose.xM - .22, ticker!.pose.xM + .4, visiblePaper.xM - Math.max(.14, (fresh ? 0 : displacement) + .04), visiblePaper.xM + .16, ...(ruler ? [ruler.pose.xM, ruler.pose.xM + Number(ruler.parameters.lengthM)] : [])];
    const ys = [ticker!.pose.yM + .2, ticker!.pose.yM - .1, visiblePaper.yM + .06, visiblePaper.yM - .06, ...(ruler ? [ruler.pose.yM - .08] : [])];
    const pixelsPerM = Math.min(600, (size.width - 60) / (Math.max(...xs) - Math.min(...xs)), (size.height - 95) / (Math.max(...ys) - Math.min(...ys)));
    onViewport({ centerXM: (Math.min(...xs) + Math.max(...xs)) / 2, centerYM: (Math.min(...ys) + Math.max(...ys)) / 2 + 25 / pixelsPerM, pixelsPerM });
  }
  return <g ref={root} tabIndex={-1} data-testid="ticker-apparatus" data-powered={s.powered} data-clamp-closed={s.fixed} data-installed={s.installed} data-taken={s.taken} data-origin={s.origin} data-target={s.target} data-displacement-m={displacement} data-time-s={s.run?.timeS ?? 0} data-paper-x-m={paper.xM} data-paper-y-m={paper.yM} pointerEvents={interactive ? undefined : 'none'} style={{ touchAction: 'none', outline: 'none' }} aria-label="直接操作打点计时器"
    onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={cancel} onLostPointerCapture={() => { if (active.current) cancel(); }}
    onClick={event => event.stopPropagation()} onWheelCapture={event => { if (active.current) event.stopPropagation(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); } }}>
    {!s.installed && !s.taken && <g pointerEvents="none"><rect x={start.x - .072 * scale} y={start.y - .013 * scale} width={.144 * scale} height={.026 * scale} rx="3" fill="none" stroke="#c78329" strokeDasharray="3 3" /><text x={start.x - .10 * scale} y={start.y - .06 * scale} fontSize="12" fill="#6c735b">纸带通道</text></g>}
    <TickerControl label="固定计时器夹具" pressed={s.fixed} action={s.fix}>
      <rect x={start.x - .085 * scale} y={start.y + .04 * scale} width={.17 * scale} height={Math.max(24, .032 * scale)} fill="transparent" />
      <g fill="none" stroke={s.fixed ? '#347e6c' : '#bd8e43'} strokeWidth="3"><path d={`M${start.x - .06 * scale} ${start.y + .025 * scale}v${.028 * scale}h${.045 * scale}`} /><path d={`M${start.x + .06 * scale} ${start.y + .025 * scale}v${.028 * scale}h${-.045 * scale}`} /></g>
      <text x={start.x + .10 * scale} y={start.y + .06 * scale} fontSize="12" fill={s.fixed ? '#347e6c' : '#8a672d'}>← 固定夹{s.fixed ? '已扣上' : '已打开'}</text>
    </TickerControl>
    <TickerControl label="计时器电源开关" pressed={s.powered} action={s.togglePower}>
      <rect x={start.x + .058 * scale - 16} y={start.y - .026 * scale - 16} width="32" height="32" fill="transparent" />
      <circle cx={start.x + .058 * scale} cy={start.y - .026 * scale} r={Math.max(8, .013 * scale)} fill={s.powered ? '#ed7e2c' : '#b67f3c'} stroke="#fff5cd" strokeWidth="1.5" />
      <text x={start.x + .058 * scale} y={start.y - .026 * scale + 4} textAnchor="middle" fontSize="11" fill="white" pointerEvents="none">{s.powered ? 'Ⅰ' : '○'}</text>
    </TickerControl>
    <g role="button" tabIndex={0} aria-label={s.installed ? '纸带本体（断电并打开固定夹后拖出）' : s.taken ? '已取下的纸带（拖到尺旁）' : '新纸带（拖入计时器）'} data-testid="ticker-paper" style={{ cursor: s.powered ? 'default' : 'grab' }} onPointerDown={event => begin(event, 'paper')} onKeyDown={paperKey} onKeyUp={event => { if (event.key === 'ArrowRight' && s.powered) { event.stopPropagation(); s.endPull(); } }}>
      <rect x={left} y={p.y - Math.max(5, .009 * scale)} width={Math.max(20, right - left)} height={Math.max(10, .018 * scale)} rx="2" fill="#f3dfb7" stroke="#bba374" />
      <rect x={left - 2} y={p.y - 15} width={Math.max(24, right - left + 4)} height="30" fill="transparent" />
      {s.installed && <rect x={start.x - .2 * scale} y={p.y - .009 * scale} width={.115 * scale} height={.018 * scale} fill="#f3dfb7" stroke="#bba374" />}
      {!s.run && <text x={(left + right) / 2} y={p.y - 20} textAnchor="middle" fontSize="12" fill="#426c6d">{s.installed ? '拖右端向右拉带 →' : '纸带 · 拖到通道穿入'}</text>}
      {s.run?.dots.map((dot, i) => {
        const x = p.x - dot.displacementM * scale;
        if (s.installed && x < left) return null;
        const selected = s.taken && (i === s.origin || i === s.target);
        return <g key={i} data-ticker-dot={i} data-dot-displacement-m={dot.displacementM} role={s.taken ? 'button' : undefined} tabIndex={s.taken && selected ? 0 : undefined} aria-label={s.taken ? `选择纸带第 ${i} 点` : undefined} onPointerDown={event => { if (s.taken) begin(event, 'paper', i); }} onKeyDown={event => { if (s.taken && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); s.choose(i); } }}>
          <circle cx={x} cy={p.y} r="1.7" fill="#68523d" />
          {selected && <><circle cx={x} cy={p.y} r="6" fill="none" stroke={i === s.origin ? '#16856d' : '#c05a39'} strokeWidth="1.8" /><text x={x} y={p.y - (i === s.origin ? 11 : 25)} fontSize="11" textAnchor="middle" fill={i === s.origin ? '#16856d' : '#a7472c'}>{i === s.origin ? '起' : '终'} {i}</text></>}
          {s.taken && <circle cx={x} cy={p.y} r="5" fill="transparent" />}
        </g>;
      })}
    </g>
    {s.taken && s.run && ruler && [s.origin, s.target].map(index => {
      const dot = s.run!.dots[index];
      if (!dot) return null;
      const x = p.x - dot.displacementM * scale, rulerY = worldToScreen(ruler.pose, view, size).y;
      return <path key={index} d={`M${x} ${p.y + 7}V${rulerY}`} fill="none" stroke={index === s.origin ? '#16856d' : '#c05a39'} strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />;
    })}
    {s.installed && <g role="button" tabIndex={0} aria-label="纸带右端（拖动拉带）" data-testid="ticker-pull-grip" onPointerDown={event => begin(event, s.powered ? 'pull' : 'paper')} onKeyDown={paperKey} onKeyUp={event => { if (event.key === 'ArrowRight') s.endPull(); }} style={{ cursor: 'ew-resize' }}>
      <rect x={endX - 15} y={start.y - 18} width="30" height="36" rx="6" fill="#62a69622" stroke="#418c7c" strokeDasharray="3 2" />
      <path d={`M${endX - 5} ${start.y}h10m-4-4 4 4-4 4`} fill="none" stroke="#287c83" strokeWidth="2" />
    </g>}
    {s.taken && <text x={Math.max(12, Math.min(size.width - 180, p.x - displacement * scale))} y={Math.max(105, p.y >= 130 ? p.y - 45 : p.y + 23)} fontSize="12" fill="#426c6d" pointerEvents="none">← 打点先后 · 点击选{s.choosing === 'origin' ? '起点' : '终点'}</text>}
    {ruler && (() => {
      const at = worldToScreen(ruler.pose, view, size);
      return <g data-testid="ticker-ruler" role="button" tabIndex={0} aria-label="拖动刻度尺（可叠在纸带上）" transform={`translate(${at.x} ${at.y}) rotate(${-ruler.pose.rotationRad * 180 / Math.PI}) scale(${scale * (ruler.pose.flippedX ? -1 : 1)} ${scale})`} style={{ cursor: 'grab' }} onPointerDown={event => begin(event, 'ruler')} onKeyDown={event => {
        const step = event.shiftKey ? .001 : .01, delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, number[]>)[event.key];
        if (delta) { event.preventDefault(); event.stopPropagation(); onMove(ruler.id, { xM: ruler.pose.xM + delta[0]!, yM: ruler.pose.yM + delta[1]! }); }
      }}><TickerRuler instance={ruler} pixelsPerM={scale} /></g>;
    })()}
    <rect x="0" y="0" width={size.width} height="70" fill="#f7faf9" pointerEvents="none" />
    <text x="16" y="24" fontSize="13" fill="#385f65" pointerEvents="none">{s.powered ? '电源：开 · 拖右端拉带，松手即停' : s.taken ? !s.run || !tapeSelection(s.run, s.origin, s.target) ? '点选两个清晰测点，避开重合点' : aligned ? '纸带已摆到尺旁，可选点读数' : '拖纸带到尺上沿，再选点读数' : s.installed ? s.run ? s.fixed ? '已断电 · 先打开固定夹再取带' : '已断电、夹已开 · 可拖出纸带' : s.fixed ? '纸带已夹好 · 点击开关通电' : '纸带已穿入 · 先扣上固定夹' : s.fixed ? '先打开固定夹，再穿入纸带' : '已断电、夹已开 · 拖纸带穿入通道'}</text>
    <TickerControl label="取用新纸带" transform="translate(16 38)" action={() => { s.renew(); if (!s.powered && (!s.installed || !s.fixed)) overview(true); }}><rect width="86" height="26" rx="5" fill="#edf6f1" stroke="#b1c9c4" /><text x="43" y="18" textAnchor="middle" fontSize="12" fill="#28636a">新纸带</text></TickerControl>
    {s.taken && <TickerControl label="放大纸带读尺" transform="translate(112 38)" action={readView}><rect width="86" height="26" rx="5" fill="#edf6f1" stroke="#b1c9c4" /><text x="43" y="18" textAnchor="middle" fontSize="12" fill="#28636a">放大读尺</text></TickerControl>}
    <TickerControl label="查看纸带全景" transform="translate(208 38)" action={overview}><rect width="64" height="26" rx="5" fill="#edf6f1" stroke="#b1c9c4" /><text x="32" y="18" textAnchor="middle" fontSize="12" fill="#28636a">全景</text></TickerControl>
    {ruler && (s.taken || scale >= 1000) && <text x="16" y="87" fontSize="12" fill="#385f65" pointerEvents="none">刻度尺：cm · 最小分度 1 mm · 可平移读另一端</text>}
  </g>;
}
