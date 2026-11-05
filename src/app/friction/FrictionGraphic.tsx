import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { BLOCK, SURFACE, DRIVE, LOAD } from '../../equipment/mechanical/frictionDefinitions.ts';

export function frictionBounds(item: EquipmentInstance) {
  if (item.type === SURFACE) return { x: -Number(item.parameters.lengthM) / 2, y: 0, width: Number(item.parameters.lengthM), height: .07 };
  if (item.type === BLOCK) return { x: -Number(item.parameters.widthM) / 2, y: -Number(item.parameters.heightM) / 2, width: Number(item.parameters.widthM), height: Number(item.parameters.heightM) };
  return item.type === LOAD ? { x: -.045, y: -.035, width: .09, height: .04 } : { x: -.06, y: -.055, width: .12, height: .11 };
}
export function FrictionGraphic({ instance: item }: { instance: EquipmentInstance }) {
  const p = item.parameters, bounds = frictionBounds(item);
  return <g className="real-apparatus" data-appearance="physical" data-friction-type={item.type} stroke="none">
    {item.type === SURFACE && <><rect {...bounds} rx=".008" fill={p.material === 'cloth' ? '#9ba9a0' : p.material === 'rough' ? '#8a8272' : '#b49265'} stroke="#77684f" strokeWidth="1" />
      {Array.from({ length: Math.ceil(bounds.width / .05) }, (_, index) => <path key={index} d={`M${bounds.x + index * .05} .01l.025 .015m-.015 .005l.02 .015`} stroke="#e1d8bf" strokeWidth=".7" />)}<path d={`M${bounds.x} 0H${bounds.x + bounds.width}`} stroke="#536d68" strokeWidth="2" /></>}
    {item.type === BLOCK && <><rect {...bounds} rx=".006" fill="#cda56c" stroke="#846140" strokeWidth="1.5" /><path d={`M${bounds.x + .015} -.012h${bounds.width - .03}m0 .022H${bounds.x + .015}`} stroke="#e9cc94" strokeWidth="1" /><circle cx={bounds.width / 2} r=".005" fill="none" stroke="#546e70" strokeWidth="1.5" /><text y=".006" textAnchor="middle" fontSize=".019" fill="#3c514c">木块</text></>}
    {item.type === LOAD && <><rect {...bounds} rx=".008" fill="#9caaae" stroke="#62797e" strokeWidth="1" /><path d="M-.015-.035v-.012h.03v.012" fill="none" stroke="#596f75" strokeWidth="2" /><text y="-.008" textAnchor="middle" fontSize=".015" fill="#243f45">{Number(p.massKg)} kg</text></>}
    {item.type === DRIVE && <><rect {...bounds} rx=".014" fill="#445e63" stroke="#31484d" strokeWidth="1.5" /><circle r=".033" fill="#d3d9ce" stroke="#869994" strokeWidth="1" /><path d="M-.022 0H.022M0-.022V.022" stroke="#647b77" strokeWidth="2" /><circle r=".008" fill="#be8e4e" /><text y=".047" textAnchor="middle" fontSize=".014" fill="#f1eedc">牵引</text></>}
  </g>;
}
