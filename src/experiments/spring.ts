import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { SPRING, SPRING_EXPERIMENT } from '../equipment/spring/definitions.ts';
import { SUPPORT, WEIGHT, MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';

export function createSpringExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = SPRING_EXPERIMENT; scene.title = '探究弹簧弹力与形变量';
  scene.viewport = { centerXM: .02, centerYM: .245, pixelsPerM: 480 };
  scene.simulationConfig.modelVersions['mechanical.spring'] = 'statics.v1';
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2025 年修订', topic: '弹力与形变量；正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['竖直无质量理想弹簧，静态平衡；无挂码、盘质量为零。自行读原长和加载长度，不自动填写记录。教材映射待教师核验。'];
    scene.equipment = [[SUPPORT, 'support', -.08, .02], [SPRING, 'spring', 0, .45], [WEIGHT, 'weight', -.23, .28], [MECHANICAL_RULER, 'ruler', .08, .49]].map(([type, id, x, y]) => ({ id: String(id), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: type === MECHANICAL_RULER ? -Math.PI / 2 : 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === SUPPORT ? { heightM: .43 } : type === SPRING ? { supportId: 'support' } : type === WEIGHT ? { massKg: .025 } : { lengthM: .4 }) } }));
  }
  return scene;
}
