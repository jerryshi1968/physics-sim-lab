import type { ReflectionOutcome } from '../../equipment/reflection/simulate.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
export function ReflectionRays({outcome,view,size}:{outcome:ReflectionOutcome;view:Viewport;size:{width:number;height:number}}){
  if(!outcome.ok)return null;
  return <g pointerEvents="none" stroke="none">{[...outcome.incoming.map((trace,index)=>({trace,index,kind:'incident'})),...outcome.outgoing.map((trace,index)=>({trace,index,kind:'reflected'}))].map(({trace,index,kind})=>{
    if(trace.kind!=='along'||!trace.start||!trace.end)return null;const a=worldToScreen({xM:trace.start.x,yM:trace.start.y},view,size),b=worldToScreen({xM:trace.end.x,yM:trace.end.y},view,size),mx=a.x+(b.x-a.x)*.55,my=a.y+(b.y-a.y)*.55,angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+(kind==='incident'?180:0);
    return <g key={kind+index} data-paper-ray={kind} data-paper-side={index===0?'left':'right'}><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke={kind==='incident'?'#d97627':'#be473e'} strokeWidth="3"/><path d="M-6-4L0 0l-6 4" transform={`translate(${mx} ${my}) rotate(${angle})`} fill="none" stroke={kind==='incident'?'#d97627':'#be473e'} strokeWidth="1.7"/></g>;
  })}</g>;
}
