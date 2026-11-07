import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { parseManualValue, manualResult } from '../../core/measurements/records.ts';
import { BENCH, RULER } from './definitions.ts';
import { simulateOptical } from './simulate.ts';

export interface OpticalCapture { rulerId: string; rawPositions: [string, string, string]; nature: string; orientation: string; size: string; clarity: string; note: string; setupLabel: string }
export function buildOpticalMeasurements(scene: SceneDocument, registry: EquipmentRegistry, entry: OpticalCapture, sampleId: string, timestamp: string) {
  const outcome = simulateOptical(scene, registry), ruler = scene.equipment.find(item => item.id === entry.rulerId && [BENCH, RULER].includes(item.type));
  if (!outcome.ok || !ruler) return { ok: false as const, code: 'OPTICAL_MEASUREMENT_UNAVAILABLE' };
  if (!['未判定', '实像', '虚像', '无有限像'].includes(entry.nature) || !['未判定', '正立', '倒立'].includes(entry.orientation)
    || !['未判定', '放大', '等大', '缩小'].includes(entry.size) || !['未判定', '清晰', '模糊', '未见像'].includes(entry.clarity)) return { ok: false as const, code: 'INVALID_OPTICAL_OBSERVATION' };
  const parsed = entry.rawPositions.map(parseManualValue);
  if (parsed.some(item => !item.ok)) return { ok: false as const, code: 'INVALID_MANUAL_VALUE' };
  const values = parsed.map(item => item.ok ? item.value : null);
  const derived = (a: number, b: number) => values[a] !== null && values[b] !== null ? String(values[a]! - values[b]!) : '';
  const imageAvailable = outcome.image.kind === 'real' && outcome.screenStatus === 'sharp' && entry.nature === '实像' && entry.clarity === '清晰';
  const raws = [...entry.rawPositions, derived(1, 0), derived(2, 1), imageAvailable ? derived(2, 1) : ''];
  if (raws.some(raw => !parseManualValue(raw).ok)) return { ok: false as const, code: 'INVALID_MANUAL_VALUE' };
  const apparatus = [outcome.setup.candle, outcome.setup.lens, outcome.setup.screen, outcome.setup.lens, outcome.setup.screen, outcome.setup.screen];
  const truths = [outcome.setup.candle.xM - ruler.pose.xM, outcome.setup.lens.xM - ruler.pose.xM, outcome.setup.screen.xM - ruler.pose.xM, outcome.objectDistanceM, outcome.screenDistanceM, outcome.image.kind === 'real' ? outcome.image.imageDistanceM : null];
  const pointLabels = ['蜡烛位置', '透镜位置', '光屏位置', '物距u', '屏距s', '像距v'];
  const maximum = Number(ruler.parameters.lengthM), resolution = ruler.type === RULER ? .001 : .01;
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId: sampleId, sequence: 1, capturedAt: timestamp,
    setupLabel: entry.setupLabel, modelVersion: 'optical.paraxial.v1', equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig,
    note: JSON.stringify({ observations: { nature: entry.nature, orientation: entry.orientation, size: entry.size, clarity: entry.clarity }, note: entry.note,
      rulerId: ruler.id, modelScreenStatus: outcome.screenStatus, aligned: outcome.aligned, spotRadiusM: Number(outcome.spotRadiusM.toPrecision(6)) }) });
  if (!snapshot.success) return { ok: false as const, code: 'INVALID_OPTICAL_OBSERVATION' };
  const records = raws.map((rawInput, index) => {
    const truth = truths[index]!, range = { min: 0, max: maximum, resolution };
    const required = index === 3 ? [truths[0]!, truths[1]!] : index >= 4 ? [truths[1]!, truths[2]!] : [truth];
    const imageUnavailable = index === 5 && !imageAvailable;
    const instrumentStatus = imageUnavailable ? 'undefined' as const : required.every(value => value >= 0 && value <= maximum) && truth >= 0 && truth <= maximum ? 'valid' as const : 'over-range' as const;
    const result = manualResult(rawInput, instrumentStatus === 'undefined' ? 'invalid' : instrumentStatus, range)!;
    return MeasurementRecordSchema.safeParse({ id: `${sampleId}.${index}`, source: 'manual', quantity: 'length', unit: 'm', ...result, rawInput, equipmentId: apparatus[index]!.id,
      range, recordedAt: timestamp, documentRevision: scene.revision, runId: sampleId, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: registry.get(scene.equipment.find(item => item.id === apparatus[index]!.id)!.type, 1)!.label, pointLabel: pointLabels[index]!,
        instrumentStatus, physicalValue: truths[index] ?? null, instrumentDisplayValue: instrumentStatus === 'valid' ? Number((Math.round((index === 5 ? outcome.screenDistanceM : truth) / resolution) * resolution).toPrecision(12)) : null,
        originalRawInput: rawInput, diagnosticCodes: instrumentStatus === 'valid' ? [] : [imageUnavailable ? 'OPTICAL_IMAGE_UNAVAILABLE' : 'OPTICAL_RULER_RANGE'] } });
  });
  if (records.some(record => !record.success)) return { ok: false as const, code: 'INVALID_OPTICAL_OBSERVATION' };
  return { ok: true as const, records: records.flatMap(record => record.success ? [record.data] : []), snapshot: snapshot.data };
}
