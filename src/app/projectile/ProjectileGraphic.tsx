import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
import { LAUNCHER,BALL,TIMER,SCALE,GROUND } from '../../equipment/projectile/definitions.ts';
export function projectileBounds(item:EquipmentInstance){
  if(item.type===SCALE)return{x:-.09,y:-.09,width:Number(item.parameters.widthM)+.12,height:Number(item.parameters.heightM)+.12};
  if(item.type===GROUND)return{x:0,y:0,width:Number(item.parameters.lengthM),height:.12};
  if(item.type===LAUNCHER)return{x:-.35,y:-.12,width:.43,height:.3};
  if(item.type===TIMER)return{x:-.26,y:-.14,width:.52,height:.28};
  return{x:-.06,y:-.06,width:.12,height:.12};
}
export function ProjectileGraphic({instance:item,flight,pixelsPerM=600}:{instance:EquipmentInstance;flight?:ProjectileFlight|null|undefined;pixelsPerM?:number}){
  const p=item.parameters,width=Number(p.widthM??2),height=Number(p.heightM??1.4),time=flight?.point.timeS;
  return <g className="real-apparatus" data-appearance="physical" data-projectile-type={item.type} stroke="none">
    {item.type===LAUNCHER&&<><rect x="-.32" y="-.065" width=".31" height=".13" rx=".025" fill="#36575d" stroke="#233d43" strokeWidth="1.5"/><rect x="-.21" y="-.08" width=".14" height=".16" rx=".02" fill="#92a6a4"/><path d="M-.32-.03h.3M-.2 .08l-.06 .09h.22l-.05-.09" stroke="#77908c" strokeWidth="2" fill="#d2d7cb"/><ellipse data-projectile-muzzle="true" cx="0" cy="0" rx=".018" ry=".06" fill="#233f43" stroke="#a6bab4" strokeWidth="1.5"/><circle cx="-.145" r=".026" fill="#bd9052"/><path d="M-.07-.09H.04" stroke="#376f66" strokeWidth="2"/></>}
    {item.type===BALL&&<><circle data-projectile-ball-grip="true" r={24/pixelsPerM} fill="transparent" pointerEvents="all"/><circle data-projectile-ball-body="true" data-projectile-time-s={time} cx="0" cy="0" r=".028" fill="#c98239" stroke="#7b512b" strokeWidth="1.5"/><circle cx="-.009" cy="-.009" r=".008" fill="#f9d69b"/></>}
    {item.type===TIMER&&<><rect x="-.25" y="-.13" width=".5" height=".26" rx=".04" fill="#31555d" stroke="#253c42" strokeWidth="1.5"/><rect x="-.21" y="-.085" width=".42" height=".14" rx=".01" fill="#e5edce"/><text data-projectile-timer-s={time} x="0" y=".015" textAnchor="middle" fontSize=".075" fill="#234d45">{time===undefined?'—':Number((Math.round(time/flight!.rig.resolutionS)*flight!.rig.resolutionS).toPrecision(12)).toFixed(Math.min(4,Math.max(0,Math.ceil(-Math.log10(flight!.rig.resolutionS)))))} s</text><circle cx="-.12" cy=".09" r=".018" fill="#c98239"/><circle cx=".12" cy=".09" r=".018" fill="#8eb7a5"/></>}
    {item.type===GROUND&&<><rect width={Number(p.lengthM)} height=".12" fill="#c7b58b"/><path d={`M0 0H${Number(p.lengthM)}`} stroke="#6c8075" strokeWidth="2"/>{Array.from({length:Math.ceil(Number(p.lengthM)/.12)},(_,i)=><path key={i} d={`M${i*.12} .02l.06 .07`} stroke="#ebdfba" strokeWidth="1"/>)}</>}
    {item.type===SCALE&&<>
      <g pointerEvents="none" stroke="#dbe7df" strokeWidth=".6">{Array.from({length:Math.floor(width*10)+1},(_,i)=><path key={`x${i}`} d={`M${i/10} 0v${height}`} />)}{Array.from({length:Math.floor(height*10)+1},(_,i)=><path key={`y${i}`} d={`M0 ${i/10}h${width}`}/>)}</g>
      <rect data-projectile-scale-grip="true" x="-.08" y="-.08" width={width+.08} height=".08" fill="#e5d5a8" stroke="#9f916b" strokeWidth="1"/><rect x="-.08" y="0" width=".08" height={height} fill="#e5d5a8" stroke="#9f916b" strokeWidth="1"/>
      {Array.from({length:Math.floor(width*100)+1},(_,i)=><g key={`t${i}`}><path d={`M${i/100} 0v${i%10?-.02:-.04}`} stroke="#68766a" strokeWidth=".6"/>{i%10===0&&<text x={i/100} y="-.05" textAnchor="middle" fontSize=".045" fill="#3b5a53">{i}</text>}</g>)}
      {Array.from({length:Math.floor(height*100)+1},(_,i)=><g key={`v${i}`}><path d={`M0 ${i/100}h${i%10?-.02:-.04}`} stroke="#68766a" strokeWidth=".6"/>{i%10===0&&<text x="-.05" y={i/100+.015} textAnchor="end" fontSize=".045" fill="#3b5a53">{i}</text>}</g>)}
      <text x={width/2} y="-.13" fontSize=".055" textAnchor="middle" fill="#3b5a53">横尺 / 竖尺：cm</text>
    </>}
  </g>;
}
