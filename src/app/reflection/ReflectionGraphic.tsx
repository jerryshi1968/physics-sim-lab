import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { MIRROR,EMITTER,PAPER,PROTRACTOR,NORMAL } from '../../equipment/reflection/definitions.ts';
export function reflectionBounds(item:EquipmentInstance){
  if(item.type===PAPER){const w=Number(item.parameters.halfWidthM),h=Number(item.parameters.heightM);return{x:-w,y:-h,width:2*w,height:h+.015};}
  if(item.type===PROTRACTOR){const r=Number(item.parameters.radiusM);return{x:-r,y:-r,width:2*r,height:r+.015};}
  if(item.type===MIRROR){const l=Number(item.parameters.lengthM);return{x:-l/2,y:-.006,width:l,height:.045};}
  if(item.type===NORMAL)return{x:-.018,y:-Number(item.parameters.lengthM),width:.036,height:Number(item.parameters.lengthM)};
  return{x:-.09,y:-.035,width:.12,height:.07};
}
export function ReflectionGraphic({instance:item}:{instance:EquipmentInstance}){
  const p=item.parameters,r=Number(p.radiusM??.36),w=Number(p.halfWidthM??.46),h=Number(p.heightM??.6),fold=Number(p.foldRad??0),k=r/.36;
  return <g className="real-apparatus" stroke="none" data-appearance="physical" data-reflection-type={item.type}>
    {item.type===PAPER&&<><rect x={-w} y={-h} width={w} height={h} fill="#fbf8e8" stroke="#b9b698" strokeWidth="1"/><polygon vectorEffect="non-scaling-stroke" data-folded-leaf="true" data-fold-rad={fold} points={`0,0 ${w*Math.cos(fold)},0 ${w*Math.cos(fold)},${-h} 0,${-h}`} fill={Math.abs(fold)>.01?'#e1dbc3':'#fffbed'} stroke="#a9b3a0" strokeWidth="1.5"/><path d={`M0 0V${-h}`} stroke="#758b7b" strokeWidth="2" strokeDasharray="3 3"/><circle cy={-h} r=".009" fill="#a4b09b"/></>}
    {item.type===MIRROR&&<><rect x={-Number(p.lengthM)/2} y="0" width={Number(p.lengthM)} height=".035" rx=".004" fill="#677d85" stroke="#3c5863" strokeWidth="1.5"/><path d={`M${-Number(p.lengthM)/2} -.002H${Number(p.lengthM)/2}`} stroke="#acd4dd" strokeWidth="5"/><text x="0" y=".025" textAnchor="middle" fontSize=".017" fill="white">镜背</text></>}
    {item.type===NORMAL&&<><path d={`M0 0V${-Number(p.lengthM)}`} stroke="#377d70" strokeWidth="1.5" strokeDasharray="5 4"/><circle r=".007" fill="#377d70"/><path d="M0-.025H.025V0" stroke="#377d70" strokeWidth="1" fill="none"/></>}
    {item.type===PROTRACTOR&&<><path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`} fill="#dceee022" stroke="#8ea68f" strokeWidth="1.5"/>{Array.from({length:181},(_,i)=>{const a=(i-90)*Math.PI/180,major=i%10===0,start=r-(major?.035*k:i%5===0?.022*k:.012*k);return <g key={i}><path d={`M${Math.sin(a)*start} ${-Math.cos(a)*start}L${Math.sin(a)*r} ${-Math.cos(a)*r}`} stroke="#688678" strokeWidth={major?1:.5}/>{major&&<text x={Math.sin(a)*(r-.06*k)} y={-Math.cos(a)*(r-.06*k)+.006*k} fontSize={.019*k} textAnchor="middle" fill="#365c4b">{Math.abs(i-90)}</text>}</g>;})}<path d="M-.018 0H.018M0-.018V.018" stroke="#638472" strokeWidth="1"/><text x={-r+.07*k} y={-.018*k} fontSize={.015*k} fill="#547963">相对法线 · °</text></>}
    {item.type===EMITTER&&<><rect x="-.085" y="-.028" width=".085" height=".056" rx=".012" fill="#3c6069" stroke="#213e48" strokeWidth="1.5"/><rect x="-.02" y="-.033" width=".022" height=".066" rx=".004" fill="#839f9f"/><circle cx=".008" r=".01" fill={p.enabled?'#ef9353':'#6b7876'}/><path d="M-.065-.015H-.035" stroke="#b0c4bb" strokeWidth="2"/></>}
  </g>;
}
