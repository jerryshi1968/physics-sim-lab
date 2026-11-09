import { z } from 'zod';
import { FiniteSchema } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../electrical/definitions.ts';

export const CART_EXPERIMENT = 'H-MECH-03';
export const CART = 'mechanical.cart';
export const TRACK = 'mechanical.cart-track';
export const GATE = 'mechanical.cart-photogate';
export const TICKER = 'mechanical.cart-ticker';
export const cartTypes = [CART, TRACK, GATE, TICKER];
export const cartHalfLengthM = .11;

export const cartFields: Record<string, readonly ParameterField[]> = {
  [CART]: [
    { key: 'cartMassKg', label: '小车质量', unit: 'kg', kind: 'number' },
    { key: 'loadMassKg', label: '车上配重质量', unit: 'kg', kind: 'number' },
    { key: 'hangerMassKg', label: '悬挂总质量（含挂钩）', unit: 'kg', kind: 'number' },
    { key: 'flagWidthM', label: '挡光片长度', unit: 'm', kind: 'number' },
  ],
  [TRACK]: [
    { key: 'lengthM', label: '轨道长度', unit: 'm', kind: 'number' },
    { key: 'dropLimitM', label: '悬挂砝码可下落距离', unit: 'm', kind: 'number' },
  ],
  [TICKER]: [{ key: 'frequencyHz', label: '打点频率（50 或 60）', unit: 'Hz', kind: 'number' }],
};

export function registerCartEquipment(registry: EquipmentRegistry) {
  const items = [
    { type: CART, label: '动力学小车', defaults: { cartMassKg: .35, loadMassKg: .1, hangerMassKg: .05, flagWidthM: .04 }, schema: z.strictObject({
      cartMassKg: FiniteSchema.min(.05).max(5), loadMassKg: FiniteSchema.min(0).max(5), hangerMassKg: FiniteSchema.min(0).max(1), flagWidthM: FiniteSchema.min(.005).max(.12),
    }) },
    { type: TRACK, label: '水平轨道（带定滑轮）', defaults: { lengthM: 1.8, dropLimitM: 1.4 }, schema: z.strictObject({
      lengthM: FiniteSchema.min(.6).max(4), dropLimitM: FiniteSchema.min(.05).max(2),
    }) },
    { type: GATE, label: '光电门', defaults: {}, schema: z.strictObject({}) },
    { type: TICKER, label: '打点计时器', defaults: { frequencyHz: 50 }, schema: z.strictObject({ frequencyHz: z.union([z.literal(50), z.literal(60)]) }) },
  ];
  for (const item of items) {
    const parameterSchemaId = `${item.type}.parameters.v1`;
    registry.registerParameterSchema(parameterSchemaId, item.schema);
    registry.register({ type: item.type, definitionVersion: 1, domain: 'mechanical', label: item.label, ports: [], parameterSchemaId,
      defaultParameters: item.defaults, modelAdapterId: 'mechanical.cart.analytic.v1', viewId: `${item.type}.physical.v1` });
  }
}
