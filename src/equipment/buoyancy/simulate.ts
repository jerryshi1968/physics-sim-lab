import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { SceneDocumentSchema } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { BALANCE, BEAKER, CYLINDER, MASS_SET } from '../density/definitions.ts';
import { panPoint, solveBalance, solveCylinder } from '../density/simulate.ts';
import type { DensityOutcome } from '../density/simulate.ts';
import { FORCE_METER, SUPPORT, MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { BODY, OVERFLOW, BUOYANCY_EXPERIMENT, buoyancyTypes, buoyancyApparatus, vesselAreaM2, vesselHeightM, spoutHeightM, beakerCapacityM3 } from './definitions.ts';

const tolerance = 1e-10;
export const isBuoyancyScene = (scene: SceneDocument) => scene.experimentId === BUOYANCY_EXPERIMENT || scene.equipment.some(item => buoyancyTypes.includes(item.type));
export const isReceiver = (item: EquipmentInstance) => item.type === BEAKER && item.parameters.buoyancyRole === 'receiver';
export const containerCapacity = (item: EquipmentInstance) => item.type === OVERFLOW ? vesselAreaM2 * spoutHeightM : isReceiver(item) ? .00025 : beakerCapacityM3;
export const bodyVolume = (item: EquipmentInstance) => Number(item.parameters.areaM2) * Number(item.parameters.heightM);
export const overflowOutlet = (item: EquipmentInstance) => ({ xM: item.pose.xM + .10, yM: item.pose.yM + .01 + spoutHeightM - .015 });

export function buoyancyViewScene(scene: SceneDocument) {
  const weighing = solveBalance(scene.equipment);
  const equipment = scene.equipment.map(item => {
    if (item.type === FORCE_METER && item.parameters.supportId) {
      const support = scene.equipment.find(peer => peer.type === SUPPORT && peer.id === item.parameters.supportId);
      if (support) return { ...item, pose: { ...item.pose, xM: support.pose.xM + .08, yM: support.pose.yM + Number(item.parameters.mountHeightM ?? support.parameters.heightM) } };
    }
    if (item.type === BEAKER && item.parameters.targetId) {
      const balance = scene.equipment.find(peer => peer.type === BALANCE && peer.id === item.parameters.targetId);
      if (balance) return { ...item, pose: { ...item.pose, ...panPoint(balance), yM: panPoint(balance).yM - (weighing.ok ? Math.tanh(weighing.residualKg / .005) * .025 : 0) } };
    }
    return item;
  });
  return { ...scene, equipment: equipment.map(item => {
    if (item.type !== BODY || !item.parameters.meterId) return item;
    const meter = equipment.find(peer => peer.type === FORCE_METER && peer.id === item.parameters.meterId);
    return meter ? { ...item, pose: { ...item.pose, xM: meter.pose.xM, yM: meter.pose.yM - .25 - Number(item.parameters.heightM) } } : item;
  }) };
}

export function buoyancyFluid(scene: SceneDocument) {
  const view = buoyancyViewScene(scene), body = view.equipment.find(item => item.type === BODY);
  const vessels = view.equipment.filter(item => item.type === OVERFLOW || item.type === BEAKER && !isReceiver(item) && !item.parameters.targetId);
  const bodyRadius = body ? Math.sqrt(Number(body.parameters.areaM2) / Math.PI) : 0;
  const vesselRadius = Math.sqrt(vesselAreaM2 / Math.PI);
  const touching = body ? vessels.filter(item => Math.abs(item.pose.xM - body.pose.xM) < vesselRadius + bodyRadius
    && body.pose.yM < item.pose.yM + vesselHeightM + (item.type === OVERFLOW ? 0 : .01) && body.pose.yM + Number(body.parameters.heightM) > item.pose.yM + .01) : [];
  const vessel = touching[0];
  const collision = !!(body && vessel && (touching.length > 1 || Math.abs(vessel.pose.xM - body.pose.xM) + bodyRadius > vesselRadius + tolerance || body.pose.yM <= vessel.pose.yM + .01));
  const liquids = vessels.map(item => {
    const liquidM3 = Number(item.parameters.liquidM3), base = item.pose.yM + .01;
    const submergedAt = (level: number) => body && item.id === vessel?.id && !collision
      ? Number(body.parameters.areaM2) * Math.max(0, Math.min(Number(body.parameters.heightM), level - body.pose.yM)) : 0;
    let lo = base, hi = base + vesselHeightM + .12;
    for (let step = 0; step < 64; step++) {
      const level = (lo + hi) / 2;
      if (vesselAreaM2 * (level - base) - submergedAt(level) < liquidM3) lo = level; else hi = level;
    }
    const uncapped = (lo + hi) / 2;
    const limit = base + (item.type === OVERFLOW ? spoutHeightM : vesselHeightM);
    const spillM3 = Math.max(0, Math.min(liquidM3, liquidM3 + submergedAt(limit) - vesselAreaM2 * (limit - base)));
    const level = Math.min(limit, uncapped), submergedM3 = submergedAt(level);
    return { item, level, submergedM3, spillM3 };
  });
  return { view, body, vessel, collision, liquids, submergedM3: liquids.find(item => item.item.id === vessel?.id)?.submergedM3 ?? 0 };
}

export function simulateBuoyancy(scene: SceneDocument, registry: EquipmentRegistry) {
  const fluid = buoyancyFluid(scene), { view, body, vessel, submergedM3, collision } = fluid;
  const meter = view.equipment.find(item => item.type === FORCE_METER), weighing = solveBalance(view.equipment), volume = solveCylinder(view.equipment);
  const density: DensityOutcome = { ok: false, code: 'BUOYANCY', weighing, volume };
  const weightN = body ? Number(body.parameters.massKg) * scene.simulationConfig.gravityMPerS2 : 0;
  const densityKgPerM3 = Number(vessel?.parameters.liquidDensityKgPerM3 ?? 1000), buoyancyN = densityKgPerM3 * scene.simulationConfig.gravityMPerS2 * submergedM3;
  const tensionN = weightN - buoyancyN;
  let code = '';
  if (!validateSceneDocument(scene, registry).ok || scene.connections.length || scene.equipment.some(item => !buoyancyApparatus.includes(item.type))) code = 'BUOY_DOCUMENT';
  else if (scene.simulationConfig.randomError.enabled || view.equipment.some(item => item.pose.flippedX || item.type !== MECHANICAL_RULER && Math.abs(item.pose.rotationRad) > 1e-8 || Math.abs(item.pose.xM) > 10 || Math.abs(item.pose.yM) > 10)) code = 'BUOY_RANGE';
  else if (!body || !meter || [BODY, FORCE_METER, SUPPORT, BALANCE, CYLINDER, MASS_SET, OVERFLOW].some(type => view.equipment.filter(item => item.type === type).length > 1)) code = 'BUOY_APPARATUS';
  else if (body.parameters.meterId !== meter.id || !view.equipment.some(item => item.type === SUPPORT && item.id === meter.parameters.supportId) || Number(meter.parameters.directionDeg) !== -90) code = 'BUOY_ATTACHMENT';
  else if (Number(meter.parameters.mountHeightM) > Number(view.equipment.find(item => item.id === meter.parameters.supportId)?.parameters.heightM)) code = 'BUOY_ATTACHMENT';
  else if (view.equipment.filter(item => item.type === BODY && item.parameters.meterId === meter.id).length > 1) code = 'BUOY_APPARATUS';
  else if (collision) code = 'BUOY_CONTACT';
  else if (tensionN <= 0 && submergedM3 > 0) code = 'BUOY_SLACK';
  else if (tensionN > Number(meter.parameters.rangeN) + tolerance) code = 'BUOY_OVER_RANGE';
  const forceN = code ? 0 : Math.round(tensionN / Number(meter!.parameters.resolutionN)) * Number(meter!.parameters.resolutionN);
  return { ...fluid, meter, density, weightN, densityKgPerM3, buoyancyN, tensionN, forceN, ok: !code, code,
    meterReading: { forceN: code ? 0 : tensionN, status: code ? 'invalid' : 'valid' } };
}
export type BuoyancyOutcome = ReturnType<typeof simulateBuoyancy>;

export function buoyancyTransition(scene: SceneDocument) {
  const candidate = SceneDocumentSchema.parse(scene), fluid = buoyancyFluid(candidate);
  for (const liquid of fluid.liquids) {
    if (liquid.spillM3 <= 1e-12) continue;
    const vessel = candidate.equipment.find(item => item.id === liquid.item.id)!;
    vessel.parameters.liquidM3 = Math.max(0, Number(vessel.parameters.liquidM3) - liquid.spillM3);
    if (vessel.type !== OVERFLOW) continue;
    const outlet = overflowOutlet(liquid.item);
    const receiver = candidate.equipment.find(item => isReceiver(item) && item.id === vessel.parameters.receiverId);
    const aligned = receiver && !receiver.parameters.targetId && Math.abs(receiver.pose.xM - outlet.xM) < .025 && outlet.yM >= receiver.pose.yM + .11 - .003 && outlet.yM <= receiver.pose.yM + .18;
    const compatible = receiver && (Number(receiver.parameters.liquidM3) < 1e-12 || receiver.parameters.liquidDensityKgPerM3 === vessel.parameters.liquidDensityKgPerM3);
    const captured = aligned && compatible ? Math.max(0, Math.min(liquid.spillM3, containerCapacity(receiver!) - Number(receiver!.parameters.liquidM3))) : 0;
    if (receiver && captured > 0) {
      receiver.parameters.liquidM3 = Number(receiver.parameters.liquidM3) + captured;
      receiver.parameters.liquidDensityKgPerM3 = Number(vessel.parameters.liquidDensityKgPerM3);
    }
    vessel.parameters.spilledM3 = Number(vessel.parameters.spilledM3) + liquid.spillM3;
    vessel.parameters.lostM3 = Number(vessel.parameters.lostM3) + liquid.spillM3 - captured;
  }
  return candidate;
}

export function buoyancyDrop(scene: SceneDocument, item: EquipmentInstance, point: { xM: number; yM: number }) {
  const view = buoyancyViewScene(scene), parameters = { ...item.parameters }, pose = { ...item.pose, ...point };
  if (item.type === FORCE_METER) {
    const support = view.equipment.find(peer => peer.type === SUPPORT && Math.abs(point.xM - peer.pose.xM - .08) < .06 && point.yM > peer.pose.yM + .1 && point.yM <= peer.pose.yM + Number(peer.parameters.heightM) + .03);
    parameters.supportId = support?.id ?? '';
    parameters.mountHeightM = support ? Math.min(Number(support.parameters.heightM), point.yM - support.pose.yM) : .5;
  }
  if (item.type === BODY) {
    const meter = view.equipment.find(peer => peer.type === FORCE_METER && Math.hypot(point.xM - peer.pose.xM, point.yM + Number(item.parameters.heightM) - peer.pose.yM + .25) < .06);
    parameters.meterId = meter?.id ?? '';
  }
  if (item.type === BEAKER) {
    const balance = view.equipment.find(peer => peer.type === BALANCE && Math.hypot(point.xM - panPoint(peer).xM, point.yM - panPoint(peer).yM) < .09);
    if (balance && scene.equipment.some(peer => peer.id !== item.id && peer.type === BEAKER && peer.parameters.targetId === balance.id)) return null;
    parameters.targetId = balance?.id ?? '';
  }
  if (item.type === MASS_SET) parameters.balanceId = view.equipment.find(peer => peer.type === BALANCE && Math.hypot(point.xM - peer.pose.xM - .14, point.yM - peer.pose.yM - .08) < .09)?.id ?? '';
  return { pose, parameters };
}

export function buoyancyChanges(before: SceneDocument, after: SceneDocument) {
  return after.equipment.filter(item => JSON.stringify(item) !== JSON.stringify(before.equipment.find(peer => peer.id === item.id))).map(({ id, pose, parameters }) => ({ id, pose, parameters }));
}

export function buoyancyDetached(scene: SceneDocument, ids: readonly string[]) {
  const view = buoyancyViewScene(scene);
  return scene.equipment.filter(item => !ids.includes(item.id) && ['meterId', 'supportId', 'targetId', 'balanceId', 'receiverId'].some(key => ids.includes(String(item.parameters[key])))).map(item => ({ id: item.id, pose: view.equipment.find(peer => peer.id === item.id)!.pose,
    parameters: Object.fromEntries(Object.entries(item.parameters).map(([key, value]) => [key, ['meterId', 'supportId', 'targetId', 'balanceId', 'receiverId'].includes(key) && ids.includes(String(value)) ? '' : value])) as Record<string, Scalar> }));
}

export function buoyancyMessage(code: string) {
  return ({ BUOY_DOCUMENT: '请检查本实验器材及参数。', BUOY_RANGE: '请保持器材竖直，使用理想静态模型。', BUOY_APPARATUS: '请放置一套支架、测力计和带吊环圆柱体。',
    BUOY_ATTACHMENT: '把测力计挂到支架，圆柱体挂到测力计下端。', BUOY_CONTACT: '物体碰到容器底或侧壁，请调整位置。', BUOY_SLACK: '绳已松弛，当前浸入位置不能保持悬挂静止。',
    BUOY_OVER_RANGE: '测力计超量程，请调整物体质量或量程。' } as Record<string, string>)[code] ?? '请检查实验条件后再读数。';
}
