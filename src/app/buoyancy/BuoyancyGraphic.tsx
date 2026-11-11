import { useId } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import { BODY, OVERFLOW, vesselHeightM, spoutHeightM, vesselAreaM2 } from '../../equipment/buoyancy/definitions.ts';
import { SUPPORT } from '../../equipment/mechanical/definitions.ts';
import { isReceiver } from '../../equipment/buoyancy/simulate.ts';
import type { BuoyancyOutcome } from '../../equipment/buoyancy/simulate.ts';

export function buoyancyBounds(item: EquipmentInstance) {
  if (item.type === BODY) { const r = Math.sqrt(Number(item.parameters.areaM2) / Math.PI); return { x: -r, y: -Number(item.parameters.heightM) - .018, width: 2 * r, height: Number(item.parameters.heightM) + .02 }; }
  const height = isReceiver(item) ? .11 : vesselHeightM + (item.type === OVERFLOW ? 0 : .01);
  return { x: -.042, y: -height - .015, width: item.type === OVERFLOW ? .155 : .084, height: height + .025 };
}

export function BuoyancyOverlay({ outcome, view, size }: { outcome: BuoyancyOutcome; view: NonNullable<SceneDocument['viewport']>; size: { width: number; height: number } }) {
  const { body, meter } = outcome;
  if (!meter) return null;
  const support = outcome.view.equipment.find(item => item.type === SUPPORT && item.id === meter.parameters.supportId);
  const bracket = support ? worldToScreen({ xM: support.pose.xM, yM: meter.pose.yM }, view, size) : null;
  const mount = worldToScreen(meter.pose, view, size);
  const top = worldToScreen({ xM: meter.pose.xM, yM: meter.pose.yM - .217 }, view, size);
  const bottom = body ? worldToScreen({ xM: body.pose.xM, yM: body.pose.yM + Number(body.parameters.heightM) + .015 }, view, size) : null;
  return <g pointerEvents="none">{bracket && <path d={`M${bracket.x} ${bracket.y}H${mount.x}`} stroke="#678b8b" strokeWidth="4" />}{body?.parameters.meterId === meter.id && bottom && <path d={`M${top.x} ${top.y}L${bottom.x} ${bottom.y}`} stroke="#597b78" strokeWidth="1.5" />}</g>;
}

export function BuoyancyGraphic({ item, outcome }: { item: EquipmentInstance; outcome?: BuoyancyOutcome | null }) {
  const clip = useId(), p = item.parameters;
  if (item.type === BODY) {
    const radius = Math.sqrt(Number(p.areaM2) / Math.PI), height = Number(p.heightM);
    const liquid = outcome?.liquids.find(peer => peer.item.id === outcome.vessel?.id), wetHeight = liquid ? Math.max(0, Math.min(height, liquid.level - item.pose.yM)) : 0;
    return <g className="real-apparatus" data-appearance="physical" data-buoyancy-body="true" stroke="none">
      <rect x={-radius} y={-height} width={2 * radius} height={height} fill="#9ba7a1" stroke="#526b69" strokeWidth="1.2" />
      <rect data-buoyancy-wet-m3={outcome?.submergedM3 ?? 0} x={-radius} y={-wetHeight} width={2 * radius} height={wetHeight} fill="#69b4c18a" />
      <ellipse cy={-height} rx={radius} ry=".004" fill="#cbd3cd" stroke="#526b69" strokeWidth="1" />
      <path d={`M-.005 ${-height}v-.009q.005-.012.01 0v.009`} stroke="#657d7a" strokeWidth="1.5" fill="none" />
      {Array.from({ length: Math.floor(height / .01) + 1 }, (_, index) => <path key={index} d={`M${-radius} ${-index * .01}h.006`} stroke="#465e5b" strokeWidth=".8" />)}
    </g>;
  }
  const receiver = isReceiver(item), half = receiver ? .035 : .04, height = receiver ? .11 : vesselHeightM + (item.type === OVERFLOW ? 0 : .01);
  const fluid = outcome?.liquids.find(peer => peer.item.id === item.id);
  const level = fluid ? fluid.level - item.pose.yM : .01 + Number(p.liquidM3) / (receiver ? .0025 : vesselAreaM2);
  return <g className="real-apparatus" data-appearance="physical" data-buoyancy-container={item.id} data-buoyancy-liquid-m3={Number(p.liquidM3)} stroke="none">
    <defs><clipPath id={clip}><rect x={-half + .002} y={-height} width={2 * half - .004} height={height - .01} /></clipPath></defs>
    <g clipPath={`url(#${clip})`}><rect x={-half} y={-level} width={2 * half} height={Math.max(0, level - .01)} fill="#82c6d080" /><path d={`M${-half} ${-level}Q0 ${-level + .005} ${half} ${-level}`} stroke="#398d9b" strokeWidth="1.2" fill="none" /></g>
    <path d={`M${-half} ${-height}V-.01Q0 .002 ${half} -.01V${-height}`} fill="#e8f4f422" stroke="#6d979c" strokeWidth="1.5" />
    {item.type === OVERFLOW && <><path d={`M.04 ${-.01 - spoutHeightM}H.09L.10 ${-.01 - spoutHeightM + .015}`} stroke="#6d979c" strokeWidth="4" fill="none" /><path d={`M-.04 ${-.01 - spoutHeightM}H.04`} stroke="#839c9e" strokeDasharray="3 3" strokeWidth="1" /></>}
    {!receiver && item.type !== OVERFLOW && Array.from({ length: 7 }, (_, index) => <g key={index}><path d={`M.025 ${-.01 - index * .025}h.013`} stroke="#668c90" strokeWidth="1" /><text x=".044" y={-.008 - index * .025} fontSize=".009" fill="#416e72">{index * 100}</text></g>)}
  </g>;
}
