import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { dimensionOf } from '../../core/units/units.ts';
import type { SIUnit } from '../../core/units/units.ts';
import { tapeRulerPlacement, tapeSelection, tickerRig, tickerSignature, TICKER_DIRECT_MODEL, TICKER_MODEL } from './simulate.ts';
import type { TapePlacement, TapeRun } from './simulate.ts';

export interface TickerInput { origin: number; target: number; count: string; rawM: string; group: string; note: string }
export const tickerProfiles: readonly MeasurementChartProfile[] = [{ id: 'ticker-time', label: '纸带位移—时间 x–t', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', label: '时间 t（s）', pointLabel: '纸带时间' }, y: { quantity: 'length', unit: 'm', label: '位移 x（m）', pointLabel: '纸带位移' } }];

export function buildTickerMeasurement(scene: SceneDocument, run: TapeRun | null, taken: boolean, input: TickerInput, id: string, timestamp: string, placement: TapePlacement | null = null) {
  const fail = (message: string) => ({ ok: false as const, message });
  const rig = tickerRig(scene);
  if (!rig.ok) return fail(rig.message);
  if (!run || !taken || run.signature !== tickerSignature(scene) || run.frequencyHz !== rig.frequencyHz) return fail('请先断电取下本次纸带；装置改变后须重新打点。');
  const selected = tapeSelection(run, input.origin, input.target);
  if (!selected) return fail('请选择两个清晰、位置不同的点，终点须在起点之后。');
  const count = parseManualValue(input.count), raw = parseManualValue(input.rawM);
  if (!count.ok || count.value !== selected.intervals) return fail('请核对间隔数 n：起始点为 0，两个点之间只有一个时间间隔。');
  const ruler = rig.ruler, a = selected.a.displacementM, b = selected.b.displacementM;
  if (!ruler || Math.abs(ruler.pose.rotationRad) > 1e-8 || ruler.pose.flippedX || Number(ruler.parameters.lengthM) < selected.displacementM) return fail('请使用水平正向、能覆盖这两个点的独立刻度尺。');
  const rulerReadings = run.interaction === 'pointer.v2' ? tapeRulerPlacement(scene, run, placement, input.origin, input.target) : null;
  if (run.interaction === 'pointer.v2' && !rulerReadings) return fail('请把取下的纸带拖到刻度尺上沿，且让两个测点都落在刻度范围内。');
  if (!raw.ok || input.rawM.length > 100 || !input.group.trim() || input.group.length > 80 || input.note.length > 100) return fail('组别不能为空，位移须为有限数字；留空可保存缺失值。');
  const range = { min: 0, max: Number(ruler.parameters.lengthM), resolution: .001 };
  const value = manualResult(input.rawM, 'valid', range);
  if (!value) return fail('位移读数无效。');
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: run.id, sequence: scene.revision + 1, capturedAt: timestamp, setupLabel: `${input.group.trim()} · 起点${input.origin}`, note: JSON.stringify({ kind: 'ticker-reading', origin: input.origin, target: input.target, frequencyHz: run.frequencyHz, originM: a, targetM: b, originTimeS: selected.a.timeS, targetTimeS: selected.b.timeS, count: input.count, rawM: input.rawM, note: input.note, ...(rulerReadings && placement ? { placement: [placement.xM, placement.yM], ruler: [rulerReadings.originM, rulerReadings.targetM] } : {}) }), modelVersion: run.interaction === 'pointer.v2' ? TICKER_DIRECT_MODEL : TICKER_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('记录来源超出范围，请缩短备注。');
  const specs: { label: string; unit: SIUnit; truth: number; value: number | null; raw: string; status: 'valid' | 'invalid' | 'over-range' | 'reverse' }[] = [
    { label: '打点间隔数', unit: '1', truth: selected.intervals, value: selected.intervals, raw: input.count, status: 'valid' },
    { label: '纸带时间', unit: 's', truth: selected.timeS, value: selected.timeS, raw: String(selected.timeS), status: 'valid' },
    { label: '纸带位移', unit: 'm', truth: selected.displacementM, value: value.value, raw: input.rawM, status: value.measurementStatus as 'valid' | 'invalid' | 'over-range' | 'reverse' },
  ];
  const rows = specs.map((spec, i) => MeasurementRecordSchema.safeParse({ id: `${id}.${i}`, source: 'manual', quantity: dimensionOf(spec.unit), unit: spec.unit, value: spec.value, rawInput: spec.raw, equipmentId: i === 2 ? ruler.id : rig.ticker.id, range: i === 2 ? range : null, measurementStatus: spec.status, recordedAt: timestamp, documentRevision: scene.revision, runId: run.id, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig,
    context: { sampleId: id, equipmentLabel: i === 2 ? '纸带·独立刻度尺' : '纸带·数点与计算', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: i === 2 ? Math.round(spec.truth * 1000) / 1000 : spec.truth, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: [] } }));
  if (rows.some(row => !row.success)) return fail('记录未通过校验，原数据保持。');
  return { ok: true as const, snapshot: snapshot.data, records: rows.map(row => row.data!) };
}
