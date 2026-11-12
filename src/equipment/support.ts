import type { SceneDocument } from '../core/scene/schema.ts';
import { POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT, WIRE } from './electrical/definitions.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from './optical/definitions.ts';
import { reflectionTypes } from './reflection/definitions.ts';
import { mirrorImageApparatus, mirrorImageTypes } from './mirrorImage/definitions.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from './mechanical/definitions.ts';
import { frictionTypes, BLOCK, LOAD } from './mechanical/frictionDefinitions.ts';
import { PENDULUM } from './pendulum/definitions.ts';
import { SPRING } from './spring/definitions.ts';
import { projectileTypes, LAUNCHER, BALL, TIMER, GROUND } from './projectile/definitions.ts';
import { densityTypes, BALANCE, CYLINDER, MASS_SET, BEAKER } from './density/definitions.ts';
import { cartTypes, CART, TRACK, GATE, TICKER } from './cart/definitions.ts';
import { buoyancyApparatus, buoyancyTypes, BODY, OVERFLOW } from './buoyancy/definitions.ts';

export const electricalApparatus = [POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT, WIRE];
export const opticalApparatus = [BENCH, CANDLE, LENS, SCREEN, RULER];
export const leverApparatus = [LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER];
export const frictionApparatus = [...frictionTypes, FORCE_METER, MECHANICAL_RULER];
export const springApparatus = [SPRING, SUPPORT, WEIGHT, MECHANICAL_RULER];
export const FREE_OPTICAL_EXPERIMENT = 'J-OPT-FREE';
export const JUNIOR_ELECTRICAL_EXPERIMENT = 'J-ELEC-FREE';
export const SENIOR_ELECTRICAL_EXPERIMENT = 'H-ELEC-FREE';

export interface EquipmentSupport {
  key: string;
  label: string;
  experimentIds: readonly string[];
  types: readonly string[];
  maximum: Readonly<Record<string, number>>;
}
const oneEach = (types: readonly string[]) => Object.fromEntries(types.map(type => [type, 1]));
export const equipmentSupports: readonly EquipmentSupport[] = [
  { key: 'ohm', label: '电流与电压、电阻的关系', experimentIds: ['J-ELEC-02'], types: [POWER, RESISTOR, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'emf', label: '电源电动势与内阻', experimentIds: ['H-ELEC-01'], types: [POWER, RESISTOR, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'electrical', label: '电路实验', experimentIds: ['J-ELEC-01', JUNIOR_ELECTRICAL_EXPERIMENT, SENIOR_ELECTRICAL_EXPERIMENT], types: electricalApparatus, maximum: {} },
  { key: 'optical', label: '凸透镜成像', experimentIds: ['J-OPT-02'], types: opticalApparatus, maximum: oneEach([BENCH, CANDLE, LENS, SCREEN]) },
  { key: 'reflection', label: '光的反射定律', experimentIds: ['J-OPT-01'], types: reflectionTypes, maximum: oneEach(reflectionTypes) },
  { key: 'mirrorImage', label: '平面镜成像', experimentIds: ['J-OPT-03'], types: mirrorImageApparatus, maximum: oneEach(mirrorImageApparatus.filter(type => type !== RULER)) },
  { key: 'lever', label: '杠杆平衡', experimentIds: ['J-MECH-02'], types: leverApparatus, maximum: oneEach([LEVER]) },
  { key: 'friction', label: '滑动摩擦力', experimentIds: ['J-MECH-01'], types: frictionApparatus, maximum: oneEach([BLOCK]) },
  { key: 'pendulum', label: '单摆测 g', experimentIds: ['H-MECH-04'], types: [PENDULUM, SUPPORT, MECHANICAL_RULER, TIMER], maximum: oneEach([PENDULUM, SUPPORT, TIMER]) },
  { key: 'spring', label: '弹簧弹力', experimentIds: ['H-MECH-01'], types: springApparatus, maximum: oneEach([SPRING]) },
  { key: 'projectile', label: '平抛运动', experimentIds: ['H-MECH-02'], types: projectileTypes, maximum: oneEach([LAUNCHER, BALL, TIMER, GROUND]) },
  { key: 'density', label: '密度测量', experimentIds: ['J-MEAS-01', 'J-MEAS-01-L'], types: densityTypes, maximum: oneEach(densityTypes) },
  { key: 'cart', label: '加速度与力、质量', experimentIds: ['H-MECH-03'], types: cartTypes, maximum: { ...oneEach([CART, TRACK, TICKER]), [GATE]: 6 } },
  { key: 'buoyancy', label: '浮力', experimentIds: ['J-MECH-03'], types: buoyancyApparatus, maximum: oneEach([SUPPORT, FORCE_METER, BODY, OVERFLOW, BALANCE, CYLINDER, MASS_SET]) },
];

export function equipmentSupport(scene: Pick<SceneDocument, 'experimentId' | 'equipment' | 'connections'>): EquipmentSupport | null {
  if (scene.experimentId === FREE_OPTICAL_EXPERIMENT) return freeOpticalSupport(scene);
  const formal = equipmentSupports.find(profile => profile.experimentIds.includes(scene.experimentId ?? ''));
  if (formal) return formal;
  const has = (types: readonly string[]) => scene.equipment.some(item => types.includes(item.type));
  const key = has(buoyancyTypes) ? 'buoyancy' : has(mirrorImageTypes) ? 'mirrorImage' : has(reflectionTypes) ? 'reflection'
    : has([PENDULUM]) ? 'pendulum' : has(densityTypes) ? 'density' : has(cartTypes) ? 'cart' : has([SPRING]) ? 'spring' : has(projectileTypes) ? 'projectile'
    : has(frictionTypes) ? 'friction' : scene.equipment.some(item => item.type.startsWith('mechanical.')) ? 'lever'
    : scene.equipment.some(item => item.type.startsWith('optical.')) ? 'optical' : scene.equipment.length || scene.connections.length ? 'electrical' : null;
  return equipmentSupports.find(profile => profile.key === key) ?? null;
}

export function freeOpticalSupport(scene: Pick<SceneDocument, 'equipment' | 'connections'>): EquipmentSupport {
  const candidates = equipmentSupports.filter(profile => ['optical', 'reflection', 'mirrorImage'].includes(profile.key))
    .filter(profile => !scene.connections.length && scene.equipment.every(item => item.type === RULER || profile.types.includes(item.type)));
  if (candidates.length === 1) {
    const profile = candidates[0]!;
    return profile.types.includes(RULER) ? profile : { ...profile, types: [...profile.types, RULER] };
  }
  const types = [...new Set(candidates.flatMap(profile => [...profile.types, RULER]))];
  return { key: 'opticalFree', label: candidates.length ? '光学自由搭建' : '光学自由搭建（器材互斥）', experimentIds: [FREE_OPTICAL_EXPERIMENT], types,
    maximum: oneEach(types.filter(type => type !== RULER)) };
}

export function equipmentAvailability(scene: Pick<SceneDocument, 'experimentId' | 'equipment' | 'connections'>, type: string) {
  const profile = equipmentSupport(scene);
  if (!equipmentSupports.some(item => item.types.includes(type))) return { enabled: false, reason: '未注册的器材。' };
  if (profile && !profile.types.includes(type)) return { enabled: false, reason: `“${profile.label}”暂不支持此器材。` };
  const maximum = profile?.maximum[type];
  if (maximum !== undefined && scene.equipment.filter(item => item.type === type).length >= maximum) return { enabled: false, reason: `本实验最多放置 ${maximum} 件，已达上限。` };
  return { enabled: true, reason: '' };
}

export function equipmentUsage(type: string) {
  return ({ [PENDULUM]: '悬点到球心的摆长，多周期计时', [SPRING]: '测量弹簧伸长量', [FORCE_METER]: '带刻度的力测量器材', [WEIGHT]: '悬挂加载，可串接',
    [LOAD]: '放在木块上增加压力', [MASS_SET]: '用于天平称量', [BEAKER]: '可用于待测、盛液或接液',
    [CART]: '配重与悬挂质量在属性中设置', [WIRE]: '可拖动线头与弯曲' } as Record<string, string>)[type] ?? '实验器材';
}
