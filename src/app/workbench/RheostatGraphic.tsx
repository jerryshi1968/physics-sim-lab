import type { KeyboardEvent, PointerEvent } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { rheostatWiperXM } from '../../core/workbench/rheostat.ts';

export interface RheostatInteraction {
  onWiperPointerDown?: ((event: PointerEvent<SVGGElement>) => void) | undefined;
  onWiperKeyDown?: ((event: KeyboardEvent<SVGGElement>) => void) | undefined;
}

export function RheostatGraphic({ instance, wood, metal, shadow, onWiperPointerDown, onWiperKeyDown }: RheostatInteraction & {
  instance: EquipmentInstance; wood: string; metal: string; shadow: string;
}) {
  const position = Number(instance.parameters.position), percentage = Number((position * 100).toFixed(1));
  return <g data-rheostat-position={position} filter={shadow}>
    <rect data-rheostat-base="true" x="-.082" y=".025" width=".164" height=".029" rx=".005" fill={wood} />
    <path d="M-.075 .032L-.045 .008M.075 .032L.045 .008" stroke="#b9b29a" strokeWidth="3" />
    <rect x="-.061" y="-.013" width=".122" height=".038" rx=".012" fill="#dbceb0" stroke="#a39373" strokeWidth="1" />
    {Array.from({ length: 31 }, (_, index) => <path key={index} d={`M${-.045 + index * .003} -.011v.034`} stroke={index % 2 ? '#887858' : '#a89876'} strokeWidth=".8" />)}
    <rect x="-.062" y="-.009" width=".012" height=".03" rx=".004" fill={metal} /><rect x=".05" y="-.009" width=".012" height=".03" rx=".004" fill={metal} />
    <path d="M-.075-.04H.075M-.065-.04V-.007M.065-.04V-.007" stroke="#b3b9b8" strokeWidth="3" fill="none" />
    <text x="0" y=".046" fontSize=".010" fill="#5e4c30" textAnchor="middle">{String(instance.parameters.maxResistanceOhm)} Ω</text>
    <text x="-.072" y=".057" fontSize=".009" fill="#5e4c30" textAnchor="middle">A</text><text x=".072" y=".057" fontSize=".009" fill="#5e4c30" textAnchor="middle">B</text>
    <text x="-.072" y="-.054" fontSize=".009" fill="#4f6259" textAnchor="middle">C</text><text x=".072" y="-.054" fontSize=".009" fill="#4f6259" textAnchor="middle">D</text>
    <g className="rheostat-slider" data-rheostat-slider={instance.id} transform={`translate(${rheostatWiperXM(position)} 0)`}
      role={onWiperPointerDown ? 'slider' : undefined} tabIndex={onWiperPointerDown ? 0 : undefined}
      aria-label={onWiperPointerDown ? '滑动变阻器滑片' : undefined} aria-orientation={onWiperPointerDown ? 'horizontal' : undefined}
      aria-valuemin={onWiperPointerDown ? 0 : undefined} aria-valuemax={onWiperPointerDown ? 100 : undefined}
      aria-valuenow={onWiperPointerDown ? percentage : undefined} aria-valuetext={onWiperPointerDown ? `${percentage}%（A 端为 0%，B 端为 100%）` : undefined}
      onPointerDown={onWiperPointerDown} onKeyDown={onWiperKeyDown} onClick={event => { if (onWiperPointerDown) event.stopPropagation(); }}>
      <rect x="-.024" y="-.058" width=".048" height=".076" fill="transparent" />
      <rect className="rheostat-slider-focus" x="-.022" y="-.058" width=".044" height=".076" rx=".004" fill="none" stroke="#da982c" strokeWidth="2" pointerEvents="none" />
      <path d="M0-.043V.006" stroke="#909b97" strokeWidth="3" />
      <rect data-rheostat-thumb="true" x="-.011" y="-.053" width=".022" height=".021" rx=".004" fill="#b95237" />
      <path d="M-.006-.048v.011M0-.048v.011M.006-.048v.011" stroke="#843e2c" strokeWidth=".8" />
      <path d="M0 .012l-.007-.009H.007Z" fill="#c59142" stroke="#8e6b35" strokeWidth=".7" />
    </g>
  </g>;
}
