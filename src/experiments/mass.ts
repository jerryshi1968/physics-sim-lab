import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BALANCE, MASS_SET, SPECIMEN, BEAKER } from '../equipment/density/definitions.ts';
import { MASS_EXPERIMENT, massSamples } from '../equipment/mass/simulate.ts';
export function createMassExperiment(id: string, timestamp: string, liquid = false) {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.experimentId = MASS_EXPERIMENT;
  scene.title = liquid ? '用天平测量液体的质量' : '用天平测量固体的质量';
  scene.viewport = { centerXM: .03, centerYM: .06, pixelsPerM: 650 };
  scene.simulationConfig.modelVersions['measurement.mass'] = 'static.v1';
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '质量测量；具体条目待教师核验', clause: null }, textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  scene.provenance.origin = 'template';
  scene.provenance.notes = ['游码归零、空载调平，左物右码，自行读数；液体先称空杯再加水称总质量，两次手工读数相减。'];
  scene.equipment = [[BALANCE, 'balance', -.1, 0], [MASS_SET, 'masses', .03, -.09], [liquid ? BEAKER : SPECIMEN, liquid ? 'beaker' : 'specimen', .28, .04]].map(([type, id, x, y]) => ({ id: String(id), type: String(type), definitionVersion: 1, pose: { xM: Number(x), yM: Number(y), rotationRad: 0 }, parameters: { ...registry.get(String(type), 1)!.defaultParameters, ...(type === MASS_SET ? { balanceId: 'balance' } : type === BEAKER ? { liquidM3: 0 } : type === SPECIMEN ? { massKg: massSamples[0]!.massKg, volumeM3: massSamples[0]!.volumeM3, sampleCode: massSamples[0]!.code } : {}) } }));
  return scene;
}
