import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advanceAverageSpeed, averageSpeedRig, averageSpeedView } from '../../equipment/averageSpeed/simulate.ts';
import type { AverageSpeedRun } from '../../equipment/averageSpeed/simulate.ts';
export function useAverageSpeed(scene: SceneDocument,enabled:boolean) {
  const rig=averageSpeedRig(scene),signature=enabled&&rig.ok?rig.signature:'';
  const [stored,setStored]=useState<AverageSpeedRun|null>(null),[active,setActive]=useState(''),[rate,setRate]=useState(1);
  const run=stored?.signature===signature&&signature?stored:null,running=!!run&&active===run.id&&run.timeS<run.rig.endTimeS;
  const context=useRef({signature,rate});useLayoutEffect(()=>{context.current={signature,rate};});
  useEffect(()=>{
    if(!running)return;
    let frame=0,previous:number|null=null;
    const tick=(now:number)=>{if(previous!==null){const dt=Math.max(0,Math.min(.1,(now-previous)/1000))*context.current.rate;setStored(current=>current?.signature===context.current.signature?advanceAverageSpeed(current,dt):current);}previous=now;frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[running]);
  const release=()=>{if(!enabled||!rig.ok)return;const id=crypto.randomUUID();setStored({id,signature,rig,timeS:0});setActive(id);};
  const reset=()=>{setStored(null);setActive('');};
  const timeS=run?.timeS??0,resolution=run?.rig.resolutionS??(rig.ok?rig.resolutionS:.01),displayS=Number((Math.round(timeS/resolution)*resolution).toPrecision(12));
  return{rig,run,running,rate,setRate,release,reset,pause:()=>setActive(''),resume:()=>{if(run)setActive(run.id);},step:()=>{setActive('');setStored(current=>current?.signature===signature?advanceAverageSpeed(current,.1):current);},viewScene:averageSpeedView(scene,run),displayS,completed:!!run&&run.timeS>=run.rig.endTimeS};
}
export type AverageSpeedSimulation=ReturnType<typeof useAverageSpeed>;
