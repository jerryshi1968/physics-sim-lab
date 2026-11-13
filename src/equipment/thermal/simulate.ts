import type { SceneDocument } from '../../core/scene/schema.ts';
import { BEAKER } from '../density/definitions.ts';
import { TIMER } from '../projectile/definitions.ts';
import { HEATER, THERMOMETER, thermalApparatus } from './definitions.ts';

export const BOILING_K = 373.15, WATER_C = 4200, LATENT_HEAT = 2256000;
export interface ThermalState { timeS: number; temperatureK: number; massKg: number }
export interface ThermalConfig { initialTemperatureK: number; ambientTemperatureK: number; initialMassKg: number; vesselCapacityJPerK: number; powerW: number; efficiency: number; lossWPerK: number }
export function thermalInitial(config: ThermalConfig): ThermalState { return { timeS: 0, temperatureK: config.initialTemperatureK, massKg: config.initialMassKg }; }
export function validThermalConfig(c: ThermalConfig) {
  return Object.values(c).every(Number.isFinite) && c.initialTemperatureK >= 273.15 && c.initialTemperatureK <= BOILING_K && c.ambientTemperatureK >= 273.15 && c.ambientTemperatureK <= 313.15 && c.initialMassKg >= .005 && c.initialMassKg <= .25 && c.vesselCapacityJPerK > 0 && c.powerW >= 0 && c.powerW <= 2000 && c.efficiency >= 0 && c.efficiency <= 1 && c.lossWPerK >= 0 && c.lossWPerK <= 10;
}
export function advanceThermal(state: ThermalState, c: ThermalConfig, heating: boolean, dtS: number): ThermalState {
  if (!validThermalConfig(c) || ![state.timeS, state.temperatureK, state.massKg, dtS].every(Number.isFinite) || dtS < 0 || state.timeS < 0 || state.massKg < 0 || state.massKg > c.initialMassKg + 1e-10 || state.temperatureK < 273.15 || state.temperatureK > BOILING_K + 1e-9) throw new RangeError('INVALID_THERMAL_STATE');
  if (!state.massKg) return { ...state };
  const power = heating ? c.powerW * c.efficiency : 0, capacity = state.massKg * WATER_C + c.vesselCapacityJPerK;
  const netAtBoiling = power - c.lossWPerK * (BOILING_K - c.ambientTemperatureK);
  const temperatureAt = (t: number) => c.lossWPerK === 0 ? state.temperatureK + power * t / capacity : state.temperatureK + (power - c.lossWPerK * (state.temperatureK - c.ambientTemperatureK)) / c.lossWPerK * -Math.expm1(-c.lossWPerK * t / capacity);
  let toBoiling = Infinity;
  if (netAtBoiling > 0) toBoiling = state.temperatureK >= BOILING_K ? 0 : c.lossWPerK === 0 ? capacity * (BOILING_K - state.temperatureK) / power : capacity / c.lossWPerK * Math.log1p(c.lossWPerK * (BOILING_K - state.temperatureK) / netAtBoiling);
  if (dtS <= toBoiling) return { timeS: state.timeS + dtS, temperatureK: Math.min(BOILING_K, temperatureAt(dtS)), massKg: state.massKg };
  const evaporationS = Math.min(dtS - toBoiling, state.massKg * LATENT_HEAT / netAtBoiling);
  return { timeS: state.timeS + toBoiling + evaporationS, temperatureK: BOILING_K, massKg: Math.max(0, state.massKg - netAtBoiling * evaporationS / LATENT_HEAT) };
}
export function thermalRig(scene: SceneDocument) {
  const beakers = scene.equipment.filter(item => item.type === BEAKER), heaters = scene.equipment.filter(item => item.type === HEATER), meters = scene.equipment.filter(item => item.type === THERMOMETER), timers = scene.equipment.filter(item => item.type === TIMER);
  const beaker = beakers[0], heater = heaters[0], meter = meters[0], timer = timers[0];
  const config: ThermalConfig = { initialMassKg: Number(beaker?.parameters.liquidM3) * 1000, vesselCapacityJPerK: Number(beaker?.parameters.tareKg) * 800, powerW: Number(heater?.parameters.powerW), efficiency: Number(heater?.parameters.efficiency), lossWPerK: Number(heater?.parameters.lossWPerK), initialTemperatureK: Number(heater?.parameters.initialTemperatureK), ambientTemperatureK: Number(heater?.parameters.ambientTemperatureK) };
  const ok = beakers.length === 1 && heaters.length === 1 && meters.length <= 1 && timers.length <= 1 && scene.equipment.filter(item => item.type === 'mechanical.support').length <= 1 && scene.equipment.every(item => thermalApparatus.includes(item.type)) && validThermalConfig(config) && beaker?.parameters.liquidDensityKgPerM3 === 1000 && !scene.connections.length;
  const upright = (angle: number) => Math.abs(angle) < 1e-8;
  const contact = !!(ok && beaker && heater && upright(beaker.pose.rotationRad) && upright(heater.pose.rotationRad) && Math.abs(beaker.pose.xM - heater.pose.xM) < .035 && Math.abs(beaker.pose.yM - heater.pose.yM - .02) < .025);
  const signature = JSON.stringify([scene.documentId, beaker?.id, heater?.id, config.initialMassKg, config.vesselCapacityJPerK, config.initialTemperatureK, config.ambientTemperatureK]);
  return { ok, config, beaker, heater, meter: meters.length === 1 ? meter : undefined, timer: timers.length === 1 ? timer : undefined, contact, signature, message: !ok ? '请放置一只盛水烧杯和一套加热装置；水量为 5～250 mL。' : !contact ? '将烧杯底部放在加热装置的网面上。' : '' };
}
export type ThermalRig = ReturnType<typeof thermalRig>;
export function thermalReading(rig: ThermalRig, state: ThermalState) {
  const meter = rig.meter, beaker = rig.beaker;
  if (!rig.ok || !meter || !beaker || !state.massKg) return { ok: false as const, message: !state.massKg ? '水已蒸干，停止加热；请重置。' : '请放置温度计，并将玻璃泡浸入水中。' };
  const angle = meter.pose.rotationRad, tip = { xM: meter.pose.xM + .22 * Math.sin(angle), yM: meter.pose.yM - .22 * Math.cos(angle) }, level = .18 * state.massKg / .25;
  if (Math.abs(beaker.pose.rotationRad) > 1e-8 || Math.abs(tip.xM - beaker.pose.xM) >= .038 || tip.yM <= beaker.pose.yM + .008 || tip.yM >= beaker.pose.yM + level - .006) return { ok: false as const, message: '玻璃泡应浸在水中，不能接触杯底或杯壁。' };
  const resolution = Number(meter.parameters.resolutionK), valueK = 273.15 + Math.round((state.temperatureK - 273.15) / resolution) * resolution;
  return { ok: true as const, valueK, message: '' };
}
