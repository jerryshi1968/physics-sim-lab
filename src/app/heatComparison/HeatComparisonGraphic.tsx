import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { HEATER } from '../../equipment/thermal/definitions.ts';
import { TIMER } from '../../equipment/projectile/definitions.ts';
import { BEAKER } from '../../equipment/density/definitions.ts';
import { heatSamples, nearestHeatBeaker, sampleKey } from '../../equipment/heatComparison/simulate.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { ThermalGraphic, thermalBounds } from '../thermal/ThermalGraphic.tsx';
import type { HeatComparisonSimulation } from './useHeatComparison.ts';
export function heatComparisonBounds(type:string){return type===HEATER?{x:-.025,y:-.03,width:.16,height:.23}:thermalBounds(type);}
export function HeatComparisonGraphic({instance,scene,simulation:s}:{instance:EquipmentInstance;scene:SceneDocument;simulation?:HeatComparisonSimulation}){
  const beaker=instance.type===BEAKER?instance:nearestHeatBeaker(scene,instance),key=beaker&&sampleKey(beaker),r=key&&s?.readings[key],active=!!(key&&s?.state.active[key]&&s.rig.channels[key].contact);
  if(instance.type===HEATER)return <g className="real-apparatus thermal-apparatus" stroke="none" data-appearance="physical" data-testid="immersion-heater" data-heating={active?'true':'false'}><path d="M.014 -.007Q.11 -.035 .12 .035" fill="none" stroke="#365963" strokeWidth="2"/><rect x="-.017" y="-.016" width=".044" height=".03" rx=".008" fill="#a47b43"/><path d="M-.008 .014V.17M.008 .014V.17" stroke="#82969a" strokeWidth="2"/><path d="M-.008 .17h.018q.012 .003 0 .006h-.018q-.012 .004 0 .008h.018" fill="none" stroke={active?'#d47f34':'#637a80'} strokeWidth="2.5"/></g>;
  const resolution=Number(instance.parameters.resolutionS),timerValid=!!(key&&s?.rig.ok&&s.rig.channels[key].timer?.id===instance.id&&resolution>0&&resolution<=1),clockText=instance.type===TIMER?timerValid&&key&&s?(Math.round(s.state.samples[key].heatSeconds/resolution)*resolution).toFixed(1):'—':r?.ok?r.displayS.toFixed(1):'—';
  return <ThermalGraphic instance={instance} liquidColor={instance.type===BEAKER&&key?heatSamples[key].color:undefined} readout={s?{reading:r||{ok:false,message:'未放入液体'},clockText,running:active&&s.running}:undefined}/>;
}
