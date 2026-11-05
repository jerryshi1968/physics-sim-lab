import { useId } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from '../../equipment/optical/definitions.ts';

import { reflectionTypes } from '../../equipment/reflection/definitions.ts';
import { ReflectionGraphic, reflectionBounds } from '../reflection/ReflectionGraphic.tsx';

export function opticalBounds(instance: EquipmentInstance) {
  if (reflectionTypes.includes(instance.type)) return reflectionBounds(instance);
  const length = Number(instance.parameters.lengthM ?? .08), height = Number(instance.parameters.heightM ?? .08);
  return instance.type === BENCH || instance.type === RULER ? { x: -.012, y: -.025, width: length + .024, height: .06 }
    : { x: instance.type === SCREEN ? -Math.max(.06, Number(instance.parameters.widthM) * .36 + .03) / 2 : -.045, y: -height / 2 - .025, width: instance.type === SCREEN ? Math.max(.06, Number(instance.parameters.widthM) * .36 + .03) : .09, height: Math.max(.07, instance.pose.yM) + height / 2 + .04 };
}
export function OpticalGraphic({ instance, pixelsPerM = 600, benchYM = 0 }: { instance: EquipmentInstance; pixelsPerM?: number; benchYM?: number }) {
  const id = useId(), { type, parameters, pose } = instance, base = Math.max(.04, pose.yM - benchYM), length = Number(parameters.lengthM ?? 1);
  const isScale = type === BENCH || type === RULER, step = type === BENCH ? .01 : pixelsPerM >= 1000 ? .001 : .005;
  if (reflectionTypes.includes(type)) return <ReflectionGraphic instance={instance} />;
  return <g className="real-apparatus" data-appearance="physical" data-optical-type={type} stroke="none">
    <defs><linearGradient id={`${id}-metal`} x2="0" y2="1"><stop stopColor="#dbe8ed" /><stop offset=".5" stopColor="#7f939d" /><stop offset="1" stopColor="#d4dfe2" /></linearGradient></defs>
    {isScale ? <>
      <rect x="0" y={type === BENCH ? 0 : -.012} width={length} height={type === BENCH ? .026 : .035} rx=".003" fill={type === BENCH ? `url(#${id}-metal)` : '#e4d3a2'} stroke="#637b7e" strokeWidth=".7" />
      {type === BENCH && <><rect x=".025" y=".025" width=".06" height=".015" rx=".003" fill="#334e57" /><rect x={length - .085} y=".025" width=".06" height=".015" rx=".003" fill="#334e57" /></>}
      {Array.from({ length: Math.floor(length / step) + 1 }, (_, index) => {
        const x = index * step, major = Math.abs(x / .05 - Math.round(x / .05)) < 1e-7;
        return <g key={index}><path d={`M${x} 0v${major ? .013 : .006}`} stroke="#405959" strokeWidth=".7" />{major && <text x={x} y=".022" fontSize=".010" textAnchor="middle" fill="#263f43">{Math.round(x * 100)}</text>}</g>;
      })}<text x={length / 2} y="-.005" fontSize=".009" textAnchor="middle" fill="#3b6063">{type === BENCH ? '光具座 · cm' : '独立尺 · cm（细格 1 mm，放大读尺）'}</text>
    </> : <>
      <rect x="-.004" y=".018" width=".008" height={Math.max(.015, base - .018)} fill={`url(#${id}-metal)`} /><rect x="-.026" y={base} width=".052" height=".014" rx=".004" fill="#344f59" /><circle cy={base + .007} r=".004" fill="#cb9b45" />
      {type === CANDLE && <><rect x="-.008" y={Number(parameters.heightM) / 2} width=".016" height=".026" rx=".003" fill="#df6150" /><path d={`M0 ${-Number(parameters.heightM) / 2}C${-Number(parameters.heightM) * .45} ${Number(parameters.heightM) * .2} ${Number(parameters.heightM) * .4} ${Number(parameters.heightM)} 0 ${-Number(parameters.heightM) / 2}`} fill="#f8bb42" /><circle r=".0025" fill="#fff0ad" /></>}
      {type === LENS && <><ellipse rx=".008" ry={Math.max(.025, Number(parameters.apertureRadiusM) * 1.3)} fill="#bde4e4aa" stroke="#4e939b" strokeWidth="1.5" /><ellipse rx=".004" ry={Number(parameters.apertureRadiusM)} fill="#d7f4f2" stroke="#819da2" strokeWidth=".6" /><circle r=".0015" fill="#388895" /></>}
      {type === SCREEN && <g data-screen-side-view="true" transform="matrix(.36 -.14 0 1 0 0)">
        <rect x={-Number(parameters.widthM) / 2 - .002} y={-Number(parameters.heightM) / 2 - .004} width={Number(parameters.widthM) + .012} height={Number(parameters.heightM) + .012} rx=".003" fill="#81928d" />
        <rect x={-Number(parameters.widthM) / 2 - .006} y={-Number(parameters.heightM) / 2 - .006} width={Number(parameters.widthM) + .012} height={Number(parameters.heightM) + .012} rx=".003" fill="#465958" />
        <rect data-screen-face="true" x={-Number(parameters.widthM) / 2} y={-Number(parameters.heightM) / 2} width={Number(parameters.widthM)} height={Number(parameters.heightM)} fill="#fffdf1" />
      </g>}
    </>}
  </g>;
}
