import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { WorldPoint } from '../../core/workbench/geometry.ts';
import { advanceHeatComparison, heatComparisonRig, heatInitial, heatReading, sampleKeys } from '../../equipment/heatComparison/simulate.ts';
import type { HeatComparisonState, HeatProtocol, SampleKey } from '../../equipment/heatComparison/simulate.ts';
interface Run {signature:string;id:string;state:HeatComparisonState;running:boolean}
function advanceRun(current:Run,dt:number,settings:{base:ReturnType<typeof heatComparisonRig>;protocol:HeatProtocol;riseK:number}){const next=advanceHeatComparison(current.state,settings.base,settings.protocol,settings.riseK,dt);return {...current,state:next,running:current.running&&next.timeS<3600&&(settings.protocol!=='same-rise'||sampleKeys.some(k=>next.active[k]))&&sampleKeys.every(k=>next.samples[k].temperatureK<353.15-1e-8)};}
export function useHeatComparison(scene:SceneDocument,enabled:boolean,preview:{id:string;point:WorldPoint}|null){
  const [protocol,setProtocol]=useState<HeatProtocol>('same-time'),[riseK,setRiseK]=useState(10),[rate,setRate]=useState(10),[stepS,setStepS]=useState(10),[stored,setStored]=useState<Run|null>(null);
  const base=heatComparisonRig(scene),signature=enabled&&base.ok?JSON.stringify([base.signature,protocol,riseK]):'',view=preview?{...scene,equipment:scene.equipment.map(i=>i.id===preview.id?{...i,pose:{...i.pose,...preview.point}}:i)}:scene,rig=heatComparisonRig(view);
  const [previous,setPrevious]=useState(signature),[seriesId,setSeriesId]=useState(()=>crypto.randomUUID());
  if(previous!==signature){setPrevious(signature);setStored(null);setSeriesId(crypto.randomUUID());}
  const run=stored?.signature===signature?stored:null,state=run?.state??heatInitial(base),running=!!signature&&!!run?.running&&!preview;
  const context=useRef({base,signature,protocol,riseK,rate});useLayoutEffect(()=>{context.current={base,signature,protocol,riseK,rate};});
  useEffect(()=>{if(!running)return;let frame=0,previousTime:number|null=null;const tick=(now:number)=>{if(previousTime!==null){const dt=Math.max(0,Math.min(.1,(now-previousTime)/1000))*context.current.rate;setStored(current=>current?.signature===context.current.signature?advanceRun(current,dt,context.current):current);}previousTime=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[running]);
  function change(fn:(current:Run)=>Run){if(!signature)return;setStored(current=>fn(current?.signature===signature?current:{signature,id:seriesId,state:heatInitial(base),running:false}));}
  const readings={water:heatReading(rig,state,'water'),oil:heatReading(rig,state,'oil')};
  return {rig,state,signature,seriesId:run?.id??seriesId,protocol,setProtocol,riseK,setRiseK,rate,setRate,stepS,setStepS,running,preview:!!preview,readings,
    start:()=>change(current=>({...current,running:true,state:{...current.state,active:{water:true,oil:true}}})),
    stop:()=>change(current=>({...current,running:false,state:{...current.state,active:{water:false,oil:false}}})),
    pause:()=>change(current=>({...current,running:false})),resume:()=>change(current=>({...current,running:true})),
    toggle:(key:SampleKey)=>change(current=>({...current,running:true,state:{...current.state,active:{...current.state.active,[key]:!current.state.active[key]}}})),
    step:()=>change(current=>advanceRun({...current,running:false},stepS,context.current)),
    reset:()=>{setStored(null);setSeriesId(crypto.randomUUID());},
  };
}
export type HeatComparisonSimulation=ReturnType<typeof useHeatComparison>;
