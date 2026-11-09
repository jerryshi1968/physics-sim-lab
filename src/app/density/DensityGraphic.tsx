import { useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { DensityOutcome } from '../../equipment/density/simulate.ts';
import { BALANCE, CYLINDER, SPECIMEN, MASS_SET, BEAKER, standardMassesG } from '../../equipment/density/definitions.ts';
import { SPECIMEN_AREA_M2 } from '../../core/measurements/density.ts';

export const balanceAdjustments = {
  riderKg: { label: '游码位置（每格0.2 g）', minKg: 0, maxKg: .005, startXM: -.09, spanM: .18 },
  zeroTrimKg: { label: '调零螺母', minKg: -.002, maxKg: .002, startXM: -.209, spanM: .048 },
} as const;
export type BalanceAdjustment = keyof typeof balanceAdjustments;
export const balanceStepKg = .0002;
export function steppedBalanceValue(key: BalanceAdjustment, valueKg: number) {
  const { minKg, maxKg } = balanceAdjustments[key];
  return Math.max(minKg, Math.min(maxKg, Number((Math.round(valueKg / balanceStepKg) * balanceStepKg).toPrecision(12))));
}

export interface DensityControls {
  onAdjustStart: (key: BalanceAdjustment, event: PointerEvent<SVGGElement>) => void;
  onAdjust: (key: BalanceAdjustment, value: number) => void;
  onWeight: (index: number) => void;
}

function weightSlotAt(event: PointerEvent<SVGGElement>) {
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-density-weight-slot]');
  if (hit && hit.closest('[data-density-type]') === event.currentTarget.closest('[data-density-type]')) {
    return hit.getAttribute('data-density-weight-slot');
  }
  return null;
}

function BalanceHandle({ adjustment, value, disabled = false, controls, children }: {
  adjustment: BalanceAdjustment; value: number; disabled?: boolean; controls: DensityControls | undefined; children: ReactNode;
}) {
  if (!controls) return <>{children}</>;
  const { label, minKg, maxKg } = balanceAdjustments[adjustment];
  return <g className="density-balance-handle" role="slider" tabIndex={0} aria-label={label} aria-disabled={disabled}
    aria-valuemin={minKg * 1000} aria-valuemax={maxKg * 1000} aria-valuenow={Number((value * 1000).toPrecision(12))}
    aria-valuetext={`${Number((value * 1000).toPrecision(12))} 克`}
    onPointerDown={event => { event.stopPropagation(); controls.onAdjustStart(adjustment, event); }}
    onPointerUp={event => event.stopPropagation()}
    onKeyDown={event => {
      const { key } = event;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      const next = key === 'Home' ? minKg : key === 'End' ? maxKg : value + (key === 'ArrowLeft' || key === 'ArrowDown' ? -balanceStepKg : balanceStepKg);
      controls.onAdjust(adjustment, steppedBalanceValue(adjustment, next));
    }}>
    {children}
  </g>;
}

function DensityRiderScale({ riderKg, controls }: { riderKg: number; controls: DensityControls | undefined }) {
  const { startXM: firstTickX, spanM: tickSpan, maxKg } = balanceAdjustments.riderKg;
  const lastTickX = firstTickX + tickSpan;
  const riderWidth = .01;
  const trackStartX = firstTickX - .004;
  const trackEndX = lastTickX + riderWidth + .008;
  const riderLeftX = firstTickX + riderKg / maxKg * tickSpan;

  return <g data-balance-rider-scale="true">
    <rect data-balance-rider-track="true" x={trackStartX} y="-.043" width={trackEndX - trackStartX} height=".028" fill="#e8d3a3" />
    {Array.from({ length: 26 }, (_, tick) => {
      const x = firstTickX + tick / 25 * tickSpan;
      const major = tick % 5 === 0;
      return <g key={tick}>
        <path data-balance-rider-tick={tick} d={`M${x} -.043v${major ? .009 : .004}`} stroke="#6d7460" strokeWidth=".7" />
        {major && <text x={x} y="-.018" fontSize=".01" textAnchor="middle" fill="#465953">{tick / 5}</text>}
      </g>;
    })}
    <BalanceHandle adjustment="riderKg" value={riderKg} controls={controls}>
      {controls && <rect x={riderLeftX - .009} y="-.056" width={riderWidth + .018} height=".036" fill="transparent" />}
      <rect data-balance-rider="true" x={riderLeftX} y="-.05" width={riderWidth} height=".024" rx=".002" fill="#bd694e" />
    </BalanceHandle>
    <text x={trackEndX + .01} y="-.018" fontSize=".01" fill="#49675f">g</text>
  </g>;
}

export function densityBounds(item: EquipmentInstance) {
  return item.type === BALANCE ? { x: -.23, y: -.25, width: .46, height: .29 } : item.type === CYLINDER ? { x: -.065, y: -.255, width: .13, height: .28 } : item.type === SPECIMEN ? { x: -.025, y: -Number(item.parameters.volumeM3) / SPECIMEN_AREA_M2, width: .05, height: Number(item.parameters.volumeM3) / SPECIMEN_AREA_M2 + .012 } : item.type === BEAKER ? { x: -.045, y: -.11, width: .09, height: .125 } : { x: -.12, y: -.035, width: .24, height: .08 };
}
export function DensityGraphic({ instance: item, outcome, controls }: { instance: EquipmentInstance; outcome?: DensityOutcome | null | undefined; controls?: DensityControls | undefined }) {
  const touchWeight = useRef<{ pointerId: number; slot: string | null; released: boolean } | null>(null);
  const p = item.parameters;
  const result = outcome?.weighing.ok && outcome.weighing.balance.id === item.id ? outcome.weighing : null;
  const volume = outcome?.volume.ok && outcome.volume.cylinder.id === item.id ? outcome.volume : null;
  const drop = result ? Math.tanh(result.residualKg / .005) * .025 : 0;
  const trim = balanceAdjustments.zeroTrimKg;
  const trimKg = Number(p.zeroTrimKg);
  const nutX = trim.startXM + (trimKg - trim.minKg) / (trim.maxKg - trim.minKg) * trim.spanM;
  const onPan = standardMassesG.filter((_, index) => Number(result?.masses?.parameters.mask ?? 0) & (1 << index));
  const linkedBox = outcome?.weighing.ok && outcome.weighing.masses?.id === item.id;
  const water = volume?.liquid.readingM3 ?? Number(p.liquidM3 ?? 0), level = -.025 - Math.min(1, water / .0001) * .2;
  return <g className="real-apparatus" data-density-type={item.type} data-appearance="physical" stroke="none">
    {item.type === BALANCE && <>
      <rect x="-.1" y="0" width=".2" height=".025" rx=".008" fill="#344f58"/><path d="M-.02 0V-.14L0-.17 .02-.14V0" fill="#7b9699"/><circle cy="-.145" r=".011" fill="#ba9457"/>
      <path d={`M-.14 ${-.145 + drop}L0-.145 .14 ${-.145 - drop}`} fill="none" stroke="#627e83" strokeWidth="5"/>
      {[-1, 1].map(side => <g key={side}><path d={`M${side * .14} ${-.145 - side * drop}v.065`} stroke="#697f85" strokeWidth="1.5"/><path data-balance-pan={side === -1 ? 'left' : 'right'} d={`M${side * .14 - .055} ${-.08 - side * drop}q.055 .025 .11 0Z`} fill="#cad7d3" stroke="#678087" strokeWidth="1"/></g>)}
      <path d="M-.035-.215H.035M0-.222v.012" stroke="#738d85" strokeWidth="1"/><path data-balance-pointer="true" data-residual-kg={result?.residualKg} d={`M0-.145L${Math.max(-.034, Math.min(.034, -(result?.residualKg ?? 0) * 30))}-.212`} stroke={result?.balanced ? '#287a56' : '#bd6e3d'} strokeWidth="2"/>
      <DensityRiderScale riderKg={Number(p.riderKg)} controls={controls} />
      <g transform={`translate(0 ${-.145 + drop})`}>
        <path d="M-.223 0H-.14" stroke="#627e83" strokeWidth="2"/>
        <g transform={`translate(${nutX} 0)`}>
          <BalanceHandle adjustment="zeroTrimKg" value={trimKg} disabled={!result?.canZero} controls={controls}>
            <title>{result?.canZero ? '拖动调零螺母' : '调零螺母：先清空两盘并将游码归零'}</title>
            {controls && <rect x="-.017" y="-.02" width=".034" height=".04" fill="transparent" />}
            <rect x="-.01" y="-.012" width=".02" height=".024" rx=".003" fill="#b59564" stroke="#715a3d" strokeWidth="1"/>
            <path d="M-.004-.008V.008M.004-.008V.008" stroke="#715a3d" strokeWidth="1"/>
          </BalanceHandle>
        </g>
        {outcome && <text x={nutX} y="-.018" textAnchor="middle" fontSize=".011" fill="#465953" pointerEvents="none">调零螺母</text>}
      </g>
      {(onPan.length > 5 ? [onPan.slice(0, 5), onPan.slice(5)] : [onPan]).map((stack, column) => stack.map((g, row) => {
        const x = onPan.length <= 5 ? .14 : .113 + column * .054;
        const height = .012, y = -.08 - drop - (row + 1) * height;
        const width = .018 + Math.log10(g) * .012;
        return <g key={`${column}-${row}`} data-balance-weight={g}>
          <rect x={x - width / 2} y={y} width={width} height={height} rx=".0015" fill="#b69656" stroke="#755f32" strokeWidth=".7" />
          <text x={x} y={y + .009} fontSize=".009" textAnchor="middle" fill="#2e4549">{g}</text>
        </g>;
      }))}
    </>}
    {item.type === CYLINDER && <>
      <path d="M-.04-.24H-.031V-.025Q-.031-.015 0-.015T.031-.025V-.24H.04" fill="#e2f0ef44" stroke="#638b91" strokeWidth="1.5"/>
      <path data-liquid-fill="true" data-volume-m3={water} d={`M-.029 ${level - .005}Q0 ${level + .005} .029 ${level - .005}V-.025H-.029Z`} fill="#8bc4d488"/>
      <path data-meniscus="true" d={`M-.029 ${level - .005}Q0 ${level + .005} .029 ${level - .005}`} fill="none" stroke="#2d839b" strokeWidth="1.3"/>
      {Array.from({ length: 101 }, (_, i) => <g key={i}><path d={`M.013 ${-.025 - i * .002}h${i % 10 === 0 ? .016 : i % 5 === 0 ? .011 : .006}`} stroke="#52716e" strokeWidth={i % 10 === 0 ? 1 : .5}/>{i % 10 === 0 && <text x=".037" y={-.022 - i * .002} fontSize=".01" fill="#3d6259">{i}</text>}</g>)}
      <rect x="-.047" y="-.013" width=".094" height=".018" rx=".006" fill="#819e9d"/><text x="0" y="-.243" fontSize=".011" textAnchor="middle" fill="#3a6b66">mL · 1 mL/格</text>
      {volume?.liquid.overflow && <text x="0" y="-.263" fontSize=".016" textAnchor="middle" fill="#bb6243">溢出</text>}
    </>}
    {item.type === SPECIMEN && <><path d={`M-.013 0L-.018 ${-Number(p.volumeM3) / SPECIMEN_AREA_M2 * .7}L-.006 ${-Number(p.volumeM3) / SPECIMEN_AREA_M2}L.012 ${-Number(p.volumeM3) / SPECIMEN_AREA_M2 * .9}L.017-.015 0 .004Z`} fill="#818f8d" stroke="#526c6c" strokeWidth="1"/><path d={`M-.006 ${-Number(p.volumeM3) / SPECIMEN_AREA_M2}V${-Number(p.volumeM3) / SPECIMEN_AREA_M2 - .02}`} stroke="#8a9385" strokeWidth="1"/><text x="0" y="-.014" fontSize=".012" textAnchor="middle" fill="white">{String(p.sampleCode)}</text></>}
    {item.type === BEAKER && <><path d="M-.045-.1H-.035V0H.035V-.1H.025" fill="#e4eeeb55" stroke="#6d9393" strokeWidth="1.5"/><path d={`M-.033 ${-.003 - Math.min(.09, Number(p.liquidM3) / .00025 * .09)}Q0 ${.003 - Math.min(.09, Number(p.liquidM3) / .00025 * .09)} .033 ${-.003 - Math.min(.09, Number(p.liquidM3) / .00025 * .09)}V-.002H-.033Z`} fill="#81bfd477"/><text x="0" y="-.03" fontSize=".011" textAnchor="middle" fill="#4c7375">液体 {String(p.liquidCode)}</text></>}
    {item.type === MASS_SET && <>
      <rect x="-.115" y="-.023" width=".23" height=".06" rx=".008" fill="#b18f58" stroke="#78603d" strokeWidth="1"/>
      {standardMassesG.map((g, index) => {
        const onRightPan = !!(Number(p.mask) & (1 << index));
        const toggle = () => { if (linkedBox) controls?.onWeight(index); };
        return <g key={index} transform={`translate(${-.096 + index % 5 * .043},${-.004 + Math.floor(index / 5) * .025})`}
          className={controls ? 'density-weight-slot' : undefined} role={controls ? 'button' : undefined} tabIndex={controls ? 0 : undefined}
          data-density-weight-slot={controls ? index : undefined}
          aria-label={controls ? `砝码${index + 1} ${g} g` : undefined} aria-pressed={controls ? onRightPan : undefined} aria-disabled={controls ? !linkedBox : undefined}
          onPointerDown={controls && (event => {
            if (!linkedBox) return;
            event.stopPropagation();
            touchWeight.current = event.isPrimary && event.pointerType !== 'mouse' ? { pointerId: event.pointerId, slot: weightSlotAt(event), released: false } : null;
          })} onPointerUp={controls && (event => {
            if (!linkedBox) return;
            event.stopPropagation();
            const press = touchWeight.current;
            if (!press || press.pointerId !== event.pointerId) return;
            press.released = true;
            if (press.slot !== null && press.slot === weightSlotAt(event)) controls.onWeight(Number(press.slot));
          })} onPointerCancel={controls && (() => { touchWeight.current = null; })} onClick={controls && (event => {
            if (touchWeight.current?.released && event.detail !== 0) { touchWeight.current = null; return; }
            toggle();
          })} onKeyDown={controls && (event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) toggle();
        })}>
          {controls && <><title>{linkedBox ? `${g} g：${onRightPan ? '取回盒内' : '放上右盘'}` : '先将砝码盒与天平右盘关联'}</title><rect x="-.018" y="-.0125" width=".036" height=".025" fill="transparent" /></>}
          <circle r=".012" fill={onRightPan ? '#e4d7b4' : '#7c693f'} stroke={onRightPan ? '#94773e' : '#e0c18e'} strokeWidth="1" strokeDasharray={onRightPan ? '2 2' : undefined} />
          <text y=".003" fontSize=".01" textAnchor="middle" fill={onRightPan ? '#705d38' : '#fff4c9'}>{g}</text>
        </g>;
      })}
    </>}
  </g>;
}
