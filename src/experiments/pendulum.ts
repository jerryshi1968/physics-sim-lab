import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { PENDULUM, PENDULUM_EXPERIMENT } from '../equipment/pendulum/definitions.ts';
import { SUPPORT, MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { TIMER } from '../equipment/projectile/definitions.ts';

export function createPendulumExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = PENDULUM_EXPERIMENT; scene.title = '单摆测重力加速度实验';
  scene.viewport = { centerXM: .12, centerYM: .4, pixelsPerM: 440 };
  scene.simulationConfig.gravityMPerS2 = 9.81;
  scene.simulationConfig.modelVersions['mechanical.pendulum'] = 'nonlinear.v1';
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2020 年修订', topic: '用单摆测量重力加速度；正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['摆长从悬点量到球心；小角多周期计时，自行读尺和记录。大角度采用非线性单摆周期，不模拟阻尼。'];
    scene.equipment = [[SUPPORT, 'support', -.2, 0], [PENDULUM, 'pendulum', -.08, .76], [MECHANICAL_RULER, 'ruler', .02, .76], [TIMER, 'timer', .42, .38]].map(([type, itemId, x, y]) => ({ id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: type === MECHANICAL_RULER ? -Math.PI / 2 : 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === SUPPORT ? { heightM: .8 } : type === PENDULUM ? { supportId: 'support' } : type === MECHANICAL_RULER ? { lengthM: .7 } : {}) } }));
  }
  return scene;
}
