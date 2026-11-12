import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { pendulumRig } from './simulate.ts';
import type { PendulumRun } from './simulate.ts';
import { PENDULUM } from './definitions.ts';

export interface PendulumCapture { rulerId: string; pivotRaw: string; centerRaw: string; cyclesRaw: string; timeRaw: string; setupLabel: string; note: string }
const version = 'mechanical.pendulum.nonlinear.v1';
export function buildPendulumMeasurements(scene: SceneDocument, run: PendulumRun | null, input: PendulumCapture, sampleId: string, timestamp: string) {
  const fail = (message: string) => ({ ok: false as const, message }), rig = pendulumRig(scene);
  if (!rig.ok) return fail(rig.message);
  if (!run || run.signature !== rig.signature || !run.completed) return fail('请先完成一次多周期计时。');
  const ruler = scene.equipment.find(item => item.id === input.rulerId && item.type === MECHANICAL_RULER);
  if (!ruler || Math.abs(Math.sin(ruler.pose.rotationRad) + 1) > 1e-8 || ruler.pose.flippedX) return fail('请选择竖直向下的独立刻度尺，重置后量悬点到球心的距离。');
  if (input.note.length > 100 || input.setupLabel.length > 100) return fail('组名和备注最多 100 字。');
  const raw = [input.pivotRaw, input.centerRaw, input.cyclesRaw, input.timeRaw];
  if (raw.map(parseManualValue).some(result => !result.ok)) return fail('请输入有限的尺读数、周期数和时间，留空记缺失。');
  const runId = `pendulum-${sampleId}`, sequence = scene.revision + 1;
  const note = JSON.stringify({ rulerId: input.rulerId, targetCycles: run.targetCycles, elapsedS: run.timeS, amplitudeRad: rig.amplitudeRad, note: input.note });
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId, sequence, capturedAt: timestamp, setupLabel: input.setupLabel, note, modelVersion: version, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success) return fail('单摆测量快照无效。');
  const rulerTop = (ruler.pose.yM - rig.pivot.yM) / -Math.sin(ruler.pose.rotationRad);
  if (rulerTop < -1e-9 || rulerTop + rig.lengthM > Number(ruler.parameters.lengthM) + 1e-9) return fail('刻度尺未覆盖悬点到最低点球心，请调整尺的位置或长度，并重新计时。');
  const resolution = Number(rig.timer!.parameters.resolutionS);
  const specs = [
    { label: '悬点尺读数', quantity: 'length', unit: 'm', raw: input.pivotRaw, truth: rulerTop, range: { min: 0, max: Number(ruler.parameters.lengthM), resolution: .001 } },
    { label: '最低点球心尺读数', quantity: 'length', unit: 'm', raw: input.centerRaw, truth: rulerTop + rig.lengthM, range: { min: 0, max: Number(ruler.parameters.lengthM), resolution: .001 } },
    { label: '完整周期数N', quantity: 'dimensionless', unit: '1', raw: input.cyclesRaw, truth: run.targetCycles, range: { min: 1, max: 50, resolution: 1 } },
    { label: '多周期时间t', quantity: 'time', unit: 's', raw: input.timeRaw, truth: Math.round(run.timeS / resolution) * resolution, range: { min: resolution, max: 1000, resolution } },
  ] as const;
  const records: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const result = manualResult(spec.raw, 'valid', spec.range);
    if (!result) return fail('单摆读数无效。');
    const parsed = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${index}`, source: 'manual', quantity: spec.quantity, unit: spec.unit, ...result, rawInput: spec.raw, equipmentId: rig.bob.id, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId, sequence, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: '单摆、刻度尺与计时器', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: spec.truth, physicalValue: spec.truth, originalRawInput: spec.raw, diagnosticCodes: rig.smallAngle ? [] : ['PENDULUM_LARGE_ANGLE'] } });
    if (!parsed.success) return fail('单摆记录无效。');
    records.push(parsed.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
export function pendulumResults(scene: SceneDocument) {
  return (scene.measurementSnapshots ?? []).filter(snapshot => snapshot.modelVersion === version).map(snapshot => {
    const records = scene.measurementRecords.filter(record => record.context?.sampleId === snapshot.id);
    const value = (label: string) => { const found = records.filter(record => record.context?.pointLabel === label); return found.length === 1 && found[0]!.measurementStatus === 'valid' ? found[0]!.value : null; };
    const top = value('悬点尺读数'), bottom = value('最低点球心尺读数'), cycles = value('完整周期数N'), time = value('多周期时间t');
    const bob = snapshot.equipment.find(item => item.type === PENDULUM), angle = Number(bob?.parameters.initialAngleDeg), gravity = snapshot.modelConfigSnapshot.gravityMPerS2;
    let target: number | null = null;
    try { target = JSON.parse(snapshot.note).targetCycles; } catch { /* Imported snapshots without a timing window remain unqualified. */ }
    const valid = top !== null && bottom !== null && bottom > top && cycles !== null && Number.isInteger(cycles) && cycles === target && time !== null && time > 0 && Number.isFinite(angle);
    const length = valid ? bottom! - top! : null, period = valid ? time! / cycles! : null;
    const smallAngle = Number.isFinite(angle) && Math.abs(angle) <= 5 + 1e-10;
    const signature = JSON.stringify([snapshot.setupLabel, gravity, bob?.parameters.massKg, bob?.parameters.bobRadiusM, Math.abs(angle)]);
    return { id: snapshot.id, label: snapshot.setupLabel, valid, length, period, angle, smallAngle, signature, gravity,
      g: valid ? 4 * Math.PI ** 2 * length! / period! ** 2 : null };
  });
}
export function pendulumFits(scene: SceneDocument) {
  const rows = pendulumResults(scene).filter(row => row.valid && row.smallAngle), groups = [...new Set(rows.map(row => row.signature))];
  return groups.map(signature => {
    const points = rows.filter(row => row.signature === signature), fit = linearFit(points.map(row => ({ x: row.length!, y: row.period! ** 2 })));
    return { signature, label: points[0]!.label, fit: fit && fit.slope > 0 ? fit : null, g: fit && fit.slope > 0 ? 4 * Math.PI ** 2 / fit.slope : null, count: points.length };
  });
}
