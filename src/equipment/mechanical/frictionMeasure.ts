import type { SceneDocument, MeasurementRecord } from '../../core/scene/schema.ts';
import { MeasurementRecordSchema, MeasurementSnapshotSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { FrictionMotion } from '../../core/mechanical/friction/model.ts';
import { frictionSample } from './frictionScene.ts';
import { manualResult } from '../../core/measurements/records.ts';

export interface FrictionCapture { source: 'manual' | 'instrument'; pressureRaw: string; pullRaw: string; frictionRaw: string; setupLabel: string; note: string }
export function buildFrictionMeasurements(scene: SceneDocument, registry: EquipmentRegistry, state: FrictionMotion, runId: string, input: FrictionCapture, sampleId: string, timestamp: string) {
  const sample = frictionSample(scene, registry, state), fail = (code: string) => ({ ok: false as const, code });
  if (!sample.ok || state.timeS <= 0 || !runId) return fail('FRICTION_CAPTURE_UNAVAILABLE');
  const { rig, forces, reading } = sample;
  const snapshot = MeasurementSnapshotSchema.safeParse({ id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId, sequence: Math.max(1, Math.round(state.timeS / rig.dt)), capturedAt: timestamp, setupLabel: input.setupLabel,
    note: JSON.stringify({ t: state.timeS, x: state.xM, v: state.velocityMPerS, state: forces.state, steady: forces.steady, mode: rig.config.mode, massKg: rig.config.massKg, areaM2: rig.block.parameters.areaM2, material: rig.surface.parameters.material, mus: rig.config.staticCoefficient, muk: rig.config.kineticCoefficient, pullN: forces.pullN, note: input.note }), modelVersion: 'mechanical.friction.v1', equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig });
  if (!snapshot.success || !['manual', 'instrument'].includes(input.source)) return fail('INVALID_FRICTION_CAPTURE');
  const range = { min: 0, max: Number(rig.meter.parameters.rangeN), resolution: Number(rig.meter.parameters.resolutionN) };
  const specs = [
    { quantity: 'force', unit: 'N', label: '压力', truth: forces.normalN, display: forces.normalN, raw: input.pressureRaw, range: { min: 0, max: 2000, resolution: .01 }, status: 'valid' },
    { quantity: 'force', unit: 'N', label: '牵引力', truth: Math.abs(forces.pullN), display: reading.displayN, raw: input.pullRaw, range, status: reading.status === 'valid' ? forces.steady ? 'valid' : 'non-steady' : 'over-range' },
    { quantity: 'force', unit: 'N', label: '滑动摩擦力', truth: Math.abs(forces.frictionN), display: forces.steady ? reading.displayN : null, raw: input.frictionRaw, range, status: !forces.steady ? 'out-of-model' : reading.status === 'valid' ? 'valid' : 'over-range' },
  ] as const;
  const records: MeasurementRecord[] = [];
  for (const [index, spec] of specs.entries()) {
    const instrumentStatus = spec.status === 'non-steady' ? 'valid' : spec.status;
    const result = input.source === 'manual' ? manualResult(spec.raw, spec.status, spec.range) : { value: spec.display, measurementStatus: spec.status };
    if (!result) return fail('INVALID_MANUAL_VALUE');
    const record = MeasurementRecordSchema.safeParse({ id: `${sampleId}.${index}`, source: input.source, quantity: spec.quantity, unit: spec.unit, rawInput: input.source === 'manual' ? spec.raw : null, ...result, equipmentId: rig.block.id, range: spec.range, recordedAt: timestamp, documentRevision: scene.revision, runId, sequence: snapshot.data.sequence, modelConfigSnapshot: scene.simulationConfig,
      context: { sampleId, equipmentLabel: '木块与测力计', pointLabel: spec.label, instrumentStatus, instrumentDisplayValue: instrumentStatus === 'valid' ? spec.display : null, physicalValue: spec.truth, originalRawInput: input.source === 'manual' ? spec.raw : null, diagnosticCodes: spec.status === 'non-steady' || spec.status === 'out-of-model' ? ['FRICTION_NON_STEADY'] : spec.status === 'over-range' ? ['FRICTION_OVER_RANGE'] : [] } });
    if (!record.success) return fail('INVALID_FRICTION_CAPTURE');
    records.push(record.data);
  }
  return { ok: true as const, records, snapshot: snapshot.data };
}
