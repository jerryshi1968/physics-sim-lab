import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BLOCK, SURFACE, DRIVE, LOAD } from '../equipment/mechanical/frictionDefinitions.ts';
import { FORCE_METER, MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { FRICTION_EXPERIMENT } from '../equipment/mechanical/frictionScene.ts';

export function createFrictionExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = FRICTION_EXPERIMENT; scene.title = '探究滑动摩擦力';
  scene.viewport = { centerXM: 0, centerYM: .08, pixelsPerM: 400 }; scene.simulationConfig.fixedTimeStepS = 1 / 120;
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '滑动摩擦与控制变量', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['水平一维、无质量测力计；自行选择牵引方式、等待稳态并记录。运行时刻不保存。'];
    scene.equipment = [[SURFACE, 'surface', 0, 0], [BLOCK, 'block', -.6, .04], [FORCE_METER, 'friction-meter', -.495, .04], [DRIVE, 'drive', -.18, .04], [LOAD, 'load', -.8, .25], [MECHANICAL_RULER, 'friction-ruler', -1.2, -.12]].map(([type, id, x, y]) => ({ id: String(id), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters,
      ...(type === BLOCK ? { surfaceId: 'surface', driverId: 'drive', meterId: 'friction-meter' } : type === FORCE_METER ? { directionDeg: 0 } : {}) } }));
  }
  return scene;
}
