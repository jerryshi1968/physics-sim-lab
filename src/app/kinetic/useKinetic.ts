import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advanceKinetic, kineticRig, kineticState, kineticView } from '../../equipment/kinetic/simulate.ts';
import type { KineticRun } from '../../equipment/kinetic/simulate.ts';
export function useKinetic(scene:SceneDocument,enabled:boolean) {
  const rig=kineticRig(scene),signature=enabled&&rig.ok?rig.signature:'', [stored,setStored]=useState<KineticRun|null>(null),[active,setActive]=useState(''),[rate,setRate]=useState(1),context=useRef({signature,rate});
  useLayoutEffect(()=>{context.current={signature,rate};});
  const run=stored?.signature===signature&&signature?stored:null,running=!!run&&run.timeS<run.rig.endTime&&active===run.id;
  useEffect(()=>{if(!running)return;let frame=0,previous:number|null=null;const tick=(now:number)=>{if(previous!==null){const dt=Math.max(0,Math.min(.1,(now-previous)/1000))*context.current.rate;setStored(old=>old?.signature===context.current.signature?advanceKinetic(old,dt):old);}previous=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[running]);
  const fresh=()=>rig.ok?{id:crypto.randomUUID(),signature,rig,timeS:0}:null;
  return {rig,run,running,rate,setRate,release:()=>{if(!enabled)return;const next=fresh();if(next){setStored(next);setActive(next.id);}},reset:()=>{setStored(null);setActive('');},pause:()=>setActive(''),resume:()=>{if(run)setActive(run.id);},step:()=>{if(!enabled)return;setActive('');const next=run??fresh();if(next)setStored(advanceKinetic(next,.1));},viewScene:kineticView(scene,run),completed:!!run&&run.timeS>=run.rig.endTime&&!run.rig.boundary,state:rig.ok?kineticState(rig,run?.timeS??0):null};
}
export type KineticSimulation=ReturnType<typeof useKinetic>;
