import { createOhmExperiment } from './ohm.ts';
import { createElectricalRegistry } from '../equipment/electrical/definitions.ts';
import { validateSceneDocument } from '../core/scene/validate.ts';

export const VOLTAMMETRY_EXPERIMENT = 'J-ELEC-03';
export function createVoltammetryExperiment(documentId: string, timestamp: string) {
  const scene = createOhmExperiment(documentId, timestamp);
  scene.experimentId = VOLTAMMETRY_EXPERIMENT;
  scene.title = '伏安法测量定值电阻';
  delete scene.ohmControl;
  delete scene.simulationConfig.modelVersions['electrical.ohm'];
  scene.simulationConfig.modelVersions['electrical.voltammetry'] = 'measurement.v1';
  scene.curriculumRef!.standard.topic = '伏安法测量定值电阻；具体条目待教师核验';
  scene.provenance.notes = ['复用现有电学器材；待测电阻隐藏阻值。开关断开、变阻器接入最大阻值，两表先接大量程，学生自行改接量程和读表。'];
  const resistor = scene.equipment.find(item => item.id === 'R')!;
  resistor.parameters = { resistanceOhm: 7.5, concealResistance: true, sampleLabel: 'A' };
  for (const wire of scene.connections) for (const end of [wire.from, wire.to]) {
    if ((end?.equipmentId === 'A' || end?.equipmentId === 'V') && end.portId === 'low') end.portId = 'high';
  }
  const checked = validateSceneDocument(scene, createElectricalRegistry());
  if (!checked.ok) throw new Error('INVALID_VOLTAMMETRY_TEMPLATE');
  return checked.document;
}
