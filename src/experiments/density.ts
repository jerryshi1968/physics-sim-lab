import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BALANCE, CYLINDER, SPECIMEN, MASS_SET, BEAKER, DENSITY_EXPERIMENT, LIQUID_EXPERIMENT, densityExperimentTitles } from '../equipment/density/definitions.ts';
export function createDensityExperiment(id: string, timestamp: string, liquid = false, empty = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = liquid ? LIQUID_EXPERIMENT : DENSITY_EXPERIMENT;
  scene.title = densityExperimentTitles[liquid ? 'liquid' : 'solid'];
  scene.viewport = { centerXM: .05, centerYM: .05, pixelsPerM: 650 };
  scene.simulationConfig.modelVersions['measurement.density'] = 'static.v1';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '质量、体积与密度测量；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (!empty) {
    scene.provenance.origin = 'template'; scene.provenance.notes = ['左物右码，游码归零后空载调平；量筒平视凹液面最低处；自行读数，不自动填表。固体限定不溶解、不吸水且下沉，液体倒出前后称重守恒。'];
    scene.equipment = [
      [BALANCE, 'balance', -.16, 0],
      [CYLINDER, 'cylinder', .31, 0],
      [SPECIMEN, 'specimen', -.45, .03],
      [MASS_SET, 'masses', -.03, -.09],
      [BEAKER, 'beaker', .1, .02],
    ].filter(([type]) => type !== (liquid ? SPECIMEN : BEAKER))
      .map(([type, id, x, y]) => ({ id: String(id), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === MASS_SET ? { balanceId: 'balance' } : type === CYLINDER && liquid ? { liquidM3: 0 } : {}) } }));
  }
  return scene;
}
