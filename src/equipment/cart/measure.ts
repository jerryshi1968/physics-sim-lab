import { dimensionOf } from '../../core/units/units.ts';
import type { SIUnit } from '../../core/units/units.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import type { MeasurementRecord, MeasurementSnapshot, SceneDocument } from '../../core/scene/schema.ts';
import { CART_MODEL, cartEstimate, cartSamples, cartSignature } from './simulate.ts';
import type { CartMethod, CartRun } from './simulate.ts';

const accelerationAxis = { quantity: 'acceleration', unit: 'm/s²', label: '加速度 a（m/s²）', pointLabel: '测得加速度' } as const;
export const cartProfiles: readonly MeasurementChartProfile[] = [
  { id: 'cart-force', label: '加速度与合外力 a–F', available: true, x: { quantity: 'force', unit: 'N', label: '系统合外力 F（N）', pointLabel: '系统合外力' }, y: accelerationAxis },
  { id: 'cart-mass', label: '加速度与系统质量倒数 a–1/M', available: true, x: { quantity: 'mass', unit: 'kg', label: '系统质量倒数 1/M（kg⁻¹）', pointLabel: '系统质量', power: -1 }, y: accelerationAxis },
  { id: 'cart-time', label: '位移与时间 x–t', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', label: '时间 t（s）', pointLabel: '采样时间' }, y: { quantity: 'length', unit: 'm', label: '位移 x（m）', pointLabel: '采样位移' } },
  { id: 'cart-time2', label: '位移与时间平方 x–t²', available: true, groupByRun: true, x: { quantity: 'time', unit: 's', label: '时间平方 t²（s²）', pointLabel: '采样时间', power: 2 }, y: { quantity: 'length', unit: 'm', label: '位移 x（m）', pointLabel: '采样位移' } },
];

export interface CartCapture { method: CartMethod; stride: number; index: number | null; group: string; note: string }

export function buildCartMeasurement(scene: SceneDocument, run: CartRun | null, input: CartCapture, sampleId: string, timestamp: string) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (!run || !input.group.trim() || input.group.length > 100 || input.note.length > 150 || run.timeS <= 0) return fail('CART_CAPTURE');
  if (run.signature !== cartSignature(scene)) return fail('CART_STALE');
  const { rig } = run;
  const samples = cartSamples(run, input.method, input.stride);
  const estimate = cartEstimate(run, input.method, input.stride);
  const chosen = input.index === null ? null : samples[input.index];
  if (input.index === null ? estimate === null || !Number.isFinite(estimate) : !chosen) return fail('CART_CAPTURE');
  const used = input.method === 'gate' ? samples.slice(0, 2) : samples;
  const methodLabel = input.method === 'gate' ? '光电门' : '纸带';
  const equipment = input.index === null ? rig.cart : scene.equipment.find(item => item.id === chosen?.id);
  if (!equipment) return fail('CART_STALE');
  const sequence = Math.round(run.timeS * 1e6) + 1;
  const snapshot: MeasurementSnapshot = { id: sampleId, documentId: scene.documentId, documentRevision: scene.revision, runId: run.id,
    sequence, capturedAt: timestamp, setupLabel: `${input.group.trim().slice(0, 92)} · ${methodLabel}`,
    note: JSON.stringify({ method: input.method, ...(input.method === 'tape' ? { stride: input.stride } : {}), timeS: run.timeS,
      point: chosen?.label ?? '本组', count: used.length, ...(input.method === 'gate' ? { gates: used.map(sample => sample.id) } : {}), note: input.note }),
    modelVersion: CART_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig,
  };
  if (snapshot.note.length > 500) return fail('CART_CAPTURE');
  const specs: { label: string; unit: SIUnit; value: number }[] = chosen ? [
    { label: '采样时间', unit: 's', value: chosen.timeS }, { label: '采样位移', unit: 'm', value: chosen.displacementM },
  ] : [
    { label: '系统合外力', unit: 'N', value: rig.forceN }, { label: '系统质量', unit: 'kg', value: rig.systemKg },
    { label: '测得加速度', unit: 'm/s²', value: estimate! },
  ];
  const rawGates = chosen ? [chosen] : input.method === 'gate' ? used : [];
  for (const sample of rawGates) {
    if (sample.velocity === null || sample.inS === null || sample.outS === null || sample.durationS === null) continue;
    specs.push({ label: `${sample.label} 遮光开始`, unit: 's', value: sample.inS }, { label: `${sample.label} 遮光结束`, unit: 's', value: sample.outS },
      { label: `${sample.label} 遮光时长`, unit: 's', value: sample.durationS }, { label: `${sample.label} 测得速度`, unit: 'm/s', value: sample.velocity });
  }
  const records: MeasurementRecord[] = specs.map(({ label, unit, value }, index) => ({
    id: `${sampleId}.${index}`, source: 'instrument', quantity: dimensionOf(unit), unit, value, rawInput: null, equipmentId: equipment.id,
    range: null, measurementStatus: 'valid', recordedAt: timestamp, documentRevision: scene.revision, runId: run.id, sequence, modelConfigSnapshot: scene.simulationConfig,
    context: { sampleId, equipmentLabel: chosen ? `${methodLabel} · ${chosen.label}` : `动力学小车 · ${methodLabel}`, pointLabel: label, instrumentStatus: 'valid',
      instrumentDisplayValue: value, physicalValue: label === '测得加速度' ? rig.acceleration : value, originalRawInput: null, diagnosticCodes: [] },
  }));
  return { ok: true as const, records, snapshot };
}
