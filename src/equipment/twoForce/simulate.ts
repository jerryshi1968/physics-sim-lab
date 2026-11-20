import type { EquipmentInstance, Pose2D, Scalar } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { CART, TRACK, cartHalfLengthM } from '../cart/definitions.ts';
import { WEIGHT } from '../mechanical/definitions.ts';
import { positionWeightChains, weightBottom, weightChainIssue, weightDescendants, weightRoot } from '../mechanical/weightChain.ts';

export const TWO_FORCE_EXPERIMENT = 'J-MECH-06', TWO_FORCE_MODEL = 'mechanical.two-force.rigid.v1';
export const twoForceApparatus = [CART, TRACK, WEIGHT];
export const twoForceLabels: Record<string, string> = { [CART]: '小车', [TRACK]: '光滑水平台（双定滑轮）', [WEIGHT]: '钩码' };
export type TwoForceSide = 'left' | 'right';
export type Vector3 = [number, number, number];
export type TwoForceState = [number, number, number, number, number, number];
const a = cartHalfLengthM, b = .05, maxAngle = Math.PI / 3;
export function twoForceRig(scene: SceneDocument, registry: EquipmentRegistry) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (!validateSceneDocument(scene, registry).ok || scene.connections.length || scene.equipment.some(item => !twoForceApparatus.includes(item.type))) return fail('TF_DOCUMENT');
  const cart = scene.equipment.find(item => item.type === CART), table = scene.equipment.find(item => item.type === TRACK), weights = scene.equipment.filter(item => item.type === WEIGHT);
  if (!cart || !table || [CART, TRACK].some(type => scene.equipment.filter(item => item.type === type).length !== 1) || weights.length > 6) return fail('TF_APPARATUS');
  if (scene.simulationConfig.randomError.enabled || scene.simulationConfig.gravityMPerS2 > 30 || scene.equipment.some(item => item.pose.flippedX || Math.abs(item.pose.xM) > 10 || Math.abs(item.pose.yM) > 10 || item.type !== CART && Math.abs(item.pose.rotationRad) > 1e-8) || Math.abs(cart.pose.rotationRad) > maxAngle + 1e-10) return fail('TF_ORIENTATION');
  if (cart.parameters.twoForceTableId !== table.id || weightChainIssue(weights) || weights.some(item => item.parameters.leverId || item.parameters.springId || item.parameters.forceMeterId || item.parameters.twoForceTableId && (item.parameters.twoForceTableId !== table.id || item.parameters.parentWeightId || !['left', 'right'].includes(String(item.parameters.twoForceSide))))) return fail('TF_ATTACHMENT');
  const chains = (['left', 'right'] as const).map(side => weights.filter(item => { const root = weightRoot(weights, item); return root?.parameters.twoForceTableId === table.id && root.parameters.twoForceSide === side; }));
  if ((['left', 'right'] as const).some(side => weights.filter(item => item.parameters.twoForceTableId === table.id && item.parameters.twoForceSide === side).length !== 1)) return fail('TF_ATTACHMENT');
  const mass: [number, number] = [chains[0]!.reduce((sum, item) => sum + Number(item.parameters.massKg), 0), chains[1]!.reduce((sum, item) => sum + Number(item.parameters.massKg), 0)], bodyMass = Number(cart.parameters.cartMassKg) + Number(cart.parameters.loadMassKg);
  if (mass.some(value => !(value > 0 && value <= 1)) || bodyMass > 10 || Number(table.parameters.dropLimitM) < .3) return fail('TF_RANGE');
  const state: TwoForceState = [cart.pose.xM - table.pose.xM, cart.pose.yM - table.pose.yM, cart.pose.rotationRad, Number(cart.parameters.twoForceSpeedMPerS ?? 0), 0, 0];
  const base = { cart, table, weights, chains, mass, bodyMass, inertia: bodyMass * ((2 * a) ** 2 + (2 * b) ** 2) / 12, half: Number(table.parameters.lengthM) / 2, g: scene.simulationConfig.gravityMPerS2, dropLimit: Number(table.parameters.dropLimitM), state };
  const initialLengths: [number, number] = [ropeGeometry(base.half, state, -1).length, ropeGeometry(base.half, state, 1).length];
  const rig = { ...base, initialLengths, signature: JSON.stringify([scene.documentId, scene.equipment, scene.connections, scene.simulationConfig]) };
  const sampled = twoForceDynamics(rig, state); if (!sampled.ok) return fail(sampled.code);
  return { ok: true as const, ...rig };
}
export type TwoForceRig = Extract<ReturnType<typeof twoForceRig>, { ok: true }>;
export function ropeGeometry(half: number, state: TwoForceState, side: number) {
  const [x, y, angle, vx, vy, omega] = state, ux = Math.cos(angle), uy = Math.sin(angle), dx = side * a * ux, dy = side * a * uy, rx = x + dx - side * half, ry = y + dy, length = Math.hypot(rx, ry);
  const tx = -dy, ty = dx, pvx = vx + tx * omega, pvy = vy + ty * omega;
  const j: Vector3 = [rx / length, ry / length, (rx * tx + ry * ty) / length], speed = j[0] * vx + j[1] * vy + j[2] * omega;
  const curvature = (pvx * pvx + pvy * pvy - (rx * dx + ry * dy) * omega * omega - speed * speed) / length;
  return { length, j, curvature, speed, dx, dy, nx: rx / length, ny: ry / length };
}
function solve3(matrix: number[][], rhs: number[]): Vector3 | null {
  const rows = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < 3; col++) {
    let pivot = col; for (let row = col + 1; row < 3; row++) if (Math.abs(rows[row]![col]!) > Math.abs(rows[pivot]![col]!)) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!]; const d = rows[col]![col]!; if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
    for (let k = col; k <= 3; k++) rows[col]![k] = rows[col]![k]! / d;
    for (let row = 0; row < 3; row++) if (row !== col) { const factor = rows[row]![col]!; for (let k = col; k <= 3; k++) rows[row]![k] = rows[row]![k]! - factor * rows[col]![k]!; }
  }
  return [rows[0]![3]!, rows[1]![3]!, rows[2]![3]!];
}
type RigPhysics = { half: number; bodyMass: number; inertia: number; mass: [number, number]; g: number; dropLimit: number; initialLengths: [number, number] };
export function twoForceDynamics(rig: RigPhysics, state: TwoForceState) {
  const fail = (code: string) => ({ ok: false as const, code });
  if (state.some(value => !Number.isFinite(value))) return fail('TF_NUMERIC');
  const [x, y, angle] = state, ropes = [ropeGeometry(rig.half, state, -1), ropeGeometry(rig.half, state, 1)], matrix = [[rig.bodyMass, 0, 0], [0, rig.bodyMass, 0], [0, 0, rig.inertia]], rhs = [0, 0, 0];
  if (Math.abs(x) + a * Math.abs(Math.cos(angle)) + b * Math.abs(Math.sin(angle)) >= rig.half - .04 || Math.abs(y) + a * Math.abs(Math.sin(angle)) + b * Math.abs(Math.cos(angle)) >= .3 || Math.abs(angle) > Math.PI * .45 || ropes.some(rope => rope.length < .06)) return fail('TF_EDGE');
  const heights = ropes.map((rope, i) => .25 + rig.initialLengths[i]! - rope.length);
  if (heights.some(height => height < .05 || height > rig.dropLimit)) return fail('TF_DROP_LIMIT');
  for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) { const rope = ropes[k]!, m = rig.mass[k]!; rhs[i] = rhs[i]! - m * (rig.g + rope.curvature) * rope.j[i]!; for (let j = 0; j < 3; j++) matrix[i]![j] = matrix[i]![j]! + m * rope.j[i]! * rope.j[j]!; }
  const acceleration = solve3(matrix, rhs); if (!acceleration) return fail('TF_NUMERIC');
  const tension = ropes.map((rope, i) => rig.mass[i]! * (rig.g + rope.curvature + rope.j.reduce((sum, value, j) => sum + value * acceleration[j]!, 0)));
  if (tension.some(value => !Number.isFinite(value) || value <= 0)) return fail('TF_SLACK');
  const forces = ropes.map((rope, i) => ({ x: -tension[i]! * rope.nx, y: -tension[i]! * rope.ny }));
  const net = { x: forces[0]!.x + forces[1]!.x, y: forces[0]!.y + forces[1]!.y }, torque = ropes.reduce((sum, rope, i) => sum + rope.dx * forces[i]!.y - rope.dy * forces[i]!.x, 0);
  const energy = .5 * rig.bodyMass * (state[3] ** 2 + state[4] ** 2) + .5 * rig.inertia * state[5] ** 2 + ropes.reduce((sum, rope, i) => sum + .5 * rig.mass[i]! * rope.speed ** 2 + rig.mass[i]! * rig.g * rope.length, 0);
  return { ok: true as const, acceleration, ropes, heights, tension, forces, net, torque, energy };
}
export interface TwoForceRun { id: string; signature: string; rig: TwoForceRig; state: TwoForceState; timeS: number; reason: string }
export function startTwoForce(rig: TwoForceRig, id: string): TwoForceRun { return { id, signature: rig.signature, rig, state: [...rig.state], timeS: 0, reason: '' }; }
function rk4(rig: TwoForceRig, state: TwoForceState, dt: number): TwoForceState | null {
  const derivative = (q: TwoForceState) => { const d = twoForceDynamics(rig, q); return d.ok ? [q[3], q[4], q[5], ...d.acceleration] : null; }, combine = (d: number[], factor: number) => state.map((v, i) => v + d[i]! * factor) as TwoForceState;
  const k1 = derivative(state); if (!k1) return null; const k2 = derivative(combine(k1, dt / 2)); if (!k2) return null; const k3 = derivative(combine(k2, dt / 2)); if (!k3) return null; const k4 = derivative(combine(k3, dt)); if (!k4) return null;
  return state.map((v, i) => v + dt * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!) / 6) as TwoForceState;
}
export function advanceTwoForce(run: TwoForceRun, dt: number): TwoForceRun {
  if (!Number.isFinite(dt) || dt < 0 || dt > 10) throw new RangeError('TF_TIME_STEP');
  if (run.reason) return run;
  let state: TwoForceState = [...run.state], timeS = run.timeS; const target = Math.min(8, timeS + dt);
  while (timeS < target - 1e-12) {
    const h = Math.min(.002, target - timeS), next = rk4(run.rig, state, h), sampled = next ? twoForceDynamics(run.rig, next) : null;
    if (!next || !sampled?.ok) {
      let low = 0, high = h, safe = state;
      for (let i = 0; i < 30; i++) { const mid = (low + high) / 2, q = rk4(run.rig, state, mid); if (q && twoForceDynamics(run.rig, q).ok) { low = mid; safe = q; } else high = mid; }
      return { ...run, state: safe, timeS: timeS + low, reason: sampled && !sampled.ok ? sampled.code : 'TF_BOUNDARY' };
    }
    state = next; timeS += h;
  }
  return { ...run, state, timeS: target, reason: target >= 8 ? 'TF_TIME_LIMIT' : '' };
}
export function twoForceView(scene: SceneDocument, rig: ReturnType<typeof twoForceRig>, run: TwoForceRun | null) {
  const table = scene.equipment.find(item => item.type === TRACK); if (!table) return scene;
  const active = rig.ok && run?.signature === rig.signature ? run : null, state = active?.state ?? (rig.ok ? rig.state : null), d = rig.ok && state ? twoForceDynamics(rig, state) : null;
  const items = scene.equipment.map(item => {
    if (item.type === CART && item.parameters.twoForceTableId === table.id && state) return { ...item, pose: { ...item.pose, xM: table.pose.xM + state[0], yM: table.pose.yM + state[1], rotationRad: state[2] } };
    if (item.type === WEIGHT && item.parameters.twoForceTableId === table.id && ['left', 'right'].includes(String(item.parameters.twoForceSide))) { const i = item.parameters.twoForceSide === 'left' ? 0 : 1; return { ...item, pose: { ...item.pose, xM: table.pose.xM + (i ? 1 : -1) * (Number(table.parameters.lengthM) / 2 + .07), yM: table.pose.yM - .16 - (d?.ok ? d.heights[i]! : .25), rotationRad: 0 } }; }
    return item;
  });
  return { ...scene, equipment: positionWeightChains(items) };
}
export function twoForceAttachment(scene: SceneDocument, item: EquipmentInstance, side: TwoForceSide | ''): Record<string, Scalar> | null {
  const table = scene.equipment.find(peer => peer.type === TRACK); if (item.type !== WEIGHT || side && !table) return null;
  const excluded = weightDescendants(scene.equipment, item.id), root = scene.equipment.find(peer => peer.type === WEIGHT && !excluded.has(peer.id) && peer.parameters.twoForceTableId === table?.id && peer.parameters.twoForceSide === side);
  let tail = root; const seen = new Set<string>(); while (tail && !seen.has(tail.id)) { seen.add(tail.id); const next = scene.equipment.find(peer => peer.type === WEIGHT && !excluded.has(peer.id) && peer.parameters.parentWeightId === tail!.id); if (!next) break; tail = next; }
  return { ...item.parameters, leverId: '', springId: '', forceMeterId: '', twoForceTableId: side && !tail ? table!.id : '', twoForceSide: side && !tail ? side : '', parentWeightId: side ? tail?.id ?? '' : '' };
}
export function twoForceDrop(scene: SceneDocument, item: EquipmentInstance, point: { xM: number; yM: number }, view: SceneDocument): { pose: Pose2D; parameters: Record<string, Scalar> } {
  const table = scene.equipment.find(peer => peer.type === TRACK);
  if (item.type === CART) return { pose: { ...item.pose, ...point }, parameters: { ...item.parameters, twoForceTableId: table && Math.abs(point.xM - table.pose.xM) < Number(table.parameters.lengthM) / 2 && Math.abs(point.yM - table.pose.yM) < .3 ? table.id : '' } };
  if (item.type === WEIGHT) {
    const excluded = weightDescendants(scene.equipment, item.id), targets = view.equipment.filter(peer => peer.type === WEIGHT && !excluded.has(peer.id)).map(peer => ({ peer, d: Math.hypot(point.xM - weightBottom(peer).xM, point.yM - weightBottom(peer).yM) })).sort((x, y) => x.d - y.d), nearest = targets[0];
    if (nearest && nearest.d < .05) { const root = weightRoot(scene.equipment, nearest.peer), side = root?.parameters.twoForceSide; if (side === 'left' || side === 'right') return { pose: { ...item.pose, ...point }, parameters: twoForceAttachment(scene, item, side)! }; }
    if (table) { const side: TwoForceSide = point.xM < table.pose.xM ? 'left' : 'right', sign = side === 'left' ? -1 : 1; if (Math.hypot(point.xM - table.pose.xM - sign * (Number(table.parameters.lengthM) / 2 + .07), point.yM - table.pose.yM + .41) < .08) return { pose: { ...item.pose, ...point }, parameters: twoForceAttachment(scene, item, side)! }; }
    return { pose: { ...item.pose, ...point }, parameters: twoForceAttachment(scene, item, '')! };
  }
  return { pose: { ...item.pose, ...point }, parameters: item.parameters };
}
export function twoForceDetached(scene: SceneDocument, ids: readonly string[], view: SceneDocument) {
  return scene.equipment.filter(item => !ids.includes(item.id) && [item.parameters.twoForceTableId, item.parameters.parentWeightId].some(id => ids.includes(String(id)))).map(item => ({ id: item.id, pose: view.equipment.find(peer => peer.id === item.id)!.pose, parameters: { ...item.parameters, ...(ids.includes(String(item.parameters.twoForceTableId)) ? { twoForceTableId: '', ...(item.type === WEIGHT ? { twoForceSide: '' } : {}) } : {}), ...(ids.includes(String(item.parameters.parentWeightId)) ? { parentWeightId: '' } : {}) } }));
}
export const twoForceMessage = (code: string) => ({ TF_DOCUMENT: '本实验使用小车、水平台和钩码，不支持其他器材或导线。', TF_APPARATUS: '请放置一辆小车、一张水平台和两侧钩码，钩码最多六件。', TF_ORIENTATION: '实验台和钩码保持正立，小车起始扭转角不超过 60°，不启用随机误差。', TF_ATTACHMENT: '小车放在水平台上，左右两端各接一组钩码，其余钩码串接。', TF_RANGE: '每侧钩码总质量不超过 1 kg，钩码行程至少 0.3 m。', TF_EDGE: '小车接近台边或超出转动范围，本次观察终止。', TF_DROP_LIMIT: '钩码到达上下行程边界，本次观察终止。', TF_SLACK: '绳张力不能保持正值，本次模型不再适用。', TF_BOUNDARY: '到达模型边界，已停在边界前；请重置并减小载荷或扭转角。', TF_NUMERIC: '当前状态超出计算范围，请重置。', TF_TIME_LIMIT: '本次 8 s 观察结束，可重置后比较另一组条件。', TF_RECORD: '请释放后暂停或单步观察，再记录现象；边界终止的状态不能记为正常观察。', TF_PREVIEW: '请先松手完成摆放或扭转，再记录。', INVALID_MANUAL_VALUE: '请输入有效质量数字，留空保留缺失；观察与组名最多 100 字。' } as Record<string, string>)[code] ?? '当前装置不在二力平衡模型范围内。';
