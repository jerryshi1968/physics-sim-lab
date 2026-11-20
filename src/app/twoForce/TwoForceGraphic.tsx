import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { CART, TRACK } from '../../equipment/cart/definitions.ts';
export function twoForceBounds(item: EquipmentInstance) { return item.type === TRACK ? { x: -Number(item.parameters.lengthM) / 2 - .04, y: -.32, width: Number(item.parameters.lengthM) + .08, height: .64 } : { x: -.13, y: -.09, width: .26, height: .18 }; }
export function TwoForceGraphic({ item }: { item: EquipmentInstance }) {
  const half = Number(item.parameters.lengthM) / 2;
  return <g className="real-apparatus" data-appearance="physical" data-two-force-type={item.type} stroke="none">
    {item.type === TRACK && <><rect x={-half} y="-.3" width={2 * half} height=".6" rx=".015" fill="#e2d4ab" fillOpacity=".3" stroke="#9a8b69" strokeWidth="1.3" /><path d={`M${-half} 0H${half}`} stroke="#91a69a" strokeDasharray="4 4" strokeWidth=".8" />{[-1, 1].map(sign => <g key={sign}><rect x={sign * half - .035} y="-.04" width=".07" height=".08" rx=".012" fill="#80999a" /><circle cx={sign * half} r=".026" fill="#e1e7dc" stroke="#587776" strokeWidth="1.6" /><circle cx={sign * half} r=".006" fill="#678784" /></g>)}</>}
    {item.type === CART && <>{[-.075, .075].flatMap(x => [-.062, .062].map(y => <rect key={`${x},${y}`} x={x - .025} y={y - .012} width=".05" height=".024" rx=".006" fill="#3d4b51" />))}<rect x="-.11" y="-.05" width=".22" height=".1" rx=".012" fill="#b99757" stroke="#7f714f" strokeWidth="1.4" /><rect x="-.085" y="-.035" width=".17" height=".07" rx=".008" fill="#e7cd86" />{[-.11, .11].map(x => <circle key={x} cx={x} r=".009" fill="#dce4dd" stroke="#527775" strokeWidth="1.3" />)}<path d="M-.025 0h.05" stroke="#b08a47" strokeWidth="1" /></>}
  </g>;
}
