import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { EYE, MATCH, MIRROR_IMAGE_EXPERIMENT, MIRROR_IMAGE_MODEL, TARGET } from '../equipment/mirrorImage/definitions.ts';
import { RULER, SCREEN } from '../equipment/optical/definitions.ts';
import { MIRROR } from '../equipment/reflection/definitions.ts';

export function createMirrorImageExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp);
  scene.title = '探究平面镜成像';
  scene.experimentId = MIRROR_IMAGE_EXPERIMENT;
  scene.viewport = { centerXM: 0, centerYM: .035, pixelsPerM: 680 };
  scene.simulationConfig.modelVersions['optical.mirror-image'] = MIRROR_IMAGE_MODEL;
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '平面镜成像特点；具体条目待教师核验', clause: null },
    textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (empty) return scene;
  const registry = createWorkbenchRegistry();
  scene.provenance.origin = 'template';
  const layout = [
    { type: RULER, id: 'distance-ruler', xM: -.47, yM: -.16, parameters: { lengthM: .94 } },
    { type: RULER, id: 'height-ruler', xM: .43, yM: -.045, rotationRad: Math.PI / 2, parameters: { lengthM: .25 } },
    { type: MIRROR, id: 'image-mirror', xM: 0, yM: .06, parameters: { lengthM: .41 } },
    { type: TARGET, id: 'image-object', xM: -.22, yM: .08 },
    { type: MATCH, id: 'image-match', xM: .31, yM: .115 },
    { type: EYE, id: 'image-eye', xM: -.39, yM: .19 },
    { type: SCREEN, id: 'image-screen', xM: .35, yM: .012, parameters: { heightM: .18, widthM: .08 } },
  ];
  scene.equipment = layout.map(({ type, id, xM, yM, rotationRad = 0, parameters }) => ({ type, id, definitionVersion: 1, pose: { xM, yM, rotationRad }, parameters: parameters ?? registry.get(type, 1)!.defaultParameters }));
  return scene;
}
