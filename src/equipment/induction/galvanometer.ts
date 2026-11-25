import type { SceneDocument } from '../../core/scene/schema.ts';
import { GALVANOMETER, INDUCTION_EXPERIMENT, SENSITIVE_GALVANOMETER } from './definitions.ts';

export function upgradeInductionGalvanometer(scene: SceneDocument, timestamp: string): SceneDocument {
  if (scene.experimentId !== INDUCTION_EXPERIMENT) return scene;
  let changed = false;
  const equipment = scene.equipment.map(item => {
    const p = item.parameters;
    if (item.type !== GALVANOMETER || p.calibrationVersion !== undefined || p.resistanceOhm !== 0 || p.maximumA !== .001 || p.resolutionA !== .00005) return item;
    changed = true;
    return { ...item, parameters: { ...p, ...SENSITIVE_GALVANOMETER } };
  });
  return changed ? { ...scene, equipment, revision: scene.revision + 1, provenance: { ...scene.provenance, updatedAt: timestamp } } : scene;
}
