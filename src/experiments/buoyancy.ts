import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BODY, OVERFLOW, BUOYANCY_EXPERIMENT, BUOYANCY_MODEL } from '../equipment/buoyancy/definitions.ts';
import { FORCE_METER, SUPPORT } from '../equipment/mechanical/definitions.ts';
import { BALANCE, BEAKER, MASS_SET, CYLINDER } from '../equipment/density/definitions.ts';
import type { EquipmentInstance } from '../core/equipment/schema.ts';

export function createBuoyancyExperiment(id: string, timestamp: string, method: 'factors' | 'archimedes' | 'empty') {
  const scene = createEmptyScene(id, timestamp), registry = createWorkbenchRegistry();
  scene.title = method === 'archimedes' ? '验证阿基米德原理' : '探究浮力的影响因素';
  scene.experimentId = BUOYANCY_EXPERIMENT;
  scene.viewport = { centerXM: method === 'archimedes' ? .06 : -.18, centerYM: .29, pixelsPerM: method === 'archimedes' ? 480 : 600 };
  scene.simulationConfig.modelVersions['mechanical.buoyancy'] = BUOYANCY_MODEL;
  scene.curriculumRef = { stage: 'junior', standard: { title: '义务教育物理课程标准', edition: '2022 年版', topic: '浮力与阿基米德原理，具体条目待教师核验', clause: null },
    textbookMappings: [{ publisher: '人民教育出版社', edition: null, volume: null, chapter: null, page: null, status: 'pending_teacher_review', reviewedBy: null, reviewedAt: null }] };
  if (method === 'empty') return scene;
  scene.provenance.origin = 'template';
  function add(type: string, id: string, xM: number, yM: number, parameters: EquipmentInstance['parameters'] = {}) {
    scene.equipment.push({ id, type, definitionVersion: 1, pose: { xM, yM, rotationRad: 0 }, parameters: { ...registry.get(type, 1)!.defaultParameters, ...parameters } });
  }
  add(SUPPORT, 'buoy-support', -.24, 0, { heightM: .65 });
  add(FORCE_METER, 'buoy-meter', -.16, .60, { supportId: 'buoy-support', mountHeightM: .60, rangeN: 2, resolutionN: .05 });
  add(BODY, 'buoy-body', -.16, .30, { meterId: 'buoy-meter' });
  if (method === 'factors') add(BEAKER, 'buoy-vessel', -.16, 0, { buoyancyRole: 'vessel', liquidM3: .0004 });
  else {
    add(OVERFLOW, 'buoy-overflow', -.16, 0, { receiverId: 'buoy-receiver' });
    add(BEAKER, 'buoy-receiver', -.06, 0, { buoyancyRole: 'receiver', liquidM3: 0 });
    add(BALANCE, 'buoy-balance', .32, .12);
    add(MASS_SET, 'buoy-masses', .36, -.03, { balanceId: 'buoy-balance' });
    add(CYLINDER, 'buoy-cylinder', .07, .015, { liquidM3: 0 });
  }
  return scene;
}
