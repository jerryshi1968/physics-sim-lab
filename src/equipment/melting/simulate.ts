import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { thermalRig, WATER_C, LATENT_HEAT, BOILING_K } from '../thermal/simulate.ts';
import type { ThermalConfig } from '../thermal/simulate.ts';
import { TUBE, meltingApparatus, meltingMaterials } from './definitions.ts';
import type { MeltingMaterial } from './definitions.ts';
export const MELTING_MODEL = 'thermal.melting.enthalpy.v1', MELTING_STEP_S = .1;
export interface MeltingConfig { bath: ThermalConfig; material: MeltingMaterial; sampleMassKg: number; sampleInitialK: number; transferWPerK: number }
export interface MeltingState { timeS: number; carryS: number; bathK: number; waterKg: number; sampleJ: number }
const tubeCapacity = 6, sampleLoss = .03;
function boundaries(c: MeltingConfig) {
  const m = meltingMaterials[c.material], solidCapacity = c.sampleMassKg * m.solidC + tubeCapacity, liquidCapacity = c.sampleMassKg * m.liquidC + tubeCapacity;
  const lowerJ = solidCapacity * (m.startK - 273.15), upperJ = lowerJ + c.sampleMassKg * m.latent + (m.endK - m.startK) * (c.sampleMassKg * (m.solidC + m.liquidC) / 2 + tubeCapacity);
  return { m, solidCapacity, liquidCapacity, lowerJ, upperJ };
}
export function meltingPhase(c: MeltingConfig, energyJ: number) {
  const b = boundaries(c);
  if (energyJ < b.lowerJ) return { temperatureK: 273.15 + energyJ / b.solidCapacity, fraction: 0 };
  if (energyJ <= b.upperJ) { const fraction = (energyJ - b.lowerJ) / (b.upperJ - b.lowerJ); return { temperatureK: b.m.startK + fraction * (b.m.endK - b.m.startK), fraction }; }
  return { temperatureK: b.m.endK + (energyJ - b.upperJ) / b.liquidCapacity, fraction: 1 };
}
export function meltingEnergy(c: MeltingConfig, temperatureK: number) {
  const b = boundaries(c);
  if (temperatureK <= b.m.startK) return (temperatureK - 273.15) * b.solidCapacity;
  if (temperatureK < b.m.endK) return b.lowerJ + (temperatureK - b.m.startK) / (b.m.endK - b.m.startK) * (b.upperJ - b.lowerJ);
  return b.upperJ + (temperatureK - b.m.endK) * b.liquidCapacity;
}
export function meltingInitial(c: MeltingConfig): MeltingState { return { timeS: 0, carryS: 0, bathK: c.bath.initialTemperatureK, waterKg: c.bath.initialMassKg, sampleJ: meltingEnergy(c,c.sampleInitialK) }; }
export function validMeltingConfig(c: MeltingConfig) {
  const b=c.bath;
  return Object.hasOwn(meltingMaterials,c.material) && [c.sampleMassKg,c.sampleInitialK,c.transferWPerK,...Object.values(b)].every(Number.isFinite) && c.sampleMassKg>=.005 && c.sampleMassKg<=.05 && c.sampleInitialK>=273.15 && c.sampleInitialK<=313.15 && c.transferWPerK>=0 && c.transferWPerK<=5 && b.initialMassKg>=.05 && b.initialMassKg<=.25 && b.vesselCapacityJPerK>=8 && b.vesselCapacityJPerK<=64 && b.initialTemperatureK>=273.15 && b.initialTemperatureK<=BOILING_K && b.ambientTemperatureK>=273.15 && b.ambientTemperatureK<=313.15 && b.powerW>=0 && b.powerW<=2000 && b.efficiency>=0 && b.efficiency<=1 && b.lossWPerK>=0 && b.lossWPerK<=10;
}
export function advanceMelting(state: MeltingState,c: MeltingConfig,heating:boolean,coupled:boolean,dtS:number):MeltingState {
  if(!validMeltingConfig(c)||![...Object.values(state),dtS].every(Number.isFinite)||dtS<0||state.timeS<0||state.timeS>7200||state.carryS<0||state.carryS>=MELTING_STEP_S+1e-8||state.waterKg<0||state.waterKg>c.bath.initialMassKg+1e-9||state.sampleJ<0||state.bathK<273.15||state.bathK>BOILING_K+1e-8)throw new RangeError('INVALID_MELTING_STATE');
  if(!state.waterKg)return {...state};
  const steps=Math.floor((state.carryS+Math.min(dtS,7200-state.timeS)+1e-9)/MELTING_STEP_S);
  let bathK=state.bathK,waterKg=state.waterKg,sampleJ=state.sampleJ,count=0;
  for(;count<steps&&waterKg>0;count++) {
    const sampleK=meltingPhase(c,sampleJ).temperatureK,exchange=coupled?c.transferWPerK*(bathK-sampleK)*MELTING_STEP_S:0;
    sampleJ=Math.max(0,sampleJ+exchange-sampleLoss*(sampleK-c.bath.ambientTemperatureK)*MELTING_STEP_S);
    const net=(heating?c.bath.powerW*c.bath.efficiency:0)-c.bath.lossWPerK*(bathK-c.bath.ambientTemperatureK);
    const energy=(waterKg*WATER_C+c.bath.vesselCapacityJPerK)*(bathK-273.15)+net*MELTING_STEP_S-exchange,ceiling=(waterKg*WATER_C+c.bath.vesselCapacityJPerK)*100;
    if(energy>ceiling){waterKg=Math.max(0,waterKg-(energy-ceiling)/LATENT_HEAT);bathK=BOILING_K;}else bathK=273.15+Math.max(0,energy)/(waterKg*WATER_C+c.bath.vesselCapacityJPerK);
  }
  return {timeS:Number((state.timeS+count*MELTING_STEP_S).toFixed(8)),carryS:waterKg>0?Math.max(0,Math.min(MELTING_STEP_S-1e-12,state.carryS+Math.min(dtS,7200-state.timeS)-count*MELTING_STEP_S)):0,bathK,waterKg,sampleJ};
}
export const sampleHeightM=(tube:EquipmentInstance)=>.03+2*Number(tube.parameters.massKg);
export function meltingRig(scene:SceneDocument) {
  const bathRig=thermalRig({...scene,equipment:scene.equipment.filter(i=>i.type!==TUBE)}),tubes=scene.equipment.filter(i=>i.type===TUBE),tube=tubes[0];
  const config:MeltingConfig={bath:bathRig.config,material:tube?.parameters.material as MeltingMaterial,sampleMassKg:Number(tube?.parameters.massKg),sampleInitialK:Number(tube?.parameters.initialTemperatureK),transferWPerK:Number(tube?.parameters.transferWPerK)};
  const ok=bathRig.ok&&tubes.length===1&&scene.equipment.every(i=>meltingApparatus.includes(i.type))&&validMeltingConfig(config)&&!!tube&&Math.abs(tube.pose.rotationRad)<1e-8&&!tube.pose.flippedX;
  const signature=JSON.stringify([scene.documentId,bathRig.signature,tube?.id,tube?.parameters.material,tube?.parameters.massKg,tube?.parameters.initialTemperatureK]);
  return {ok,config,tube,bathRig,signature,message:!ok?'请放置一套水浴装置和一支盛样品的试管；水量 50～250 mL，试管保持竖直。':bathRig.message};
}
export type MeltingRig=ReturnType<typeof meltingRig>;
export function meltingCoupled(rig:MeltingRig,state:MeltingState) {
  const t=rig.tube,b=rig.bathRig.beaker;
  return !!(rig.ok&&t&&b&&Math.abs(t.pose.xM-b.pose.xM)<.025&&t.pose.yM>b.pose.yM+.008&&t.pose.yM+.008+sampleHeightM(t)<b.pose.yM+.18*state.waterKg/.25-.004&&b.pose.yM+.18*state.waterKg/.25<t.pose.yM+.19);
}
export function meltingReading(rig:MeltingRig,state:MeltingState) {
  const t=rig.tube,m=rig.bathRig.meter;
  if(!rig.ok||!t||!m||state.waterKg<=0)return{ok:false as const,message:!state.waterKg?'水浴已干，请停止实验并重置。':'请放置温度计，将玻璃泡埋入试管样品。'};
  const x=m.pose.xM+.22*Math.sin(m.pose.rotationRad),y=m.pose.yM-.22*Math.cos(m.pose.rotationRad);
  if(Math.abs(x-t.pose.xM)>.005||y<t.pose.yM+.016||y>t.pose.yM+.008+sampleHeightM(t)-.009)return{ok:false as const,message:'玻璃泡应埋入试管样品，不碰管壁或管底；不能读成水浴温度。'};
  const temperatureK=meltingPhase(rig.config,state.sampleJ).temperatureK,res=Number(m.parameters.resolutionK);
  return{ok:true as const,valueK:273.15+Math.round((temperatureK-273.15)/res)*res,message:''};
}
