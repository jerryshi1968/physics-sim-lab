import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { FORCE_METER, MECHANICAL_RULER } from './definitions.ts';
import { frictionApparatus } from '../support.ts';
import { BLOCK, SURFACE, DRIVE, LOAD, materials, frictionTypes, FRICTION_EXPERIMENT } from './frictionDefinitions.ts';
import { frictionForces, initialFrictionMotion } from '../../core/mechanical/friction/model.ts';
import type { FrictionMotion, FrictionConfig } from '../../core/mechanical/friction/model.ts';
import { forceReading } from '../../core/mechanical/lever.ts';

export { FRICTION_EXPERIMENT } from './frictionDefinitions.ts';
export const isFrictionScene = (scene: SceneDocument) => scene.experimentId === FRICTION_EXPERIMENT || scene.equipment.some(item => frictionTypes.includes(item.type));
const fail = (code: string) => ({ ok: false as const, code });
export function compileFriction(scene: SceneDocument, registry: EquipmentRegistry) {
  if (!validateSceneDocument(scene, registry).ok) return fail('FRICTION_DOCUMENT');
  if (scene.simulationConfig.randomError.enabled) return fail('FRICTION_RANDOM_UNSUPPORTED');
  if (scene.connections.length || scene.equipment.some(item => !frictionApparatus.includes(item.type))) return fail('FRICTION_DOMAIN');
  const blocks = scene.equipment.filter(item => item.type === BLOCK);
  if (blocks.length !== 1) return fail('FRICTION_BLOCK_COUNT');
  const block = blocks[0]!, p = block.parameters;
  const surface = scene.equipment.find(item => item.id === p.surfaceId && item.type === SURFACE), actuator = scene.equipment.find(item => item.id === p.driverId && item.type === DRIVE), meter = scene.equipment.find(item => item.id === p.meterId && item.type === FORCE_METER);
  if (!surface || !meter || p.driverId && !actuator) return fail('FRICTION_ATTACHMENT');
  const drive = actuator ?? meter;
  if (scene.equipment.some(item => item.pose.flippedX || Math.abs(item.pose.xM) > 100 || Math.abs(item.pose.yM) > 100 || Math.abs(item.pose.rotationRad) > 1e-10 && item.type !== MECHANICAL_RULER)
    || Math.abs(Math.sin(Number(meter.parameters.directionDeg) * Math.PI / 180)) > 1e-8) return fail('FRICTION_ORIENTATION');
  if (p.material !== 'wood' || Number(surface.parameters.staticCoefficient) < Number(surface.parameters.kineticCoefficient)) return fail('FRICTION_MATERIAL');
  const material = materials[surface.parameters.material as keyof typeof materials];
  if (material && (Number(surface.parameters.staticCoefficient) !== material.mus || Number(surface.parameters.kineticCoefficient) !== material.muk)) return fail('FRICTION_MATERIAL');
  const loads = scene.equipment.filter(item => item.type === LOAD && item.parameters.blockId === block.id);
  if (scene.equipment.some(item => item.type === LOAD && item.parameters.blockId && item.parameters.blockId !== block.id)) return fail('FRICTION_ATTACHMENT');
  const massKg = Number(p.massKg) + loads.reduce((sum, item) => sum + Number(item.parameters.massKg), 0);
  const config: FrictionConfig = { massKg, gravityMPerS2: scene.simulationConfig.gravityMPerS2, staticCoefficient: Number(surface.parameters.staticCoefficient), kineticCoefficient: Number(surface.parameters.kineticCoefficient), mode: actuator ? actuator.parameters.mode as 'force' | 'speed' : 'force', pullN: actuator ? Number(actuator.parameters.pullN) : Number(meter.parameters.forceN) * Math.cos(Number(meter.parameters.directionDeg) * Math.PI / 180), targetMPerS: actuator ? Number(actuator.parameters.targetMPerS) : 0 };
  const initial = initialFrictionMotion(block.pose.xM, Number(actuator?.parameters.initialMPerS ?? 0)), dt = scene.simulationConfig.fixedTimeStepS;
  if (!frictionForces(config, initial, dt).ok || dt < .001 || dt > .05 || Number(meter.parameters.resolutionN) > Number(meter.parameters.rangeN)) return fail('FRICTION_PARAMETERS');
  const halfTravel = (Number(surface.parameters.lengthM) - Number(p.widthM)) / 2;
  if (halfTravel <= 0 || Math.abs(initial.xM - surface.pose.xM) > halfTravel || Math.abs(block.pose.yM - surface.pose.yM - Number(p.heightM) / 2) > 1e-4) return fail('FRICTION_CONTACT');
  return { ok: true as const, block, surface, drive, meter, loads, config, initial, dt, halfTravel };
}
export type FrictionRig = Extract<ReturnType<typeof compileFriction>, { ok: true }>;
export function frictionSample(scene: SceneDocument, registry: EquipmentRegistry, state: FrictionMotion) {
  const rig = compileFriction(scene, registry);
  if (!rig.ok) return rig;
  if (Math.abs(state.xM - rig.surface.pose.xM) > rig.halfTravel + 1e-10) return fail('FRICTION_EDGE');
  const forces = frictionForces(rig.config, state, rig.dt);
  if (!forces.ok) return forces;
  const reading = forceReading(Math.abs(forces.pullN), Number(rig.meter.parameters.rangeN), Number(rig.meter.parameters.resolutionN), true);
  return { ok: true as const, rig, state, forces, reading };
}
export type FrictionSample = ReturnType<typeof frictionSample>;
export function frictionView(scene: SceneDocument, rig: FrictionRig, state: FrictionMotion): SceneDocument {
  const yM = rig.surface.pose.yM + Number(rig.block.parameters.heightM) / 2;
  const sign = rig.config.mode === 'speed' ? Math.sign(rig.config.targetMPerS) || 1 : Math.sign(rig.config.pullN) || Math.sign(state.velocityMPerS) || 1;
  return { ...scene, equipment: scene.equipment.map(item => item.id === rig.block.id ? { ...item, pose: { ...item.pose, xM: state.xM, yM } }
    : item.id === rig.meter.id ? { ...item, pose: { ...item.pose, xM: state.xM + sign * (Number(rig.block.parameters.widthM) / 2 + .025), yM }, parameters: { ...item.parameters, directionDeg: sign < 0 ? 180 : 0 } }
    : item.id === rig.drive.id ? { ...item, pose: { ...item.pose, xM: state.xM + sign * (Number(rig.block.parameters.widthM) / 2 + .34), yM } }
    : rig.loads.some(load => load.id === item.id) ? { ...item, pose: { ...item.pose, xM: state.xM, yM: yM + Number(rig.block.parameters.heightM) / 2 + rig.loads.findIndex(load => load.id === item.id) * .025 } } : item) };
}
export function frictionDrop(scene: SceneDocument, item: EquipmentInstance, point: { xM: number; yM: number }) {
  const parameters = { ...item.parameters };
  if (item.type === LOAD) {
    const block = scene.equipment.find(item => item.type === BLOCK);
    parameters.blockId = block && Math.hypot(point.xM - block.pose.xM, point.yM - block.pose.yM - Number(block.parameters.heightM) / 2) <= .12 ? block.id : '';
  }
  return { pose: { ...item.pose, ...point }, parameters };
}
export const frictionMessage = (code: string) => ({ FRICTION_DOCUMENT: '摩擦器材参数无效。', FRICTION_RANDOM_UNSUPPORTED: '当前摩擦模型尚不施加随机误差，请关闭该配置。', FRICTION_DOMAIN: '摩擦实验仅支持木块、接触面、牵引器、砝码、测力计和独立尺。', FRICTION_BLOCK_COUNT: '请放置一只木块。', FRICTION_ATTACHMENT: '请在装配区选择接触面和测力计；若选择牵引器或加载砝码，其引用也须有效。', FRICTION_ORIENTATION: '当前仅支持水平面、水平拉力及无转动的一维运动。', FRICTION_MATERIAL: '材料对参数不一致，请选预设材料，或切换为自定义后填写 μs≥μk。', FRICTION_PARAMETERS: '质量、系数、步长、拉力、速度或仪器参数超出范围。', FRICTION_CONTACT: '木块须放在接触面上且位于范围内，可使用“放到接触面上”。', FRICTION_EDGE: '木块到达接触面边缘，运行停止；请重置或调整初态。', FRICTION_RANGE: '运动达到模型时间/速度范围，已停止。', FRICTION_ADAPTER: '接触表示与自研轨迹不一致，已停止且不能正常采样。' }[code] ?? '当前状态不在摩擦模型范围内。');
