import type { MeasurementRecord } from '../scene/schema.ts';
import { parseManualValue } from './records.ts';

export function displayMeasurement(record: MeasurementRecord) {
  if (record.quantity !== 'angle' || record.unit !== 'rad') return record;
  const degrees = (value: number) => Number((value * 180 / Math.PI).toPrecision(10));
  const parsed = record.rawInput === null ? null : parseManualValue(record.rawInput);
  return { ...record, unit: '°', value: record.value === null ? null : degrees(record.value),
    rawInput: parsed?.ok && parsed.value !== null ? String(degrees(parsed.value)) : record.rawInput,
    range: record.range ? { min: degrees(record.range.min), max: degrees(record.range.max), resolution: degrees(record.range.resolution) } : null,
    context: record.context ? { ...record.context,
      instrumentDisplayValue: record.context.instrumentDisplayValue === null ? null : degrees(record.context.instrumentDisplayValue),
      physicalValue: record.context.physicalValue === null ? null : degrees(record.context.physicalValue) } : record.context };
}

export function measurementInputInSI(record: MeasurementRecord, rawInput: string): string | null {
  if (record.quantity !== 'angle' || record.unit !== 'rad') return rawInput;
  if (rawInput === displayMeasurement(record).rawInput) return record.rawInput;
  const parsed = parseManualValue(rawInput);
  if (!parsed.ok) return null;
  return parsed.value === null ? rawInput : String(parsed.value * Math.PI / 180);
}
