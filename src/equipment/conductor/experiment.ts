import type { SceneDocument } from '../../core/scene/schema.ts';
import type { SceneCommand } from '../../core/workbench/history.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { AMMETER, POWER, SWITCH } from '../electrical/definitions.ts';
import { CONDUCTOR_EXPERIMENT, METAL_WIRE, MetalWireSchema, metalSamples, metalMaterials } from '../electrical/conductor.ts';
import type { MetalWireParameters } from '../electrical/conductor.ts';
import { HEATER, THERMOMETER } from '../thermal/definitions.ts';

export const conductorSample = (scene: Pick<SceneDocument, 'equipment'>) => scene.equipment.filter(i => i.type === METAL_WIRE).length === 1 ? scene.equipment.find(i => i.type === METAL_WIRE) : undefined;
export const conductorClosed = (scene: Pick<SceneDocument, 'equipment'>) => scene.equipment.some(i => i.type === SWITCH && i.parameters.closed === true);
export function heaterAligned(scene: Pick<SceneDocument, 'equipment'>) {
  const wire = conductorSample(scene), heaters = scene.equipment.filter(i => i.type === HEATER);
  return wire && heaters.length === 1 && Math.abs(Math.sin(wire.pose.rotationRad)) < .01 && Math.abs(Math.sin(heaters[0]!.pose.rotationRad)) < .01 && Math.abs(heaters[0]!.pose.xM - wire.pose.xM) <= .12 && Math.abs(heaters[0]!.pose.yM - (wire.pose.yM - .10)) <= .08 ? heaters[0] : undefined;
}
export function conductorChange(scene: SceneDocument, change: { sample?: string; parameters?: Partial<MetalWireParameters>; thermal?: 'heat' | 'cool' | 'reset'; range?: 'low' | 'high' }): SceneCommand | null {
  const wire = conductorSample(scene);
  if (scene.experimentId !== CONDUCTOR_EXPERIMENT || !wire || conductorClosed(scene)) return null;
  if (change.range) {
    const meters = scene.equipment.filter(i => i.type === AMMETER); if (meters.length !== 1) return null;
    const meter = meters[0]!, old = meterConnection(scene, meter.id); if (!old.range || old.bothRanges) return null;
    return { type: 'update-circuit', updates: [{ id: meter.id, pose: meter.pose, parameters: meter.parameters }], connections: scene.connections.map(c => ({ ...c,
      from: c.from?.equipmentId === meter.id && c.from.portId === old.range ? { ...c.from, portId: change.range! } : c.from,
      to: c.to?.equipmentId === meter.id && c.to.portId === old.range ? { ...c.to, portId: change.range! } : c.to,
    })) };
  }
  let p = { ...wire.parameters, ...change.parameters };
  if (change.sample) {
    const sample = metalSamples.find(s => s.id === change.sample); if (!sample) return null;
    p = { ...wire.parameters, material: sample.material, lengthM: sample.lengthM, areaM2: sample.areaM2 };
  }
  if (change.thermal) {
    if (change.thermal === 'reset') p.temperatureK = 293.15;
    else {
      const heater = heaterAligned(scene); if (!heater) return null;
      const power = change.thermal === 'heat' ? Number(heater.parameters.powerW) * Number(heater.parameters.efficiency) : 0;
      const loss = Number(heater.parameters.lossWPerK), seconds = change.thermal === 'heat' ? 5 : 30;
      p.temperatureK = conductorTemperature(Number(wire.parameters.temperatureK), Number(heater.parameters.ambientTemperatureK), power, loss, seconds);
    }
  }
  const checked = MetalWireSchema.safeParse(p); if (!checked.success) return null;
  return { type: 'update-equipment', id: wire.id, pose: wire.pose, parameters: checked.data };
}
export function conductorTemperature(initialK: number, ambientK: number, powerW: number, lossWPerK: number, seconds: number) {
  if (![initialK, ambientK, powerW, lossWPerK, seconds].every(Number.isFinite) || seconds < 0 || powerW < 0 || lossWPerK < 0) throw new RangeError('INVALID_CONDUCTOR_HEATING');
  const capacity = 10;
  const next = lossWPerK === 0 ? initialK + powerW * seconds / capacity : ambientK + powerW / lossWPerK + (initialK - ambientK - powerW / lossWPerK) * Math.exp(-lossWPerK * seconds / capacity);
  return Math.max(293.15, Math.min(353.15, next));
}
export function conductorRows(scene: SceneDocument) {
  return scene.measurementRecords.filter(r => r.quantity === 'current').flatMap(r => {
    const snapshot = scene.measurementSnapshots?.find(s => s.id === r.context?.sampleId); if (!snapshot) return [];
    const wire = conductorSample(snapshot), p = MetalWireSchema.safeParse(wire?.parameters);
    if (!p.success || snapshot.equipment.find(i => i.id === r.equipmentId)?.type !== AMMETER) return [];
    const source = snapshot.equipment.find(i => i.type === POWER), meter = snapshot.equipment.find(i => i.id === r.equipmentId);
    return [{ id: r.id, group: snapshot.setupLabel, note: snapshot.note, p: p.data, material: metalMaterials[p.data.material].label,
      source: JSON.stringify([source?.parameters, meter?.parameters.resistanceOhm, snapshot.modelConfigSnapshot,
        snapshot.equipment.filter(i => i.type.startsWith('electrical.') && ![POWER, AMMETER, METAL_WIRE].includes(i.type)).map(i => [i.id, i.parameters]).sort(),
        snapshot.connections.map(c => [c.from, c.to].map(e => e ? `${e.equipmentId}:${e.equipmentId === meter?.id && ['low', 'high'].includes(e.portId) ? 'positive' : e.portId}` : 'loose').sort().join('|')).sort(),
      ]), voltage: source?.parameters.voltageV,
      value: r.measurementStatus === 'valid' ? r.value : null, status: r.measurementStatus }];
  });
}
export function conductorContrast(a: ReturnType<typeof conductorRows>[number] | undefined, b: ReturnType<typeof conductorRows>[number]) {
  if (!a || a.group !== b.group) return '本组首条';
  if (a.value === null || b.value === null) return '读数缺失或无效';
  if (a.source !== b.source) return '电源或电表条件不同';
  const keys = ['material', 'lengthM', 'areaM2', 'temperatureK'] as const;
  const changed = keys.filter(key => key === 'material' ? a.p[key] !== b.p[key] : Math.abs(a.p[key] - b.p[key]) > (key === 'areaM2' ? 1e-13 : 1e-8));
  return changed.length === 1 ? `只改变${({ material: '材料', lengthM: '长度', areaM2: '横截面积', temperatureK: '温度' })[changed[0]!]}` : changed.length ? '同时改变多个因素' : '条件相同';
}
export const conductorAuxiliary = [HEATER, THERMOMETER];
