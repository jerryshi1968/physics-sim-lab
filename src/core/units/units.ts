export const SI_UNITS = ['m', 'kg', 's', 'A', 'V', 'Ω', 'N', 'N·m', 'm/s', 'm/s²', 'rad', '1', 'm³', 'kg/m³', 'K'] as const;
export type SIUnit = typeof SI_UNITS[number];
export type Dimension = 'length' | 'mass' | 'time' | 'current' | 'voltage' | 'resistance'
  | 'force' | 'torque' | 'velocity' | 'acceleration' | 'angle' | 'dimensionless' | 'volume' | 'density' | 'temperature';

const units = {
  K: { dimension: 'temperature', factor: 1, si: 'K' },
  '°C': { dimension: 'temperature', factor: 1, si: 'K' },
  m: { dimension: 'length', factor: 1, si: 'm' },
  cm: { dimension: 'length', factor: 0.01, si: 'm' },
  mm: { dimension: 'length', factor: 0.001, si: 'm' },
  kg: { dimension: 'mass', factor: 1, si: 'kg' },
  g: { dimension: 'mass', factor: 0.001, si: 'kg' },
  'm³': { dimension: 'volume', factor: 1, si: 'm³' },
  mL: { dimension: 'volume', factor: .000001, si: 'm³' },
  'cm³': { dimension: 'volume', factor: .000001, si: 'm³' },
  'kg/m³': { dimension: 'density', factor: 1, si: 'kg/m³' },
  'g/cm³': { dimension: 'density', factor: 1000, si: 'kg/m³' },
  s: { dimension: 'time', factor: 1, si: 's' },
  ms: { dimension: 'time', factor: 0.001, si: 's' },
  A: { dimension: 'current', factor: 1, si: 'A' },
  mA: { dimension: 'current', factor: 0.001, si: 'A' },
  V: { dimension: 'voltage', factor: 1, si: 'V' },
  'Ω': { dimension: 'resistance', factor: 1, si: 'Ω' },
  'kΩ': { dimension: 'resistance', factor: 1000, si: 'Ω' },
  N: { dimension: 'force', factor: 1, si: 'N' },
  'N·m': { dimension: 'torque', factor: 1, si: 'N·m' },
  'm/s': { dimension: 'velocity', factor: 1, si: 'm/s' },
  'm/s²': { dimension: 'acceleration', factor: 1, si: 'm/s²' },
  rad: { dimension: 'angle', factor: 1, si: 'rad' },
  deg: { dimension: 'angle', factor: Math.PI / 180, si: 'rad' },
  '1': { dimension: 'dimensionless', factor: 1, si: '1' },
} as const;

export type Unit = keyof typeof units;
export interface Quantity { value: number; unit: Unit }

function definition(unit: Unit): typeof units[Unit] {
  if (!Object.hasOwn(units, unit)) throw new RangeError('UNKNOWN_UNIT');
  return units[unit];
}

export function dimensionOf(unit: Unit): Dimension {
  return definition(unit).dimension;
}

export function convertUnit(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) throw new RangeError('NON_FINITE_QUANTITY');
  const source = definition(from);
  const target = definition(to);
  if (source.dimension !== target.dimension) throw new RangeError('INCOMPATIBLE_UNITS');
  const converted = source.dimension === 'temperature' ? value + (from === '°C' ? 273.15 : 0) - (to === '°C' ? 273.15 : 0) : value * source.factor / target.factor;
  if (!Number.isFinite(converted)) throw new RangeError('QUANTITY_OVERFLOW');
  return converted;
}

export function toSI(quantity: Quantity): { value: number; unit: SIUnit } {
  const si = definition(quantity.unit).si;
  return { value: convertUnit(quantity.value, quantity.unit, si), unit: si };
}
