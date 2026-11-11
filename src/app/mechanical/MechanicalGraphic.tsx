import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';
import { buoyancyTypes } from '../../equipment/buoyancy/definitions.ts';
import { BuoyancyGraphic, buoyancyBounds } from '../buoyancy/BuoyancyGraphic.tsx';
import { weightDiscs, weightHookDrop } from '../../equipment/mechanical/weightChain.ts';
import { frictionTypes } from '../../equipment/mechanical/frictionDefinitions.ts';
import { FrictionGraphic, frictionBounds } from '../friction/FrictionGraphic.tsx';
import { SPRING } from '../../equipment/spring/definitions.ts';
import type { SpringOutcome } from '../../equipment/spring/simulate.ts';
import { SpringGraphic } from '../spring/SpringGraphic.tsx';
import { projectileTypes } from '../../equipment/projectile/definitions.ts';
import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
import { ProjectileGraphic, projectileBounds } from '../projectile/ProjectileGraphic.tsx';
import { RULER } from '../../equipment/optical/definitions.ts';
import { OpticalGraphic, opticalBounds } from '../optical/OpticalGraphic.tsx';

import { densityTypes } from '../../equipment/density/definitions.ts';
import type { DensityOutcome } from '../../equipment/density/simulate.ts';
import { DensityGraphic, densityBounds } from '../density/DensityGraphic.tsx';
import type { DensityControls } from '../density/DensityGraphic.tsx';
import { cartTypes } from '../../equipment/cart/definitions.ts';
import { CartGraphic, cartBounds } from '../cart/CartGraphic.tsx';
import type { CartRun } from '../../equipment/cart/simulate.ts';

export function mechanicalBounds(item: EquipmentInstance, springOutcome?: SpringOutcome | null) {
  if (buoyancyTypes.includes(item.type)) return buoyancyBounds(item);
  if (cartTypes.includes(item.type)) return cartBounds(item);
  if (densityTypes.includes(item.type)) return densityBounds(item);
  if (projectileTypes.includes(item.type)) return projectileBounds(item);
  if (item.type === SPRING) return { x: -.09, y: -.015, width: .125, height: (springOutcome?.ok ? springOutcome.value.lengthM : Number(item.parameters.originalLengthM)) + .06 };
  if (frictionTypes.includes(item.type)) return frictionBounds(item);
  if (item.type === MECHANICAL_RULER) return opticalBounds({ ...item, type: RULER });
  if (item.type === LEVER) { const half = Number(item.parameters.halfHooks) * Number(item.parameters.spacingM); return { x: -half - .09, y: -.035, width: half * 2 + .18, height: .08 }; }
  if (item.type === SUPPORT) return { x: -.065, y: -Number(item.parameters.heightM) - .03, width: .13, height: Number(item.parameters.heightM) + .05 };
  if (item.type === FORCE_METER) {
    const a = Number(item.parameters.directionDeg) * Math.PI / 180, x = .22 * Math.cos(a), y = -.22 * Math.sin(a);
    return { x: Math.min(0, x) - .035, y: Math.min(0, y) - .035, width: Math.abs(x) + .07, height: Math.abs(y) + .07 };
  }
  return { x: -.035, y: -.01, width: .07, height: weightHookDrop(item) + .02 };
}
export function MechanicalGraphic({ instance: item, outcome, pixelsPerM = 600, showWeightLabel = true, buoyancyReading, frictionReading, springOutcome, projectileFlight, densityOutcome, densityControls, cartRun }: { densityOutcome?: DensityOutcome | null | undefined; densityControls?: DensityControls | undefined; projectileFlight?: ProjectileFlight | null | undefined; springOutcome?: SpringOutcome | null | undefined; buoyancyReading?: { forceN: number; status: string } | undefined; frictionReading?: { forceN: number; status: string } | undefined; cartRun?: CartRun | null | undefined; instance: EquipmentInstance; outcome?: LeverOutcome | null; pixelsPerM?: number; showWeightLabel?: boolean }) {
  if (buoyancyTypes.includes(item.type)) return <BuoyancyGraphic item={item} />;
  if (cartTypes.includes(item.type)) return <CartGraphic instance={item} run={cartRun} />;
  if (densityTypes.includes(item.type)) return <DensityGraphic instance={item} outcome={densityOutcome} controls={densityControls} />;
  const p = item.parameters, half = Number(p.halfHooks ?? 6), spacing = Number(p.spacingM ?? .05);
  const meter = buoyancyReading ?? frictionReading ?? (outcome?.ok ? outcome.meters.find(meter => meter.id === item.id) : undefined);
  const pointer = outcome === undefined && !buoyancyReading ? 0 : meter && meter.status !== 'invalid' && Number.isFinite(meter.forceN) && Number(p.rangeN) > 0 ? Math.min(1, meter.forceN / Number(p.rangeN)) : null;
  const divisions = item.type === FORCE_METER ? Number(p.rangeN) / Number(p.resolutionN) : 1, tickStep = Math.max(1, Math.ceil(divisions / 200));
  if (projectileTypes.includes(item.type)) return <ProjectileGraphic instance={item} flight={projectileFlight} pixelsPerM={pixelsPerM} />;
  if (item.type === SPRING) return <SpringGraphic instance={item} outcome={springOutcome} />;
  if (frictionTypes.includes(item.type)) return <FrictionGraphic instance={item} />;
  if (item.type === MECHANICAL_RULER) return <OpticalGraphic instance={{ ...item, type: RULER }} pixelsPerM={pixelsPerM} />;
  return <g className="real-apparatus" data-appearance="physical" data-mechanical-type={item.type} stroke="none">
    {item.type === SUPPORT && <><rect x="-.055" y="0" width=".11" height=".02" rx=".007" fill="#344e58" /><rect x="-.007" y={-Number(p.heightM)} width=".014" height={Number(p.heightM)} fill="#9db0b6" /><path d={`M-.025 ${-Number(p.heightM) + .015}L0 ${-Number(p.heightM) - .015}L.025 ${-Number(p.heightM) + .015}Z`} fill="#526c71" /><circle cy={-Number(p.heightM)} r=".006" fill="#d9ad59" /></>}
    {item.type === LEVER && <>
      <rect x={-half * spacing - .012} y="-.014" width={half * spacing * 2 + .024} height=".028" rx=".004" fill="#d9bd7f" stroke="#98784b" strokeWidth="1" />
      {Array.from({ length: half * 2 + 1 }, (_, slot) => slot - half).map(index => <g key={index} data-lever-hook={index}>
        <path d={`M${index * spacing} -.012v.007`} stroke="#6f603c" strokeWidth="1" /><circle cx={index * spacing} cy=".006" r=".0035" fill="#536c70" /><text x={index * spacing} y="-.019" fontSize=".011" textAnchor="middle" fill="#365759">{index}</text>
      </g>)}
      <circle cx={Number(p.pivotIndex) * spacing} r=".007" fill="#3f6066" stroke="#dfb34d" strokeWidth="1" />
      {(['left', 'right'] as const).map(side => {
        const sign = side === 'left' ? -1 : 1, x = sign * (half * spacing + .015 + Number(p[side === 'left' ? 'leftNutOffsetM' : 'rightNutOffsetM'] ?? .02));
        return <g key={side} data-balance-nut={side}><path d={`M${sign * (half * spacing + .01)} .01H${sign * (half * spacing + .08)}`} stroke="#9e9790" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, tick) => <path key={tick} d={`M${sign * (half * spacing + .014 + tick * .005)} .006v.008`} stroke="#697777" strokeWidth=".6" />)}
          <rect x={x - .009} y="-.009" width=".018" height=".038" rx=".004" fill="#aa7952" stroke="#71513c" strokeWidth="1" /><path d={`M${x - .004} -.005v.03m.005-.03v.03`} stroke="#dec49c" strokeWidth="1" /></g>;
      })}
    </>}
    {item.type === WEIGHT && <>
      <rect x={-12 / pixelsPerM} y={-8 / pixelsPerM} width={24 / pixelsPerM} height={.025 + 16 / pixelsPerM} fill="transparent" pointerEvents="all" data-weight-grip="true" />
      <path d="M0 0v.025m-.006-.005q.006-.012.012 0" fill="none" stroke="#697c82" strokeWidth="1.5" />
      {Array.from({ length: weightDiscs(item) }, (_, index) => <g key={index}><rect x="-.025" y={.026 + index * .011} width=".05" height=".013" rx=".004" fill={index % 2 ? '#9aaeb2' : '#c5d2d1'} stroke="#6e8385" strokeWidth=".7" /><path d={`M-.02 ${.03 + index * .011}h.04`} stroke="#e7eeea" strokeWidth="1" /></g>)}
      <path data-weight-bottom="true" d={`M0 ${weightHookDrop(item) - .014}v.01q.008.009 0 .009q-.006 0-.006-.006`} fill="none" stroke="#697c82" strokeWidth="1.5" />
      {showWeightLabel && <text x="0" y={weightHookDrop(item) + .018} fontSize=".012" textAnchor="middle" fill="#34565a">{Number(p.massKg)} kg</text>}
    </>}
    {item.type === FORCE_METER && <g transform={`rotate(${-Number(p.directionDeg)})`} data-force-meter-status={outcome && !outcome.ok ? 'invalid' : meter?.status ?? 'disconnected'}>
      <path d="M0 0h.03m.14 0h.025" stroke="#647e84" strokeWidth="2" /><circle r=".005" fill="none" stroke="#627d82" strokeWidth="1.5" />
      <rect x=".025" y="-.024" width=".15" height=".048" rx=".009" fill="#e2e8db" stroke="#496867" strokeWidth="1.5" />
      <path d="M.032 0l.005-.008.005.016.005-.016.005.016.005-.016.005.008" fill="none" stroke="#7a8f8e" strokeWidth="1" />
      {Array.from({ length: Math.floor(divisions / tickStep) + 1 }, (_, index) => <path key={index} d={`M${.065 + index * tickStep / divisions * .09} -.018v${index * tickStep % 5 ? .005 : .009}`} stroke="#5d7674" strokeWidth=".7" />)}
      {[0, .5, 1].map(fraction => <text key={fraction} x={.065 + fraction * .09} y=".017" fontSize=".009" textAnchor="middle" fill="#355557">{Number((Number(p.rangeN) * fraction).toPrecision(4))}</text>)}
      {pointer !== null && <path data-force-meter-pointer="true" data-pointer-fraction={pointer} data-applied-force-n={meter?.forceN ?? 0} d={`M${.065 + .09 * pointer} -.014v.022`} stroke="#c8543b" strokeWidth="2" />}
      <circle cx=".205" r=".012" fill="none" stroke="#53736f" strokeWidth="2" /><text x=".11" y=".004" fontSize=".009" fill="#4d6662">N</text>
    </g>}
  </g>;
}
