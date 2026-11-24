import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { BEAKER } from '../density/definitions.ts';
import { SUPPORT } from '../mechanical/definitions.ts';
import { TIMER } from '../projectile/definitions.ts';
import { HEATER, THERMOMETER, thermalFields } from '../thermal/definitions.ts';
export const HEAT_COMPARISON_EXPERIMENT='J-THERM-03',HEAT_COMPARISON_MODEL='thermal.heat-comparison.lumped.v1';
export const heatComparisonApparatus=[BEAKER,HEATER,THERMOMETER,TIMER,SUPPORT];
export const sampleKeys=['water','oil'] as const;
export type SampleKey=typeof sampleKeys[number];
export type HeatProtocol='same-time'|'same-rise';
export const heatSamples={water:{name:'水',density:1000,c:4200,color:'#aed7df'},oil:{name:'食用油',density:900,c:2000,color:'#e6c15d'}};
export const heatComparisonFields:typeof thermalFields={...thermalFields,[BEAKER]:[]};
export const HEAT_LIMIT_K=353.15,HEAT_TIME_LIMIT_S=3600;
export interface HeatSampleConfig {massKg:number;c:number;powerW:number;efficiency:number;lossWPerK:number;initialK:number;ambientK:number}
export interface HeatSampleState {temperatureK:number;heatSeconds:number;energyInJ:number;lossJ:number}
export interface HeatComparisonState {timeS:number;samples:Record<SampleKey,HeatSampleState>;active:Record<SampleKey,boolean>}
export function validHeatSample(c:HeatSampleConfig){return Object.values(c).every(Number.isFinite)&&c.massKg>=.05-1e-10&&c.massKg<=.2+1e-10&&[2000,4200].includes(c.c)&&c.powerW>=0&&c.powerW<=2000&&c.efficiency>=0&&c.efficiency<=1&&c.lossWPerK>=0&&c.lossWPerK<=10&&c.initialK>=273.15&&c.initialK<=313.15&&c.ambientK>=273.15&&c.ambientK<=313.15;}
export function sampleKey(item:EquipmentInstance){return sampleKeys.find(key=>heatSamples[key].name===item.parameters.liquidCode);}
export function nearestHeatBeaker(scene:SceneDocument,item:EquipmentInstance){return scene.equipment.filter(i=>i.type===BEAKER).map(i=>({item:i,d:Math.abs(i.pose.xM-item.pose.xM)})).sort((a,b)=>a.d-b.d)[0]?.item;}
export function heatComparisonLabel(scene:SceneDocument,item:EquipmentInstance){const beaker=item.type===BEAKER?item:nearestHeatBeaker(scene,item),key=beaker&&sampleKey(beaker),label=item.type===HEATER?'电加热器':item.type===THERMOMETER?'温度计':item.type===TIMER?'加热计时器':item.type===BEAKER?'烧杯':'支架';return `${key?heatSamples[key].name+'·':''}${label}`;}
export function heatComparisonRig(scene:SceneDocument){
  const beakers=scene.equipment.filter(i=>i.type===BEAKER),heaters=scene.equipment.filter(i=>i.type===HEATER),meters=scene.equipment.filter(i=>i.type===THERMOMETER),timers=scene.equipment.filter(i=>i.type===TIMER);
  const channels=Object.fromEntries(sampleKeys.map(key=>{const beaker=beakers.find(i=>sampleKey(i)===key),own=(items:EquipmentInstance[])=>items.filter(i=>beaker&&nearestHeatBeaker(scene,i)?.id===beaker.id),h=own(heaters),t=own(timers),heater=h.length===1?h[0]:undefined,timer=t.length===1?t[0]:undefined;
    const config:HeatSampleConfig={massKg:Number(beaker?.parameters.liquidM3)*Number(beaker?.parameters.liquidDensityKgPerM3),c:heatSamples[key].c,powerW:Number(heater?.parameters.powerW),efficiency:Number(heater?.parameters.efficiency),lossWPerK:Number(heater?.parameters.lossWPerK),initialK:Number(heater?.parameters.initialTemperatureK),ambientK:Number(heater?.parameters.ambientTemperatureK)};
    const level=Number(beaker?.parameters.liquidM3)/.00025*.18,contact=!!(beaker&&heater&&Math.abs(beaker.pose.rotationRad)<1e-8&&Math.abs(heater.pose.rotationRad)<1e-8&&Math.abs(heater.pose.xM-beaker.pose.xM)+.015<.038&&heater.pose.yM-.184>beaker.pose.yM+.008&&heater.pose.yM-.17<beaker.pose.yM+level-.006);
    return [key,{key,beaker,heater,timer,config,contact}];})) as Record<SampleKey,{key:SampleKey;beaker:EquipmentInstance|undefined;heater:EquipmentInstance|undefined;timer:EquipmentInstance|undefined;config:HeatSampleConfig;contact:boolean}>;
  const ok=beakers.length===2&&heaters.length===2&&meters.length<=2&&timers.length<=2&&scene.equipment.filter(i=>i.type===SUPPORT).length<=2&&!scene.connections.length&&!scene.simulationConfig.randomError.enabled&&scene.equipment.every(i=>heatComparisonApparatus.includes(i.type)&&!i.pose.flippedX&&[i.pose.xM,i.pose.yM,i.pose.rotationRad].every(Number.isFinite))&&sampleKeys.every(key=>beakers.filter(i=>sampleKey(i)===key).length===1&&channels[key].beaker?.parameters.liquidDensityKgPerM3===heatSamples[key].density&&!channels[key].beaker?.parameters.targetId&&validHeatSample(channels[key].config));
  const signature=JSON.stringify([scene.documentId,...sampleKeys.map(key=>{const c=channels[key];return [key,c.beaker?.id,c.heater?.id,c.config,c.beaker?.parameters.tareKg];})]);
  return {ok,channels,meters,timers,signature,message:ok?'':'请放置分别装水和食用油的两只烧杯及两只电加热器；每杯液体 50～200 g，关闭随机误差。'};
}
export type HeatComparisonRig=ReturnType<typeof heatComparisonRig>;
export function heatInitial(rig:HeatComparisonRig):HeatComparisonState{return {timeS:0,samples:Object.fromEntries(sampleKeys.map(k=>[k,{temperatureK:rig.channels[k].config.initialK,heatSeconds:0,energyInJ:0,lossJ:0}])) as Record<SampleKey,HeatSampleState>,active:{water:false,oil:false}};}
function temperatureAfter(c:HeatSampleConfig,t:number,on:boolean,dt:number){const p=on?c.powerW*c.efficiency:0,capacity=c.massKg*c.c;return c.lossWPerK===0?t+p*dt/capacity:t+(p-c.lossWPerK*(t-c.ambientK))/c.lossWPerK*-Math.expm1(-c.lossWPerK*dt/capacity);}
export function heatTimeTo(c:HeatSampleConfig,t:number,target:number,on=true){if(!validHeatSample(c)||![t,target].every(Number.isFinite))throw Error('INVALID_HEAT_SAMPLE');if(t>=target-1e-10)return 0;const p=on?c.powerW*c.efficiency:0,net=p-c.lossWPerK*(target-c.ambientK);if(net<=0)return Infinity;return c.lossWPerK===0?c.massKg*c.c*(target-t)/p:c.massKg*c.c/c.lossWPerK*Math.log1p(c.lossWPerK*(target-t)/net);}
export function advanceHeatComparison(state:HeatComparisonState,rig:HeatComparisonRig,protocol:HeatProtocol,riseK:number,dt:number){
  if(!rig.ok||!['same-time','same-rise'].includes(protocol)||!Number.isFinite(riseK)||riseK<=0||riseK>40||!Number.isFinite(dt)||dt<0||!Number.isFinite(state.timeS)||state.timeS<0||state.timeS>HEAT_TIME_LIMIT_S||sampleKeys.some(k=>typeof state.active[k]!=='boolean'||!Object.values(state.samples[k]).every(Number.isFinite)||state.samples[k].temperatureK<273.15||state.samples[k].temperatureK>HEAT_LIMIT_K+1e-8||state.samples[k].heatSeconds<0||state.samples[k].heatSeconds>state.timeS+1e-8||state.samples[k].energyInJ<0))throw Error('INVALID_HEAT_COMPARISON');
  const on=(k:SampleKey)=>state.active[k]&&rig.channels[k].contact&&rig.channels[k].config.powerW*rig.channels[k].config.efficiency>0;
  const target=(k:SampleKey)=>protocol==='same-rise'?Math.min(HEAT_LIMIT_K,rig.channels[k].config.initialK+riseK):HEAT_LIMIT_K;
  const until=Object.fromEntries(sampleKeys.map(k=>[k,heatTimeTo(rig.channels[k].config,state.samples[k].temperatureK,target(k),on(k))])) as Record<SampleKey,number>;
  let elapsed=Math.min(dt,HEAT_TIME_LIMIT_S-state.timeS);if(protocol==='same-time')elapsed=Math.min(elapsed,...sampleKeys.filter(on).map(k=>until[k]));else if(sampleKeys.every(k=>!state.active[k]||Number.isFinite(until[k])))elapsed=Math.min(elapsed,Math.max(...sampleKeys.map(k=>state.active[k]?until[k]:0)));
  const next:HeatComparisonState={...state,samples:{water:{...state.samples.water},oil:{...state.samples.oil}},active:{...state.active}};next.timeS+=elapsed;
  for(const key of sampleKeys){const c=rig.channels[key].config,current=state.samples[key],heatDt=on(key)?Math.min(elapsed,until[key]):0,first=temperatureAfter(c,current.temperatureK,on(key),heatDt),end=temperatureAfter(c,first,false,elapsed-heatDt),energy=c.powerW*c.efficiency*heatDt;next.samples[key]={temperatureK:Math.min(HEAT_LIMIT_K,end),heatSeconds:current.heatSeconds+heatDt,energyInJ:current.energyInJ+energy,lossJ:current.lossJ+energy-c.massKg*c.c*(end-current.temperatureK)};if(protocol==='same-rise'&&until[key]<=elapsed+1e-8)next.active[key]=false;}
  if(next.timeS>=HEAT_TIME_LIMIT_S-1e-8||protocol==='same-time'&&sampleKeys.some(k=>next.samples[k].temperatureK>=HEAT_LIMIT_K-1e-8))next.active={water:false,oil:false};
  return next;
}
export function heatReading(rig:HeatComparisonRig,state:HeatComparisonState,key:SampleKey){
  const channel=rig.channels[key],b=channel.beaker,fail=(message:string)=>({ok:false as const,message});if(!rig.ok||!b)return fail(rig.message);const valid=rig.meters.filter(m=>{const tip={x:m.pose.xM+.22*Math.sin(m.pose.rotationRad),y:m.pose.yM-.22*Math.cos(m.pose.rotationRad)},level=.18*Number(b.parameters.liquidM3)/.00025;return !m.pose.flippedX&&Math.abs(b.pose.rotationRad)<1e-8&&Math.abs(tip.x-b.pose.xM)<.036&&tip.y>b.pose.yM+.008&&tip.y<b.pose.yM+level-.006;});
  if(valid.length!==1)return fail('每杯放一支温度计，玻璃泡浸没且不碰杯底、杯壁。');const meter=valid[0]!,r=Number(meter.parameters.resolutionK),timer=channel.timer,tr=Number(timer?.parameters.resolutionS);if(!Number.isFinite(r)||r<.1||r>5||!timer||!Number.isFinite(tr)||tr<=0||tr>1)return fail('请给每杯配好温度计和加热计时器。');
  const valueK=273.15+Math.round((state.samples[key].temperatureK-273.15)/r)*r,displayS=Number((Math.round(state.samples[key].heatSeconds/tr)*tr).toPrecision(12));return {ok:true as const,message:'',valueK,meter,timer,displayS};
}
export function heatControlWarnings(rig:HeatComparisonRig){const a=rig.channels.water,b=rig.channels.oil,w:string[]=[];if(Math.abs(a.config.massKg-b.config.massKg)>1e-8)w.push('液体质量不相同');if(a.config.powerW*a.config.efficiency<=0||b.config.powerW*b.config.efficiency<=0)w.push('加热器没有有效功率');if(a.config.powerW!==b.config.powerW||a.config.efficiency!==b.config.efficiency)w.push('加热功率或效率不相同');if(a.config.initialK!==b.config.initialK)w.push('初温不相同');if(a.config.lossWPerK||b.config.lossWPerK)w.push('存在散热，不能直接用加热时间代表液体吸热量');if(a.beaker?.parameters.tareKg!==b.beaker?.parameters.tareKg)w.push('烧杯质量不相同');if(!a.contact||!b.contact)w.push('电热器应完全浸没在液体中');return w;}
export function heatMassUpdate(item:EquipmentInstance,massKg:number){return {...item,parameters:{...item.parameters,liquidM3:massKg/Number(item.parameters.liquidDensityKgPerM3)}};}
export function heatSampleUpdate(item:EquipmentInstance,key:SampleKey){const sample=heatSamples[key],mass=Math.max(.05,Math.min(.2,Number(item.parameters.liquidM3)*Number(item.parameters.liquidDensityKgPerM3)));return {...item,parameters:{...item.parameters,liquidCode:sample.name,liquidDensityKgPerM3:sample.density,liquidM3:mass/sample.density} as Record<string,Scalar>};}

export function heatPlacementParameters(scene:SceneDocument,type:string,defaults:Record<string,Scalar>){
  const key=scene.equipment.some(i=>i.type===BEAKER&&sampleKey(i)==='water')?'oil':'water',sample=heatSamples[key];
  return {...defaults,...(type===BEAKER?{liquidM3:.1/sample.density,liquidDensityKgPerM3:sample.density,liquidCode:sample.name}:type===HEATER?{powerW:100,efficiency:1,lossWPerK:0}:type===TIMER?{resolutionS:.1}:type===SUPPORT?{heightM:.418}:{})};
}
