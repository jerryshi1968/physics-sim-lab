import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { validateSceneDocument } from '../../core/scene/validate.ts';
import { BALANCE, MASS_SET, SPECIMEN, BEAKER } from '../density/definitions.ts';
import { solveBalance, densityMessage } from '../density/simulate.ts';
export const MASS_EXPERIMENT = 'J-MEAS-02';
export const massApparatus = [BALANCE, MASS_SET, SPECIMEN, BEAKER];
export const massSamples = [{ code: '橡皮', massKg: .0356, volumeM3: .000008 }, { code: '铅笔', massKg: .0084, volumeM3: .000004 }];
export function simulateMass(scene: SceneDocument, registry: EquipmentRegistry) {
  const weighing = solveBalance(scene.equipment);
  const fail = (code: string) => ({ ok: false as const, code, weighing });
  if (!validateSceneDocument(scene, registry).ok) return fail('MASS_DOCUMENT');
  if (scene.connections.length || scene.equipment.some(i => !massApparatus.includes(i.type))) return fail('MASS_MIXED');
  if (scene.simulationConfig.randomError.enabled) return fail('DENSITY_RANDOM');
  if (massApparatus.some(type => scene.equipment.filter(i => i.type === type).length > 1)) return fail('MASS_DUPLICATE');
  if (!weighing.ok) return fail(weighing.code);
  if (scene.equipment.some(i => i.pose.flippedX || Math.abs(i.pose.rotationRad) > 1e-10 || Math.abs(i.pose.xM) > 100 || Math.abs(i.pose.yM) > 100)) return fail('DENSITY_ORIENTATION');
  if (scene.equipment.some(i => [SPECIMEN, BEAKER].includes(i.type) && !['', weighing.balance.id].includes(String(i.parameters.targetId)) || i.type === MASS_SET && !['', weighing.balance.id].includes(String(i.parameters.balanceId)))) return fail('DENSITY_ATTACHMENT');
  return { ok: true as const, weighing };
}
export type MassOutcome = ReturnType<typeof simulateMass>;
export const massMessage = (code: string) => ({ MASS_DOCUMENT: '器材参数无效。', MASS_MIXED: '质量测量使用天平、砝码盒、待测固体和烧杯。', MASS_DUPLICATE: '同类器材最多放一件。', MASS_PHASE: '固体读数需将固体放在左盘；空杯读数需清空烧杯，总质量读数需杯中有水。', MASS_BALANCE: '请先空载调零，再左物右码、调游码至平衡，且不超量程。', MASS_SOURCES: '请选择本组同一烧杯先空杯、后加水的两条有效读数；装置及容器参数须一致。', MASS_DIFFERENCE: '总质量应大于空烧杯质量，请检查手工读数。', MASS_PREVIEW: '请松手完成调整后再保存读数。' } as Record<string, string>)[code] ?? densityMessage(code);
