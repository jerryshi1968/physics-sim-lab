import { z } from 'zod';
import type { SceneDocument } from '../scene/schema.ts';
import type { EquipmentInstance } from '../equipment/schema.ts';
import { FiniteSchema } from '../equipment/schema.ts';
import type { DcBranchValue } from './solve.ts';

const fields = {
  lowRange: FiniteSchema.positive(), highRange: FiniteSchema.positive(),
  lowResolution: FiniteSchema.positive(), highResolution: FiniteSchema.positive(),
};
function validScale(range: number, resolution: number): boolean {
  const divisions = range / resolution;
  return divisions >= 1 && divisions <= 100 && Math.abs(divisions - Math.round(divisions)) <= 1e-9;
}
const MeterScales = z.strictObject(fields).refine(spec => spec.highRange > spec.lowRange
  && validScale(spec.lowRange, spec.lowResolution) && validScale(spec.highRange, spec.highResolution), { message: 'Invalid meter scale' });
export const AmmeterParametersSchema = MeterScales.safeExtend({ resistanceOhm: FiniteSchema.nonnegative() });
export const VoltmeterParametersSchema = MeterScales.safeExtend({ finiteInput: z.boolean(), inputResistanceOhm: FiniteSchema.positive() });

export type MeterRange = 'low' | 'high';
export interface MeterConnection { range: MeterRange | null; commonConnected: boolean; bothRanges: boolean }
export interface MeterReading {
  id: string; unit: 'A' | 'V'; range: MeterRange | null; maximum: number; resolution: number;
  status: 'valid' | 'disconnected' | 'reverse' | 'over-range' | 'undefined' | 'invalid';
  trueValue: number | null; displayValue: number | null; needleFraction: number; measurementUsable: boolean;
  reverse: boolean; overRange: boolean;
}

export function meterConnection(scene: SceneDocument, id: string): MeterConnection {
  const ports = new Set<string>();
  for (const wire of scene.connections) {
    if (wire.kind !== 'wire') continue;
    for (const end of [wire.from, wire.to]) if (end?.equipmentId === id) ports.add(end.portId);
  }
  return { range: ports.has('low') ? 'low' : ports.has('high') ? 'high' : null,
    commonConnected: ports.has('common'), bothRanges: ports.has('low') && ports.has('high') };
}

export function meterReading(instance: EquipmentInstance, connection: MeterConnection, value: DcBranchValue | undefined, unit: 'A' | 'V'): MeterReading {
  const range = connection.range;
  const maximum = Number(instance.parameters[range === 'high' ? 'highRange' : 'lowRange']);
  const resolution = Number(instance.parameters[range === 'high' ? 'highResolution' : 'lowResolution']);
  const raw = unit === 'A' ? value?.currentA : value?.voltageV;
  const disconnected = !range || !connection.commonConnected;
  const trueValue = connection.bothRanges || disconnected || raw === undefined || raw === null || !Number.isFinite(raw) ? null : raw;
  const reverse = trueValue !== null && trueValue < -1e-12;
  const overRange = trueValue !== null && Math.abs(trueValue) > maximum + 1e-9 * maximum;
  const status = connection.bothRanges ? 'invalid' : disconnected ? 'disconnected' : trueValue === null ? 'undefined' : overRange ? 'over-range' : reverse ? 'reverse' : 'valid';
  const displayValue = status === 'valid' ? Number((Math.round(Math.max(0, trueValue!) / resolution) * resolution).toPrecision(12)) : null;
  return { id: instance.id, unit, range, maximum, resolution, status, trueValue, displayValue,
    needleFraction: trueValue === null ? 0 : Math.max(-.05, Math.min(1.05, (displayValue ?? trueValue) / maximum)),
    measurementUsable: status === 'valid', reverse, overRange };
}
