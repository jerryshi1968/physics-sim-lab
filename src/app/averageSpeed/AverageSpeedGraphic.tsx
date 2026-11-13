import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { CART, TRACK } from '../../equipment/cart/definitions.ts';
import { STOP } from '../../equipment/averageSpeed/definitions.ts';
import { MechanicalGraphic, mechanicalBounds } from '../mechanical/MechanicalGraphic.tsx';
import { CartGraphic } from '../cart/CartGraphic.tsx';
export function averageSpeedBounds(item:EquipmentInstance) {
  if(item.type===STOP)return{x:-.03,y:-.14,width:.06,height:.15};
  if(item.type===TRACK)return{x:-Number(item.parameters.lengthM)/2,y:-.008,width:Number(item.parameters.lengthM),height:.04};
  if(item.type===CART)return{x:-.12,y:-.105,width:.24,height:.11};
  return mechanicalBounds(item);
}
export function AverageSpeedGraphic({instance:item,timeS=0,pixelsPerM=600}:{instance:EquipmentInstance;timeS?:number;pixelsPerM?:number}) {
  if(item.type===CART)return <CartGraphic instance={item} simple />;
  if(item.type===TRACK){const half=Number(item.parameters.lengthM)/2;return <g className="real-apparatus" stroke="none" data-appearance="physical"><rect x={-half} y="0" width={2*half} height=".027" rx=".004" fill="#be9d68" stroke="#8e784d" strokeWidth="1"/><path d={`M${-half} .002H${half}`} stroke="#e7d6ad" strokeWidth="2"/></g>;}
  if(item.type===STOP)return <g className="real-apparatus" data-appearance="physical" stroke="none" data-average-stop="true"><rect x={-12/pixelsPerM} y="-.13" width={24/pixelsPerM} height=".14" fill="transparent" pointerEvents="all"/><rect x="-.009" y="-.12" width=".009" height=".12" fill="#b5c3c5" stroke="#5d777c" strokeWidth="1"/><path d="M-.009 0H-.034V.009H0V0" fill="#85999c"/><path d="M-.006-.115V-.012" stroke="#e9eeeb" strokeWidth="1"/></g>;
  return <MechanicalGraphic instance={item} timerValueS={timeS} pixelsPerM={pixelsPerM}/>;
}
