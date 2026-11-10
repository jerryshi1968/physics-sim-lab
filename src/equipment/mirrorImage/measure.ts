import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { MeasurementRecord, SceneDocument } from '../../core/scene/schema.ts';
import { MIRROR_IMAGE_MODEL } from './definitions.ts';
import { mirrorImageRulers, rulerCovers, simulateMirrorImage } from './simulate.ts';

export interface MirrorImageCapture {
  setupLabel: string;
  objectDistance: string;
  imageDistance: string;
  objectHeight: string;
  imageHeight: string;
  screenObservation: string;
}

const labels = { objectDistance: '物到镜面的距离', imageDistance: '像到镜面的距离', objectHeight: '物高', imageHeight: '像高' } as const;
export const mirrorImageLengthLabels = labels;
export const mirrorImageProfiles: readonly MeasurementChartProfile[] = [
  { id: 'mirror-distance', label: '像距—物距（cm）', available: true, x: { quantity: 'length', unit: 'm', displayUnit: 'cm', label: '物距（cm）', pointLabel: labels.objectDistance }, y: { quantity: 'length', unit: 'm', displayUnit: 'cm', label: '像距（cm）', pointLabel: labels.imageDistance } },
  { id: 'mirror-height', label: '像高—物高（cm）', available: true, x: { quantity: 'length', unit: 'm', displayUnit: 'cm', label: '物高（cm）', pointLabel: labels.objectHeight }, y: { quantity: 'length', unit: 'm', displayUnit: 'cm', label: '像高（cm）', pointLabel: labels.imageHeight } },
];

export function buildMirrorImageMeasurements(scene: SceneDocument, input: MirrorImageCapture, sampleId: string, timestamp: string) {
  const fail = (code: string) => ({ ok: false as const, code });
  const result = simulateMirrorImage(scene);
  if (!result.ok || !['', '0', '1'].includes(input.screenObservation)) return fail('MIRROR_CAPTURE');
  const { distance, height } = mirrorImageRulers(scene.equipment);
  const { mirror, target, object, comparison, match, screen, imageProjection, matchProjection } = result;
  const mirrorX = mirror.pose.xM, visibleComparison = imageProjection.complete && matchProjection?.complete;
  const distanceRange = { min: 0, max: Number(distance?.parameters.lengthM ?? 1.2), resolution: .01 };
  const heightRange = { min: 0, max: Number(height?.parameters.lengthM ?? 1.2), resolution: .01 };
  const observationRange = { min: 0, max: 1, resolution: 1 };
  const lengths = [
    { key: 'objectDistance', instrument: distance, range: distanceRange, actual: result.objectDistanceM, observed: result.objectDistanceM, valid: rulerCovers(distance, [mirrorX, object.bottom.xM]) },
    { key: 'imageDistance', instrument: distance, range: distanceRange, actual: result.imageDistanceM, observed: comparison ? comparison.bottom.xM - mirrorX : 0, valid: !!(visibleComparison && comparison && rulerCovers(distance, [mirrorX, comparison.bottom.xM])) },
    { key: 'objectHeight', instrument: height, range: heightRange, actual: result.heightM, observed: result.heightM, valid: rulerCovers(height, [object.bottom.yM, object.top.yM], true) },
    { key: 'imageHeight', instrument: height, range: heightRange, actual: result.heightM, observed: match ? Number(match.parameters.heightM) : 0, valid: !!(visibleComparison && comparison && rulerCovers(height, [comparison.bottom.yM, comparison.top.yM], true)) },
  ] as const;
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId: sampleId, sequence: 1,
    capturedAt: timestamp, setupLabel: input.setupLabel, note: JSON.stringify({ screenAtImage: result.screenTest, screenObservation: input.screenObservation }), modelVersion: MIRROR_IMAGE_MODEL,
    equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('MIRROR_CAPTURE');
  const records: MeasurementRecord[] = [];
  function append(raw: string, original: string, label: string, instrumentId: string, range: typeof distanceRange, valid: boolean, actual: number, observed: number, observation = false) {
    const status = valid ? 'valid' : 'out-of-model';
    const read = manualResult(raw, status, range);
    if (!read) return false;
    const record = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${records.length}`, source: 'manual', quantity: observation ? 'dimensionless' : 'length', unit: observation ? '1' : 'm',
      ...read, rawInput: raw, equipmentId: instrumentId, range, recordedAt: timestamp, documentRevision: scene.revision, runId: sampleId, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: observation ? '光屏' : '独立刻度尺', pointLabel: label, instrumentStatus: status, physicalValue: valid ? actual : null,
        instrumentDisplayValue: valid ? Number((Math.round(observed / range.resolution) * range.resolution).toPrecision(10)) : null,
        originalRawInput: original, diagnosticCodes: valid ? [] : [observation ? 'MIRROR_SCREEN_NOT_AT_IMAGE' : 'MIRROR_READING_UNAVAILABLE'] } });
    if (!record.success) return false;
    records.push(record.data);
    return true;
  }
  for (const item of lengths) {
    const inputCm = input[item.key], value = parseManualValue(inputCm);
    if (!value.ok || !append(value.value === null ? '' : String(value.value / 100), inputCm, labels[item.key], item.instrument?.id ?? target.id, item.range, item.valid, item.actual, item.observed)) return fail('INVALID_MANUAL_VALUE');
  }
  if (input.screenObservation && !append(input.screenObservation, input.screenObservation === '0' ? '未接到清晰的像' : '接到清晰的像', '光屏是否接到清晰的像', screen?.id ?? mirror.id, observationRange, result.screenTest, 0, 0, true)) return fail('MIRROR_CAPTURE');
  return { ok: true as const, records, snapshot: snapshot.data };
}
