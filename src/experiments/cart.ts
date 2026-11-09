import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { CART, CART_EXPERIMENT, GATE, TICKER, TRACK } from '../equipment/cart/definitions.ts';

export function createCartExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp);
  scene.experimentId = CART_EXPERIMENT;
  scene.title = '探究加速度与力、质量的关系';
  scene.viewport = { centerXM: 0, centerYM: -.66, pixelsPerM: 200 };
  scene.simulationConfig.modelVersions['mechanical.cart'] = 'analytic.v1';
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2025 年修订', topic: '加速度与力、质量的关系，正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    const registry = createWorkbenchRegistry();
    scene.provenance.origin = 'template';
    scene.equipment = [[TRACK, 'track', 0, 0], [TICKER, 'ticker', -.99, .05], [GATE, 'gate-a', -.50, 0], [GATE, 'gate-b', -.10, 0], [CART, 'cart', -.70, 0]].map(([type, itemId, x, y]) => ({
      id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 },
      parameters: { ...registry.get(String(type), 1)!.defaultParameters },
    }));
  }
  return scene;
}
