import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { SUPPORT } from '../../equipment/mechanical/definitions.ts';
import { TIMER } from '../../equipment/projectile/definitions.ts';
import { TUBE, materialLabels } from '../../equipment/melting/definitions.ts';
import { sampleHeightM } from '../../equipment/melting/simulate.ts';
import { thermalBounds } from '../thermal/ThermalGraphic.tsx';
import { ThermalGraphic } from '../thermal/ThermalGraphic.tsx';
import type { MeltingSimulation } from './useMelting.ts';
export const meltingBounds=(item:EquipmentInstance)=>item.type===TUBE?{x:-.023,y:-.21,width:.046,height:.22}:thermalBounds(item.type);
export function MeltingGraphic({instance:item,simulation:s}:{instance:EquipmentInstance;simulation?:MeltingSimulation|undefined}) {
  const appearance=s?{...s,state:{timeS:s.state.timeS,temperatureK:s.state.bathK,massKg:s.rig.ok?s.state.waterKg:s.rig.bathRig.config.initialMassKg},rig:s.rig.bathRig,clockText:(s.displayS/60).toFixed(2)}:undefined;
  if(item.type!==TUBE)return <><ThermalGraphic instance={item} simulation={appearance} clockUnit={s&&item.type===TIMER?'min':'s'}/>{item.type===SUPPORT&&<g className="real-apparatus" stroke="none"><path d={`M0 ${-Number(item.parameters.heightM)+.14}H.18`} stroke="#819a9d" strokeWidth="3"/><rect x=".166" y={-Number(item.parameters.heightM)+.13} width=".028" height=".018" rx=".004" fill="#6a8589"/></g>}</>;
  const h=sampleHeightM(item),f=s?.rig.tube?.id===item.id?s.phase.fraction:0,material=item.parameters.material==='wax'?'wax':'hypo';
  return <g className="real-apparatus melting-apparatus" stroke="none" data-appearance="physical" data-melting-tube="true" data-material={material} data-fraction={f}>
    <rect x="-.02" y="-.205" width=".04" height=".21" fill="transparent" pointerEvents="all"/>
    <path d={`M-.012 ${-.008-h}H.012V-.008Q0 .002 -.012 -.008Z`} fill={material==='wax'?'#efda9f':'#d0e9e6'} fillOpacity={.35+.4*f}/>
    {Array.from({length:20},(_,n)=><ellipse key={n} cx={-.008+(n%3)*.008} cy={-.012-Math.floor(n/3)*h/7} rx=".004" ry=".003" fill={material==='wax'?'#f0e6c3':'#f6fbf7'} stroke="#b1c6c0" strokeWidth=".4" opacity={1-f}/>)}
    <path d="M-.017-.2H-.014V-.008Q0 .012 .014-.008V-.2H.017" fill="none" stroke="#74949a" strokeWidth="1.3"/>
    <path d="M-.01-.192V-.02" stroke="#eef9fa" strokeWidth="1"/>
    <title>{materialLabels[material]}样品，观察固体颗粒和液体外观</title>
  </g>;
}
