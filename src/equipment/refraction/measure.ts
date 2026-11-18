import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { parseManualValue, manualResult } from '../../core/measurements/records.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { simulateRefraction, AIR_INDEX, WATER_INDEX } from './simulate.ts';
import { REFRACTION_MODEL } from './definitions.ts';
export const refractionObservations = ['未判断', '向法线偏折', '远离法线偏折', '传播方向不变', '未见折射光线'] as const;
export interface RefractionCapture { incidenceDeg: string; refractionDeg: string; observation: string; setupLabel: string; note: string }
export const refractionProfiles: readonly MeasurementChartProfile[] = [{ id: 'refraction-r-i', label: '折射角 r—入射角 i（°）', available: true, x: { quantity: 'angle', unit: 'rad', displayUnit: '°', label: '入射角 i（°）', pointLabel: '入射角i' }, y: { quantity: 'angle', unit: 'rad', displayUnit: '°', label: '折射角 r（°）', pointLabel: '折射角r' } }];
export function buildRefractionMeasurements(scene: SceneDocument, registry: EquipmentRegistry, input: RefractionCapture, id: string, time: string, preview = false) {
  const fail = (message: string) => ({ ok: false as const, message }), result = simulateRefraction(scene, registry);
  if (preview || !result.ok) return fail('请先完成光源摆放，结束拖动并打开光源。');
  if (!refractionObservations.some(value => value === input.observation) || input.note.length > 100 || input.setupLabel.length > 70) return fail('请检查组名和观察；组名最多 70 字，备注最多 100 字。');
  const parsed = [input.incidenceDeg, input.refractionDeg].map(parseManualValue);
  if (parsed.some(p => !p.ok)) return fail('请输入有限角度，留空记缺失；读角范围为 0～90°。');
  const raw = parsed.map(p => p.ok && p.value !== null ? String(p.value * Math.PI / 180) : '');
  const direction = result.fromWater ? '水→空气' : '空气→水';
  const snapshot = MeasurementSnapshotSchema.safeParse({ id, documentId: scene.documentId, documentRevision: scene.revision, runId: id, sequence: 1, capturedAt: time, setupLabel: `${input.setupLabel} · ${direction}`, modelVersion: REFRACTION_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig,
    note: JSON.stringify({ direction, n1: result.fromWater ? WATER_INDEX : AIR_INDEX, n2: result.fromWater ? AIR_INDEX : WATER_INDEX, kind: result.kind, hit: result.hit, observation: input.observation, note: input.note }) });
  if (!snapshot.success) return fail('折射实验快照无效。');
  const bend = !result.transmitted ? 3 : Math.abs(result.incidenceRad) < 1e-8 ? 2 : result.fromWater ? 1 : 0;
  const specs = [{ label: '入射角i', quantity: 'angle', unit: 'rad', raw: raw[0]!, original: input.incidenceDeg, value: result.incidenceRad, valid: result.readable.incident, equipment: result.incidentGauge?.id ?? result.tank.id },
    { label: '折射角r', quantity: 'angle', unit: 'rad', raw: raw[1]!, original: input.refractionDeg, value: result.refractionRad, valid: result.readable.refracted, equipment: result.refractedGauge?.id ?? result.tank.id },
    { label: '折射偏折观察', quantity: 'dimensionless', unit: '1', raw: input.observation === '未判断' ? '' : String(refractionObservations.indexOf(input.observation as typeof refractionObservations[number]) - 1), original: input.observation, value: bend, valid: true, equipment: result.tank.id }] as const;
  const records: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const range = { min: 0, max: index === 2 ? 3 : Math.PI / 2, resolution: index === 2 ? 1 : Math.PI / 180 }, status = spec.valid ? 'valid' : 'out-of-model', measured = manualResult(spec.raw, status, range);
    if (!measured) return fail('抄表值无效。');
    const record = MeasurementRecordSchema.safeParse({ id: `${id}.${index}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...measured, rawInput: spec.raw, equipmentId: spec.equipment, range, recordedAt: time, documentRevision: scene.revision, runId: id, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId: id, equipmentLabel: '折射量角与观察', pointLabel: spec.label, instrumentStatus: status, physicalValue: spec.value, instrumentDisplayValue: spec.valid && spec.value !== null ? Number((Math.round(spec.value / range.resolution) * range.resolution).toPrecision(12)) : null, originalRawInput: spec.original, diagnosticCodes: spec.valid ? [] : [result.kind === 'total-reflection' ? 'REFRACTION_NO_TRANSMITTED_RAY' : 'REFRACTION_UNCALIBRATED_GAUGE'] } });
    if (!record.success) return fail('折射记录未通过校验。'); records.push(record.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
