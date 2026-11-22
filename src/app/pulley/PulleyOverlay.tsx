import type { SceneDocument } from '../../core/scene/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { Viewport, WorldPoint } from '../../core/workbench/geometry.ts';
import { MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';
import type { PulleyOutcome } from '../../equipment/pulley/simulate.ts';
export function PulleyOverlay({scene,outcome:out,view,size}:{scene:SceneDocument;outcome:PulleyOutcome;view:Viewport;size:{width:number;height:number}}) {
  const l=out.layout;if(!l)return null;const screen=(p:WorldPoint)=>worldToScreen(p,view,size),anchor=screen(l.anchor),center=screen(l.center),load=screen(l.loadPoint),meter=screen(l.meterPoint),r=.04*view.pixelsPerM,left=center.x-r,right=center.x+r,meterHook=screen({...l.meterPoint,yM:l.meterPoint.yM-.205}),pole=screen({...l.anchor,xM:l.support.pose.xM});
  const rope=l.mode==='fixed'?`M${load.x} ${load.y}V${center.y}A${r} ${r} 0 0 1 ${right} ${center.y}V${meter.y}`:l.mode==='movable'?`M${left} ${anchor.y}V${center.y}A${r} ${r} 0 0 0 ${right} ${center.y}V${meterHook.y}`:'';
  return <g pointerEvents="none" data-pulley-overlay="true" data-pulley-travel-m={l.u} data-load-rise-m={l.u/l.n}><path d={`M${pole.x} ${pole.y}H${l.mode==='movable'?left+8:anchor.x+10}`} stroke="#6c9294" strokeWidth="4"/>{l.mode==='fixed'&&<path d={`M${anchor.x} ${anchor.y}V${center.y-.069*view.pixelsPerM}`} stroke="#617e82" strokeWidth="2"/>}{rope&&<path data-pulley-rope="true" d={rope} fill="none" stroke="#ab8151" strokeWidth="2.5"/>}
    {[['重物起点',l.loadStart,load,-1],['拉动点起点',l.meterStart,meter,1]].map(([label,initial,current,side])=>{const p=screen(initial as WorldPoint),q=current as typeof load,sign=side as number,x=p.x+sign*view.pixelsPerM*.115;return <g key={String(label)}><path d={`M${p.x} ${p.y}H${x}M${q.x} ${q.y}H${x}M${x} ${p.y}V${q.y}`} stroke={sign<0?'#268779':'#b4733e'} strokeDasharray="4 3" fill="none" strokeWidth="1"/><text x={Math.max(55,Math.min(size.width-90,x+sign*16))} y={Math.max(p.y,q.y)+18} textAnchor={sign<0?'end':'start'} fontSize="11" fill="#275c63">{label as string}</text>{l.u>.005&&<text x={x+sign*25} y={(p.y+q.y)/2} textAnchor={sign<0?'end':'start'} fontSize="13" fill="#275c63">{sign<0?'h':'s'}</text>}</g>;})}
    {scene.equipment.filter(i=>i.type===MECHANICAL_RULER).map((i,index)=>{const p=screen(i.pose);return p.x<0||p.x>size.width?null:<text key={i.id} x={p.x} y={p.y+23} fontSize="11" textAnchor="middle" fill="#275c63">尺 {index+1} · cm</text>;})}
    {l.mode!=='direct'&&<circle cx={l.mode==='movable'?left:anchor.x} cy={anchor.y} r="3" fill="#365f64"/>}
    <path d={`M${meter.x+70} ${meter.y+10}v${l.sign===1?-26:26}m-4 ${l.sign===1?5:-5}l4 ${l.sign===1?-5:5}l4 ${l.sign===1?5:-5}`} stroke="#4d8c8b" fill="none" strokeWidth="1.5"/>
  </g>;
}
