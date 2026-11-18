import { createMassExperiment } from './mass.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { MASS_VOLUME_EXPERIMENT, aluminumBlocks } from '../equipment/massVolume/simulate.ts';
import { SPECIMEN } from '../equipment/density/definitions.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
export function createMassVolumeExperiment(id: string, timestamp: string) {
  const scene = createMassExperiment(id, timestamp), sample = aluminumBlocks[0]!, registry = createWorkbenchRegistry();
  scene.experimentId = MASS_VOLUME_EXPERIMENT;
  scene.title = '探究同种物质的质量与体积的关系';
  scene.simulationConfig.modelVersions = { 'measurement.mass-volume': 'static.v1' };
  scene.curriculumRef!.standard.topic = '同种物质的质量与体积关系；具体条目待教师核验';
  scene.provenance.notes = ['同种铝制正方体，先称量，再用独立尺读正面边长，计算体积并绘制 m–V 图；不自动填读数或结论。'];
  const block = scene.equipment.find(i => i.type === SPECIMEN)!;
  Object.assign(block.parameters, { massKg: sample.massKg, volumeM3: sample.volumeM3, sampleCode: sample.code });
  block.pose = { xM: .25, yM: .04, rotationRad: 0 };
  scene.equipment.push({ id: 'ruler', type: MECHANICAL_RULER, definitionVersion: 1, pose: { xM: .23, yM: .026, rotationRad: 0 }, parameters: { ...registry.get(MECHANICAL_RULER, 1)!.defaultParameters, lengthM: .15 } });
  return scene;
}
