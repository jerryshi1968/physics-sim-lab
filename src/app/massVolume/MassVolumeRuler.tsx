import type { EquipmentInstance } from '../../core/equipment/schema.ts';
export function MassVolumeRuler({ instance, pixelsPerM }: { instance: EquipmentInstance; pixelsPerM: number }) {
  const length = Number(instance.parameters.lengthM), step = pixelsPerM >= 1000 ? .001 : .005, font = 11 / pixelsPerM;
  return <g className="real-apparatus" data-appearance="physical" data-mass-volume-ruler="true" stroke="none"><rect x="0" y="-.012" width={length} height=".035" rx=".002" fill="#e4d3a2" stroke="#637b7e" strokeWidth=".7" />
    {Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => { const x = i * step, cm = x * 100, major = Math.abs(cm - Math.round(cm)) < 1e-7, half = Math.abs(cm * 2 - Math.round(cm * 2)) < 1e-7; return <g key={i}><path d={`M${x} 0v${major ? .012 : half ? .008 : .005}`} stroke="#405959" strokeWidth=".7" />{major && (pixelsPerM >= 1000 || Math.round(cm) % 5 === 0) && <text x={x} y=".019" textAnchor="middle" fontSize={font} fill="#263f43">{Math.round(cm)}</text>}</g>; })}
    <text x={length / 2} y="-.004" fontSize={font} textAnchor="middle" fill="#3b6063">cm · 每小格 1 mm</text>
  </g>;
}
