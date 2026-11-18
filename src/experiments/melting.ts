import { createBoilingExperiment } from './boiling.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { MELTING_EXPERIMENT, TUBE } from '../equipment/melting/definitions.ts';
import { HEATER } from '../equipment/thermal/definitions.ts';
export function createMeltingExperiment(id:string,time:string,empty=false) {
  const scene=createBoilingExperiment(id,time,empty),registry=createWorkbenchRegistry();
  scene.experimentId=MELTING_EXPERIMENT;scene.title='探究固体熔化时温度的变化规律';
  scene.simulationConfig.modelVersions={'thermal.melting':'enthalpy.v1'};
  scene.curriculumRef!.standard.topic='固体熔化过程的物态与温度变化；正式条目待教师核验';
  if(!empty){scene.equipment=scene.equipment.map(i=>i.type===HEATER?{...i,parameters:{...i.parameters,powerW:200}}:i);scene.equipment.push({id:'tube',type:TUBE,definitionVersion:1,pose:{xM:.02,yM:.015,rotationRad:0},parameters:{...registry.get(TUBE,1)!.defaultParameters}});}
  return scene;
}
