import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { CART, TRACK } from '../equipment/cart/definitions.ts';
import { BLOCK } from '../equipment/mechanical/frictionDefinitions.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { TIMER } from '../equipment/projectile/definitions.ts';
import { AVERAGE_SPEED_EXPERIMENT, STOP } from '../equipment/averageSpeed/definitions.ts';
import { trackPoint } from '../equipment/averageSpeed/simulate.ts';
export function createAverageSpeedExperiment(id:string,time:string,empty=false) {
  const scene=createEmptyScene(id,time),registry=createWorkbenchRegistry(),angle=2*Math.PI/180;
  scene.experimentId=AVERAGE_SPEED_EXPERIMENT;scene.title='测量物体运动的平均速度';scene.viewport={centerXM:0,centerYM:.22,pixelsPerM:500};
  scene.simulationConfig.modelVersions['mechanical.average-speed']='analytic.v1';
  scene.curriculumRef={stage:'junior',standard:{title:'义务教育物理课程标准',edition:'2022 年版',topic:'路程、时间与平均速度；正式条目待教师核验',clause:null},textbookMappings:[{publisher:'人民教育出版社',edition:null,volume:null,chapter:null,page:null,status:'pending_teacher_review',reviewedBy:null,reviewedAt:null}]};
  if (!empty) {
    scene.provenance.origin='template';
    const rail={pose:{xM:0,yM:.12,rotationRad:angle}};
    scene.equipment=[[TRACK,'track',0,0],[CART,'cart',.55,0],[STOP,'stop',-.56,0],[BLOCK,'block',.61,-.065],[MECHANICAL_RULER,'ruler',-.65,-.15],[TIMER,'timer',0,.34]].map(([type,itemId,u,n])=>({id:String(itemId),type:String(type),definitionVersion:1,pose:{...trackPoint(rail,Number(u),Number(n)),rotationRad:[TRACK,CART,STOP,MECHANICAL_RULER].includes(String(type))?angle:0},parameters:{...registry.get(String(type),1)!.defaultParameters,...(type===TRACK?{lengthM:1.4}:type===CART?{loadMassKg:0,hangerMassKg:0}:type===MECHANICAL_RULER?{lengthM:1.2}:type===TIMER?{resolutionS:.01}: {})}}));
  }
  return scene;
}
