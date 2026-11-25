import { z } from 'zod';
import type { MeasurementRecord, SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { csvCell } from '../../core/measurements/csv.ts';
import { tapeRulerPlacement, tapeSelection, tickerRig, tickerSignature } from '../ticker/simulate.ts';
import type { TapePlacement, TapeRun } from '../ticker/simulate.ts';

export const TAPE_SPEED_EXPERIMENT = 'H-MECH-06';
export const TAPE_SPEED_MODEL = 'mechanical.tape-speed.v1';
export type TapeSpeedMode = 'average' | 'instant';
export interface TapeSpeedInput { mode: TapeSpeedMode; zero: number; origin: number; target: number; at: number | null; stride: number; rawA: string; rawB: string; group: string; note: string }
const index = z.number().int().min(0).max(720), finite = z.number().finite();
const metadataSchema = z.strictObject({ kind: z.literal('tape-speed'), mode: z.enum(['average', 'instant']), zero: index, a: index, b: index, e: index.nullable(), stride: z.number().int().min(1).max(50), f: z.union([z.literal(50), z.literal(60)]), positions: z.tuple([finite, finite, finite, finite.nullable()]), paper: z.tuple([finite, finite]), ruler: z.tuple([finite, finite, finite]), note: z.string().max(60) }).refine(m => m.zero <= m.a && m.a < m.b && m.positions[0] <= m.positions[1] && m.positions[1] < m.positions[2] && (m.mode === 'average' ? m.e === null && m.positions[3] === null : m.e !== null && m.a < m.e && m.e < m.b && m.positions[3] !== null && m.positions[1] < m.positions[3] && m.positions[3] < m.positions[2]));
export type TapeSpeedMetadata = z.infer<typeof metadataSchema>;
export function speedMetadata(note: string): TapeSpeedMetadata | null { try { const parsed = metadataSchema.safeParse(JSON.parse(note)); return parsed.success ? parsed.data : null; } catch { return null; } }

export function speedNumbers(rawA: number | null, rawB: number | null, intervals: number, frequencyHz: number) {
  if (!Number.isInteger(intervals) || intervals < 1 || ![50, 60].includes(frequencyHz)) return null;
  const timeS = intervals / frequencyHz, displacementM = rawA !== null && rawB !== null && [rawA, rawB].every(Number.isFinite) && rawA >= 0 && rawB > rawA ? rawB - rawA : null;
  const velocityMPerS = displacementM === null ? null : displacementM / timeS;
  return { timeS, displacementM, velocityMPerS: velocityMPerS !== null && Number.isFinite(velocityMPerS) ? velocityMPerS : null, readingErrorBoundMPerS: .001 / timeS };
}

export function buildTapeSpeedMeasurement(scene: SceneDocument, run: TapeRun | null, taken: boolean, input: TapeSpeedInput, id: string, timestamp: string, placement: TapePlacement | null) {
  const fail = (message: string) => ({ ok: false as const, message });
  const rig = tickerRig(scene);
  if (scene.experimentId !== TAPE_SPEED_EXPERIMENT || !rig.ok) return fail(rig.ok ? '请进入纸带速度实验。' : rig.message);
  if (!run || !taken || run.interaction !== 'pointer.v2' || run.signature !== tickerSignature(scene) || run.frequencyHz !== rig.frequencyHz) return fail('请先断电、打开固定夹，取下本次纸带。装置改变后须重新打点。');
  const selected = tapeSelection(run, input.origin, input.target), reference = tapeSelection(run, input.zero, input.target);
  if (!selected || !reference || input.zero > input.origin) return fail('请选清晰的参考起点0和有先后顺序的测点，参考起点不得晚于区间起点。');
  if (!Number.isInteger(input.stride) || input.stride < 1 || input.stride > 50 || !['average', 'instant'].includes(input.mode)) return fail('每组须包含1～50个打点间隔。');
  const e = input.mode === 'instant' ? input.at : null;
  if (input.mode === 'instant' && (e === null || !Number.isInteger(e) || e <= input.origin || e >= input.target || !tapeSelection(run, input.origin, e) || !tapeSelection(run, e, input.target))) return fail('瞬时速度近似的目标点E须是区间内部的清晰点，不能选端点。');
  const ruler = rig.ruler, readings = tapeRulerPlacement(scene, run, placement, input.zero, input.target), segment = tapeRulerPlacement(scene, run, placement, input.origin, input.target);
  if (!ruler || !placement || !readings || !segment) return fail('请将纸带放到水平正向刻度尺旁，让参考起点0和区间两端都在尺内。');
  if (!input.group.trim() || input.group.length > 40 || input.note.length > 60 || [input.rawA, input.rawB].some(raw => raw.length > 60 || !parseManualValue(raw).ok)) return fail('请填写组别和有限的读尺值；读数留空可保存缺失值，备注最多60字。');
  const range = { min: 0, max: Number(ruler.parameters.lengthM), resolution: .001 }, values = [manualResult(input.rawA, 'valid', range), manualResult(input.rawB, 'valid', range)];
  const positions = [reference.a.displacementM, selected.a.displacementM, selected.b.displacementM, e === null ? null : run.dots[e]!.displacementM];
  const metadata = { kind: 'tape-speed', mode: input.mode, zero: input.zero, a: input.origin, b: input.target, e, stride: input.stride, f: run.frequencyHz, positions, paper: [placement.xM, placement.yM], ruler: [readings.originM, segment.originM, readings.targetM], note: input.note };
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: run.id, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: `${input.group.trim()} · 起点${input.zero} · ${input.mode === 'average' ? '平均' : '瞬时近似'}`, note: JSON.stringify(metadata), modelVersion: TAPE_SPEED_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success || !metadataSchema.safeParse(metadata).success) return fail('来源信息超出记录范围，请缩短读数或备注。');
  const records = values.map((value, i) => MeasurementRecordSchema.safeParse({ id: `${id}.${i}`, source: 'manual', quantity: 'length', unit: 'm', value: value!.value, rawInput: i === 0 ? input.rawA : input.rawB, equipmentId: ruler.id, range, measurementStatus: value!.measurementStatus, recordedAt: timestamp, documentRevision: scene.revision, runId: run.id, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '纸带·独立刻度尺', pointLabel: i === 0 ? '区间起点位置xA' : '区间终点位置xB', instrumentStatus: 'valid', instrumentDisplayValue: Math.round((positions[i + 1]! - positions[0]!) * 1000) / 1000, physicalValue: positions[i + 1]! - positions[0]!, originalRawInput: i === 0 ? input.rawA : input.rawB, diagnosticCodes: [] } }));
  if (records.some(record => !record.success)) return fail('记录未通过校验，原数据保持。');
  return { ok: true as const, snapshot: snapshot.data, records: records.map(record => record.data!) };
}

export function tapeSpeedRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(sample => sample.modelVersion === TAPE_SPEED_MODEL).flatMap(sample => {
    const meta = speedMetadata(sample.note);
    if (!meta) return [];
    const readings = ['0', '1'].map(suffix => scene.measurementRecords.find(record => record.id === `${sample.id}.${suffix}` && record.context?.sampleId === sample.id));
    if (!readings.some(Boolean)) return [];
    const value = (row: MeasurementRecord | undefined) => row?.measurementStatus === 'valid' ? row.value : null;
    const result = speedNumbers(value(readings[0]), value(readings[1]), meta.b - meta.a, meta.f)!;
    const at = meta.mode === 'instant' ? meta.e! : (meta.a + meta.b) / 2;
    return [{ sample, meta, readings, ...result, atTimeS: (at - meta.zero) / meta.f, midpointOffsetS: (at - (meta.a + meta.b) / 2) / meta.f }];
  });
}
export const tapeSpeedProfiles: readonly MeasurementChartProfile[] = [
  { id: 'tape-average-v-t', label: '平均速度—区间中点时刻', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', pointLabel: '测速对应时刻', label: '区间中点时刻（s）' }, y: { quantity: 'velocity', unit: 'm/s', pointLabel: '纸带平均速度', label: '平均速度（m/s）' } },
  { id: 'tape-instant-v-t', label: '瞬时速度近似值—目标时刻', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', pointLabel: '测速对应时刻', label: '目标点时刻（s）' }, y: { quantity: 'velocity', unit: 'm/s', pointLabel: '纸带瞬时速度近似值', label: '瞬时速度近似值（m/s）' } },
  { id: 'tape-instant-window', label: '瞬时近似值—取样区间比较', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', pointLabel: '测速区间时间', label: '取样区间Δt（s）' }, y: { quantity: 'velocity', unit: 'm/s', pointLabel: '纸带瞬时速度近似值', label: '瞬时速度近似值（m/s）' } },
];
export function tapeSpeedChartScene(scene: SceneDocument, windowComparison = false): SceneDocument {
  return { ...scene, measurementRecords: tapeSpeedRows(scene).flatMap(row => {
    const first = row.readings.find(Boolean)!;
    return [['测速对应时刻', 's', row.atTimeS], ['测速区间时间', 's', row.timeS], [row.meta.mode === 'average' ? '纸带平均速度' : '纸带瞬时速度近似值', 'm/s', row.velocityMPerS]].map(([label, unit, value], i) => {
      const truth = i === 0 ? row.atTimeS : i === 1 ? row.timeS : (row.meta.positions[2] - row.meta.positions[1]) / row.timeS;
      return { ...first, id: `${row.sample.id}.plot${i}`, quantity: unit === 's' ? 'time' : 'velocity', unit, value, rawInput: value === null ? '' : String(value), measurementStatus: value === null ? 'invalid' : 'valid', range: null, context: { ...first.context!, pointLabel: label, sampleId: row.sample.id, instrumentDisplayValue: truth, physicalValue: truth, originalRawInput: value === null ? '' : String(value), diagnosticCodes: ['TAPE_SPEED_FROM_MANUAL'] } } as MeasurementRecord;
    });
  }), measurementSnapshots: (scene.measurementSnapshots ?? []).map(sample => windowComparison && speedMetadata(sample.note)?.mode === 'instant' ? { ...sample, setupLabel: `${sample.setupLabel} · E${speedMetadata(sample.note)!.e}` } : sample) };
}
export function tapeSpeedCsv(scene: SceneDocument) {
  const header = ['组别', '纸带来源', '方法', '参考起点0', '原始点A', '原始点B', '目标点E', 'xA/m', 'xB/m', 'Δx/m', 'Δt/s', 'v/(m/s)', '对应时刻/s', '目标偏离区间中点/s', '估读误差上界示意/(m/s)', '状态', '原始输入xA', '原始输入xB'];
  return '\ufeff' + [header, ...tapeSpeedRows(scene).map(row => [row.sample.setupLabel, row.sample.runId, row.meta.mode === 'average' ? '平均速度' : '瞬时速度近似值', row.meta.zero, row.meta.a, row.meta.b, row.meta.e, row.readings[0]?.value, row.readings[1]?.value, row.displacementM, row.timeS, row.velocityMPerS, row.atTimeS, row.midpointOffsetS, row.readingErrorBoundMPerS, row.velocityMPerS === null ? '缺失／异常' : '有效读数计算', row.readings[0]?.context?.originalRawInput, row.readings[1]?.context?.originalRawInput])].map(row => row.map(value => csvCell(value ?? null)).join(',')).join('\r\n');
}
