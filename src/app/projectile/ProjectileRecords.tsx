import { useMemo,useState } from 'react';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { SCALE } from '../../equipment/projectile/definitions.ts';
import { projectileRuler,projectileMessage,beginProjectileFlight } from '../../equipment/projectile/simulate.ts';
import type { ProjectileFlight } from '../../equipment/projectile/simulate.ts';
import type { ProjectileCapture } from '../../equipment/projectile/measure.ts';
export function ProjectileRecords({scene,registry,flight,ready,onCapture}:{scene:SceneDocument;registry:EquipmentRegistry;flight:ProjectileFlight|null;ready:boolean;onCapture:(input:ProjectileCapture)=>string|null}){
  const scales=scene.equipment.filter(item=>item.type===SCALE),[scaleId,setScaleId]=useState(''),[raw,setRaw]=useState(['','','','','','']),[setupLabel,setSetupLabel]=useState('平抛对照'),[note,setNote]=useState(''),[error,setError]=useState('');
  const preview=useMemo(()=>!flight?beginProjectileFlight(scene,registry,'projectile-reader-preview'):null,[scene,registry,flight]);
  const observed=flight??(preview?.ok?preview.flight:null);
  const rulerId=scales.find(item=>item.id===scaleId)?.id??scales[0]?.id??'',read=observed?projectileRuler(scene,observed,rulerId):null;
  const width=read?.ok?Number(read.ruler.parameters.widthM):2,height=read?.ok?Number(read.ruler.parameters.heightM):1.4;
  const labels=['平抛时间读数（s）','本次起点横尺读数（m）','小球横尺读数（m）','本次起点竖尺读数（m）','小球竖尺读数（m）','地面竖尺读数（m）'];
  return <section className="projectile-records"><h3>平抛计时与读尺记录</h3><p>发射前先读起点和地面，量出发射高度；暂停或单步后再读小球位置。刻度标数为 cm，换算为 m；分别读取本次起点与小球的位置，相减得到水平位移及向下位移。竖尺向下增加，不能把世界 y 当成 ydrop；输入留空记缺失。</p>
    <label>平抛读尺来源<select aria-label="平抛读尺来源" value={rulerId} onChange={event=>setScaleId(event.target.value)}>{scales.map(item=><option key={item.id} value={item.id}>二维标尺 · {item.id}</option>)}</select></label>
    {read?.ok?<div className="projectile-ruler-scroll" role="region" tabIndex={0} aria-label="平抛读尺放大窗，可横纵滚动"><svg width={width*600+80} height={height*600+70} role="img" aria-label="本次起点与小球在实际标尺上的位置，不显示自动答案"><rect width={width*600+80} height={height*600+70} fill="#f5f7ed"/>
      {Array.from({length:Math.floor(width*100)+1},(_,i)=><g key={`x${i}`}><path d={`M${45+i*6} 32V${height*600+32}`} stroke={i%10?'#e2e9dd':'#bcccb6'} strokeWidth={i%10?.6:1}/>{i%10===0&&<text x={45+i*6} y="22" textAnchor="middle" fontSize="11">{i}</text>}</g>)}
      {Array.from({length:Math.floor(height*100)+1},(_,i)=><g key={`y${i}`}><path d={`M45 ${32+i*6}H${width*600+45}`} stroke={i%10?'#e2e9dd':'#bcccb6'} strokeWidth={i%10?.6:1}/>{i%10===0&&<text x="33" y={36+i*6} textAnchor="end" fontSize="11">{i}</text>}</g>)}
      {read.groundM>=0&&read.groundM<=height&&<g data-projectile-ground-read={read.groundM}><path d={`M45 ${32+read.groundM*600}H${width*600+45}`} stroke="#697d6a" strokeWidth="1.5" strokeDasharray="8 4"/><text x={width*600+40} y={26+read.groundM*600} textAnchor="end" fontSize="12">地面</text></g>}
      {(flight?[read.origin,read.ball]:[read.origin]).map((point,index)=><g key={index} data-projectile-reader={index?'ball':'origin'} data-read-x={point.xM} data-read-y={point.yM}><path d={`M${45+point.xM*600} 32V${32+point.yM*600}H45`} stroke={index?'#bb7631':'#167e6a'} fill="none" strokeDasharray="4 3"/><circle cx={45+point.xM*600} cy={32+point.yM*600} r="5" fill={index?'#bb7631':'#167e6a'}/><text x={53+point.xM*600} y={27+point.yM*600} fontSize="12">{index?'小球':flight?'本次起点':'发射点'}</text></g>)}
    </svg></div>:<p>{read&&!read.ok?projectileMessage(read.code):'请先发射或单步，再暂停并在标尺上读数。'}</p>}
    {read?.ok&&(read.groundM<0||read.groundM>height)&&<p>地面未被当前标尺覆盖，发射高度记录不可用；请移动标尺或扩大量程。</p>}
    <form onSubmit={event=>{event.preventDefault();setError(onCapture({rulerId,timeRaw:raw[0]!,originXRaw:raw[1]!,ballXRaw:raw[2]!,originYRaw:raw[3]!,ballYRaw:raw[4]!,groundYRaw:raw[5]!,setupLabel,note})??'');}}><label>平抛对照组<input aria-label="平抛对照组" value={setupLabel} maxLength={100} onChange={event=>setSetupLabel(event.target.value)}/></label><div className="projectile-entry">{labels.map((label,index)=><label key={label}>{label}<input aria-label={label} inputMode="decimal" maxLength={100} value={raw[index]} onChange={event=>setRaw(values=>values.map((value,i)=>i===index?event.target.value:value))}/></label>)}</div><label>平抛备注<input aria-label="平抛备注" value={note} maxLength={100} onChange={event=>setNote(event.target.value)}/></label><button disabled={!ready||!read?.ok}>保存平抛读数</button></form>
    <p>本次发射初态与采样时待发装置分别留档；每次发射独立成图线。发射高度由地面与起点竖尺读数相减；每组另留两行，落地时再记落地时间与射程。重新发射后请重新核对保留的输入。手工行可独立修订，修改尺读数后请同步核对位移；图线和拟合只用记录值。</p>{error&&<p role="alert">{error}</p>}
  </section>;
}
