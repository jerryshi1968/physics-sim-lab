import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { CART, TRACK } from '../equipment/cart/definitions.ts';
import { WEIGHT } from '../equipment/mechanical/definitions.ts';
import { TWO_FORCE_EXPERIMENT } from '../equipment/twoForce/simulate.ts';
export function createTwoForceExperiment(id: string, timestamp: string) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = TWO_FORCE_EXPERIMENT; scene.title = '探究二力平衡的条件'; scene.viewport = { centerXM: 0, centerYM: .15, pixelsPerM: 400 };
  scene.simulationConfig.gravityMPerS2 = 9.81; scene.simulationConfig.modelVersions = { 'mechanical.two-force': 'rigid.v1' };
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '二力平衡条件；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.provenance.origin = 'template'; scene.provenance.notes = ['复用小车、轨道和钩码；本实验以双定滑轮水平台俯视摆放，钩码以侧视示意。改变两侧质量，扭转后释放并自行记录条件与现象。'];
  scene.equipment = [[TRACK, 'table', 0, .35], [CART, 'cart', 0, .35], [WEIGHT, 'left', -.87, -.06], [WEIGHT, 'right', .87, -.06]].map(([type, key, x, y]) => ({ id: String(key), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === TRACK ? { lengthM: 1.6, dropLimitM: .65 } : type === CART ? { cartMassKg: .35, loadMassKg: 0, hangerMassKg: 0, twoForceTableId: 'table', twoForceSpeedMPerS: 0 } : { massKg: .05, twoForceTableId: 'table', twoForceSide: key === 'left' ? 'left' : 'right' }) } }));
  return scene;
}
