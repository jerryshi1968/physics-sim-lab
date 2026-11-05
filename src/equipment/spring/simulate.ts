import type { EquipmentInstance, Pose2D, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { solveSpring } from '../../physics/samples/spring.ts';
import { SPRING, SPRING_EXPERIMENT } from './definitions.ts';
import { SUPPORT, WEIGHT, MECHANICAL_RULER } from '../mechanical/definitions.ts';
import { positionWeightChains, weightChainIssue, weightRoot, weightDescendants, weightBottom } from '../mechanical/weightChain.ts';

export const isSpringScene = (scene: SceneDocument) => scene.experimentId === SPRING_EXPERIMENT || scene.equipment.some(item => item.type === SPRING);
export const springAnchor = (support: EquipmentInstance) => ({ xM: support.pose.xM + .08, yM: support.pose.yM + Number(support.parameters.heightM) });
const fail = (code: string) => ({ ok: false as const, code });
export function springSample(scene: SceneDocument, registry: EquipmentRegistry, transitioning = false) {
  if (!validateSceneDocument(scene, registry).ok) return fail('SPRING_DOCUMENT');
  if (scene.simulationConfig.randomError.enabled) return fail('SPRING_RANDOM_UNSUPPORTED');
  if (scene.connections.length || scene.equipment.some(item => ![SPRING, SUPPORT, WEIGHT, MECHANICAL_RULER].includes(item.type))) return fail('SPRING_DOMAIN');
  const springs = scene.equipment.filter(item => item.type === SPRING);
  if (springs.length !== 1) return fail('SPRING_COUNT');
  const spring = springs[0]!, p = spring.parameters, support = scene.equipment.find(item => item.type === SUPPORT && item.id === p.supportId);
  if (!support) return fail('MISSING_SUPPORT');
  if (scene.equipment.some(item => item.pose.flippedX || Math.abs(item.pose.xM) > 100 || Math.abs(item.pose.yM) > 100 || item.type !== MECHANICAL_RULER && Math.abs(item.pose.rotationRad) > 1e-10)) return fail('SPRING_ORIENTATION');
  const weights = scene.equipment.filter(item => item.type === WEIGHT);
  if (weightChainIssue(scene.equipment) || weights.some(item => item.parameters.leverId || item.parameters.springId && (item.parameters.springId !== spring.id || item.parameters.parentWeightId))) return fail('SPRING_ATTACHMENT');
  if (weights.filter(item => item.parameters.springId === spring.id).length > 1) return fail('SPRING_HOOK_OCCUPIED');
  const loads = weights.filter(item => weightRoot(weights, item)?.parameters.springId === spring.id);
  const result = solveSpring({ originalLengthM: Number(p.originalLengthM), stiffnessNPerM: Number(p.stiffnessNPerM), hangingMassKg: loads.reduce((sum, item) => sum + Number(item.parameters.massKg), 0), trayMassKg: Number(p.trayMassKg), gravityMPerS2: scene.simulationConfig.gravityMPerS2, maxExtensionM: Number(p.maxExtensionM), ratedLoadN: Number(p.ratedLoadN), supported: true, transitioning });
  if (result.status !== 'ok') return fail(result.code);
  if (result.value.forceN > Number(support.parameters.capacityN)) return fail('SPRING_SUPPORT_CAPACITY');
  const top = springAnchor(support), bottom = { xM: top.xM, yM: top.yM - result.value.lengthM };
  return { ok: true as const, spring, support, loads, value: result.value, top, bottom };
}
export type SpringOutcome = ReturnType<typeof springSample>;
export function springViewScene(scene: SceneDocument, registry: EquipmentRegistry, preview?: { id: string; point: { xM: number; yM: number } } | null): SceneDocument {
  const items = scene.equipment.map(item => preview?.id === item.id ? { ...item, pose: { ...item.pose, ...preview.point }, parameters: { ...item.parameters, ...(item.type === SPRING ? { supportId: '' } : item.type === WEIGHT ? { springId: '', parentWeightId: '' } : {}) } } : item);
  const temporary = { ...scene, equipment: items }, outcome = springSample(temporary, registry);
  return { ...scene, equipment: positionWeightChains(items.map(item => {
    if (item.type === SPRING) {
      const support = items.find(candidate => candidate.type === SUPPORT && candidate.id === item.parameters.supportId);
      return support ? { ...item, pose: { ...item.pose, ...springAnchor(support) } } : item;
    }
    if (item.type === WEIGHT && item.parameters.springId) {
      const spring = items.find(other => other.id === item.parameters.springId && other.type === SPRING), support = items.find(other => other.type === SUPPORT && other.id === spring?.parameters.supportId);
      if (spring) { const top = support ? springAnchor(support) : spring.pose; return { ...item, pose: { ...item.pose, xM: top.xM, yM: top.yM - (outcome.ok ? outcome.value.lengthM : Number(spring.parameters.originalLengthM)) } }; }
    }
    return item;
  })) };
}
export function springAttachment(scene: SceneDocument, item: EquipmentInstance, springId: string, parentId = '') {
  if (item.type === SPRING) return { ...item.parameters, supportId: springId };
  if (item.type !== WEIGHT || springId && !scene.equipment.some(other => other.id === springId && other.type === SPRING)) return null;
  const descendants = weightDescendants(scene.equipment, item.id);
  if (parentId && (descendants.has(parentId) || !scene.equipment.some(other => other.id === parentId && other.type === WEIGHT) || scene.equipment.some(other => other.id !== item.id && other.parameters.parentWeightId === parentId))) return null;
  if (springId && scene.equipment.some(other => other.id !== item.id && !descendants.has(other.id) && other.type === WEIGHT && other.parameters.springId === springId)) return null;
  return { ...item.parameters, springId: parentId ? '' : springId, parentWeightId: parentId, leverId: '' };
}
export function springDrop(scene: SceneDocument, item: EquipmentInstance, point: { xM: number; yM: number }, visible: SceneDocument, registry: EquipmentRegistry): { pose: Pose2D; parameters: Record<string, Scalar>; notice?: string } {
  let parameters = { ...item.parameters };
  if (item.type === SPRING) {
    const nearest = visible.equipment.filter(item => item.type === SUPPORT).map(item => ({ item, distance: Math.hypot(point.xM - springAnchor(item).xM, point.yM - springAnchor(item).yM) })).sort((a, b) => a.distance - b.distance)[0];
    parameters.supportId = nearest && nearest.distance <= .05 ? nearest.item.id : '';
  } else if (item.type === WEIGHT) {
    const outcome = springSample(scene, registry), excluded = weightDescendants(scene.equipment, item.id);
    const ends = visible.equipment.filter(other => other.type === SPRING || other.type === WEIGHT && !excluded.has(other.id)).map(other => {
      const end = other.type === SPRING ? { xM: other.pose.xM, yM: other.pose.yM - (outcome.ok ? outcome.value.lengthM : Number(other.parameters.originalLengthM)) } : weightBottom(other);
      return { item: other, distance: Math.hypot(point.xM - end.xM, point.yM - end.yM) };
    }).sort((a, b) => a.distance - b.distance);
    const end = ends[0], close = end && end.distance <= .04;
    const attached = springAttachment(scene, item, close && end.item.type === SPRING ? end.item.id : '', close && end.item.type === WEIGHT ? end.item.id : '');
    if (!attached) return { pose: { ...item.pose }, parameters, notice: '弹簧下端或钩码下挂钩已占用，请串接到空闲下挂钩。' };
    parameters = attached;
  }
  return { pose: { ...item.pose, ...point }, parameters };
}
export function springRuler(scene: SceneDocument, registry: EquipmentRegistry, rulerId: string) {
  const sample = springSample(scene, registry), ruler = scene.equipment.find(item => item.id === rulerId && item.type === MECHANICAL_RULER);
  if (!sample.ok) return sample;
  if (!ruler || Math.abs(Math.cos(ruler.pose.rotationRad)) > 1e-8 || Math.sin(ruler.pose.rotationRad) > -.999999 || Math.abs(ruler.pose.xM - sample.top.xM) > .2) return fail('SPRING_RULER_ALIGNMENT');
  const topM = ruler.pose.yM - sample.top.yM, bottomM = ruler.pose.yM - sample.bottom.yM, lengthM = Number(ruler.parameters.lengthM);
  if (topM < -1e-10 || bottomM > lengthM + 1e-10) return fail('SPRING_RULER_RANGE');
  return { ok: true as const, sample, ruler, topM, bottomM, lengthM };
}
export const springMessage = (code: string) => ({ SPRING_ORIGINAL_LOADED: '测原长须先取下全部钩码并将盘质量设为零。', SPRING_DOCUMENT: '弹簧器材参数无效。', SPRING_RANDOM_UNSUPPORTED: '当前静态弹簧模型尚不施加随机误差。', SPRING_DOMAIN: '弹簧实验仅支持弹簧、支架、钩码和独立刻度尺。', SPRING_COUNT: '请放置一只弹簧。', MISSING_SUPPORT: '请把弹簧安装到支架，再加载和读尺。', SPRING_ORIENTATION: '首版只支持竖直弹簧、支架与钩码，请检查姿态。', SPRING_ATTACHMENT: '钩码挂接无效，请检查引用、串接或循环。', SPRING_HOOK_OCCUPIED: '弹簧下端只能直接挂一个钩码，其余请串接下挂钩。', RATED_LOAD_EXCEEDED: '超过额定载荷，不再预测长度或采样；请减载。', LINEAR_RANGE_EXCEEDED: '超过线性范围，不外推真实长度或塑性变形；请减载。', SPRING_SUPPORT_CAPACITY: '超过支架承载范围，请减载。', TRANSITIONING: '移动/过渡示意中，请松手完成后再读尺采样。', SPRING_RULER_ALIGNMENT: '请把独立尺竖直向下摆在弹簧旁，距弹簧不超过 0.2 m。', SPRING_RULER_RANGE: '弹簧两端须落在刻度尺范围内，请自行移动尺零点。' }[code] ?? '当前不在弹簧模型有效范围内。');

export function detachedSpringUpdates(scene: SceneDocument, ids: readonly string[], visible: SceneDocument) {
  return scene.equipment.filter(item => !ids.includes(item.id) && (item.type === SPRING && ids.includes(String(item.parameters.supportId)) || item.type === WEIGHT && (ids.includes(String(item.parameters.springId)) || ids.includes(String(item.parameters.parentWeightId))))).map(item => ({ id: item.id, pose: visible.equipment.find(other => other.id === item.id)!.pose, parameters: { ...item.parameters, ...(item.type === SPRING ? { supportId: '' } : { springId: '', parentWeightId: '' }) } }));
}
