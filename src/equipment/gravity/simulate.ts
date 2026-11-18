import type { EquipmentInstance, Pose2D, Scalar } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { SUPPORT, FORCE_METER, WEIGHT } from '../mechanical/definitions.ts';
import { positionWeightChains, weightBottom, weightChainIssue, weightDescendants, weightRoot } from '../mechanical/weightChain.ts';

export const GRAVITY_EXPERIMENT = 'J-MECH-05', GRAVITY_MODEL = 'mechanical.gravity.static.v1';
export const gravityApparatus = [SUPPORT, FORCE_METER, WEIGHT];
export const gravityAnchor = (support: EquipmentInstance) => ({ xM: support.pose.xM + .08, yM: support.pose.yM + Number(support.parameters.heightM) });
export const gravityHook = (meter: EquipmentInstance) => ({ xM: meter.pose.xM, yM: meter.pose.yM - .205 });
export function gravityViewScene(scene: SceneDocument, preview?: { id: string; point: { xM: number; yM: number } } | null) {
  const items = scene.equipment.map(item => item.id === preview?.id ? { ...item, pose: { ...item.pose, ...preview.point }, parameters: { ...item.parameters, ...(item.type === FORCE_METER ? { supportId: '' } : item.type === WEIGHT ? { forceMeterId: '', parentWeightId: '' } : {}) } } : item);
  const meters = items.map(item => { const support = items.find(peer => peer.type === SUPPORT && peer.id === item.parameters.supportId); return item.type === FORCE_METER && support ? { ...item, pose: { ...item.pose, ...gravityAnchor(support) } } : item; });
  return { ...scene, equipment: positionWeightChains(meters.map(item => { const meter = meters.find(peer => peer.type === FORCE_METER && peer.id === item.parameters.forceMeterId); return item.type === WEIGHT && meter ? { ...item, pose: { ...item.pose, ...gravityHook(meter) } } : item; })) };
}
export function simulateGravity(scene: SceneDocument, registry: EquipmentRegistry, preview = false) {
  const view = gravityViewScene(scene), meter = view.equipment.find(item => item.type === FORCE_METER), support = view.equipment.find(item => item.type === SUPPORT && item.id === meter?.parameters.supportId), weights = view.equipment.filter(item => item.type === WEIGHT);
  const hung = weights.filter(item => weightRoot(weights, item)?.parameters.forceMeterId === meter?.id), massKg = hung.reduce((sum, item) => sum + Number(item.parameters.massKg), 0), forceN = massKg * scene.simulationConfig.gravityMPerS2;
  let code = '';
  if (!validateSceneDocument(scene, registry).ok || scene.connections.length || scene.equipment.some(item => !gravityApparatus.includes(item.type))) code = 'GRAVITY_DOCUMENT';
  else if (preview) code = 'GRAVITY_PREVIEW';
  else if (scene.simulationConfig.randomError.enabled || view.equipment.some(item => item.pose.flippedX || Math.abs(item.pose.rotationRad) > 1e-8 || Math.abs(item.pose.xM) > 10 || Math.abs(item.pose.yM) > 10)) code = 'GRAVITY_ORIENTATION';
  else if (!meter || !support || view.equipment.filter(item => item.type === FORCE_METER).length !== 1 || view.equipment.filter(item => item.type === SUPPORT).length !== 1 || weights.length > 6) code = 'GRAVITY_APPARATUS';
  else if (Number(meter.parameters.directionDeg) !== -90 || meter.parameters.leverId || weightChainIssue(weights) || weights.some(item => item.parameters.leverId || item.parameters.springId || item.parameters.forceMeterId && (item.parameters.forceMeterId !== meter.id || item.parameters.parentWeightId)) || weights.filter(item => item.parameters.forceMeterId === meter.id).length > 1) code = 'GRAVITY_ATTACHMENT';
  else if (Number(meter.parameters.resolutionN) > Number(meter.parameters.rangeN) || Number(meter.parameters.rangeN) / Number(meter.parameters.resolutionN) > 200) code = 'GRAVITY_SCALE';
  else if (forceN > Number(meter.parameters.rangeN) + 1e-10 || forceN > Number(support.parameters.capacityN) + 1e-10) code = 'GRAVITY_OVER_RANGE';
  else if (hung.some(item => weightBottom(item).yM < support.pose.yM + .025)) code = 'GRAVITY_CONTACT';
  return { ok: !code, code, view, meter, support, hung, massKg, forceN, meterReading: { forceN, status: code ? 'invalid' : 'valid' }, displayN: !code && meter ? Math.round(forceN / Number(meter.parameters.resolutionN)) * Number(meter.parameters.resolutionN) : null };
}
export type GravityOutcome = ReturnType<typeof simulateGravity>;
export function gravityAttachment(scene: SceneDocument, item: EquipmentInstance, target: string): Record<string, Scalar> | null {
  if (item.type === FORCE_METER) return target && !scene.equipment.some(peer => peer.type === SUPPORT && peer.id === target) ? null : { ...item.parameters, supportId: target };
  if (item.type !== WEIGHT) return null;
  const peer = scene.equipment.find(peer => peer.id === target), excluded = weightDescendants(scene.equipment, item.id);
  if (target && (!peer || ![WEIGHT, FORCE_METER].includes(peer.type) || excluded.has(target) || scene.equipment.some(other => !excluded.has(other.id) && (peer.type === WEIGHT ? other.parameters.parentWeightId === target : other.parameters.forceMeterId === target)))) return null;
  return { ...item.parameters, leverId: '', springId: '', forceMeterId: peer?.type === FORCE_METER ? target : '', parentWeightId: peer?.type === WEIGHT ? target : '' };
}
export function gravityDrop(scene: SceneDocument, item: EquipmentInstance, point: { xM: number; yM: number }): { pose: Pose2D; parameters: Record<string, Scalar>; notice?: string } {
  const view = gravityViewScene(scene), excluded = weightDescendants(scene.equipment, item.id), targets = view.equipment.filter(peer => item.type === FORCE_METER ? peer.type === SUPPORT : item.type === WEIGHT && (peer.type === FORCE_METER || peer.type === WEIGHT && !excluded.has(peer.id)));
  const nearest = targets.map(peer => ({ peer, distance: Math.hypot(point.xM - (peer.type === SUPPORT ? gravityAnchor(peer) : peer.type === FORCE_METER ? gravityHook(peer) : weightBottom(peer)).xM, point.yM - (peer.type === SUPPORT ? gravityAnchor(peer) : peer.type === FORCE_METER ? gravityHook(peer) : weightBottom(peer)).yM) })).sort((a, b) => a.distance - b.distance)[0];
  const parameters = [WEIGHT, FORCE_METER].includes(item.type) ? gravityAttachment(scene, item, nearest && nearest.distance < .045 ? nearest.peer.id : '') : item.parameters;
  return parameters ? { pose: { ...item.pose, ...point }, parameters } : { pose: item.pose, parameters: item.parameters, notice: '挂钩已占用，请挂到最下方的空闲钩上。' };
}
export function gravityDetached(scene: SceneDocument, ids: readonly string[]) {
  const view = gravityViewScene(scene);
  return scene.equipment.filter(item => !ids.includes(item.id) && [item.parameters.supportId, item.parameters.forceMeterId, item.parameters.parentWeightId].some(id => ids.includes(String(id)))).map(item => ({ id: item.id, pose: view.equipment.find(peer => peer.id === item.id)!.pose, parameters: { ...item.parameters, ...(ids.includes(String(item.parameters.supportId)) ? { supportId: '' } : {}), ...(ids.includes(String(item.parameters.forceMeterId)) ? { forceMeterId: '' } : {}), ...(ids.includes(String(item.parameters.parentWeightId)) ? { parentWeightId: '' } : {}) } }));
}
export const gravityMessage = (code: string) => ({ GRAVITY_DOCUMENT: '本实验使用支架、弹簧测力计和钩码。', GRAVITY_PREVIEW: '请先松手完成调整，再记录。', GRAVITY_ORIENTATION: '请保持支架、测力计和钩码竖直，不启用随机误差。', GRAVITY_APPARATUS: '将一只弹簧测力计挂到支架；本实验最多使用六件钩码。', GRAVITY_ATTACHMENT: '测力计应竖直向下，钩码逐个串接，不能重复占用挂钩。', GRAVITY_SCALE: '请使用不超过量程的分度值，刻度格数最多 200 格。', GRAVITY_OVER_RANGE: '超过测力计量程或支架承载范围，请减载或选合适量程。', GRAVITY_CONTACT: '钩码已接触桌面，请提高支架或减载。', GRAVITY_UNLOADED: '请先挂上钩码，再读取它受到的重力。', INVALID_MANUAL_VALUE: '请输入有效数字，留空会保留为缺失。' } as Record<string, string>)[code] ?? '当前装置不能记录正常重力读数。';
