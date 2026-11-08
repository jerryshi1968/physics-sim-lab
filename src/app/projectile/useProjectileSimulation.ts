import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import { compileProjectile, beginProjectileFlight, advanceProjectile, projectileIdentity, projectileSignature, projectileView } from '../../equipment/projectile/simulate.ts';
import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
export function useProjectileSimulation(scene:SceneDocument,registry:EquipmentRegistry,enabled:boolean) {
  const next=enabled?compileProjectile(scene,registry):null,context=useRef({scene,registry,enabled});
  useLayoutEffect(()=>{context.current={scene,registry,enabled};},[scene,registry,enabled]);
  const active=useRef<ProjectileFlight|null>(null),counter=useRef({documentId:scene.documentId,value:0});
  const [frame,setFrame]=useState<ProjectileFlight|null>(null),[runningId,setRunningId]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  const [playbackRate,setPlaybackRate]=useState(.1),rate=useRef(.1);
  useLayoutEffect(()=>{rate.current=playbackRate;},[playbackRate]);
  const flight=enabled&&frame&&projectileIdentity(scene,frame)?frame:null;
  const running=!!flight&&runningId===flight.runId&&flight.point.state==='flying';
  useEffect(()=>{active.current=null;let cancelled=false;queueMicrotask(()=>{if(!cancelled){setFrame(null);setRunningId(null);setError(null);}});return()=>{cancelled=true;active.current=null;};},[scene.documentId,enabled]);
  const prepare=useCallback(()=>{
    const current=context.current;if(!current.enabled)return null;
    if(counter.current.documentId!==current.scene.documentId)counter.current={documentId:current.scene.documentId,value:0};
    const built=beginProjectileFlight(current.scene,current.registry,`projectile-${crypto.randomUUID()}`,counter.current.value+1);
    if(!built.ok){setError(built.code);return null;}
    counter.current.value++;active.current=built.flight;setFrame(built.flight);setError(null);return built.flight;
  },[]);
  const advance=useCallback((seconds:number)=>{
    const current=context.current,previous=active.current;if(!previous||!current.enabled||!projectileIdentity(current.scene,previous))return;
    const result=advanceProjectile(previous,seconds);
    if(!result.ok){setError(result.code);setRunningId(null);return;}
    active.current=result.flight;setFrame(result.flight);if(result.flight.point.state==='landed')setRunningId(null);
  },[]);
  const runId=flight?.runId??null;
  useEffect(()=>{
    if(!running)return;
    let handle=0,previous:number|null=null;
    function tick(now:number){if(previous!==null)advance((now-previous)/1000*rate.current);previous=now;handle=requestAnimationFrame(tick);}
    handle=requestAnimationFrame(tick);return()=>cancelAnimationFrame(handle);
  },[running,runId,advance]);
  return {next,flight,running,error,playbackRate,setPlaybackRate,staged:!!flight&&projectileSignature(scene)!==projectileSignature(flight.initialScene),viewScene:projectileView(scene,flight),
    launch:()=>{const value=prepare();setRunningId(value?.runId??null);},
    pause:()=>setRunningId(null),resume:()=>{if(flight&&flight.point.state==='flying')setRunningId(flight.runId);},
    step:()=>{setRunningId(null);const current=active.current;const value=current&&projectileIdentity(scene,current)?current:prepare();if(value&&value.point.state==='flying')advance(value.rig.intervalS);},
    reset:()=>{counter.current.value=0;active.current=null;setFrame(null);setRunningId(null);setError(null);},
  };
}
export type ProjectileSimulation=ReturnType<typeof useProjectileSimulation>;
