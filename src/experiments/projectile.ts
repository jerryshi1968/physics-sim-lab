import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { LAUNCHER, BALL, TIMER, SCALE, GROUND, PROJECTILE_EXPERIMENT } from '../equipment/projectile/definitions.ts';
export function createProjectileExperiment(id: string, timestamp: string, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = PROJECTILE_EXPERIMENT; scene.title = '探究平抛运动';
  scene.viewport = { centerXM: .65, centerYM: .65, pixelsPerM: 160 };
  scene.simulationConfig.modelVersions['mechanical.projectile'] = 'analytic.v1';
  scene.curriculumRef = { stage: 'senior', standard: { title: '普通高中物理课程标准', edition: '2017 年版 2025 年修订', topic: '平抛与运动合成；正式条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['水平质点平抛，g=10 m/s²，无空气阻力。先读尺校准，自行发射、暂停/步进和抄表。只保存初态和已记数据，不续跑。'];
    scene.equipment = [[SCALE, 'scale', -.1, 1.3], [GROUND, 'ground', -.3, 0], [LAUNCHER, 'launcher', 0, 1.25], [TIMER, 'timer', 1.65, 1.1], [BALL, 'ball', 0, 1.25]].map(([type,id,x,y])=>({ id:String(id), type:String(type), definitionVersion:1, pose:{xM:Number(x),yM:Number(y),rotationRad:0}, parameters:{...registry.get(String(type),1)!.defaultParameters,...(type===BALL?{launcherId:'launcher'}:{})} }));
  }
  return scene;
}
