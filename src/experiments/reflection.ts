import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { MIRROR,EMITTER,PAPER,PROTRACTOR,NORMAL,REFLECTION_EXPERIMENT } from '../equipment/reflection/definitions.ts';
export function createReflectionExperiment(id:string,timestamp:string,empty=false){
  const scene=createEmptyScene(id,timestamp),registry=createWorkbenchRegistry();scene.experimentId=REFLECTION_EXPERIMENT;scene.title='探究光的反射定律';scene.viewport={centerXM:0,centerYM:.27,pixelsPerM:500};scene.simulationConfig.modelVersions['optical.reflection']='spatial.v1';
  scene.curriculumRef={stage:'junior',standard:{title:'义务教育物理课程标准',edition:'2022 年版',topic:'光的反射与三线共面；具体条目待教师核验',clause:null},textbookMappings:[{publisher:'人民教育出版社',edition:null,volume:null,chapter:null,page:null,status:'pending_teacher_review',reviewedBy:null,reviewedAt:null}]};
  if(!empty){scene.provenance.origin='template';scene.provenance.notes=['绕法线折动右纸板，以实际光线与承接平面的空间关系观察光迹。理论辅助默认关闭，角度自行读量角器。'];scene.equipment=[[PAPER,'paper',0,0,0],[PROTRACTOR,'gauge',0,0,0],[MIRROR,'mirror',0,0,0],[NORMAL,'normal',0,0,0],[EMITTER,'emitter',-.24,.24*Math.sqrt(3),-Math.PI/3]].map(([type,id,x,y,a])=>({id:String(id),type:String(type),definitionVersion:1,pose:{xM:Number(x),yM:Number(y),rotationRad:Number(a)},parameters:registry.get(String(type),1)!.defaultParameters}));}
  return scene;
}
