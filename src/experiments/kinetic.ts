import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { TRACK } from '../equipment/cart/definitions.ts';
import { BALL } from '../equipment/projectile/definitions.ts';
import { BLOCK, SURFACE } from '../equipment/mechanical/frictionDefinitions.ts';
import { MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { KINETIC_EXPERIMENT, kineticBallPoint } from '../equipment/kinetic/simulate.ts';
export function createKineticExperiment(id: string, timestamp: string) {
  const scene = createEmptyScene(id,timestamp), registry=createWorkbenchRegistry();
  scene.experimentId=KINETIC_EXPERIMENT;scene.title='探究物体的动能跟哪些因素有关';scene.viewport={centerXM:.05,centerYM:.13,pixelsPerM:350};
  scene.simulationConfig.gravityMPerS2=9.81;scene.simulationConfig.modelVersions={'mechanical.kinetic':'rolling-impact.v1'};
  scene.curriculumRef={stage:'junior',standard:{title:'义务教育物理课程标准',edition:'2022 年版',topic:'动能与控制变量；具体条目待教师核验',clause:null},textbookMappings:[{publisher:'人民教育出版社',edition:null,volume:null,chapter:null,page:null,status:'pending_teacher_review',reviewedBy:null,reviewedAt:null}]};
  scene.provenance.origin='template';scene.provenance.notes=['按教师提供图片设计，复用五种器材。均质实心球纯滚动、斜槽平滑衔接；碰后球块共同滑行，忽略滚阻，木块承受恒定滑动摩擦。'];
  scene.equipment=[[TRACK,'ramp',-.45,0],[BALL,'ball',0,.15],[BLOCK,'block',.13,0],[SURFACE,'surface',.45,0],[MECHANICAL_RULER,'ruler',-.05,-.09],[MECHANICAL_RULER,'height-ruler',-1.4,.025]].map(([type,key,x,y])=>({id:String(key),type:String(type),definitionVersion:1,pose:{xM:Number(x),yM:Number(y),rotationRad:key==='height-ruler'?Math.PI/2:0},parameters:{...registry.get(String(type),1)!.defaultParameters,...(type===TRACK?{lengthM:1}:type===BALL?{massKg:.05}:type===BLOCK?{massKg:.1,surfaceId:'surface'}:type===SURFACE?{lengthM:2.4,kineticCoefficient:.2}: {lengthM:key==='height-ruler'?.5:1.2})}}));
  const track=scene.equipment[0]!,ball=scene.equipment[1]!;ball.pose={...ball.pose,...kineticBallPoint(track,.15)};
  return scene;
}
