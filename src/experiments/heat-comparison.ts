import { createEmptyScene } from '../core/scene/create.ts';
import { createWorkbenchRegistry } from '../equipment/registry.ts';
import { BEAKER } from '../equipment/density/definitions.ts';
import { SUPPORT } from '../equipment/mechanical/definitions.ts';
import { TIMER } from '../equipment/projectile/definitions.ts';
import { HEATER, THERMOMETER } from '../equipment/thermal/definitions.ts';
import { HEAT_COMPARISON_EXPERIMENT, HEAT_COMPARISON_MODEL, heatSamples, sampleKeys } from '../equipment/heatComparison/simulate.ts';
export function createHeatComparisonExperiment(id:string,time:string){
  const scene=createEmptyScene(id,time),registry=createWorkbenchRegistry();scene.experimentId=HEAT_COMPARISON_EXPERIMENT;scene.title='比较不同物质吸热的情况';scene.viewport={centerXM:0,centerYM:.1,pixelsPerM:600};scene.simulationConfig.modelVersions={'thermal.heat-comparison':HEAT_COMPARISON_MODEL};scene.provenance.origin='template';scene.provenance.notes=['全部复用已有烧杯、加热装置、温度计、计时器和支架；新实验将加热装置配置为相同规格浸入式电加热器。水和食用油各 100 g，初温 20 ℃，每只 100 W，默认忽略散热与容器热容。'];
  scene.curriculumRef={stage:'junior',standard:{title:'义务教育物理课程标准',edition:'2022 年版',topic:'比较不同物质吸热的情况、控制变量与比热容；条目待教师核验',clause:null},textbookMappings:[{publisher:'人民教育出版社',edition:null,volume:null,chapter:null,page:null,status:'pending_teacher_review',reviewedBy:null,reviewedAt:null}]};
  scene.equipment=sampleKeys.flatMap((key,index)=>{const x=index===0?-.22:.22,sample=heatSamples[key];return [[SUPPORT,'support',x-.16,-.12],[BEAKER,'beaker',x,0],[HEATER,'heater',x+.018,.198],[THERMOMETER,'thermometer',x-.018,.238],[TIMER,'timer',x,-.08]].map(([type,name,px,py])=>({id:`${key}-${name}`,type:String(type),definitionVersion:1,pose:{xM:Number(px),yM:Number(py),rotationRad:0},parameters:{...registry.get(String(type),1)!.defaultParameters,...(type===BEAKER?{liquidM3:.1/sample.density,liquidDensityKgPerM3:sample.density,liquidCode:sample.name}:type===HEATER?{powerW:100,efficiency:1,lossWPerK:0}:type===SUPPORT?{heightM:.418}:type===TIMER?{resolutionS:.1}:{})}}));});return scene;
}
