import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { solveLever, targetLeverForce, forceReading, endNutBalance, BALANCE_NUT_MASS_KG, BALANCE_DROP_M } from '../../core/mechanical/lever.ts';
import type { LeverLoad } from '../../core/mechanical/lever.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from './definitions.ts';

import { positionWeightChains, weightAttachment, weightBottom, weightChainIssue, weightDescendants, weightRoot } from './weightChain.ts';

import { FRICTION_EXPERIMENT } from './frictionDefinitions.ts';

export const LEVER_EXPERIMENT = 'J-MECH-02';
export const isMechanicalScene = (scene: SceneDocument) => scene.experimentId === LEVER_EXPERIMENT || scene.experimentId === FRICTION_EXPERIMENT || scene.experimentId === 'H-MECH-01' || scene.experimentId === 'H-MECH-02' || scene.equipment.some(item => item.type.startsWith('mechanical.'));
export function hookWorld(lever: EquipmentInstance, index: number) {
  const distance = index * Number(lever.parameters.spacingM), angle = lever.pose.rotationRad;
  return { xM: lever.pose.xM + distance * Math.cos(angle), yM: lever.pose.yM + distance * Math.sin(angle) };
}
export function leverNuts(lever: EquipmentInstance) {
  const p = lever.parameters;
  return endNutBalance({ halfLengthM: Number(p.halfHooks) * Number(p.spacingM), pivotM: Number(p.pivotIndex) * Number(p.spacingM), massKg: Number(p.massKg), comM: Number(p.comOffsetM), leftM: Number(p.leftNutOffsetM ?? .02), rightM: Number(p.rightNutOffsetM ?? .02) });
}
export function mechanicalViewScene(scene: SceneDocument, preview?: { id: string; point: { xM: number; yM: number } } | null): SceneDocument {
  let items = scene.equipment.map(item => preview?.id === item.id ? { ...item, pose: { ...item.pose, ...preview.point }, parameters: { ...item.parameters, ...(item.type === LEVER ? { supportId: '' } : [WEIGHT, FORCE_METER].includes(item.type) ? { leverId: '', ...(item.type === WEIGHT ? { parentWeightId: '' } : {}) } : {}) } } : item);
  items = items.map(item => {
    if (item.type !== LEVER) return item;
    const support = items.find(other => other.id === item.parameters.supportId && other.type === SUPPORT);
    if (!support) return item;
    const loaded = items.some(load => [WEIGHT, FORCE_METER].includes(load.type) && load.parameters.leverId === item.id);
    const balance = leverNuts(item), rotationRad = balance.ok && !loaded ? balance.angleRad : item.pose.rotationRad;
    const offset = hookWorld({ ...item, pose: { ...item.pose, xM: 0, yM: 0, rotationRad } }, Number(item.parameters.pivotIndex));
    return { ...item, pose: { ...item.pose, rotationRad, xM: support.pose.xM - offset.xM, yM: support.pose.yM + Number(support.parameters.heightM) - offset.yM } };
  });
  return { ...scene, equipment: positionWeightChains(items.map(item => {
    if (![WEIGHT, FORCE_METER].includes(item.type)) return item;
    const lever = items.find(other => other.id === item.parameters.leverId && other.type === LEVER);
    return lever ? { ...item, pose: { ...item.pose, ...hookWorld(lever, Number(item.parameters.hookIndex)) } } : item;
  })) };
}
export function leverZeroReference(scene: SceneDocument, lever: EquipmentInstance) {
  const parameters = { ...lever.parameters }; delete parameters.zeroReference;
  delete parameters.trimPositionM; delete parameters.trimMassKg;
  const support = scene.equipment.find(item => item.id === parameters.supportId && item.type === SUPPORT);
  return JSON.stringify(['end-nuts-v1', parameters, support?.parameters, scene.simulationConfig.gravityMPerS2]);
}
export function mechanicalDrop(scene: SceneDocument, instance: EquipmentInstance, point: { xM: number; yM: number }, visible = mechanicalViewScene(scene)) {
  const parameters = { ...instance.parameters };
  if (instance.type === LEVER) {
    const mounted = visible.equipment.find(item => item.id === instance.id) ?? instance;
    const offset = hookWorld({ ...mounted, pose: { ...mounted.pose, xM: 0, yM: 0 } }, Number(parameters.pivotIndex));
    const support = visible.equipment.filter(item => item.type === SUPPORT).map(item => ({ item, distance: Math.hypot(point.xM + offset.xM - item.pose.xM, point.yM + offset.yM - item.pose.yM - Number(item.parameters.heightM)) })).sort((a, b) => a.distance - b.distance)[0];
    parameters.supportId = support && support.distance <= .04 ? support.item.id : '';
  } else if ([WEIGHT, FORCE_METER].includes(instance.type)) {
    const hooks = visible.equipment.filter(item => item.type === LEVER).flatMap(lever => Array.from({ length: Number(lever.parameters.halfHooks) * 2 + 1 }, (_, slot) => {
      const hookIndex = slot - Number(lever.parameters.halfHooks), position = hookWorld(lever, hookIndex);
      return { leverId: lever.id, hookIndex, distance: Math.hypot(point.xM - position.xM, point.yM - position.yM) };
    })).sort((a, b) => a.distance - b.distance);
    const hook = hooks[0];
    if (instance.type === WEIGHT) {
      const excluded = weightDescendants(scene.equipment, instance.id);
      const bottom = visible.equipment.filter(item => item.type === WEIGHT && !excluded.has(item.id)).map(item => ({ item, distance: Math.hypot(point.xM - weightBottom(item).xM, point.yM - weightBottom(item).yM) })).sort((a, b) => a.distance - b.distance)[0];
      const attached = bottom && bottom.distance <= .04 && (!hook || bottom.distance < hook.distance)
        ? weightAttachment(scene, instance, '', 0, bottom.item.id)
        : weightAttachment(scene, instance, hook && hook.distance <= .04 ? hook.leverId : '', hook?.hookIndex ?? 0);
      if (!attached) return { pose: { ...instance.pose }, parameters: { ...instance.parameters }, notice: '该挂点已有钩码，请接到钩码的下挂钩，或选择空挂点。' };
      Object.assign(parameters, attached);
    } else {
      parameters.leverId = hook && hook.distance <= .04 ? hook.leverId : '';
      if (parameters.leverId) parameters.hookIndex = hook!.hookIndex;
    }
  }
  return { pose: { ...instance.pose, ...point }, parameters };
}
export function simulateLever(scene: SceneDocument, registry: EquipmentRegistry) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (!validateSceneDocument(scene, registry).ok) return fail('LEVER_DOCUMENT');
  if (scene.connections.length || scene.equipment.some(item => registry.get(item.type, 1)?.domain !== 'mechanical')) return fail('LEVER_MIXED_DOMAIN');
  if (scene.equipment.some(item => Math.abs(item.pose.xM) > 1000 || Math.abs(item.pose.yM) > 1000 || Math.abs(item.pose.rotationRad) > 2 * Math.PI || item.pose.flippedX)) return fail('LEVER_RANGE');
  if (scene.equipment.some(item => ![LEVER, MECHANICAL_RULER].includes(item.type) && Math.abs(item.pose.rotationRad) > 1e-10)) return fail('LEVER_ORIENTATION');
  const levers = scene.equipment.filter(item => item.type === LEVER);
  if (levers.length !== 1) return fail(levers.length ? 'LEVER_MULTIPLE' : 'LEVER_MISSING');
  const original = levers[0]!, p = original.parameters, half = Number(p.halfHooks), spacing = Number(p.spacingM);
  const nuts = leverNuts(original);
  if (!nuts.ok || Math.abs(Number(p.pivotIndex)) > half || Math.abs(Number(p.comOffsetM)) > half * spacing || scene.simulationConfig.gravityMPerS2 > 100) return fail('LEVER_RANGE');
  const support = scene.equipment.find(item => item.type === SUPPORT && item.id === p.supportId);
  if (!support) return fail('MISSING_SUPPORT');
  const chainIssue = weightChainIssue(scene.equipment);
  if (chainIssue) return fail(chainIssue);
  const roots = new Map(scene.equipment.filter(item => [WEIGHT, FORCE_METER].includes(item.type)).map(item => [item.id, weightRoot(scene.equipment, item)!]));
  const view = mechanicalViewScene(scene), lever = view.equipment.find(item => item.id === original.id)!, pivot = hookWorld(lever, Number(p.pivotIndex)), g = scene.simulationConfig.gravityMPerS2;
  const attached = view.equipment.filter(item => [WEIGHT, FORCE_METER].includes(item.type) && roots.get(item.id)?.parameters.leverId === lever.id);
  if (view.equipment.some(item => [WEIGHT, FORCE_METER].includes(item.type) && roots.get(item.id)?.parameters.leverId && roots.get(item.id)?.parameters.leverId !== lever.id)) return fail('LEVER_DANGLING_ATTACHMENT');
  if (attached.some(item => Math.abs(Number(roots.get(item.id)!.parameters.hookIndex)) > half)) return fail('LEVER_HOOK_RANGE');
  const loads: LeverLoad[] = attached.map(item => {
    const hookIndex = Number(roots.get(item.id)!.parameters.hookIndex);
    const angle = Number(item.parameters.directionDeg ?? 0) * Math.PI / 180, force = Number(item.parameters.forceN ?? 0);
    return { id: item.id, kind: item.type === WEIGHT ? 'weight' : 'meter', hookIndex, point: hookWorld(lever, hookIndex),
      fxN: item.type === WEIGHT ? 0 : force * Math.cos(angle), fyN: item.type === WEIGHT ? -Number(item.parameters.massKg) * g : force * Math.sin(angle) };
  });
  const at = (distance: number) => {
    const point = hookWorld({ ...lever, parameters: { ...p, spacingM: 1 } }, distance);
    return { xM: point.xM + BALANCE_DROP_M * Math.sin(lever.pose.rotationRad), yM: point.yM - BALANCE_DROP_M * Math.cos(lever.pose.rotationRad) };
  };
  if (p.includeSelfWeight || attached.length === 0) {
    loads.push({ id: `${lever.id}:nut-left`, kind: 'trim', hookIndex: null, point: at(nuts.leftXM), fxN: 0, fyN: -BALANCE_NUT_MASS_KG * g }, { id: `${lever.id}:nut-right`, kind: 'trim', hookIndex: null, point: at(nuts.rightXM), fxN: 0, fyN: -BALANCE_NUT_MASS_KG * g });
    loads.push({ id: `${lever.id}:self`, kind: 'self', hookIndex: null, point: at(Number(p.comOffsetM)), fxN: 0, fyN: -Number(p.massKg) * g });
  }
  const result = solveLever(pivot, loads, Number(support.parameters.capacityN));
  if (!result.ok) return result;
  const zeroReference = leverZeroReference(scene, original), horizontal = Math.abs(Math.sin(lever.pose.rotationRad)) <= 1e-6 && Math.cos(lever.pose.rotationRad) > 0;
  const calibrated = p.zeroReference === zeroReference && horizontal;
  const meters = attached.filter(item => item.type === FORCE_METER).map(item => {
    const load = result.loads.find(load => load.id === item.id)!, angle = Number(item.parameters.directionDeg) * Math.PI / 180;
    const armValid = Math.abs((load.point.xM - pivot.xM) * Math.sin(angle) - (load.point.yM - pivot.yM) * Math.cos(angle)) > 1e-12;
    return { id: item.id, forceN: Number(item.parameters.forceN), ...forceReading(Number(item.parameters.forceN), Number(item.parameters.rangeN), Number(item.parameters.resolutionN), calibrated && armValid), zeroArm: !armValid };
  });
  const meter = attached.filter(item => item.type === FORCE_METER)[0];
  const target = attached.filter(item => item.type === FORCE_METER).length !== 1 ? { status: 'invalid' as const, code: 'UNDERDETERMINED_FORCES' } : targetLeverForce(pivot, loads.filter(load => load.id !== meter!.id), hookWorld(lever, Number(meter!.parameters.hookIndex)), Number(meter!.parameters.directionDeg));
  const supportedTarget = target.status === 'ok' && Math.hypot(target.value.equilibrium.reactionN.x, target.value.equilibrium.reactionN.y) > Number(support.parameters.capacityN) ? { status: 'invalid' as const, code: 'SUPPORT_OVERLOAD' } : target;
  return { ...result, lever, pivot, meters, calibrated, horizontal, zeroReference, empty: attached.length === 0, canZero: attached.length === 0 && horizontal && result.balanced,
    ignoredLoads: scene.equipment.filter(item => [WEIGHT, FORCE_METER].includes(item.type) && !roots.get(item.id)?.parameters.leverId).length, target: supportedTarget, nuts };
}
export type LeverOutcome = ReturnType<typeof simulateLever>;
export const leverMessage = (code: string) => ({ LEVER_DOCUMENT: '器材参数无效。', LEVER_MIXED_DOMAIN: '杠杆实验只支持力学器材，请另建实验。', LEVER_RANGE: '挂点、质心、螺母或坐标超出模型范围。',
  LEVER_ORIENTATION: '支架、钩码须保持竖直；拉力方向请在测力计参数中调整。', LEVER_MISSING: '请放置杠杆和支架，并将杠杆安装到支架。', LEVER_MULTIPLE: '当前杠杆实验支持一根杠杆。',
  MISSING_SUPPORT: '杠杆没有有效支架：拖到支架顶端或在挂接区安装。', SUPPORT_OVERLOAD: '支点反力超过支架约束范围，不能输出正常读数。', LEVER_DANGLING_ATTACHMENT: '挂载引用的杠杆已不存在，请重新挂接。',
  WEIGHT_HOOK_OCCUPIED: '同一杠杆挂点只能直接挂一个钩码，请将其余钩码串接到下挂钩。', WEIGHT_CHAIN_REFERENCE: '钩码串接引用无效，请重新挂接。', WEIGHT_CHAIN_BRANCH: '一个下挂钩只能串接一个钩码，请接到串尾。', WEIGHT_CHAIN_CYCLE: '钩码不能挂到自己或自己的下级钩码上。',
  LEVER_HOOK_RANGE: '挂载编号超出杠杆挂点，请重新选择。', ZERO_MOMENT_ARM: '力作用线通过支点，目标拉力无法唯一求解。', DIRECTION_CANNOT_BALANCE: '该拉力方向无法平衡已有力矩。', UNDERDETERMINED_FORCES: '仅有一个测力计且约束充分时才能唯一求目标拉力。', NUMERIC_RANGE: '数值超出范围。' }[code] ?? '当前装置不在杠杆模型范围内。');
