import type { SceneDocument, MeasurementRecord, MeasurementSnapshot } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SIUnit } from '../../core/units/units.ts';
import { dimensionOf } from '../../core/units/units.ts';
import { manualResult, parseManualValue } from '../../core/measurements/records.ts';
import type { MeasurementChartProfile } from '../../core/measurements/charts.ts';
import { CYLINDER } from '../density/definitions.ts';
import { BODY, OVERFLOW, BUOYANCY_MODEL, vesselAreaM2, spoutHeightM } from './definitions.ts';
import { bodyVolume, buoyancyFluid, isReceiver, simulateBuoyancy } from './simulate.ts';

export const buoyancyPhases = { air: '空气中测力计示数', immersed: '液中测力计示数', depth: '浸入高度', empty: '空接液杯质量', full: '接液后总质量', volume: '排液体积' } as const;
export type BuoyancyPhase = keyof typeof buoyancyPhases;
interface Spec { label: string; unit: SIUnit; value: number; truth: number }
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const overflow = (scene: Pick<SceneDocument, 'equipment'>) => scene.equipment.find(item => item.type === OVERFLOW);
const body = (scene: Pick<SceneDocument, 'equipment'>) => scene.equipment.find(item => item.type === BODY);
const receiver = (scene: Pick<SceneDocument, 'equipment'>) => scene.equipment.find(isReceiver);

export function captureBuoyancy(scene: SceneDocument, registry: EquipmentRegistry, phase: BuoyancyPhase, raw: string, group: string, id: string, time: string) {
  const outcome = simulateBuoyancy(scene, registry), fail = (message: string) => ({ ok: false as const, message });
  if (['BUOY_DOCUMENT', 'BUOY_RANGE'].includes(outcome.code)) return fail('请先检查器材参数和模型范围。');
  if (!Object.hasOwn(buoyancyPhases, phase) || !group.trim() || group.length > 100) return fail('请填写组名并选择读数阶段。');
  const mass = phase === 'empty' || phase === 'full', volume = phase === 'volume', depth = phase === 'depth';
  const weighing = outcome.density.weighing, cylinder = outcome.density.volume;
  let truth: number, display: number, equipmentId: string, unit: SIUnit, range: { min: number; max: number; resolution: number };
  if (mass) {
    if (!weighing.ok || !weighing.readableMass || !weighing.load || !isReceiver(weighing.load)) return fail('先将接液杯放到左盘并调平天平，再读质量。');
    if (phase === 'empty' && Number(weighing.load.parameters.liquidM3) > 1e-12 || phase === 'full' && Number(weighing.load.parameters.liquidM3) <= 1e-12) return fail('杯内液量不符合所选阶段。');
    truth = weighing.leftKg; display = weighing.rightKg; equipmentId = weighing.balance.id; unit = 'kg'; range = { min: 0, max: .2, resolution: .0002 };
  } else if (volume) {
    if (!cylinder.ok || !cylinder.readableVolume || cylinder.liquid.readingM3 <= 0) return fail('请将排液倒入空量筒，并平视液面。');
    truth = cylinder.liquid.readingM3; display = Math.round(truth / .000001) * .000001; equipmentId = cylinder.cylinder.id; unit = 'm³'; range = { min: 0, max: .0001, resolution: .000001 };
  } else if (depth) {
    if (!outcome.ok || !outcome.body || outcome.submergedM3 <= 0) return fail('先将圆柱体浸入液体，再按柱身刻度读浸入高度。');
    truth = outcome.submergedM3 / Number(outcome.body.parameters.areaM2); display = truth; equipmentId = outcome.body.id; unit = 'm'; range = { min: 0, max: Number(outcome.body.parameters.heightM), resolution: .01 };
  } else {
    if (!outcome.ok || !outcome.meter || phase === 'air' && outcome.submergedM3 > 1e-12 || phase === 'immersed' && outcome.submergedM3 <= 1e-12) return fail('先正确挂接并放到所选阶段的位置，再读测力计。');
    truth = outcome.tensionN; display = outcome.forceN; equipmentId = outcome.meter.id; unit = 'N'; range = { min: 0, max: Number(outcome.meter.parameters.rangeN), resolution: Number(outcome.meter.parameters.resolutionN) };
  }
  const parsed = parseManualValue(raw);
  if (!parsed.ok) return fail('请输入有限数字，留空保存为缺失。');
  const siRaw = parsed.value === null ? '' : String(parsed.value * (mass ? .001 : volume ? .000001 : depth ? .01 : 1));
  const read = manualResult(siRaw, 'valid', range)!;
  const snapshot: MeasurementSnapshot = { id, documentId: scene.documentId, documentRevision: scene.revision, runId: id, sequence: 1, capturedAt: time,
    setupLabel: group.trim(), note: JSON.stringify({ phase }), modelVersion: BUOYANCY_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig };
  const record: MeasurementRecord = { id: `${id}.0`, source: 'manual', quantity: dimensionOf(unit), unit, ...read, rawInput: siRaw, equipmentId, range,
    recordedAt: time, documentRevision: scene.revision, runId: id, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
    context: { sampleId: id, equipmentLabel: mass ? '托盘天平' : volume ? '量筒' : depth ? '带吊环圆柱体' : '弹簧测力计', pointLabel: buoyancyPhases[phase], instrumentStatus: 'valid', physicalValue: truth,
      instrumentDisplayValue: display, originalRawInput: raw, diagnosticCodes: [] } };
  return { ok: true as const, snapshot, records: [record] };
}

export type BuoyancyCalculation = 'force' | 'weight' | 'volume';
export function calculateBuoyancy(scene: SceneDocument, kind: BuoyancyCalculation, ids: string[], group: string, id: string, time: string) {
  const fail = (message: string) => ({ ok: false as const, message });
  const rows = ids.map(key => scene.measurementRecords.find(item => item.id === key));
  const snapshots = rows.map(row => scene.measurementSnapshots?.find(item => item.id === row?.context?.sampleId));
  if (!group.trim() || group.length > 100 || new Set(ids).size !== ids.length || rows.some(row => !row || row.value === null || row.measurementStatus !== 'valid')
    || snapshots.some(item => !item || item.modelVersion !== BUOYANCY_MODEL || item.setupLabel !== group.trim() || item.modelConfigSnapshot.gravityMPerS2 !== scene.simulationConfig.gravityMPerS2)) return fail('请选择同一组的有效来源读数。');
  const [a, b, c] = snapshots as MeasurementSnapshot[], [ra, rb, rc] = rows as MeasurementRecord[], g = scene.simulationConfig.gravityMPerS2;
  if (!a || !b || !ra || !rb) return fail('请选齐来源。');
  let specs: Spec[], sourceIds: string[];
  if (kind === 'force') {
    const original = body(a), immersed = body(b);
    if (ra.context?.pointLabel !== buoyancyPhases.air || rb.context?.pointLabel !== buoyancyPhases.immersed || !original || !immersed || original.id !== immersed.id
      || ['massKg', 'areaM2', 'heightM'].some(key => original.parameters[key] !== immersed.parameters[key]) || a.documentRevision >= b.documentRevision || ra.value! < rb.value!) return fail('空气和液中读数必须来自同一物体、相同质量与尺寸，并先测空气读数。');
    const tank = buoyancyFluid({ ...scene, equipment: b.equipment }).vessel;
    const rho = Number(tank?.parameters.liquidDensityKgPerM3 ?? 1000);
    specs = [{ label: '称重法浮力', unit: 'N', value: ra.value! - rb.value!, truth: ra.context!.physicalValue! - rb.context!.physicalValue! }, { label: '液体密度', unit: 'kg/m³', value: rho, truth: rho }];
    sourceIds = [a.id, b.id];
    if (c && rc) {
      if (rc.context?.pointLabel !== buoyancyPhases.depth || JSON.stringify(b.equipment) !== JSON.stringify(c.equipment)) return fail('浸入高度需与液中示数在同一摆放状态下记录。');
      specs.push({ label: '排液体积', unit: 'm³', value: rc.value! * Number(immersed.parameters.areaM2), truth: rc.context!.physicalValue! * Number(immersed.parameters.areaM2) });
      sourceIds.push(c.id);
    }
  } else {
    if (ra.context?.pointLabel !== '称重法浮力' || !a.note.startsWith('{"calculation":"force",')) return fail('先计算称重法浮力，再选择排液来源。');
    const wetSnapshot = scene.measurementSnapshots?.find(item => item.id === a.sourceSnapshotIds?.[1]);
    const wet = wetSnapshot && overflow(wetSnapshot), trial = wet?.parameters.trialId;
    if (!wet || !trial || Number(wet.parameters.lostM3) > 1e-10 || !near(Number(wet.parameters.initialLiquidM3), vesselAreaM2 * spoutHeightM)) return fail('溢水杯需先加至溢水口，排液应全部接住。');
    const wetBody = body(wetSnapshot!), original = body(a);
    if (!wetBody || !original || bodyVolume(wetBody) !== bodyVolume(original)) return fail('物体条件不连续。');
    const displaced = Number(wet.parameters.spilledM3);
    if (displaced <= 0 || !near(displaced, buoyancyFluid({ ...scene, equipment: wetSnapshot!.equipment }).submergedM3)) return fail('本批累计排液与本次浸没体积不符，请重新准备后测量。');
    if (kind === 'weight') {
      if (!c || !rc || rb.context?.pointLabel !== buoyancyPhases.empty || rc.context?.pointLabel !== buoyancyPhases.full) return fail('请选择空杯与接液后质量。');
      const empty = receiver(b), full = receiver(c), tank = overflow(c);
      if (!empty || !full || empty.id !== full.id || empty.parameters.tareKg !== full.parameters.tareKg || Number(empty.parameters.liquidM3) !== 0 || !tank || tank.parameters.trialId !== trial
        || Number(tank.parameters.lostM3) > 1e-10 || !near(Number(full.parameters.liquidM3), displaced) || !near(Number(tank.parameters.spilledM3), displaced)
        || full.parameters.liquidDensityKgPerM3 !== wet.parameters.liquidDensityKgPerM3 || b.documentRevision >= c.documentRevision || rb.value! >= rc.value!) return fail('空杯和接液后读数需来自同一杯，且对应同一次完整排液。');
      specs = [{ label: '称重法浮力', unit: 'N', value: ra.value!, truth: ra.context!.physicalValue! }, { label: '排液重力', unit: 'N', value: (rc.value! - rb.value!) * g, truth: displaced * Number(wet.parameters.liquidDensityKgPerM3) * g }];
      sourceIds = [a.id, b.id, c.id];
    } else {
      const cylinder = b.equipment.find(item => item.type === CYLINDER), tank = overflow(b);
      if (rb.context?.pointLabel !== buoyancyPhases.volume || !cylinder || !tank || tank.parameters.trialId !== trial || Number(tank.parameters.lostM3) > 1e-10
        || !near(Number(cylinder.parameters.liquidM3), displaced) || Number(receiver(b)?.parameters.liquidM3) !== 0 || cylinder.parameters.liquidDensityKgPerM3 !== wet.parameters.liquidDensityKgPerM3) return fail('量筒读数需对应同一次排液，且已将接液杯中的液体全部转入空量筒。');
      specs = [{ label: '称重法浮力', unit: 'N', value: ra.value!, truth: ra.context!.physicalValue! }, { label: '排液体积', unit: 'm³', value: rb.value!, truth: displaced }];
      sourceIds = [a.id, b.id];
    }
  }
  const snapshot: MeasurementSnapshot = { id, documentId: scene.documentId, documentRevision: scene.revision, runId: id, sequence: 1, capturedAt: time,
    setupLabel: group.trim(), note: JSON.stringify({ calculation: kind, sources: ids }), sourceSnapshotIds: sourceIds,
    modelVersion: BUOYANCY_MODEL, equipment: scene.equipment, connections: scene.connections, modelConfigSnapshot: scene.simulationConfig };
  const equipmentId = scene.equipment.find(item => item.id === ra.equipmentId)?.id;
  if (!equipmentId) return fail('来源仪器已不存在。');
  const records: MeasurementRecord[] = specs.map((spec, index) => ({ id: `${id}.${index}`, source: 'instrument', quantity: dimensionOf(spec.unit), unit: spec.unit, value: Number(spec.value.toPrecision(12)), rawInput: null,
    equipmentId, range: null, measurementStatus: 'valid', recordedAt: time, documentRevision: scene.revision, runId: id, sequence: 1, modelConfigSnapshot: scene.simulationConfig,
    context: { sampleId: id, equipmentLabel: '学生读数计算', pointLabel: spec.label, instrumentStatus: 'valid', instrumentDisplayValue: Number(spec.value.toPrecision(12)), physicalValue: spec.truth, originalRawInput: null, diagnosticCodes: [] } }));
  return { ok: true as const, snapshot, records };
}

const forceAxis = { quantity: 'force', unit: 'N', label: '浮力（N）', pointLabel: '称重法浮力' } as const;
export const buoyancyProfiles: readonly MeasurementChartProfile[] = [
  { id: 'buoyancy-density', label: '浮力—液体密度', available: true, x: { quantity: 'density', unit: 'kg/m³', label: '液体密度（kg/m³）', pointLabel: '液体密度' }, y: forceAxis },
  { id: 'buoyancy-weight', label: '浮力—排液重力', available: true, x: { quantity: 'force', unit: 'N', label: '排液重力（N）', pointLabel: '排液重力' }, y: forceAxis },
  { id: 'buoyancy-volume', label: '浮力—排液体积', available: true, x: { quantity: 'volume', unit: 'm³', displayUnit: 'mL', label: '排液体积（mL）', pointLabel: '排液体积' }, y: forceAxis },
];
