import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Viewport } from '../../core/workbench/geometry.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import { LAUNCHER,GROUND } from '../../equipment/projectile/definitions.ts';
import { projectileMarks } from '../../equipment/projectile/simulate.ts';
import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
export function ProjectileOverlay({scene,flight,marks,view,size}:{scene:SceneDocument;flight:ProjectileFlight|null;marks:boolean;view:Viewport;size:{width:number;height:number}}){
  const launcher=scene.equipment.find(item=>item.type===LAUNCHER),ground=scene.equipment.find(item=>item.type===GROUND);
  const support=launcher&&ground?[worldToScreen({xM:launcher.pose.xM-.17,yM:ground.pose.yM},view,size),worldToScreen({xM:launcher.pose.xM-.17,yM:launcher.pose.yM-.08},view,size)]:null;
  const origin=flight?worldToScreen({xM:flight.rig.initial.x0M,yM:flight.rig.initial.y0M},view,size):null;
  const path=flight?Array.from({length:81},(_,i)=>flight.rig.model.sample(flight.point.timeS*i/80)).flatMap(result=>result.status==='ok'?[worldToScreen(result.value,view,size)]:[]):[];
  return <g pointerEvents="none" stroke="none">
    {support&&<path d={`M${support[0]!.x-16} ${support[0]!.y}h32M${support[0]!.x} ${support[0]!.y}V${support[1]!.y}`} stroke="#90a7a6" strokeWidth="5"/>}
    {flight&&origin&&<><path d={path.map((point,i)=>`${i?'L':'M'}${point.x} ${point.y}`).join(' ')} fill="none" stroke="#7da79b" strokeWidth="1.5" strokeDasharray="3 4"/><circle cx={origin.x} cy={origin.y} r="5" fill="white" stroke="#5e887a" strokeWidth="1.5"/><text x={origin.x+8} y={origin.y-12} fontSize="11" fill="#426c62">本次起点</text>
      {marks&&projectileMarks(flight).map((sample,index)=>{const point=worldToScreen(sample,view,size);return <g key={index} data-projectile-mark-time={sample.timeS} data-projectile-mark-x={sample.xM} data-projectile-mark-y={sample.yM}><circle cx={point.x} cy={point.y} r="3.5" fill="#c8883d" opacity=".65"/>{index > 0 && <text x={point.x+5} y={point.y-5} fontSize="10" fill="#7b643c">{Number(sample.timeS.toPrecision(5))} s</text>}</g>;})}
      <path data-projectile-launch-ground="true" d={`M${origin.x-35} ${worldToScreen({xM:0,yM:flight.rig.initial.groundYM},view,size).y}h${Math.max(80,flight.point.horizontalDisplacementM*view.pixelsPerM+70)}`} stroke="#7f9b8e" strokeWidth="1.4" strokeDasharray="6 4"/>
    </>}
  </g>;
}
