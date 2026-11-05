import { createEmptyScene } from '../core/scene/create.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from '../equipment/optical/definitions.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { OPTICAL_EXPERIMENT } from '../equipment/optical/simulate.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';

export function createOpticalExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = OPTICAL_EXPERIMENT; scene.title = '探究凸透镜成像规律';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '光学实验与测量', clause: null },
    textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.viewport = { centerXM: .55, centerYM: .03, pixelsPerM: 600 };
  if (!empty) {
    scene.provenance.origin = 'template';
    scene.provenance.notes = ['器材初态未同高、光屏未对焦；请独立调高、移动光屏找像。近轴薄透镜与离焦采样模型，不模拟衍射/像差。'];
    scene.equipment = [[BENCH, 'bench', 0, 0], [CANDLE, 'candle', .2, .06], [LENS, 'lens', .5, .07], [SCREEN, 'screen', .73, .06], [RULER, 'ruler', .1, -.045]].map(([type, key, x, y]) => ({
      id: String(key), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
      pose: { xM: Number(x), yM: Number(y), rotationRad: 0 },
    }));
  }
  const checked = validateSceneDocument(scene, registry);
  if (!checked.ok) throw new Error('INVALID_OPTICAL_TEMPLATE');
  return checked.document;
}
