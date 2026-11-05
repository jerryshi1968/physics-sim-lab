import type { SceneDocument } from '../../core/scene/schema.ts';
import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';
import { mechanicalViewScene, hookWorld } from '../../equipment/mechanical/simulate.ts';
import { WEIGHT, FORCE_METER } from '../../equipment/mechanical/definitions.ts';

import { positionWeightChains } from '../../equipment/mechanical/weightChain.ts';

export function leverTrendAngle(outcome: LeverOutcome | null) {
  return outcome?.ok && !outcome.empty && !outcome.balanced ? Math.sign(outcome.totalTorqueNm) * .18 : 0;
}
export function leverPresentationScene(scene: SceneDocument, outcome: LeverOutcome | null, preview?: { id: string; point: { xM: number; yM: number } } | null): SceneDocument {
  const original = mechanicalViewScene(scene, preview), angle = leverTrendAngle(outcome);
  if (!outcome?.ok || angle === 0) return original;
  const lever = original.equipment.find(item => item.id === outcome.lever.id);
  if (!lever || !lever.parameters.supportId) return original;
  const pivot = hookWorld(lever, Number(lever.parameters.pivotIndex)), rotationRad = lever.pose.rotationRad + angle;
  const offset = hookWorld({ ...lever, pose: { ...lever.pose, xM: 0, yM: 0, rotationRad } }, Number(lever.parameters.pivotIndex));
  const tilted = { ...lever, pose: { ...lever.pose, rotationRad, xM: pivot.xM - offset.xM, yM: pivot.yM - offset.yM } };
  return { ...original, equipment: positionWeightChains(original.equipment.map(item => item.id === lever.id ? tilted : [WEIGHT, FORCE_METER].includes(item.type) && item.parameters.leverId === lever.id
    ? { ...item, pose: { ...item.pose, ...hookWorld(tilted, Number(item.parameters.hookIndex)) } } : item)) };
}
