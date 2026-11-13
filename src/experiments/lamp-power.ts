import { createOhmExperiment } from './ohm.ts';
import { createElectricalRegistry, LAMP } from '../equipment/electrical/definitions.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';

export const LAMP_POWER_EXPERIMENT = 'J-ELEC-04';
export function createLampPowerExperiment(documentId: string, timestamp: string) {
  const scene = createOhmExperiment(documentId, timestamp), registry = createElectricalRegistry();
  scene.experimentId = LAMP_POWER_EXPERIMENT;
  scene.title = '测量小灯泡的电功率';
  delete scene.ohmControl;
  delete scene.simulationConfig.modelVersions['electrical.ohm'];
  scene.simulationConfig.modelVersions['electrical.lamp-power'] = 'measurement.v1';
  scene.curriculumRef!.standard.topic = '测量小灯泡的电功率；具体条目待教师核验';
  scene.provenance.notes = ['复用首版非线性灯泡与现有电学器材。开关断开，变阻器接入最大阻值，两表先接大量程；自行调节至额定电压，不预填功率记录。'];
  const lamp = scene.equipment.find(item => item.id === 'R')!;
  lamp.id = 'L1'; lamp.type = LAMP;
  lamp.parameters = { ...registry.get(LAMP, 1)!.defaultParameters };
  for (const wire of scene.connections) for (const end of [wire.from, wire.to]) {
    if (end?.equipmentId === 'R') end.equipmentId = 'L1';
    if ((end?.equipmentId === 'A' || end?.equipmentId === 'V') && end.portId === 'low') end.portId = 'high';
  }
  const checked = validateSceneDocument(scene, registry);
  if (!checked.ok) throw new Error('INVALID_LAMP_POWER_TEMPLATE');
  return checked.document;
}
