import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { SUPPORT, FORCE_METER, WEIGHT, MECHANICAL_RULER } from '../equipment/mechanical/definitions.ts';
import { PULLEY, PULLEY_EXPERIMENT } from '../equipment/pulley/definitions.ts';
export function createPulleyExperiment(id:string,timestamp:string) {
  const scene=createEmptyScene(id,timestamp),registry=createWorkbenchRegistry();scene.experimentId=PULLEY_EXPERIMENT;scene.title='研究定滑轮和动滑轮的特点';scene.viewport={centerXM:.05,centerYM:.39,pixelsPerM:550};
  scene.simulationConfig.gravityMPerS2=9.81;scene.simulationConfig.modelVersions={'mechanical.pulley':'quasistatic.v1'};scene.provenance.origin='template';scene.provenance.notes=['复用支架、测力计、钩码、独立尺，仅新增一类可作定/动滑轮的器材，附轻绳绳路。三种装配作对照，缓慢提拉、静止读表，手工读两端位移。'];
  scene.curriculumRef={stage:'junior',standard:{title:'义务教育物理课程标准',edition:'2022 年版',topic:'定滑轮、动滑轮与力和距离；具体条目待教师核验',clause:null},textbookMappings:[{publisher:'人民教育出版社',edition:null,volume:null,chapter:null,page:null,status:'pending_teacher_review',reviewedBy:null,reviewedAt:null}]};
  scene.equipment=[[SUPPORT,'support',-.17,0],[PULLEY,'pulley',.01,.61],[FORCE_METER,'meter',.05,.49],[WEIGHT,'load',-.03,.3],[WEIGHT,'load2',-.03,.247],[MECHANICAL_RULER,'load-ruler',-.12,.03],[MECHANICAL_RULER,'pull-ruler',.18,.03]].map(([type,key,x,y])=>({id:String(key),type:String(type),definitionVersion:1,pose:{xM:Number(x),yM:Number(y),rotationRad:type===MECHANICAL_RULER?Math.PI/2:0},parameters:{...registry.get(String(type),1)!.defaultParameters,...(type===SUPPORT?{heightM:.72}:type===PULLEY?{supportId:'support',meterId:'meter',weightId:'load'}:type===FORCE_METER?{rangeN:2,resolutionN:.02}:type===WEIGHT?{massKg:.05,...(key==='load2'?{parentWeightId:'load'}:{})}:{lengthM:.8})}}));return scene;
}
