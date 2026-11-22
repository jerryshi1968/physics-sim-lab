import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { TRACK } from '../../equipment/cart/definitions.ts';
import { BALL } from '../../equipment/projectile/definitions.ts';
import { BLOCK, SURFACE } from '../../equipment/mechanical/frictionDefinitions.ts';
import { ballRadius, kineticBallPoint } from '../../equipment/kinetic/simulate.ts';
import { MechanicalGraphic, mechanicalBounds } from '../mechanical/MechanicalGraphic.tsx';
export function kineticBounds(item:EquipmentInstance) {
  if(item.type===TRACK)return {x:-Number(item.parameters.lengthM)-.03,y:-Math.min(.4,1.5*Number(item.parameters.lengthM)/Math.PI)-.035,width:Number(item.parameters.lengthM)+.06,height:Math.min(.4,1.5*Number(item.parameters.lengthM)/Math.PI)+.075};
  if(item.type===BALL)return {x:-.03,y:-.03,width:.06,height:.06};
  if(item.type===BLOCK)return {x:-Number(item.parameters.widthM)/2,y:-Number(item.parameters.heightM),width:Number(item.parameters.widthM),height:Number(item.parameters.heightM)};
  return mechanicalBounds(item);
}
export function KineticGraphic({instance:item,spin=0,pixelsPerM=350}:{instance:EquipmentInstance;spin?:number;pixelsPerM?:number}) {
  if(item.type===TRACK){const radius=Number(item.parameters.lengthM)/Math.PI,maxHeight=Math.min(.4,1.5*radius),points=Array.from({length:81},(_,i)=>{const h=maxHeight*(1-i/80),p=kineticBallPoint({...item,pose:{xM:0,yM:0,rotationRad:0}},h),theta=2*Math.acos(Math.sqrt(h/(2*radius))),incline=(Math.PI-theta)/2;return `${p.xM-ballRadius*Math.sin(incline)},${-p.yM+ballRadius*Math.cos(incline)}`;});return <g className="real-apparatus" data-appearance="physical"><polyline vectorEffect="non-scaling-stroke" points={points.join(' ')} fill="none" stroke="#ae8751" strokeWidth="7" strokeLinecap="round"/><polyline vectorEffect="non-scaling-stroke" points={points.join(' ')} fill="none" stroke="#f0d4a2" strokeWidth="2"/><path d="M-.06 .02V.12H.04" fill="none" stroke="#708d8d" strokeWidth="4"/></g>;}
  if(item.type===BALL)return <g className="real-apparatus" data-appearance="physical"><circle r={ballRadius} fill="#70b6c3" stroke="#325d6b" strokeWidth="1.4"/><circle cx="-.007" cy="-.009" r=".007" fill="#d5edf1"/><path d={`M${Math.cos(spin)*.018} ${Math.sin(spin)*.018}L${-Math.cos(spin)*.018} ${-Math.sin(spin)*.018}`} stroke="#dceef0" strokeWidth="1"/></g>;
  if(item.type===BLOCK){const w=Number(item.parameters.widthM),h=Number(item.parameters.heightM);return <g className="real-apparatus" data-appearance="physical"><rect x={-w/2} y={-h} width={w} height={h} rx=".003" fill="#cfa45e" stroke="#826d45" strokeWidth="1"/><path d={`M${-w*.35} ${-h*.7}h${w*.5}m${-w*.35} ${h*.4}h${w*.55}`} stroke="#ae854a" strokeWidth="1"/><path d={`M${-w/2} 0V${-h}`} stroke="#885127" strokeWidth="2"/></g>;}
  if(item.type===SURFACE){const half=Number(item.parameters.lengthM)/2;return <g className="real-apparatus" data-appearance="physical"><rect x={-half} y="0" width={2*half} height=".025" fill="#b2bda1" stroke="#697c6a" strokeWidth="1"/><path d={`M${-half} 0H${half}`} stroke="#526e60" strokeWidth="2"/></g>;}
  return <MechanicalGraphic instance={item} pixelsPerM={pixelsPerM}/>;
}
