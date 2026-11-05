import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { LEVER_EXPERIMENT } from '../equipment/mechanical/simulate.ts';

export function createLeverExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = LEVER_EXPERIMENT; scene.title = '探究杠杆平衡条件';
  scene.viewport = { centerXM: 0, centerYM: .18, pixelsPerM: 900 };
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '杠杆平衡', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['空载杠杆尚未调平，钩码和测力计未挂载；请自行调平、挂接及读尺。'];
    scene.equipment = [[SUPPORT, 'support', 0, 0], [LEVER, 'lever', 0, .32], [WEIGHT, 'left', -.28, .12], [WEIGHT, 'right', .1, .12], [FORCE_METER, 'meter', .32, .28], [MECHANICAL_RULER, 'ruler', -.4, -.035]].map(([type, key, x, y]) => ({ id: String(key), type: String(type), definitionVersion: 1,
      pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === LEVER ? { supportId: 'support' } : {}) } }));
  }
  return scene;
}
