import { z } from 'zod';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { csvCell } from '../../core/measurements/csv.ts';
import { tapeRulerPlacement, tapeSelection, tickerRig, tickerSignature } from '../ticker/simulate.ts';
import type { TapePlacement, TapeRun } from '../ticker/simulate.ts';
import { CART_VELOCITY_EXPERIMENT } from './definitions.ts';
import { cartVelocityRows } from './measure.ts';

export const CART_POSITIONS_MODEL = 'mechanical.cart-positions.v2';
export const CART_POSITIONS_LEGACY_MODEL = 'mechanical.cart-positions.v1';
export interface CartPositionsInput { zero: number; stride: number; last: number; rawCm: Record<string, string>; group: string; note: string }
const metadata = z.strictObject({ kind: z.literal('cart-positions'), zero: z.number().int().min(0).max(720), stride: z.number().int().min(1).max(50), last: z.number().int().min(2).max(240), aux: z.boolean(), f: z.union([z.literal(50), z.literal(60)]), inputUnit: z.literal('cm'), paper: z.tuple([z.number().finite(), z.number().finite()]), flippedX: z.boolean().optional(), note: z.string().max(60) }).refine(m => m.zero + m.last * m.stride <= 720 && (!m.aux || m.zero >= m.stride));
export function positionMetadata(note: string) { try { const result = metadata.safeParse(JSON.parse(note)); return result.success ? result.data : null; } catch { return null; } }
export function clearTapePoint(run: TapeRun, index: number) { return !!tapeSelection(run, index - 1, index) && !!tapeSelection(run, index, index + 1); }
export function defaultCartPositionZero(run: TapeRun | null) { const first = run?.dots.findIndex((_, i) => clearTapePoint(run, i)) ?? -1; return first >= 0 && run && clearTapePoint(run, first + 5) ? first + 5 : Math.max(0, first); }
export function positionPointNumbers(run: TapeRun | null, zero: number, stride: number, last: number) {
  if (!run || !Number.isInteger(zero) || !Number.isInteger(stride) || stride < 1 || !Number.isInteger(last) || last < 2 || last > 240) return [];
  return Array.from({ length: last + 1 }, (_, i) => i);
}
export function centimetresInSI(raw: string) { const parsed = parseManualValue(raw); return !parsed.ok ? null : parsed.value === null ? '' : String(parsed.value / 100); }
export function positionCalculations(points: readonly { number: number; value: number | null }[], periodS: number) {
  const at = (n: number) => points.find(p => p.number === n)?.value ?? null;
  return points.filter(p => p.number >= 0).map(p => {
    const before = at(p.number - 1), next = at(p.number + 1), distanceM = p.value !== null && next !== null && next > p.value ? next - p.value : null;
    const ordered = p.value === null || before !== null && next !== null && before < p.value && p.value < next;
    const displacementM = p.number > 0 && before !== null && next !== null && next > before && ordered ? next - before : null;
    return { number: p.number, atTimeS: p.number * periodS, distanceM, displacementM, timeS: 2 * periodS, velocityMPerS: displacementM === null ? null : displacementM / (2 * periodS) };
  });
}
export function buildCartPositions(scene: SceneDocument, run: TapeRun | null, taken: boolean, input: CartPositionsInput, id: string, timestamp: string, paper: TapePlacement | null) {
  const fail = (message: string) => ({ ok: false as const, message }), rig = tickerRig(scene);
  if (scene.experimentId !== CART_VELOCITY_EXPERIMENT || !rig.ok || !run || !taken || run.signature !== tickerSignature(scene) || run.interaction !== 'pointer.v2' || run.frequencyHz !== rig.frequencyHz) return fail('请先完成打点，断电开夹并取带；装置改变后需要重做。');
  const numbers = positionPointNumbers(run, input.zero, input.stride, input.last);
  if (!numbers.length || !numbers.every(n => clearTapePoint(run, input.zero + n * input.stride))) return fail('选择清晰起点和计数点，避开开头及末尾重合点；可减少末尾计数点。');
  const first = input.zero + numbers[0]! * input.stride, last = input.zero + input.last * input.stride;
  const placement = tapeRulerPlacement(scene, run, paper, first, last), ruler = rig.ruler;
  if (!placement || !ruler || !paper) return fail('把这段纸带放到水平正向尺旁，让起点0及末尾计数点都落在尺内。');
  if (!input.group.trim() || input.group.length > 40 || input.note.length > 60 || numbers.some(n => n !== 0 && (typeof input.rawCm[n] !== 'string' || input.rawCm[n]!.length > 60 || centimetresInSI(input.rawCm[n]!) === null))) return fail('位置填写有限数字（cm），可以留空；组别不能为空，备注最多60字。');
  const meta = { kind: 'cart-positions', zero: input.zero, stride: input.stride, last: input.last, aux: false, f: run.frequencyHz, inputUnit: 'cm', paper: [paper.xM, paper.yM], ...(paper.flippedX ? { flippedX: true } : {}), note: input.note };
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: run.id, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: input.group.trim(), note: JSON.stringify(meta), modelVersion: CART_POSITIONS_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success || !metadata.safeParse(meta).success) return fail('位置表来源未通过校验。');
  const length = Number(ruler.parameters.lengthM), zeroM = run.dots[input.zero]!.displacementM;
  const records = numbers.filter(n => n !== 0).map(n => {
    const rawCm = input.rawCm[n]!, rawInput = centimetresInSI(rawCm)!, range = { min: n < 0 ? -length : 0, max: n < 0 ? 0 : length, resolution: .001 }, value = manualResult(rawInput, 'valid', range)!;
    const physicalValue = run.dots[input.zero + n * input.stride]!.displacementM - zeroM;
    return MeasurementRecordSchema.safeParse({ id: `${id}.p${n}`, source: 'manual', quantity: 'length', unit: 'm', ...value, rawInput, equipmentId: ruler.id, range, recordedAt: timestamp, documentRevision: scene.revision, runId: run.id, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig, context: { sampleId: id, equipmentLabel: '小车纸带·独立刻度尺', pointLabel: n < 0 ? '起点前辅助点的位置' : `计数点${n}的位置`, instrumentStatus: 'valid', instrumentDisplayValue: Math.round(physicalValue * 1000) / 1000, physicalValue, originalRawInput: rawCm, diagnosticCodes: ['CART_POSITION_CM'] } });
  });
  if (records.some(r => !r.success)) return fail('位置读数未通过校验。');
  return { ok: true as const, snapshot: snapshot.data, records: records.map(r => r.data!) };
}
export function cartPositionSheets(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(s => [CART_POSITIONS_MODEL, CART_POSITIONS_LEGACY_MODEL].includes(s.modelVersion)).flatMap(sample => {
    const meta = positionMetadata(sample.note); if (!meta) return [];
    const points = [...(meta.aux ? [-1] : []), ...Array.from({ length: meta.last + 1 }, (_, i) => i)].map(n => {
      const record = scene.measurementRecords.find(r => r.id === `${sample.id}.p${n}` && r.context?.sampleId === sample.id);
      return { number: n, record, value: n === 0 ? 0 : record?.measurementStatus === 'valid' ? record.value : null };
    });
    if (!points.some(p => p.record)) return [];
    return [{ sample, meta, points, results: positionCalculations(points, meta.stride / meta.f) }];
  });
}
export function cartVelocitySeriesRows(scene: SceneDocument) {
  return [...cartVelocityRows(scene).map(r => ({ id: r.sample.id, sample: r.sample, meta: r.meta, groupKey: `legacy:${r.groupKey}`, pointNumber: (r.meta.e - r.meta.zero) / r.meta.stride, atTimeS: r.atTimeS, velocityMPerS: r.velocityMPerS })), ...cartPositionSheets(scene).flatMap(sheet => sheet.results.filter(r => r.number > 0 && r.number < sheet.meta.last).map(r => ({ id: `${sheet.sample.id}.v${r.number}`, sample: sheet.sample, meta: sheet.meta, groupKey: sheet.sample.id, pointNumber: r.number, atTimeS: r.atTimeS, velocityMPerS: r.velocityMPerS })))];
}
export function cartPositionsCsv(scene: SceneDocument) {
  const header = ['组别', '纸带来源', '计数点', '时间/s', '位置/cm', '到下一点距离/cm', '速度/(m/s)', '测速时间间隔/s', '频率/Hz', '原始位置输入/cm', '当前位置输入/m', '备注'];
  const rows = cartPositionSheets(scene).flatMap(s => s.points.filter(p => p.number >= 0).map(p => { const r = s.results.find(r => r.number === p.number); return [s.sample.setupLabel, s.sample.runId, p.number < 0 ? '辅助点' : p.number, p.number * s.meta.stride / s.meta.f, p.value === null ? null : p.value * 100, r?.distanceM == null ? null : r.distanceM * 100, r?.velocityMPerS, r?.timeS, s.meta.f, p.number === 0 ? '0（定义）' : p.record?.context?.originalRawInput, p.number === 0 ? '0' : p.record?.rawInput, s.meta.note]; }));
  const legacy = cartVelocityRows(scene).map(r => [r.sample.setupLabel + '（旧版区间记录）', r.sample.runId, (r.meta.e - r.meta.zero) / r.meta.stride, r.atTimeS, null, null, r.velocityMPerS, r.timeS, r.meta.f, null, null, r.meta.note]);
  return '\ufeff' + [header, ...rows, ...legacy].map(row => row.map(v => csvCell(v ?? null)).join(',')).join('\r\n');
}
