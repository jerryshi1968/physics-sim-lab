import { inductionViewport } from '../equipment/induction/motion.ts';
import { createLampCircuitExperiment } from './lamp-circuits.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';
import { MAGNET, GALVANOMETER, INDUCTION_EXPERIMENT, INDUCTION_MODEL } from '../equipment/induction/definitions.ts';
import { METAL_WIRE } from '../equipment/electrical/conductor.ts';
import { SWITCH } from '../equipment/electrical/definitions.ts';

export function createInductionExperiment(id: string, time: string) {
  const scene = createLampCircuitExperiment(id, time, 'blank'), registry = createWorkbenchRegistry();
  scene.experimentId = INDUCTION_EXPERIMENT; scene.title = '探究什么情况下磁可以生电';
  scene.curriculumRef!.standard.topic = scene.title;
  scene.provenance.origin = 'template';
  scene.provenance.notes = ['复用金属丝、开关与导线；新增蹄形磁体及中央零刻度灵敏电流计。磁体采用斜视立体示意，N/S 极间的磁场沿上下方向，连接导线在磁场外，忽略自感与指针惯性。'];
  scene.equipment = [[MAGNET, 'B', -.22, .03], [METAL_WIRE, 'M', -.22, .03], [GALVANOMETER, 'G', .45, .1], [SWITCH, 'S', .36, -.23]].map(([type, itemId, x, y]) => ({
    id: String(itemId), type: String(type), definitionVersion: 1, parameters: { ...registry.get(String(type), 1)!.defaultParameters },
    pose: { xM: Number(x), yM: Number(y), rotationRad: itemId === 'M' ? Math.PI / 2 : 0, flippedX: false },
  }));
  Object.assign(scene.equipment.find(i => i.id === 'M')!.parameters, { lengthM: .2, areaM2: 5e-8, inductionShape: 'rod', turns: 10, inductionPerspective: true });
  scene.connections = [
    { id: 'induction-wire-1', kind: 'wire', from: { equipmentId: 'M', portId: 'a' }, to: { equipmentId: 'G', portId: 'low' }, routeWorldM: [{ x: -.22, y: -.38 }, { x: .7, y: -.38 }, { x: .7, y: .02 }] },
    { id: 'induction-wire-2', kind: 'wire', from: { equipmentId: 'G', portId: 'common' }, to: { equipmentId: 'S', portId: 'b' } },
    { id: 'induction-wire-3', kind: 'wire', from: { equipmentId: 'S', portId: 'a' }, to: { equipmentId: 'M', portId: 'b' }, routeWorldM: [{ x: .2, y: -.18 }, { x: .2, y: .36 }, { x: -.22, y: .36 }] },
  ];
  scene.viewport = inductionViewport(scene, 1000, 450);
  scene.simulationConfig.modelVersions['electrical.induction'] = INDUCTION_MODEL;
  const checked = validateSceneDocument(scene, registry); if (!checked.ok) throw new Error('INVALID_INDUCTION_TEMPLATE');
  return checked.document;
}
