import { createPulleyExperiment } from './pulley.ts';
import { EFFICIENCY_EXPERIMENT, EFFICIENCY_MODEL, PULLEY } from '../equipment/pulley/definitions.ts';
export function createPulleyEfficiencyExperiment(id:string,time:string) {
  const scene=createPulleyExperiment(id,time),pulley=scene.equipment.find(i=>i.type===PULLEY)!;
  scene.experimentId=EFFICIENCY_EXPERIMENT;scene.title='测量滑轮组的机械效率';scene.viewport={centerXM:.08,centerYM:.39,pixelsPerM:500};
  scene.simulationConfig.modelVersions={'mechanical.pulley':EFFICIENCY_MODEL};
  scene.provenance.notes=['全部复用现有器材：一只定滑轮、一只动滑轮、支架、测力计、钩码和两把独立尺。两股绳承重，向下缓慢拉动，手工读数计算功与效率。默认动滑轮 0.05 kg，忽略摩擦和绳重。'];
  scene.curriculumRef!.standard.topic='滑轮组、有用功、总功和机械效率；具体条目待教师核验';
  pulley.parameters={...pulley.parameters,mode:'tackle',massKg:.05,fixedPulleyId:'fixed-pulley'};pulley.pose={xM:.01,yM:.32,rotationRad:0};
  scene.equipment.push({...structuredClone(pulley),id:'fixed-pulley',pose:{xM:.09,yM:.61,rotationRad:0},parameters:{mode:'fixed',massKg:.05,pullM:0,supportId:'',meterId:'',weightId:''}});
  scene.equipment.find(i=>i.id==='pull-ruler')!.pose.xM=.27;
  return scene;
}
