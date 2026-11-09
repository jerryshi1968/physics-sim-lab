import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { MeterReading } from '../../core/electrical/instruments.ts';
import { AMMETER } from '../../equipment/electrical/definitions.ts';

export function MeterGraphic({ instance, reading }: { instance: EquipmentInstance; reading?: MeterReading }) {
  const fraction = reading?.needleFraction ?? 0;
  const angle = Math.PI + fraction * Math.PI;
  const unit = instance.type === AMMETER ? 'A' : 'V';
  return <g data-meter-dial={instance.id} data-meter-status={reading?.status ?? 'unavailable'} data-needle-fraction={fraction} pointerEvents="none">
    <rect x="-.085" y="-.06" width=".17" height=".12" rx=".012" fill="#414942" pointerEvents="fill" />
    <rect x="-.077" y="-.054" width=".154" height=".09" rx=".009" fill="#e8e5d2" />
    {(['high', 'low'] as const).map(range => {
      const maximum = Number(instance.parameters[`${range}Range`]);
      const resolution = Number(instance.parameters[`${range}Resolution`]);
      const divisions = Math.max(1, Math.min(100, Math.round(maximum / resolution)));
      const majorStep = Math.ceil(divisions / 3);
      const radius = range === 'high' ? .063 : .038;
      const labelRadius = range === 'high' ? .049 : .025;
      const active = reading?.range === range;
      const color = range === 'high' ? '#455b75' : '#426443';
      return <g key={range} data-meter-scale={range} data-scale-maximum={maximum} data-scale-resolution={resolution} data-scale-active={active}
        aria-label={`${range === 'high' ? '外圈大量程' : '内圈小量程'} 0～${maximum} ${unit}`} opacity={active || !reading?.range ? 1 : .65}>
        <path d={`M${-radius} .012A${radius} ${radius} 0 0 1 ${radius} .012`} fill="none" stroke={color} strokeWidth={active ? 1.2 : .8} />
        {Array.from({ length: divisions + 1 }, (_, index) => {
          const theta = Math.PI + index / divisions * Math.PI;
          const major = index % majorStep === 0 || index === divisions;
          const innerRadius = radius - (major ? .007 : .004);
          return <g key={index}>
            <path data-scale-tick={index} d={`M${radius * Math.cos(theta)} ${.012 + radius * Math.sin(theta)}L${innerRadius * Math.cos(theta)} ${.012 + innerRadius * Math.sin(theta)}`} stroke={color} strokeWidth={active ? 1.1 : .8} />
            {major && <text data-scale-value={Number((index * resolution).toPrecision(6))} x={labelRadius * Math.cos(theta)} y={.012 + labelRadius * Math.sin(theta)}
              fontSize=".010" textAnchor="middle" dominantBaseline="middle" fontWeight={active ? '700' : '400'} fill={color}>{Number((index * resolution).toPrecision(6))}</text>}
          </g>;
        })}
      </g>;
    })}
    <text x="0" y=".028" fontSize=".012" textAnchor="middle" fontWeight="700" fill="#34473b">{unit}</text>
    <path d={`M0 .013L${.051 * Math.cos(angle)} ${.013 + .051 * Math.sin(angle)}`} stroke={reading && !reading.measurementUsable ? '#a74432' : '#b64e39'} strokeWidth="1.8" />
    <circle cy=".013" r=".004" fill="#687367" />
    <text x="-.065" y=".039" fontSize=".009" textAnchor="middle" fill="#edf1e9">−</text>
    <text x="0" y=".039" fontSize=".009" textAnchor="middle" fill="#edf1e9">{Number(instance.parameters.lowRange)} +</text>
    <text x=".065" y=".039" fontSize=".009" textAnchor="middle" fill="#edf1e9">{Number(instance.parameters.highRange)} +</text>
  </g>;
}
