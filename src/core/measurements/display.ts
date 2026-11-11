import type { MeasurementRecord } from '../scene/schema.ts';
import { parseManualValue } from './records.ts';

function contextualDisplay(record: MeasurementRecord) {
  if (record.runId.startsWith('mirror-image-') && record.unit === 'm') return { unit: 'cm' as const, factor: 100 };
  if (record.runId.startsWith('buoyancy-') && record.unit === 'm') return { unit: 'cm' as const, factor: 100 };
  if (!record.runId.startsWith('density-') && !record.runId.startsWith('buoyancy-')) return null;
  return record.unit === 'kg' ? { unit: 'g' as const, factor: 1000 } : record.unit === 'm³' ? { unit: 'mL' as const, factor: 1000000 } : record.unit === 'kg/m³' ? { unit: 'g/cm³' as const, factor: .001 } : null;
}

export function displayMeasurement(record: MeasurementRecord) {
  const display = contextualDisplay(record);
  if (display) {
    const convert = (value: number) => Number((value * display.factor).toPrecision(12)), parsed = record.rawInput === null ? null : parseManualValue(record.rawInput);
    return { ...record, unit: display.unit, value: record.value === null ? null : convert(record.value), rawInput: parsed?.ok && parsed.value !== null ? String(convert(parsed.value)) : record.rawInput,
      range: record.range ? { min: convert(record.range.min), max: convert(record.range.max), resolution: convert(record.range.resolution) } : null,
      context: record.context ? { ...record.context, instrumentDisplayValue: record.context.instrumentDisplayValue === null ? null : convert(record.context.instrumentDisplayValue), physicalValue: record.context.physicalValue === null ? null : convert(record.context.physicalValue) } : record.context };
  }
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
  const display = contextualDisplay(record);
  if (display) {
    if (rawInput === displayMeasurement(record).rawInput) return record.rawInput;
    const parsed = parseManualValue(rawInput);
    return !parsed.ok ? null : parsed.value === null ? rawInput : String(parsed.value / display.factor);
  }
  if (record.quantity !== 'angle' || record.unit !== 'rad') return rawInput;
  if (rawInput === displayMeasurement(record).rawInput) return record.rawInput;
  const parsed = parseManualValue(rawInput);
  if (!parsed.ok) return null;
  return parsed.value === null ? rawInput : String(parsed.value * Math.PI / 180);
}
