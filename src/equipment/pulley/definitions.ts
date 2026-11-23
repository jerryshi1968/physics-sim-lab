import { z } from 'zod';
import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import { SUPPORT, FORCE_METER, WEIGHT, MECHANICAL_RULER } from '../mechanical/definitions.ts';
import type { ParameterField } from '../electrical/definitions.ts';
export const PULLEY = 'mechanical.pulley', PULLEY_EXPERIMENT = 'J-MECH-08', PULLEY_MODEL = 'mechanical.pulley.quasistatic.v1';
export const EFFICIENCY_EXPERIMENT = 'J-MECH-09', EFFICIENCY_MODEL = 'mechanical.pulley.efficiency.v2';
export const EFFICIENCY_LEGACY_MODEL = 'mechanical.pulley.efficiency.v1';
export const pulleyWheelScale = (item:EquipmentInstance) => item.parameters.mode==='fixed'&&item.parameters.ropeEnd==='moving'?.5:1;
export const pulleyApparatus = [PULLEY, SUPPORT, FORCE_METER, WEIGHT, MECHANICAL_RULER];
export const pulleyModes = { direct: '直接提起', fixed: '定滑轮', movable: '动滑轮', tackle: '滑轮组' } as const;
export type PulleyMode = keyof typeof pulleyModes;
export const pulleyFields: Record<string, readonly ParameterField[]> = {
  [PULLEY]: [{ key: 'massKg', label: '滑轮质量（0 为理想轻滑轮）', unit: 'kg', kind: 'number', min: 0, max: .2, step: .01 }],
  [SUPPORT]: [{ key: 'heightM', label: '支架高度', unit: 'm', kind: 'number' }, { key: 'capacityN', label: '支架承载上限', unit: 'N', kind: 'number' }],
  [FORCE_METER]: [{ key: 'rangeN', label: '测力计量程', unit: 'N', kind: 'number' }, { key: 'resolutionN', label: '测力计分度值', unit: 'N', kind: 'number' }],
  [WEIGHT]: [{ key: 'massKg', label: '钩码质量', unit: 'kg', kind: 'number' }],
  [MECHANICAL_RULER]: [{ key: 'lengthM', label: '刻度尺长度', unit: 'm', kind: 'number' }],
};
export function registerPulleyEquipment(registry:EquipmentRegistry) {
  const parameterSchemaId=`${PULLEY}.parameters.v1`,id=z.string().max(80);
  registry.registerParameterSchema(parameterSchemaId,z.strictObject({mode:z.enum(['direct','fixed','movable','tackle']),massKg:FiniteSchema.min(0).max(.2),pullM:FiniteSchema.min(0).max(.2),supportId:id,meterId:id,weightId:id,fixedPulleyId:id.optional(),ropeEnd:z.enum(['stand','moving']).optional()}).transform((value:Record<string,Scalar|undefined>)=>Object.fromEntries(Object.entries(value).filter((entry):entry is [string,Scalar]=>entry[1]!==undefined))));
  registry.register({type:PULLEY,definitionVersion:1,domain:'mechanical',label:'滑轮（定/动）',ports:[],parameterSchemaId,defaultParameters:{mode:'fixed',massKg:0,pullM:0,supportId:'',meterId:'',weightId:''},modelAdapterId:PULLEY_MODEL,viewId:`${PULLEY}.physical.v1`});
}
