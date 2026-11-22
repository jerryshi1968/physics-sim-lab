import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';
import type { KineticSimulation } from './useKinetic.ts';
export function KineticOverlay({simulation:s,view,size}:{simulation:KineticSimulation;view:Viewport;size:{width:number;height:number}}) {
  if(!s.rig.ok)return null;
  const r=s.rig,screen=(xM:number,yM:number)=>worldToScreen({xM,yM},view,size),top=screen(r.ball.pose.xM,r.ball.pose.yM),base=screen(r.ball.pose.xM,r.track.pose.yM+.025),start=screen(r.left,r.track.pose.yM),end=screen(r.left+(s.state?.displacement??0),r.track.pose.yM),x=top.x-32;
  return <g pointerEvents="none"><path d={`M${top.x-13} ${top.y}H${x-5}M${base.x-13} ${base.y}H${x-5}M${x} ${top.y}V${base.y}`} fill="none" stroke="#78968b" strokeWidth="1" strokeDasharray="4 3"/><text x={x-5} y={(top.y+base.y)/2} fontSize="13" textAnchor="end" fill="#215b64">h</text><path d={`M${start.x} ${start.y-8}V${start.y-52}`} stroke="#1b7c6f" strokeDasharray="3 3"/><text x={start.x} y={start.y-60} textAnchor="middle" fontSize="12" fill="#215b64">木块起点</text>{s.run&&s.state&&s.state.displacement>.012&&<><path d={`M${end.x} ${end.y-8}V${end.y-48}M${start.x} ${start.y-40}H${end.x}`} stroke="#ac6b30" fill="none"/><text x={(start.x+end.x)/2} y={start.y-45} fontSize="13" textAnchor="middle" fill="#9f662e">s</text></>}</g>;
}
