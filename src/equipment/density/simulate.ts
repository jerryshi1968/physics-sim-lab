import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { displacedLiquid } from '../../core/measurements/density.ts';
import { BALANCE, CYLINDER, SPECIMEN, MASS_SET, BEAKER, densityTypes, standardMassesG, DENSITY_EXPERIMENT, LIQUID_EXPERIMENT } from './definitions.ts';
export const isDensityScene = (scene: SceneDocument) => [DENSITY_EXPERIMENT, LIQUID_EXPERIMENT].includes(scene.experimentId ?? '') || scene.equipment.some(item => densityTypes.includes(item.type));
export const densityMethod = (scene: SceneDocument) => scene.experimentId === LIQUID_EXPERIMENT ? 'liquid' : 'solid';
export const panPoint = (item: EquipmentInstance) => ({ xM: item.pose.xM - .14, yM: item.pose.yM + .08 });
export const massesKg = (mask: number) => standardMassesG.reduce((sum, mass, index) => sum + ((mask & (1 << index)) ? mass / 1000 : 0), 0);
const fail = (code: string) => ({ ok: false as const, code });
const invalidPose = ({ pose }: EquipmentInstance) => pose.flippedX || Math.abs(pose.rotationRad) > 1e-10 || Math.abs(pose.xM) > 100 || Math.abs(pose.yM) > 100;

function densitySceneError(scene: SceneDocument, registry: EquipmentRegistry): string | null {
  if (!validateSceneDocument(scene, registry).ok) return 'DENSITY_DOCUMENT';
  if (scene.connections.length || scene.equipment.some(item => !densityTypes.includes(item.type))) return 'DENSITY_MIXED';
  if (scene.simulationConfig.randomError.enabled) return 'DENSITY_RANDOM';
  return null;
}

function solveBalance(equipment: EquipmentInstance[]) {
  const [balance, duplicateBalance] = equipment.filter(item => item.type === BALANCE);
  if (!balance || duplicateBalance) return fail('DENSITY_BALANCE_SETUP');
  const [load, otherLoad] = equipment.filter(item => [SPECIMEN, BEAKER].includes(item.type) && item.parameters.targetId === balance.id);
  if (otherLoad) return fail('DENSITY_PAN_OCCUPIED');
  const [masses, otherMasses] = equipment.filter(item => item.type === MASS_SET && item.parameters.balanceId === balance.id);
  if (otherMasses) return fail('DENSITY_BALANCE_SETUP');
  if (invalidPose(balance) || load && invalidPose(load) || masses && invalidPose(masses)) return fail('DENSITY_ORIENTATION');
  const riderKg = Number(balance.parameters.riderKg);
  if (Math.abs(riderKg / .0002 - Math.round(riderKg / .0002)) > 1e-7) return fail('DENSITY_RIDER');
  const leftKg = !load ? 0 : load.type === SPECIMEN ? Number(load.parameters.massKg) : Number(load.parameters.tareKg) + Number(load.parameters.liquidM3) * Number(load.parameters.liquidDensityKgPerM3);
  const weightsKg = masses ? massesKg(Number(masses.parameters.mask)) : 0;
  const rightKg = weightsKg + riderKg;
  const offsetKg = Number(balance.parameters.zeroErrorKg) - Number(balance.parameters.zeroTrimKg);
  const residualKg = leftKg - rightKg + offsetKg;
  const calibrated = Math.abs(offsetKg) <= 1e-9, balanced = Math.abs(residualKg) <= .0001000001, overRange = leftKg > .2 + 1e-10 || rightKg > .2 + 1e-10;
  const readableMass = !!load && calibrated && balanced && !overRange;
  return { ok: true as const, balance, masses, load, leftKg, rightKg, weightsKg, offsetKg, residualKg, calibrated, balanced, overRange, readableMass, canZero: !load && weightsKg === 0 && riderKg === 0 };
}

function solveCylinder(equipment: EquipmentInstance[]) {
  const [cylinder, duplicateCylinder] = equipment.filter(item => item.type === CYLINDER);
  if (!cylinder || duplicateCylinder) return fail('DENSITY_CYLINDER_SETUP');
  const [immersed, otherImmersed] = equipment.filter(item => item.type === SPECIMEN && item.parameters.targetId === cylinder.id);
  if (otherImmersed) return fail('DENSITY_APPARATUS');
  if (invalidPose(cylinder) || immersed && invalidPose(immersed)) return fail('DENSITY_ORIENTATION');
  const specimenM3 = immersed ? Number(immersed.parameters.volumeM3) : 0;
  if (immersed && Number(immersed.parameters.massKg) / specimenM3 <= Number(cylinder.parameters.liquidDensityKgPerM3)) return fail('DENSITY_FLOATING');
  const bottomM = .01 + Number(immersed?.parameters.liftM ?? 0);
  const liquid = displacedLiquid(Number(cylinder.parameters.liquidM3), specimenM3, bottomM, Number(cylinder.parameters.capacityM3));
  return { ok: true as const, cylinder, liquid, inCylinder: !!immersed, readableVolume: cylinder.parameters.eyeLevel === 0 && !liquid.overflow };
}

export function simulateDensity(scene: SceneDocument, registry: EquipmentRegistry) {
  const sceneError = densitySceneError(scene, registry);
  const weighing = sceneError ? fail(sceneError) : solveBalance(scene.equipment);
  const volume = sceneError ? fail(sceneError) : solveCylinder(scene.equipment);
  const unavailable = (code: string) => ({ ...fail(code), weighing, volume });
  if (sceneError) return unavailable(sceneError);
  if (densityTypes.some(type => scene.equipment.filter(item => item.type === type).length > 1)) return unavailable('DENSITY_APPARATUS');
  if (!weighing.ok) return unavailable(weighing.code);
  if (!volume.ok) return unavailable(volume.code);

  const specimen = scene.equipment.find(item => item.type === SPECIMEN);
  const beaker = scene.equipment.find(item => item.type === BEAKER);
  const masses = scene.equipment.find(item => item.type === MASS_SET);
  const balanceId = weighing.balance.id;
  if (specimen && !['', balanceId, volume.cylinder.id].includes(String(specimen.parameters.targetId))
    || beaker && !['', balanceId].includes(String(beaker.parameters.targetId))
    || masses && !['', balanceId].includes(String(masses.parameters.balanceId))) return unavailable('DENSITY_ATTACHMENT');
  if (scene.equipment.some(invalidPose)) return unavailable('DENSITY_ORIENTATION');
  const method = densityMethod(scene);
  if (method === 'liquid' && !beaker) return unavailable('DENSITY_BEAKER_REQUIRED');
  if (method === 'solid' && !specimen) return unavailable('DENSITY_SPECIMEN_REQUIRED');
  return { ...weighing, ...volume, weighing, volume, specimen, beaker };
}
export type DensityOutcome = ReturnType<typeof simulateDensity>;
export function densityViewScene(scene: SceneDocument, preview?: { id: string; point: WorldPoint } | null, outcome?: DensityOutcome | null) {
  const items = scene.equipment.map(item => item.id === preview?.id ? { ...item, pose: { ...item.pose, ...preview.point }, parameters: { ...item.parameters, ...([SPECIMEN, BEAKER].includes(item.type) ? { targetId: '' } : {}) } } : item);
  return { ...scene, equipment: items.map(item => {
    if (item.id === preview?.id || ![SPECIMEN, BEAKER].includes(item.type)) return item;
    const target = items.find(target => target.id === item.parameters.targetId);
    const weighing = outcome?.weighing;
    const point = target?.type === BALANCE ? { ...panPoint(target), yM: panPoint(target).yM - (weighing?.ok && weighing.balance.id === target.id ? Math.tanh(weighing.residualKg / .005) * .025 : 0) } : target?.type === CYLINDER && item.type === SPECIMEN ? { xM: target.pose.xM, yM: target.pose.yM + .035 + Number(item.parameters.liftM) } : null;
    return point ? { ...item, pose: { ...item.pose, ...point } } : item;
  }) };
}
export function detachedDensityUpdates(scene: SceneDocument, ids: string[], view: SceneDocument) {
  return scene.equipment.filter(item => !ids.includes(item.id) && (ids.includes(String(item.parameters.targetId)) || ids.includes(String(item.parameters.balanceId)))).map(item => ({ id: item.id, pose: view.equipment.find(shown => shown.id === item.id)!.pose, parameters: { ...item.parameters, ...(ids.includes(String(item.parameters.targetId)) ? { targetId: '' } : {}), ...(ids.includes(String(item.parameters.balanceId)) ? { balanceId: '', mask: 0 } : {}) } }));
}
export function densityDrop(scene: SceneDocument, item: EquipmentInstance, point: WorldPoint) {
  const occupied = [SPECIMEN, BEAKER].includes(item.type) && scene.equipment.some(other => other.type === BALANCE && Math.hypot(point.xM - panPoint(other).xM, point.yM - panPoint(other).yM) < .11 && scene.equipment.some(peer => peer.id !== item.id && [SPECIMEN, BEAKER].includes(peer.type) && peer.parameters.targetId === other.id));
  if (occupied) return { pose: item.pose, parameters: item.parameters, notice: '左盘已占用，请先移开原物，不能重叠放置。' };
  const target = [SPECIMEN, BEAKER].includes(item.type) ? scene.equipment.find(other => other.type === BALANCE && Math.hypot(point.xM - panPoint(other).xM, point.yM - panPoint(other).yM) < .11 && !scene.equipment.some(peer => peer.id !== item.id && [SPECIMEN, BEAKER].includes(peer.type) && peer.parameters.targetId === other.id)) : undefined;
  const cylinder = item.type === SPECIMEN && !target ? scene.equipment.find(other => other.type === CYLINDER && Math.abs(point.xM - other.pose.xM) < .06 && point.yM >= other.pose.yM - .02 && point.yM <= other.pose.yM + .26) : undefined;
  const balance = item.type === MASS_SET ? scene.equipment.find(other => other.type === BALANCE && Math.hypot(point.xM - other.pose.xM - .14, point.yM - other.pose.yM - .08) < .09) : undefined;
  return { pose: { ...item.pose, ...point }, parameters: { ...item.parameters, ...([SPECIMEN, BEAKER].includes(item.type) ? { targetId: target?.id ?? cylinder?.id ?? '', ...(item.type === SPECIMEN ? { liftM: cylinder ? Math.max(0, Math.min(.2, point.yM - cylinder.pose.yM - .035)) : Number(item.parameters.liftM) } : {}) } : {}), ...(item.type === MASS_SET ? { balanceId: balance?.id ?? '', ...(!balance ? { mask: 0 } : {}) } : {}) } };
}
export function densityPour(scene: SceneDocument, registry: EquipmentRegistry, volumeM3: number) {
  const sceneError = densitySceneError(scene, registry);
  if (sceneError) return fail(sceneError);
  const result = solveCylinder(scene.equipment);
  if (!result.ok) return result;
  const { cylinder, inCylinder } = result;
  const [beaker, duplicateBeaker] = scene.equipment.filter(item => item.type === BEAKER);
  if (!beaker || duplicateBeaker) return fail('DENSITY_BEAKER_REQUIRED');
  if (invalidPose(beaker)) return fail('DENSITY_ORIENTATION');
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0 || volumeM3 > Number(beaker.parameters.liquidM3) + 1e-12 || Number(cylinder.parameters.liquidM3) + volumeM3 > Number(cylinder.parameters.capacityM3) + 1e-12 || inCylinder) return { ok: false as const, code: 'DENSITY_POUR' };
  if (Number(cylinder.parameters.liquidM3) > 1e-12 && cylinder.parameters.liquidDensityKgPerM3 !== beaker.parameters.liquidDensityKgPerM3) return { ok: false as const, code: 'DENSITY_MIX_LIQUIDS' };
  return { ok: true as const, updates: [{ id: beaker.id, pose: beaker.pose, parameters: { ...beaker.parameters, liquidM3: Math.max(0, Number(beaker.parameters.liquidM3) - volumeM3) } }, { id: cylinder.id, pose: cylinder.pose, parameters: { ...cylinder.parameters, liquidM3: Number(cylinder.parameters.liquidM3) + volumeM3, liquidDensityKgPerM3: Number(beaker.parameters.liquidDensityKgPerM3) } }] };
}
export const densityMessage = (code: string) => ({ DENSITY_DOCUMENT: '器材参数无效。', DENSITY_APPARATUS: '记录密度时，同类器材最多放一件。', DENSITY_BALANCE_SETUP: '请放置一台托盘天平，右盘最多关联一盒砝码。', DENSITY_CYLINDER_SETUP: '请放置一支量筒。', DENSITY_SPECIMEN_REQUIRED: '记录固体密度需要待测固体。', DENSITY_BEAKER_REQUIRED: '请放置一只待测液体烧杯。', DENSITY_MIXED: '密度实验请使用本组器材，其他实验请另建。', DENSITY_RANDOM: '当前模型不提供随机误差，请关闭后使用。', DENSITY_ORIENTATION: '天平和量筒应水平放稳、保持竖直；当前不支持旋转、翻转或范围外坐标。', DENSITY_ATTACHMENT: '挂接目标已不存在，请重新放置或选择目标。', DENSITY_PAN_OCCUPIED: '左盘一次只能放一件待测物或烧杯。', DENSITY_RIDER: '游码须落在 0.2 g 刻度上。', DENSITY_FLOATING: '当前排水模型只支持不吸水、不溶解且下沉的固体；浮体不能强行当作完全浸没。', DENSITY_POUR: '倒液量应大于零，不超过烧杯余液和量筒容量，并先移出固体。', DENSITY_MIX_LIQUIDS: '不能把不同待测液体混合；请先清空量筒。', DENSITY_BALANCE: '先空载调零，再左物右码、移动游码至平衡；超量程不读数。', DENSITY_VOLUME: '读液面需平视凹液面最低处；溢出或未完全浸没不能记正常体积。', DENSITY_STAGE: '当前器材位置不符合这项读数，请核对实验阶段。', DENSITY_SOURCES: '请选择与本次组名一致、相同样品/液体且装置条件连续的三条有效读数；不能拼接不同实验。', DENSITY_DIFFERENCE: '有效质量和体积差必须大于零，请检查手工读数。', INVALID_MANUAL_VALUE: '请输入有限十进制读数；留空只记缺失，不补零。', DENSITY_PREVIEW: '请先松手完成移动或调节，再记录。' } as Record<string, string>)[code] ?? '当前密度实验状态不可用，原数据保持。';
