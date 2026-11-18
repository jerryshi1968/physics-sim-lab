import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { SUPPORT, FORCE_METER, WEIGHT } from '../equipment/mechanical/definitions.ts';
import { GRAVITY_EXPERIMENT } from '../equipment/gravity/simulate.ts';
export function createGravityExperiment(id: string, timestamp: string) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = GRAVITY_EXPERIMENT; scene.title = '探究重力的大小跟质量的关系';
  scene.viewport = { centerXM: 0, centerYM: .36, pixelsPerM: 650 };
  scene.simulationConfig.gravityMPerS2 = 9.81; scene.simulationConfig.modelVersions = { 'mechanical.gravity': 'static.v1' };
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '重力的大小与质量的关系；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.provenance.origin = 'template'; scene.provenance.notes = ['复用支架、测力计与五件 0.05 kg 钩码，钩码尚未挂载；逐次挂接，自行读表记录并绘制 G–m 图。'];
  scene.equipment = [[SUPPORT, 'support', -.16, 0], [FORCE_METER, 'meter', -.08, .72], ...Array.from({ length: 5 }, (_, i) => [WEIGHT, `weight${i + 1}`, i % 2 ? .17 : -.30, .28 - Math.floor(i / 2) * .1])].map(([type, key, x, y]) => ({ id: String(key), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === SUPPORT ? { heightM: .72 } : type === FORCE_METER ? { supportId: 'support' } : { massKg: .05 }) } }));
  return scene;
}
