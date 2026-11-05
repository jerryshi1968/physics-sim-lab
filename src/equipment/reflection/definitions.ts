import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';
export const MIRROR='optical.plane-mirror',EMITTER='optical.ray-box',PAPER='optical.folding-paper',PROTRACTOR='optical.protractor',NORMAL='optical.normal-marker';
export const REFLECTION_EXPERIMENT='J-OPT-01',reflectionTypes=[PAPER,PROTRACTOR,MIRROR,NORMAL,EMITTER];
export const reflectionFields:Record<string,readonly ParameterField[]>={
  [MIRROR]:[{key:'lengthM',label:'镜面长度',unit:'m',kind:'number'}],
  [EMITTER]:[{key:'enabled',label:'打开光源',unit:'',kind:'boolean'},{key:'rangeM',label:'光线传播上限',unit:'m',kind:'number'}],
  [PAPER]:[{key:'halfWidthM',label:'单侧纸板宽度',unit:'m',kind:'number'},{key:'heightM',label:'纸板高度',unit:'m',kind:'number'}],
  [PROTRACTOR]:[{key:'radiusM',label:'量角器半径',unit:'m',kind:'number'}],
  [NORMAL]:[{key:'lengthM',label:'法线标记长度',unit:'m',kind:'number'}],
};
export function registerReflectionEquipment(registry:EquipmentRegistry){
  const items=[
    {type:MIRROR,label:'平面镜',defaults:{lengthM:.9},schema:z.strictObject({lengthM:FiniteSchema.min(.1).max(1.5)})},
    {type:EMITTER,label:'窄光束光源',defaults:{enabled:true,rangeM:2},schema:z.strictObject({enabled:z.boolean(),rangeM:FiniteSchema.min(.2).max(5)})},
    {type:PAPER,label:'可折承接纸板',defaults:{halfWidthM:.46,heightM:.6,foldRad:0},schema:z.strictObject({halfWidthM:FiniteSchema.min(.1).max(1),heightM:FiniteSchema.min(.1).max(1.2),foldRad:FiniteSchema.min(-Math.PI/2).max(Math.PI/2)})},
    {type:PROTRACTOR,label:'半圆量角器',defaults:{radiusM:.36},schema:z.strictObject({radiusM:FiniteSchema.min(.05).max(.8)})},
    {type:NORMAL,label:'法线标记',defaults:{lengthM:.55},schema:z.strictObject({lengthM:FiniteSchema.min(.1).max(1)})},
  ];
  for(const item of items){const parameterSchemaId=`${item.type}.parameters.v1`;registry.registerParameterSchema(parameterSchemaId,item.schema);registry.register({type:item.type,definitionVersion:1,domain:'optical',label:item.label,ports:[],parameterSchemaId,defaultParameters:item.defaults,modelAdapterId:`${item.type}.reflection.v1`,viewId:`${item.type}.physical.v1`});}
}
