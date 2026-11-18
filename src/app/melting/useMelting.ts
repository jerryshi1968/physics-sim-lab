import { useEffect,useLayoutEffect,useRef,useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { advanceMelting,meltingInitial,meltingRig,meltingReading,meltingCoupled,meltingPhase } from '../../equipment/melting/simulate.ts';
import type { MeltingState } from '../../equipment/melting/simulate.ts';
interface Run {signature:string;id:string;state:MeltingState;heating:boolean;running:boolean;originS:number;epoch:number}
function advance(run:Run,rig:ReturnType<typeof meltingRig>,dt:number) {
  const state=advanceMelting(run.state,rig.config,run.heating&&rig.bathRig.contact,meltingCoupled(rig,run.state),dt);
  return{...run,state,running:run.running&&state.waterKg>0&&state.timeS<7200,heating:run.heating&&state.waterKg>0};
}
export function useMelting(scene:SceneDocument,enabled:boolean) {
  const rig=meltingRig(scene),signature=enabled&&rig.ok?rig.signature:'';
  const[cycle,setCycle]=useState(()=>crypto.randomUUID()),[stored,setStored]=useState<Run|null>(null),[rate,setRate]=useState(20),[stepS,setStepS]=useState(60);
  const run=stored?.signature===signature?stored:null,state=run?.state??(rig.ok?meltingInitial(rig.config):{timeS:0,carryS:0,bathK:293.15,waterKg:0,sampleJ:0});
  const running=!!signature&&!!run?.running&&state.waterKg>0&&state.timeS<7200,heating=!!run?.heating&&state.waterKg>0;
  const context=useRef({rig,signature,rate});useLayoutEffect(()=>{context.current={rig,signature,rate};});
  useEffect(()=>{if(!running)return;let frame=0,previous:number|null=null;const tick=(now:number)=>{if(previous!==null){const dt=Math.max(0,Math.min(.1,(now-previous)/1000))*context.current.rate;setStored(old=>old?.signature===context.current.signature?advance(old,context.current.rig,dt):old);}previous=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[running]);
  const change=(update:(r:Run)=>Run)=>{if(!signature)return;setStored(old=>update(old?.signature===signature?old:{signature,id:cycle,state:meltingInitial(rig.config),heating:false,running:false,originS:0,epoch:0}));};
  const phase=rig.ok?meltingPhase(rig.config,state.sampleJ):{temperatureK:293.15,fraction:0},recordS=Math.max(0,state.timeS-(run?.originS??0)),res=Number(rig.bathRig.timer?.parameters.resolutionS??.1),displayS=Number((Math.round(recordS/res)*res).toPrecision(12));
  return{rig,state,running,heating,rate,setRate,stepS,setStepS,phase,reading:meltingReading(rig,state),coupled:meltingCoupled(rig,state),displayS,recordS,originS:run?.originS??0,seriesId:(run?.id??cycle)+'.'+(run?.epoch??0),
    heat:()=>change(r=>({...r,heating:!r.heating,running:true})),pause:()=>change(r=>({...r,running:false})),resume:()=>change(r=>({...r,running:true})),step:()=>change(r=>advance({...r,running:false},rig,stepS)),zero:()=>change(r=>({...r,originS:r.state.timeS,epoch:r.epoch+1})),reset:()=>{setStored(null);setCycle(crypto.randomUUID());}};
}
export type MeltingSimulation=ReturnType<typeof useMelting>;
