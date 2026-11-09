import { displayMeasurement } from './display.ts';
import type { Dimension, SIUnit } from '../units/units.ts';
import type { SceneDocument } from '../scene/schema.ts';
import { measurementRows, sourceLabel, validPlotValue } from './table.ts';
import type { MeasurementRow } from './table.ts';

export interface MeasurementAxis { quantity: Dimension; unit: SIUnit; displayUnit?: '°' | 'g' | 'mL' | 'g/cm³'; label: string; pointLabel?: string; power?: 1 | 2 }
export interface MeasurementChartProfile { id: string; label: string; available: boolean; groupByRun?: boolean; x: MeasurementAxis | 'sample'; y: MeasurementAxis }
export const measurementChartProfiles: readonly MeasurementChartProfile[] = [
  { id: 'electrical-current', label: '电流多测点比较', available: true, x: 'sample', y: { quantity: 'current', unit: 'A', label: '电流（A）' } },
  { id: 'electrical-voltage', label: '电压多测点比较', available: true, x: 'sample', y: { quantity: 'voltage', unit: 'V', label: '电压（V）' } },
  { id: 'lever-torque', label: '杠杆力矩（预留）', available: false, x: { quantity: 'length', unit: 'm', label: '力臂（m）', pointLabel: '力臂' }, y: { quantity: 'torque', unit: 'N·m', label: '力矩（N·m）' } },
  { id: 'friction-f-n', label: '摩擦 F-N（预留）', available: false, x: { quantity: 'force', unit: 'N', label: '压力（N）', pointLabel: '压力' }, y: { quantity: 'force', unit: 'N', label: '摩擦力（N）', pointLabel: '摩擦力' } },
  { id: 'spring-f-extension', label: '弹簧 F-Δx（预留）', available: false, x: { quantity: 'length', unit: 'm', label: '形变量（m）', pointLabel: '形变量' }, y: { quantity: 'force', unit: 'N', label: '弹力（N）', pointLabel: '弹力' } },
  { id: 'projectile-x-t', label: '平抛 x-t（预留）', available: false, x: { quantity: 'time', unit: 's', label: '时间（s）', pointLabel: '时间' }, y: { quantity: 'length', unit: 'm', label: '水平位移（m）', pointLabel: '水平位移' } },
  { id: 'projectile-y-t2', label: '平抛 ydrop-t²（预留）', available: false, x: { quantity: 'time', unit: 's', label: '时间平方（s²）', pointLabel: '时间', power: 2 }, y: { quantity: 'length', unit: 'm', label: '向下位移（m）', pointLabel: '向下位移' } },
];
export interface MeasurementChartPoint { recordId: string; sampleIndex: number; x: number; y: number | null; status: string }
export interface MeasurementSeries { id: string; label: string; points: MeasurementChartPoint[] }

export function normalizedChartPosition(value: number, minimum: number, maximum: number): number {
  if (![value, minimum, maximum].every(Number.isFinite)) throw new RangeError('NON_FINITE_CHART_POSITION');
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum), 1e-9);
  const span = maximum / scale - minimum / scale;
  return span === 0 ? .5 : (value / scale - minimum / scale) / span;
}

function matches(row: MeasurementRow, axis: MeasurementAxis): boolean {
  return row.record.quantity === axis.quantity && row.record.unit === axis.unit && (!axis.pointLabel || row.pointLabel === axis.pointLabel);
}
function axisValue(row: MeasurementRow, axis: MeasurementAxis): number | null {
  const value = validPlotValue(row.record) === null ? null : axis.displayUnit ? displayMeasurement(row.record).value : row.record.value;
  if (value === null) return null;
  const transformed = axis.power === 2 ? value * value : value;
  return Number.isFinite(transformed) ? transformed : null;
}

export function measurementSeries(scene: SceneDocument, profile: MeasurementChartProfile): MeasurementSeries[] {
  const rows = measurementRows(scene), series = new Map<string, MeasurementSeries>();
  const runNumbers = new Map<string, number>();
  for (const row of rows) if (!runNumbers.has(row.record.runId)) runNumbers.set(row.record.runId, runNumbers.size + 1);
  const rowsBySample = new Map<number, MeasurementRow[]>(), samplesBySetup = new Map<string, Set<number>>(), setupBySeries = new Map<string, string>();
  for (const row of rows) {
    if (!rowsBySample.has(row.sampleIndex)) rowsBySample.set(row.sampleIndex, []);
    rowsBySample.get(row.sampleIndex)!.push(row);
    if (!samplesBySetup.has(row.setupLabel)) samplesBySetup.set(row.setupLabel, new Set());
    samplesBySetup.get(row.setupLabel)!.add(row.sampleIndex);
  }
  for (const row of rows.filter(item => matches(item, profile.y))) {
    const key = JSON.stringify([row.record.equipmentId, row.pointLabel, row.record.source, row.setupLabel, ...(profile.groupByRun ? [row.record.runId] : [])]);
    if (!series.has(key)) series.set(key, { id: key, label: `${row.setupLabel} · ${row.pointLabel} · ${sourceLabel(row.record.source)}${profile.groupByRun ? ` · 轨迹 ${runNumbers.get(row.record.runId)}` : ''}`, points: [] });
    setupBySeries.set(key, row.setupLabel);
    let x: number | null = row.sampleIndex;
    if (profile.x !== 'sample') {
      const axis = profile.x;
      const candidates = (rowsBySample.get(row.sampleIndex) ?? []).filter(item => item.record.source === row.record.source && matches(item, axis));
      x = candidates.length === 1 ? axisValue(candidates[0]!, axis) : null;
    }
    if (x === null) continue;
    series.get(key)!.points.push({ recordId: row.record.id, sampleIndex: row.sampleIndex, x, y: axisValue(row, profile.y), status: row.record.measurementStatus });
  }
  for (const group of series.values()) {
    const first = group.points[0]?.sampleIndex, last = group.points.at(-1)?.sampleIndex;
    if (profile.x === 'sample' && first !== undefined && last !== undefined) {
      const existing = new Set(group.points.map(point => point.sampleIndex));
      for (const sampleIndex of samplesBySetup.get(setupBySeries.get(group.id)!) ?? []) {
        if (sampleIndex > first && sampleIndex < last && !existing.has(sampleIndex)) group.points.push({ recordId: '', sampleIndex, x: sampleIndex, y: null, status: 'missing' });
      }
      group.points.sort((a, b) => a.sampleIndex - b.sampleIndex);
    }
  }
  return [...series.values()].filter(group => group.points.length);
}

export function chartSegments(points: MeasurementChartPoint[]): MeasurementChartPoint[][] {
  const segments: MeasurementChartPoint[][] = [];
  let current: MeasurementChartPoint[] = [];
  for (const point of points) {
    if (point.y === null) { if (current.length) segments.push(current); current = []; }
    else current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}
