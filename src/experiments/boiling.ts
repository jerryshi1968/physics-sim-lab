import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BEAKER } from '../equipment/density/definitions.ts';
import { SUPPORT } from '../equipment/mechanical/definitions.ts';
import { TIMER } from '../equipment/projectile/definitions.ts';
import { BOILING_EXPERIMENT, HEATER, THERMOMETER } from '../equipment/thermal/definitions.ts';

export function createBoilingExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = BOILING_EXPERIMENT; scene.title = '探究水的沸腾';
  scene.viewport = { centerXM: .08, centerYM: .08, pixelsPerM: 650 };
  scene.simulationConfig.modelVersions['thermal.boiling'] = 'lumped.v1';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '水的沸腾与温度—时间记录；正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template';
    scene.equipment = [[SUPPORT, 'support', -.16, -.12], [HEATER, 'heater', 0, -.02], [BEAKER, 'beaker', 0, 0], [THERMOMETER, 'thermometer', .02, .28], [TIMER, 'timer', .3, .13]].map(([type, itemId, x, y]) => ({ id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === BEAKER ? { liquidM3: .0002, liquidCode: '水' } : type === SUPPORT ? { heightM: .46 } : type === TIMER ? { resolutionS: .1 } : {}) } }));
  }
  return scene;
}
