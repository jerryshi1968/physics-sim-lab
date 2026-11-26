import { GALVANOMETER, MAGNET, INDUCTION_EXPERIMENT } from './induction/definitions.ts';
import { CONDUCTOR_EXPERIMENT, METAL_WIRE } from './electrical/conductor.ts';
import { PARALLEL_CURRENT_EXPERIMENT, parallelCurrentSetup } from '../experiments/parallel-current.ts';
import { SERIES_CURRENT_EXPERIMENT, seriesCurrentSetup } from '../experiments/series-current.ts';
import { HEAT_COMPARISON_EXPERIMENT, heatComparisonApparatus } from './heatComparison/simulate.ts';
import { PULLEY, PULLEY_EXPERIMENT, EFFICIENCY_EXPERIMENT, pulleyApparatus } from './pulley/definitions.ts';
import { KINETIC_EXPERIMENT, kineticApparatus } from './kinetic/simulate.ts';
import { TWO_FORCE_EXPERIMENT, twoForceApparatus } from './twoForce/simulate.ts';
import { GRAVITY_EXPERIMENT, gravityApparatus } from './gravity/simulate.ts';
import type { SceneDocument } from '../core/scene/schema.ts';
import { MASS_VOLUME_EXPERIMENT, massVolumeApparatus } from './massVolume/simulate.ts';
import { MASS_EXPERIMENT, massApparatus } from './mass/simulate.ts';
import { POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT, WIRE } from './electrical/definitions.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from './optical/definitions.ts';
import { REFRACTION_EXPERIMENT, TANK, refractionApparatus } from './refraction/definitions.ts';
import { PROTRACTOR } from './reflection/definitions.ts';
import { reflectionTypes } from './reflection/definitions.ts';
import { mirrorImageApparatus, mirrorImageTypes } from './mirrorImage/definitions.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, MECHANICAL_RULER } from './mechanical/definitions.ts';
import { frictionTypes, BLOCK, LOAD } from './mechanical/frictionDefinitions.ts';
import { PENDULUM } from './pendulum/definitions.ts';
import { SPRING } from './spring/definitions.ts';
import { projectileTypes, LAUNCHER, BALL, TIMER, GROUND } from './projectile/definitions.ts';
import { densityTypes, BALANCE, CYLINDER, MASS_SET, BEAKER } from './density/definitions.ts';
import { CART_VELOCITY_EXPERIMENT, cartVelocityTypes } from './cartVelocity/definitions.ts';
import { TAPE_SPEED_EXPERIMENT } from './tapeSpeed/model.ts';
import { TICKER_EXPERIMENT, tickerTypes } from './ticker/simulate.ts';
import { cartTypes, CART, TRACK, GATE, TICKER } from './cart/definitions.ts';
import { buoyancyApparatus, buoyancyTypes, BODY, OVERFLOW } from './buoyancy/definitions.ts';

import { MELTING_EXPERIMENT, TUBE, meltingApparatus } from './melting/definitions.ts';
import { BOILING_EXPERIMENT, thermalApparatus, HEATER, THERMOMETER } from './thermal/definitions.ts';

import { AVERAGE_SPEED_EXPERIMENT, averageSpeedApparatus, STOP } from './averageSpeed/definitions.ts';

export const electricalApparatus = [METAL_WIRE, POWER, RESISTOR, SWITCH, JUNCTION, LAMP, AMMETER, VOLTMETER, RHEOSTAT, WIRE];
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
  { key: 'ticker', label: '小车速度随时间变化', experimentIds: [CART_VELOCITY_EXPERIMENT], types: cartVelocityTypes, maximum: oneEach(cartVelocityTypes) },
  { key: 'ticker', label: '练习使用打点计时器', experimentIds: [TICKER_EXPERIMENT, TAPE_SPEED_EXPERIMENT], types: tickerTypes, maximum: oneEach(tickerTypes) },
  { key: 'induction', label: '磁生电', experimentIds: [INDUCTION_EXPERIMENT], types: [MAGNET, GALVANOMETER, METAL_WIRE, SWITCH, WIRE], maximum: oneEach([MAGNET, GALVANOMETER, METAL_WIRE, SWITCH]) },
  { key: 'conductor', label: '导体电阻因素', experimentIds: [CONDUCTOR_EXPERIMENT], types: [POWER, SWITCH, AMMETER, METAL_WIRE, HEATER, THERMOMETER, WIRE], maximum: oneEach([POWER, SWITCH, AMMETER, METAL_WIRE, HEATER, THERMOMETER]) },
  { key: 'parallelCurrent', label: '并联电流关系', experimentIds: [PARALLEL_CURRENT_EXPERIMENT], types: [POWER, SWITCH, LAMP, AMMETER, WIRE], maximum: { [POWER]: 1, [SWITCH]: 1, [LAMP]: 2, [AMMETER]: 1 } },
  { key: 'seriesCurrent', label: '串联电流关系', experimentIds: [SERIES_CURRENT_EXPERIMENT], types: [POWER, SWITCH, LAMP, AMMETER, WIRE], maximum: { [POWER]: 1, [SWITCH]: 1, [LAMP]: 2, [AMMETER]: 1 } },
  { key: 'heatComparison', label: '不同物质吸热比较', experimentIds: [HEAT_COMPARISON_EXPERIMENT], types: heatComparisonApparatus, maximum: Object.fromEntries(heatComparisonApparatus.map(type => [type, 2])) },
  { key: 'pulley', label: '滑轮组机械效率', experimentIds: [EFFICIENCY_EXPERIMENT], types: pulleyApparatus, maximum: { [PULLEY]: 2, [SUPPORT]: 1, [FORCE_METER]: 1, [WEIGHT]: 6, [MECHANICAL_RULER]: 2 } },
  { key: 'pulley', label: '定滑轮和动滑轮', experimentIds: [PULLEY_EXPERIMENT], types: pulleyApparatus, maximum: { [PULLEY]: 1, [SUPPORT]: 1, [FORCE_METER]: 1, [WEIGHT]: 6, [MECHANICAL_RULER]: 2 } },
  { key: 'pulley', label: '滑轮组机械效率', experimentIds: [EFFICIENCY_EXPERIMENT], types: pulleyApparatus, maximum: { [PULLEY]: 2, [SUPPORT]: 1, [FORCE_METER]: 1, [WEIGHT]: 6, [MECHANICAL_RULER]: 2 } },
  { key: 'kinetic', label: '动能影响因素', experimentIds: [KINETIC_EXPERIMENT], types: kineticApparatus, maximum: { ...oneEach(kineticApparatus), [MECHANICAL_RULER]: 2 } },
  { key: 'twoForce', label: '二力平衡', experimentIds: [TWO_FORCE_EXPERIMENT], types: twoForceApparatus, maximum: { [CART]: 1, [TRACK]: 1, [WEIGHT]: 6 } },
  { key: 'gravity', label: '重力与质量', experimentIds: [GRAVITY_EXPERIMENT], types: gravityApparatus, maximum: { [SUPPORT]: 1, [FORCE_METER]: 1, [WEIGHT]: 6 } },
  { key: 'massVolume', label: '同种物质质量与体积', experimentIds: [MASS_VOLUME_EXPERIMENT], types: massVolumeApparatus, maximum: oneEach(massVolumeApparatus) },
  { key: 'mass', label: '天平测质量', experimentIds: [MASS_EXPERIMENT], types: massApparatus, maximum: oneEach(massApparatus) },
  { key: 'averageSpeed', label: '测量平均速度', experimentIds: [AVERAGE_SPEED_EXPERIMENT], types: averageSpeedApparatus, maximum: oneEach(averageSpeedApparatus) },
  { key: 'melting', label: '固体熔化', experimentIds: [MELTING_EXPERIMENT], types: meltingApparatus, maximum: oneEach(meltingApparatus) },
  { key: 'boiling', label: '水沸腾', experimentIds: [BOILING_EXPERIMENT], types: thermalApparatus, maximum: oneEach(thermalApparatus) },
  { key: 'lampPower', label: '小灯泡电功率', experimentIds: ['J-ELEC-04'], types: [POWER, LAMP, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, LAMP, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'voltammetry', label: '伏安法测量定值电阻', experimentIds: ['J-ELEC-03'], types: [POWER, RESISTOR, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'ohm', label: '电流与电压、电阻的关系', experimentIds: ['J-ELEC-02'], types: [POWER, RESISTOR, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'emf', label: '电源电动势与内阻', experimentIds: ['H-ELEC-01'], types: [POWER, RESISTOR, SWITCH, JUNCTION, AMMETER, VOLTMETER, RHEOSTAT, WIRE], maximum: oneEach([POWER, SWITCH, AMMETER, VOLTMETER, RHEOSTAT]) },
  { key: 'electrical', label: '电路实验', experimentIds: ['J-ELEC-01', JUNIOR_ELECTRICAL_EXPERIMENT, SENIOR_ELECTRICAL_EXPERIMENT], types: electricalApparatus, maximum: {} },
  { key: 'optical', label: '凸透镜成像', experimentIds: ['J-OPT-02'], types: opticalApparatus, maximum: oneEach([BENCH, CANDLE, LENS, SCREEN]) },
  { key: 'refraction', label: '光折射特点', experimentIds: [REFRACTION_EXPERIMENT], types: refractionApparatus, maximum: { ...oneEach([TANK, 'optical.ray-box', 'optical.normal-marker']), [PROTRACTOR]: 2 } },
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
  if (scene.experimentId === 'J-ELEC-01' && parallelCurrentSetup(scene).position) return equipmentSupports.find(profile => profile.key === 'parallelCurrent')!;
  if (scene.experimentId === FREE_OPTICAL_EXPERIMENT) return freeOpticalSupport(scene);
  if (scene.experimentId === 'J-ELEC-01' && seriesCurrentSetup(scene).position) return equipmentSupports.find(profile => profile.key === 'seriesCurrent')!;
  const formal = equipmentSupports.find(profile => profile.experimentIds.includes(scene.experimentId ?? ''));
  if (formal) return scene.experimentId === TAPE_SPEED_EXPERIMENT ? { ...formal, label: '纸带平均速度与瞬时速度测量' } : formal;
  const has = (types: readonly string[]) => scene.equipment.some(item => types.includes(item.type));
  const key = has([PULLEY]) ? 'pulley' : has([TANK]) ? 'refraction' : has([TUBE]) ? 'melting' : has([STOP]) ? 'averageSpeed' : has([HEATER, THERMOMETER]) ? 'boiling' : has(buoyancyTypes) ? 'buoyancy' : has(mirrorImageTypes) ? 'mirrorImage' : has(reflectionTypes) ? 'reflection'
    : has([PENDULUM]) ? 'pendulum' : has(densityTypes) ? 'density' : has(cartTypes) ? 'cart' : has([SPRING]) ? 'spring' : has(projectileTypes) ? 'projectile'
    : has(frictionTypes) ? 'friction' : scene.equipment.some(item => item.type.startsWith('mechanical.')) ? 'lever'
    : scene.equipment.some(item => item.type.startsWith('optical.')) ? 'optical' : scene.equipment.length || scene.connections.length ? 'electrical' : null;
  return equipmentSupports.find(profile => profile.key === key) ?? null;
}

export function freeOpticalSupport(scene: Pick<SceneDocument, 'equipment' | 'connections'>): EquipmentSupport {
  const candidates = equipmentSupports.filter(profile => ['optical', 'reflection', 'mirrorImage', 'refraction'].includes(profile.key))
    .filter(profile => !scene.connections.length && scene.equipment.every(item => item.type === RULER || profile.types.includes(item.type)) && Object.entries(profile.maximum).every(([type, maximum]) => scene.equipment.filter(item => item.type === type).length <= maximum));
  if (candidates.length === 1) {
    const profile = candidates[0]!;
    return profile.types.includes(RULER) ? profile : { ...profile, types: [...profile.types, RULER] };
  }
  const types = [...new Set(candidates.flatMap(profile => [...profile.types, RULER]))];
  return { key: 'opticalFree', label: candidates.length ? '光学自由搭建' : '光学自由搭建（器材互斥）', experimentIds: [FREE_OPTICAL_EXPERIMENT], types,
    maximum: { ...oneEach(types.filter(type => type !== RULER)), ...(candidates.some(profile => profile.key === 'refraction') ? { [PROTRACTOR]: 2 } : {}) } };
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
