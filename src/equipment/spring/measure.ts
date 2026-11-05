import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { measurementSeries } from '../../core/measurements/charts.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { springRuler } from './simulate.ts';
import { SPRING } from './definitions.ts';

export interface SpringCapture { rulerId: string; topRaw: string; bottomRaw: string; originalRaw: string; massRaw: string; phase: string; setupLabel: string; note: string }
export const springProfiles: readonly MeasurementChartProfile[] = [{ id: 'spring-f-extension', label: '弹簧 F–Δx（读尺记录）', available: true, x: { quantity: 'length', unit: 'm', label: '形变量 Δx（m）', pointLabel: '形变量' }, y: { quantity: 'force', unit: 'N', label: '弹力 F（N）', pointLabel: '弹力' } }];
export function buildSpringMeasurements(scene: SceneDocument, registry: EquipmentRegistry, input: SpringCapture, sampleId: string, timestamp: string, transitioning = false) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (transitioning) return fail('TRANSITIONING');
  const ruler = springRuler(scene, registry, input.rulerId);
  if (!ruler.ok) return ruler;
  if (input.phase === '原长测量' && ruler.sample.value.totalMassKg !== 0) return fail('SPRING_ORIGINAL_LOADED');
  if (!['原长测量', '加载', '卸载复测'].includes(input.phase) || input.note.length > 100) return fail('INVALID_SPRING_CAPTURE');
  const inputs = [input.topRaw, input.bottomRaw, input.originalRaw, input.massRaw].map(parseManualValue);
  if (inputs.some(item => !item.ok)) return fail('INVALID_MANUAL_VALUE');
  const values = inputs.map(item => item.ok ? item.value : null), [top, bottom, original, mass] = values;
  const usable = (value: number | null | undefined, max: number) => value !== null && value !== undefined && value >= 0 && value <= max;
  const length = usable(top, ruler.lengthM) && usable(bottom, ruler.lengthM) && bottom! >= top! ? Number((bottom! - top!).toPrecision(12)) : null;
  const extension = length !== null && usable(original, 1.2) && original! > 0 && length >= original! ? length - original! : null;
  const totalMass = usable(mass, 400) ? mass! + Number(ruler.sample.spring.parameters.trayMassKg) : null;
  const force = totalMass !== null ? totalMass * scene.simulationConfig.gravityMPerS2 : null;
  const { sample } = ruler, runId = `spring-${scene.documentId}`, sequence = scene.revision + 1;
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId, sequence, capturedAt: timestamp, setupLabel: input.setupLabel, note: JSON.stringify({ phase: input.phase, rulerId: input.rulerId, trayMassKg: sample.spring.parameters.trayMassKg, top: input.topRaw, bottom: input.bottomRaw, original: input.originalRaw, hangingMass: input.massRaw, note: input.note }), modelVersion: 'mechanical.spring.statics.v1', equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('INVALID_SPRING_CAPTURE');
  const derivedRaw = (value: number | null) => value === null ? '' : String(Number(value.toPrecision(12)));
  const lengthRange = { min: 0, max: 1.2, resolution: .001 }, massRange = { min: 0, max: 402, resolution: .001 };
  const specs = [
    { label: '上端读数', quantity: 'length', unit: 'm', raw: input.topRaw, truth: ruler.topM, range: { ...lengthRange, max: ruler.lengthM } },
    { label: '下端读数', quantity: 'length', unit: 'm', raw: input.bottomRaw, truth: ruler.bottomM, range: { ...lengthRange, max: ruler.lengthM } },
    { label: '原长L0', quantity: 'length', unit: 'm', raw: input.originalRaw, truth: Number(sample.spring.parameters.originalLengthM), range: lengthRange },
    { label: '总长L', quantity: 'length', unit: 'm', raw: derivedRaw(length), truth: sample.value.lengthM, range: lengthRange },
    { label: '形变量', quantity: 'length', unit: 'm', raw: derivedRaw(extension), truth: sample.value.extensionM, range: lengthRange },
    { label: '总挂载质量', quantity: 'mass', unit: 'kg', raw: derivedRaw(totalMass), truth: sample.value.totalMassKg, range: massRange },
    { label: '弹力', quantity: 'force', unit: 'N', raw: derivedRaw(force), truth: sample.value.forceN, range: { min: 0, max: 10000, resolution: .01 } },
  ] as const;
  const records: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const result = manualResult(spec.raw, 'valid', spec.range);
    if (!result) return fail('INVALID_MANUAL_VALUE');
    const record = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${index}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...result, rawInput: spec.raw, equipmentId: sample.spring.id, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId, sequence, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: '弹簧与独立刻度尺', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.truth, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: [] } });
    if (!record.success) return fail('INVALID_SPRING_CAPTURE');
    records.push(record.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
export function springFits(scene: SceneDocument) {
  const records = new Map(scene.measurementRecords.map(item => [item.id, item])), snapshots = new Map((scene.measurementSnapshots ?? []).map(item => [item.id, item]));
  return measurementSeries(scene, springProfiles[0]!).map(series => {
    const points = series.points.filter((point): point is typeof point & { y: number } => point.y !== null);
    const signatures = new Set(points.map(point => {
      const record = records.get(point.recordId), snapshot = snapshots.get(record?.context?.sampleId ?? ''), item = snapshot?.equipment.find(item => item.id === record?.equipmentId && item.type === SPRING);
      return JSON.stringify([item?.parameters, snapshot?.modelConfigSnapshot.gravityMPerS2]);
    }));
    return { ...series, fit: signatures.size <= 1 ? linearFit(points) : null, mixed: signatures.size > 1, validCount: points.length };
  });
}
