import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { EMITTER, PROTRACTOR, NORMAL } from '../equipment/reflection/definitions.ts';
import { TANK, REFRACTION_EXPERIMENT } from '../equipment/refraction/definitions.ts';
export function createRefractionExperiment(id: string, timestamp: string) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry(), angle = 40 * Math.PI / 180;
  scene.experimentId = REFRACTION_EXPERIMENT; scene.title = '探究光折射时的特点'; scene.viewport = { centerXM: 0, centerYM: -.015, pixelsPerM: 480 };
  scene.simulationConfig.modelVersions['optical.refraction'] = 'interface.v1';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '光折射时的特点与光路可逆；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.provenance.origin = 'template';
  scene.equipment = [[TANK, 'tank', 0, 0, 0], [PROTRACTOR, 'upper-gauge', 0, 0, 0], [PROTRACTOR, 'lower-gauge', 0, 0, Math.PI], [NORMAL, 'normal', 0, 0, 0], [EMITTER, 'emitter', -.46 * Math.sin(angle), .46 * Math.cos(angle), angle - Math.PI / 2]].map(([type, itemId, x, y, a]) => ({ id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: Number(a) }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === PROTRACTOR ? { radiusM: .28 } : type === NORMAL ? { lengthM: .36 } : {}) } }));
  return scene;
}
