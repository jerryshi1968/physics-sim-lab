import { z } from 'zod';
import { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentDefinition } from '../../core/equipment/schema.ts';
import { LampParametersSchema } from '../../core/electrical/lamp.ts';
import { AmmeterParametersSchema, VoltmeterParametersSchema } from '../../core/electrical/instruments.ts';
import { RheostatParametersSchema } from '../../core/electrical/rheostat.ts';

export const POWER = 'electrical.power-supply';
export const RESISTOR = 'electrical.resistor';
export const SWITCH = 'electrical.switch';
export const JUNCTION = 'electrical.junction';
export const WIRE = 'electrical.wire';
export const LAMP = 'electrical.lamp';
export const AMMETER = 'electrical.ammeter';
export const VOLTMETER = 'electrical.voltmeter';
export const RHEOSTAT = 'electrical.rheostat';

export interface ParameterField { key: string; label: string; unit: string; kind: 'number' | 'boolean' }
export const parameterFields: Record<string, readonly ParameterField[]> = {
  [POWER]: [{ key: 'voltageV', label: '电源电压', unit: 'V', kind: 'number' }],
  [RESISTOR]: [{ key: 'resistanceOhm', label: '电阻', unit: 'Ω', kind: 'number' }],
  [SWITCH]: [{ key: 'closed', label: '闭合开关', unit: '', kind: 'boolean' }],
  [JUNCTION]: [],
  [RHEOSTAT]: [{ key: 'maxResistanceOhm', label: '最大电阻', unit: 'Ω', kind: 'number' }, { key: 'position', label: '滑片位置', unit: '0～1', kind: 'number' }],
  [LAMP]: [{ key: 'ratedVoltageV', label: '额定电压', unit: 'V', kind: 'number' }, { key: 'ratedCurrentA', label: '额定电流', unit: 'A', kind: 'number' },
    { key: 'coldResistanceOhm', label: '冷态电阻', unit: 'Ω', kind: 'number' }, { key: 'maxCurrentA', label: '模型电流上限', unit: 'A', kind: 'number' }],
  [AMMETER]: [{ key: 'lowRange', label: '小量程上限', unit: 'A', kind: 'number' }, { key: 'highRange', label: '大量程上限', unit: 'A', kind: 'number' },
    { key: 'lowResolution', label: '小量程分度值', unit: 'A', kind: 'number' }, { key: 'highResolution', label: '大量程分度值', unit: 'A', kind: 'number' }, { key: 'resistanceOhm', label: '电流表内阻', unit: 'Ω', kind: 'number' }],
  [VOLTMETER]: [{ key: 'lowRange', label: '小量程上限', unit: 'V', kind: 'number' }, { key: 'highRange', label: '大量程上限', unit: 'V', kind: 'number' },
    { key: 'lowResolution', label: '小量程分度值', unit: 'V', kind: 'number' }, { key: 'highResolution', label: '大量程分度值', unit: 'V', kind: 'number' },
    { key: 'finiteInput', label: '启用有限输入电阻', unit: '', kind: 'boolean' }, { key: 'inputResistanceOhm', label: '输入电阻', unit: 'Ω', kind: 'number' }],
};

export function portLabel(id: string): string {
  return ({ positive: '正极 +', negative: '负极 −', a: '端点 A', b: '端点 B', c: '上端 C', d: '上端 D', node: '结点', common: '公共负端 −', low: '小量程 +', high: '大量程 +' } as Record<string, string>)[id] ?? id;
}

export function createElectricalRegistry(): EquipmentRegistry {
  const registry = new EquipmentRegistry();
  const descriptions = [
    { type: POWER, label: '电源', schema: z.strictObject({ voltageV: FiniteSchema.nonnegative() }), defaults: { voltageV: 3 }, ports: ['positive', 'negative'] },
    { type: RESISTOR, label: '电阻', schema: z.strictObject({ resistanceOhm: FiniteSchema.positive() }), defaults: { resistanceOhm: 10 }, ports: ['a', 'b'] },
    { type: SWITCH, label: '开关', schema: z.strictObject({ closed: z.boolean() }), defaults: { closed: false }, ports: ['a', 'b'] },
    { type: JUNCTION, label: '显式结点', schema: z.strictObject({}), defaults: {}, ports: ['node'] },
  ];
  for (const item of descriptions) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    const definition: EquipmentDefinition = {
      type: item.type, definitionVersion: 1, label: item.label, domain: 'electrical',
      ports: item.ports.map((id, index) => ({ id, kind: 'electrical-terminal',
        localPositionM: { x: item.ports.length === 1 ? 0 : index === 0 ? -0.075 : 0.075, y: 0 } })),
      parameterSchemaId, modelAdapterId: `${item.type}.uncompiled.v1`, viewId: `${item.type}.svg.v1`,
      defaultParameters: item.defaults,
    };
    registry.register(definition);
  }
  const extra = [
    { type: LAMP, label: '小灯泡', schema: LampParametersSchema, defaults: { ratedVoltageV: 3, ratedCurrentA: .3, coldResistanceOhm: 2, maxCurrentA: .9 } },
    { type: AMMETER, label: '电流表', schema: AmmeterParametersSchema, defaults: { lowRange: .6, highRange: 3, lowResolution: .02, highResolution: .1, resistanceOhm: 0 } },
    { type: VOLTMETER, label: '电压表', schema: VoltmeterParametersSchema, defaults: { lowRange: 3, highRange: 15, lowResolution: .1, highResolution: .5, finiteInput: false, inputResistanceOhm: 1_000_000 } },
  ];
  for (const item of extra) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, label: item.label, domain: 'electrical', parameterSchemaId,
      modelAdapterId: `${item.type}.dc.v1`, viewId: `${item.type}.physical.v1`, defaultParameters: item.defaults,
      ports: (item.type === LAMP ? ['a', 'b'] : ['common', 'low', 'high']).map((id, index) => ({ id, kind: 'electrical-terminal',
        localPositionM: item.type === LAMP ? { x: index === 0 ? -.075 : .075, y: 0 } : { x: (index - 1) * .065, y: -.046 } })) });
  }
  registry.registerParameterSchema(`${RHEOSTAT}.parameters.v1`, RheostatParametersSchema);
  registry.register({ type: RHEOSTAT, definitionVersion: 1, label: '四柱滑动变阻器', domain: 'electrical',
    parameterSchemaId: `${RHEOSTAT}.parameters.v1`, modelAdapterId: `${RHEOSTAT}.dc.v1`, viewId: `${RHEOSTAT}.physical.v1`,
    defaultParameters: { maxResistanceOhm: 20, position: .5 },
    ports: ['a', 'b', 'c', 'd'].map((id, index) => ({ id, kind: 'electrical-terminal',
      localPositionM: { x: index % 2 === 0 ? -.075 : .075, y: index < 2 ? -.032 : .04 } })) });
  return registry;
}
