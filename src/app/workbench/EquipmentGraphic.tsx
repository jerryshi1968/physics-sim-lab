import { AMMETER, JUNCTION, LAMP, POWER, RESISTOR, SWITCH, VOLTMETER, RHEOSTAT } from '../../equipment/electrical/definitions.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { DcBranchValue } from '../../core/electrical/solve.ts';
import type { MeterReading } from '../../core/electrical/instruments.ts';
import { MeterGraphic } from './MeterGraphic.tsx';
import { RheostatGraphic } from './RheostatGraphic.tsx';
import type { RheostatInteraction } from './RheostatGraphic.tsx';

export function EquipmentGraphic({ instance, branchValue, meter, onToggleSwitch, onWiperPointerDown, onWiperKeyDown }: { instance: EquipmentInstance; branchValue?: DcBranchValue | undefined; meter?: MeterReading | undefined; onToggleSwitch?: (() => void) | undefined } & RheostatInteraction) {
  const id = useId();
  const touchToggle = useRef(false);
  const wood = `url(#${id}-wood)`;
  const metal = `url(#${id}-metal)`;
  const brightness = branchValue?.brightness ?? 0;
  // Keep apparatus bodies free of SVG shadow filters, which can hide the entire group in WebKit.
  return <g className="real-apparatus" stroke="none" data-appearance="physical">
    <defs>
      <linearGradient id={`${id}-wood`} x2="0" y2="1"><stop stopColor="#dfc196" /><stop offset=".5" stopColor="#c99d68" /><stop offset="1" stopColor="#aa7947" /></linearGradient>
      <linearGradient id={`${id}-metal`} x2="0" y2="1"><stop stopColor="#fafbfc" /><stop offset=".35" stopColor="#b8c0c7" /><stop offset=".6" stopColor="#f5f6f8" /><stop offset="1" stopColor="#737e86" /></linearGradient>
      <linearGradient id={`${id}-cell`} x2="0" y2="1"><stop stopColor="#edb84f" /><stop offset=".35" stopColor="#ffe294" /><stop offset=".65" stopColor="#d49c37" /><stop offset="1" stopColor="#9b6b22" /></linearGradient>
      <linearGradient id={`${id}-ceramic`} x2="0" y2="1"><stop stopColor="#e4eadf" /><stop offset=".45" stopColor="#ffffff" /><stop offset="1" stopColor="#a9b4a2" /></linearGradient>
      <radialGradient id={`${id}-lamp-glow`}><stop stopColor="#fff6bc" /><stop offset=".45" stopColor="#ffd464" stopOpacity=".7" /><stop offset="1" stopColor="#ffc443" stopOpacity="0" /></radialGradient>
    </defs>
    {instance.type === POWER && <g>
      <rect x="-.067" y="-.03" width=".134" height=".06" rx=".009" fill="#293e48" />
      <rect x="-.059" y="-.022" width=".118" height=".044" rx=".004" fill="#132830" />
      <rect data-battery-cell="true" x="-.048" y="-.017" width=".096" height=".034" rx=".005" fill={`url(#${id}-cell)`} />
      <rect x="-.048" y="-.017" width=".015" height=".034" rx=".003" fill={metal} />
      <rect x="-.052" y="-.006" width=".004" height=".012" fill="#c6ced0" />
      <text data-battery-voltage="true" x=".007" y=".005" textAnchor="middle" fontSize=".014" fill="#624a1e">{String(instance.parameters.voltageV)} V</text>
      <path d="M-.075 0H-.065M.065 0H.075" stroke="#a8b7ba" strokeWidth="4" />
      <text x="-.06" y="-.015" fontSize=".016" fill="#ffb4a0">+</text><text x=".05" y="-.015" fontSize=".016" fill="#d8e5eb">−</text>
    </g>}
    {instance.type === RESISTOR && <g>
      <rect x="-.072" y="-.039" width=".144" height=".078" rx=".006" fill={wood} />
      <path d="M-.066-.029H.066M-.064.03H.064" stroke="#b88b5e" strokeWidth="1" />
      <rect x="-.075" y="-.006" width=".15" height=".012" fill={metal} />
      <rect x="-.038" y="-.018" width=".076" height=".036" rx=".009" fill={`url(#${id}-ceramic)`} />
      <rect x="-.04" y="-.014" width=".008" height=".028" rx=".003" fill={metal} /><rect x=".032" y="-.014" width=".008" height=".028" rx=".003" fill={metal} />
      <text x="0" y=".004" textAnchor="middle" fontSize=".012" fill="#42523b">{String(instance.parameters.resistanceOhm)} Ω</text>
      {[-.058, .058].map(x => <g key={x}><circle cx={x} cy=".027" r=".004" fill="#e5d4b5" /><path d={`M${x - .0025} .027h.005`} stroke="#735e3d" strokeWidth="1" /></g>)}
    </g>}
    {instance.type === SWITCH && <g>
      <rect x="-.073" y="-.034" width=".146" height=".074" rx=".008" fill="#2e3437" />
      <rect x="-.065" y="-.026" width=".13" height=".057" rx=".005" fill="#454d4d" />
      <rect x="-.075" y="-.008" width=".045" height=".016" rx=".003" fill="#b5934f" /><rect x=".025" y="-.008" width=".05" height=".016" rx=".003" fill="#b5934f" />
      <g className="switch-toggle" transform={`translate(-.035 0) rotate(${instance.parameters.closed ? 0 : -38})`}
        role={onToggleSwitch ? 'button' : undefined} tabIndex={onToggleSwitch ? 0 : undefined}
        aria-label={onToggleSwitch ? `${instance.parameters.closed ? '打开' : '合上'}开关` : undefined}
        data-switch-closed={instance.parameters.closed === true}
        onPointerDown={event => { if (onToggleSwitch && !event.shiftKey) { touchToggle.current = false; event.stopPropagation(); } }}
        onPointerUp={event => {
          if (!onToggleSwitch || event.shiftKey) return;
          event.stopPropagation();
          if (event.isPrimary && event.pointerType !== 'mouse') { touchToggle.current = true; onToggleSwitch(); }
        }} onClick={event => {
          if (!onToggleSwitch || event.shiftKey) return;
          event.stopPropagation();
          if (touchToggle.current && event.detail !== 0) { touchToggle.current = false; return; }
          touchToggle.current = false; onToggleSwitch();
        }} onKeyDown={event => {
          if (onToggleSwitch && !event.shiftKey && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) onToggleSwitch(); }
        }}>
        <rect className="switch-toggle-focus" x="-.005" y="-.02" width=".092" height=".04" rx=".004" fill="none" stroke="#da982c" strokeWidth="2" pointerEvents="none" />
        <rect x="0" y="-.006" width=".082" height=".012" rx=".003" fill="#c99042" />
        <rect x=".02" y="-.013" width=".033" height=".026" rx=".005" fill="#b54d36" />
        <path d="M.026-.007v.014M.034-.007v.014M.042-.007v.014" stroke="#893c2c" strokeWidth="1" />
      </g>
      <circle cx="-.035" r=".006" fill={metal} /><text x="0" y=".032" textAnchor="middle" fontSize=".01" fill="#d2dddc">{instance.parameters.closed ? '闭合' : '断开'}</text>
    </g>}
    {instance.type === JUNCTION && <circle r=".01" fill="#7b847e" />}
    {instance.type === LAMP && <g data-lamp-brightness={brightness} data-lamp-power-w={branchValue?.powerW ?? undefined} data-lamp-status={branchValue ? 'valid' : 'unavailable'}>
      <title>{branchValue?.powerW === undefined || branchValue.powerW === null ? '尚无有效灯泡功率' : `耗散功率：${Number(branchValue.powerW.toPrecision(4))} W；亮度为教学示意`}</title>
      <ellipse data-lamp-halo="true" cy="-.018" rx={.042 + .045 * brightness} ry={.04 + .045 * brightness} fill={`url(#${id}-lamp-glow)`} opacity={brightness} />
      <rect x="-.07" y=".012" width=".14" height=".036" rx=".006" fill={wood} />
      <path d="M-.075 0H-.025V.026M.075 0H.025V.026" fill="none" stroke="#a4aca2" strokeWidth="3" />
      <ellipse cy="-.02" rx=".035" ry=".037" fill="#d9e4df" opacity=".9" stroke="#94aaa1" strokeWidth="1" />
      <ellipse data-lamp-emission="true" cy="-.02" rx=".035" ry=".037" fill="#ffdc62" opacity={brightness} />
      <ellipse cy="-.02" rx=".027" ry=".029" fill="#fffce6" opacity={brightness * brightness} />
      <rect x="-.022" y=".012" width=".044" height=".019" rx=".004" fill={metal} />
      <path data-lamp-filament="true" d="M-.02 .018H.02M-.02 .024H.02M-.013 .01V-.009l.009-.009 .008.009 .009-.009V.01" fill="none" stroke={`hsl(${25 + 30 * brightness} ${20 + 80 * brightness}% ${35 + 55 * brightness}%)`} strokeWidth={1 + brightness} />
      <text x="0" y=".043" fontSize=".009" fill="#5c503a" textAnchor="middle">{String(instance.parameters.ratedVoltageV)} V · {String(instance.parameters.ratedCurrentA)} A</text>
    </g>}
    {instance.type === RHEOSTAT && <RheostatGraphic instance={instance} wood={wood} metal={metal} onWiperPointerDown={onWiperPointerDown} onWiperKeyDown={onWiperKeyDown} />}
    {(instance.type === AMMETER || instance.type === VOLTMETER) && <MeterGraphic instance={instance} {...(meter ? { reading: meter } : {})} />}
  </g>;
}
import { useId, useRef } from 'react';

