import type { EquipmentInstance } from '../../core/equipment/schema.ts';

export const tickerMaximumZoom = 12800;

export function tickerRulerBounds(instance: EquipmentInstance, pixelsPerM: number) {
  return { x: -8 / pixelsPerM, y: -8 / pixelsPerM, width: Number(instance.parameters.lengthM) + 16 / pixelsPerM, height: 62 / pixelsPerM };
}

export function TickerRuler({ instance, pixelsPerM }: { instance: EquipmentInstance; pixelsPerM: number }) {
  const length = Number(instance.parameters.lengthM), fine = pixelsPerM >= 1000, step = fine ? .001 : .005;
  const labelEveryMm = [10, 50, 100, 200, 500, 1000].find(mm => mm * pixelsPerM / 1000 >= 22) ?? 1000, font = 14 / pixelsPerM;
  return <g data-testid="ticker-ruler-scale" data-mm-pixels={pixelsPerM / 1000}>
    <rect x="0" y={-8 / pixelsPerM} width={length} height={62 / pixelsPerM} rx={3 / pixelsPerM} fill="#e4d3a2" fillOpacity=".35" stroke="#60766c" strokeWidth={1 / pixelsPerM} />
    {Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => {
      const x = i * step, mm = Math.round(x * 1000), cm = mm % 10 === 0, half = mm % 5 === 0;
      return <g key={i}>
        <path data-ruler-tick-mm={mm} d={`M${x} 0v${(cm ? 26 : half ? 19 : 12) / pixelsPerM}`} stroke="#254d49" strokeWidth={(cm ? 1.5 : 1) / pixelsPerM} />
        {cm && mm % labelEveryMm === 0 && <text data-ruler-cm={mm / 10} x={x} y={45 / pixelsPerM} textAnchor="middle" fontSize={font} fill="#164e48">{mm / 10}</text>}
      </g>;
    })}
  </g>;
}
