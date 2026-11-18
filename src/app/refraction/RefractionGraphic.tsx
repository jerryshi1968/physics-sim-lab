import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { TANK } from '../../equipment/refraction/definitions.ts';
import { NORMAL, PROTRACTOR } from '../../equipment/reflection/definitions.ts';
import { reflectionBounds, ReflectionGraphic } from '../reflection/ReflectionGraphic.tsx';
import { opticalBounds, OpticalGraphic } from '../optical/OpticalGraphic.tsx';
import { RULER } from '../../equipment/optical/definitions.ts';
export function refractionBounds(item: EquipmentInstance) {
  if (item.type === TANK) return { x: -Number(item.parameters.widthM) / 2 - .02, y: -.07, width: Number(item.parameters.widthM) + .04, height: Number(item.parameters.depthM) + .1 };
  if (item.type === RULER) return opticalBounds(item);
  if (item.type === NORMAL) { const h = Number(item.parameters.lengthM); return { x: -.018, y: -h, width: .036, height: h * 2 }; }
  return reflectionBounds(item);
}
export function RefractionGraphic({ instance: item }: { instance: EquipmentInstance }) {
  if (item.type === RULER) return <OpticalGraphic instance={item} />;
  if (item.type === TANK) {
    const w = Number(item.parameters.widthM), h = Number(item.parameters.depthM);
    return <g className="real-apparatus" stroke="none" data-appearance="physical" data-refraction-tank="true"><rect x={-w / 2} y="-.055" width={w} height={h + .055} rx=".009" fill="#f4fbfc" fillOpacity=".25" stroke="#6e9599" strokeWidth="2" /><rect x={-w / 2 + .006} y="0" width={w - .012} height={h - .006} fill="#b4e0ec" fillOpacity=".55" /><path d={`M${-w / 2} 0H${w / 2}`} stroke="#50a4b9" strokeWidth="2" /><path d={`M${-w / 2 - .015} -.06H${w / 2 + .015}M${-w / 2} ${h + .009}H${w / 2}`} stroke="#84aeb2" strokeWidth="3" /><text x={-w / 2 + .03} y="-.018" fontSize=".025" fill="#3a6670">空气</text><text x={-w / 2 + .03} y={h * .5} fontSize=".025" fill="#3a6670">水</text></g>;
  }
  if (item.type === PROTRACTOR) {
    const r = Number(item.parameters.radiusM), rotation = item.pose.rotationRad * 180 / Math.PI, k = r / .36;
    return <g className="real-apparatus" stroke="none" data-appearance="physical" data-refraction-gauge="true"><path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`} fill="#e4eee512" stroke="#93a88c" strokeWidth="1.2" />{Array.from({ length: 181 }, (_, degree) => { const a = (degree - 90) * Math.PI / 180, major = degree % 10 === 0, start = r - (major ? .035 : degree % 5 === 0 ? .022 : .012) * k, x = Math.sin(a) * (r - .061 * k), y = degree === 0 || degree === 180 ? -.025 * k : -Math.cos(a) * (r - .061 * k) + .006 * k; return <g key={degree}><path d={`M${Math.sin(a) * start} ${-Math.cos(a) * start}L${Math.sin(a) * r} ${-Math.cos(a) * r}`} stroke="#657f73" strokeWidth={major ? 1 : .5} />{major && <text x={x} y={y} transform={`rotate(${rotation} ${x} ${y})`} fontSize={.022 * k} textAnchor="middle" fill="#315a4e">{Math.abs(degree - 90)}</text>}</g>; })}<path d="M-.015 0H.015M0-.015V.015" stroke="#577b72" strokeWidth="1" /></g>;
  }
  return <><ReflectionGraphic instance={item} />{item.type === NORMAL && <g className="real-apparatus" stroke="none" fill="none"><path d={`M0 0V${Number(item.parameters.lengthM)}`} stroke="#377d70" strokeDasharray="5 4" strokeWidth="1.5" /></g>}</>;
}
