import { z } from 'zod';
import type { MeasurementRecord, SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { csvCell } from '../../core/measurements/csv.ts';
import { tapeRulerPlacement, tapeSelection, tickerRig, tickerSignature } from '../ticker/simulate.ts';
import type { TapePlacement, TapeRun } from '../ticker/simulate.ts';
import { CART_VELOCITY_EXPERIMENT, CART_VELOCITY_MODEL } from './definitions.ts';

export interface CartVelocityInput { zero: number; at: number; stride: number; half: number; rawA: string; rawB: string; group: string; note: string }
const index = z.number().int().min(0).max(720), finite = z.number().finite();
const metadataSchema = z.strictObject({ kind: z.literal('cart-velocity'), zero: index, e: index, half: z.number().int().min(1).max(5), stride: z.number().int().min(1).max(50), f: z.union([z.literal(50), z.literal(60)]), positions: z.tuple([finite, finite]), ruler: z.tuple([finite, finite]), paper: z.tuple([finite, finite]), note: z.string().max(60) }).refine(m => m.e >= m.zero && m.e >= m.half && m.e + m.half <= 720 && (m.e - m.zero) % m.stride === 0 && m.positions[1] > m.positions[0]);
export function cartVelocityMetadata(note: string) { try { const parsed = metadataSchema.safeParse(JSON.parse(note)); return parsed.success ? parsed.data : null; } catch { return null; } }
export function cartVelocityNumbers(a: number | null, b: number | null, intervals: number, frequency: number) {
  if (!Number.isInteger(intervals) || intervals < 1 || ![50, 60].includes(frequency)) return null;
  const timeS = intervals / frequency, displacementM = a !== null && b !== null && [a, b].every(Number.isFinite) && a > b && b >= 0 ? a - b : null;
  return { timeS, displacementM, velocityMPerS: displacementM === null ? null : displacementM / timeS };
}
export function buildCartVelocityMeasurement(scene: SceneDocument, run: TapeRun | null, taken: boolean, input: CartVelocityInput, id: string, timestamp: string, paper: TapePlacement | null) {
  const fail = (message: string) => ({ ok: false as const, message }), rig = tickerRig(scene);
  if (scene.experimentId !== CART_VELOCITY_EXPERIMENT || !rig.ok || !run || !taken || run.interaction !== 'pointer.v2' || run.signature !== tickerSignature(scene) || run.frequencyHz !== rig.frequencyHz) return fail('请在本实验完成打点，断电开夹并取下纸带；装置改变后需重做。');
  const { zero, at: e, stride, half } = input, a = e - half, b = e + half;
  if (![zero, e, stride, half].every(Number.isInteger) || stride < 1 || stride > 50 || half < 1 || half > 5 || zero < half || e < zero || (e - zero) % stride || !tapeSelection(run, a, e) || !tapeSelection(run, e, b) || zero !== e && !tapeSelection(run, zero, e)) return fail('选清晰的时间零点和计数点E；E前后对称取点，避开起止重合点。');
  const ruler = rig.ruler, readings = tapeRulerPlacement(scene, run, paper, a, b);
  if (!ruler || !readings || !paper) return fail('把纸带拖到水平正向尺旁，让E前后两个测点都落在尺内。');
  if (!input.group.trim() || input.group.length > 40 || input.note.length > 60 || [input.rawA, input.rawB].some(raw => raw.length > 60 || !parseManualValue(raw).ok)) return fail('填写组别和有限读数；读数可留空，备注最多60字。');
  const range = { min: 0, max: Number(ruler.parameters.lengthM), resolution: .001 }, values = [input.rawA, input.rawB].map(raw => manualResult(raw, 'valid', range)!);
  const meta = { kind: 'cart-velocity', zero, e, half, stride, f: run.frequencyHz, positions: [run.dots[a]!.displacementM, run.dots[b]!.displacementM], ruler: [readings.originM, readings.targetM], paper: [paper.xM, paper.yM], note: input.note };
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: run.id, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: input.group.trim(), note: JSON.stringify(meta), modelVersion: CART_VELOCITY_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success || !metadataSchema.safeParse(meta).success) return fail('来源信息无效，未写入记录。');
  const records = values.map((value, i) => MeasurementRecordSchema.safeParse({ id: `${id}.${i}`, source: 'manual', quantity: 'length', unit: 'm', value: value.value, rawInput: i ? input.rawB : input.rawA, equipmentId: ruler.id, range, measurementStatus: value.measurementStatus, recordedAt: timestamp, documentRevision: scene.revision, runId: run.id, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '小车纸带·独立刻度尺', pointLabel: i ? '后点B尺读数' : '前点A尺读数', instrumentStatus: 'valid', instrumentDisplayValue: Math.round(meta.ruler[i]! * 1000) / 1000, physicalValue: meta.ruler[i]!, originalRawInput: i ? input.rawB : input.rawA, diagnosticCodes: [] } }));
  if (records.some(record => !record.success)) return fail('读数记录未通过校验。');
  return { ok: true as const, snapshot: snapshot.data, records: records.map(record => record.data!) };
}
export function cartVelocityRows(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(sample => sample.modelVersion === CART_VELOCITY_MODEL).flatMap(sample => {
    const meta = cartVelocityMetadata(sample.note); if (!meta) return [];
    const readings = [0, 1].map(i => scene.measurementRecords.find(record => record.id === `${sample.id}.${i}` && record.context?.sampleId === sample.id));
    if (!readings.some(Boolean)) return [];
    const value = (record: MeasurementRecord | undefined) => record?.measurementStatus === 'valid' ? record.value : null;
    return [{ sample, meta, readings, groupKey: `${sample.runId}:${meta.zero}:${meta.stride}:${meta.f}:${meta.half}`, atTimeS: (meta.e - meta.zero) / meta.f, ...cartVelocityNumbers(value(readings[0]), value(readings[1]), 2 * meta.half, meta.f)! }];
  });
}
export function cartVelocityCsv(scene: SceneDocument) {
  return '\ufeff' + [['组别', '纸带来源', '时间零点', '原始点E', '前点A', '后点B', 't/s', 'RA/m', 'RB/m', 'Δx/m', 'Δt/s', 'v/(m/s)', '频率/Hz', '状态', '原始输入RA', '原始输入RB', '备注'], ...cartVelocityRows(scene).map(r => [r.sample.setupLabel, r.sample.runId, r.meta.zero, r.meta.e, r.meta.e - r.meta.half, r.meta.e + r.meta.half, r.atTimeS, r.readings[0]?.value, r.readings[1]?.value, r.displacementM, r.timeS, r.velocityMPerS, r.meta.f, r.velocityMPerS === null ? '缺失／异常' : '有效读数计算', r.readings[0]?.context?.originalRawInput, r.readings[1]?.context?.originalRawInput, r.meta.note])].map(row => row.map(v => csvCell(v ?? null)).join(',')).join('\r\n');
}
