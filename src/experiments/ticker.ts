import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { TICKER } from '../equipment/cart/definitions.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { TICKER_EXPERIMENT, TICKER_DIRECT_MODEL } from '../equipment/ticker/simulate.ts';

export function createTickerExperiment(id: string, timestamp: string) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = TICKER_EXPERIMENT;
  scene.title = '练习使用打点计时器';
  scene.provenance.origin = 'template';
  scene.viewport = { centerXM: .25, centerYM: .04, pixelsPerM: 600 };
  scene.simulationConfig.modelVersions['mechanical.ticker'] = TICKER_DIRECT_MODEL;
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2025 年修订', topic: '打点计时器的使用、时间与位移测量，正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.equipment = [[TICKER, 'ticker', -.18, .04], [MECHANICAL_RULER, 'ruler', -.18, -.14]].map(([type, itemId, x, y]) => ({
    id: String(itemId), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters },
  }));
  return scene;
}
