import type { MeltingSimulation } from './useMelting.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { materialLabels } from '../../equipment/melting/definitions.ts';
import { useState } from 'react';
function NumberField({label,value,min,max,onValue}:{label:string;value:number;min:number;max:number;onValue:(n:number)=>void}) {
  const[draft,setDraft]=useState<{raw:string;value:number}|null>(null);
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step="any" value={draft?.value===value?draft.raw:value} onChange={e=>{const raw=e.currentTarget.value,n=e.currentTarget.valueAsNumber;if(raw!==''&&Number.isFinite(n)&&n>=min&&n<=max){onValue(n);setDraft({raw,value:n});}else setDraft({raw,value});}} onBlur={()=>setDraft(null)}/></label>;
}
export function MeltingPanel({simulation:s,onUpdate}:{simulation:MeltingSimulation;onUpdate:(item:EquipmentInstance,values:EquipmentInstance['parameters'])=>void}) {
  const tube=s.rig.tube,bath=s.rig.bathRig,heater=bath.heater,beaker=bath.beaker;
  return <section className="config-section thermal-controls melting-controls"><h3>水浴与固体熔化观察</h3>{tube&&<label>试管样品<select aria-label="试管样品" value={String(tube.parameters.material)} onChange={e=>onUpdate(tube,{material:e.target.value})}>{Object.entries(materialLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
    <div className="projectile-controls"><button disabled={!s.rig.ok||!s.state.waterKg||!bath.contact&&!s.heating} onClick={s.heat}>{s.heating?'停止水浴加热':'开始水浴加热'}</button><button disabled={!s.running} onClick={s.pause}>暂停熔化实验</button><button disabled={!s.rig.ok||s.running||!s.state.waterKg} onClick={s.resume}>继续熔化实验</button><button disabled={!s.rig.ok||!s.state.waterKg} onClick={s.step}>单步熔化实验</button><button onClick={s.reset}>重置熔化实验</button></div>
    <p data-testid="melting-clock" data-time-s={s.state.timeS} data-record-s={s.displayS}>加热过程 {s.state.timeS.toFixed(1)} s；记录计时 {(s.displayS/60).toFixed(2)} min；{s.running?'运行中':'已暂停'}</p>
    <p data-testid="melting-reading">样品温度计：{s.reading.ok?`${Number((s.reading.valueK-273.15).toFixed(4))} ℃`:'—'}</p>
    <p role="status">{s.rig.message||(!s.state.waterKg?'水浴已干，请重置。':!s.coupled?'请把试管样品段浸没在水浴中，管口露出水面，管底不碰杯底。':!s.reading.ok?s.reading.message:'观察试管中的颗粒、液体与温度计，按间隔保存读数。')}</p>
    <button disabled={!s.reading.ok} onClick={s.zero}>记录计时归零</button><p className="editor-help">约升至 40 ℃时可将记录计时归零，再每隔约 1 min 记录。归零保留当前温度和物态；完全熔化后继续记录 4～5 次。换样品会从初态重做，历史记录保留。</p>
    <label>熔化播放速度<select aria-label="熔化播放速度" value={s.rate} onChange={e=>s.setRate(Number(e.target.value))}>{[1,5,20,60].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><NumberField label="熔化单步间隔（s）" value={s.stepS} min={1} max={300} onValue={s.setStepS}/>
    {tube&&<><NumberField label="样品质量（g）" value={Number(tube.parameters.massKg)*1000} min={5} max={50} onValue={v=>onUpdate(tube,{massKg:v/1000})}/><NumberField label="样品初温（℃）" value={Number((Number(tube.parameters.initialTemperatureK)-273.15).toFixed(5))} min={0} max={40} onValue={v=>onUpdate(tube,{initialTemperatureK:v+273.15})}/></>}
    {beaker&&<NumberField label="水浴初始水量（mL）" value={Number(beaker.parameters.liquidM3)*1e6} min={50} max={250} onValue={v=>onUpdate(beaker,{liquidM3:v/1e6})}/>}
    {heater&&<NumberField label="水浴初温（℃）" value={Number((Number(heater.parameters.initialTemperatureK)-273.15).toFixed(5))} min={0} max={100} onValue={v=>onUpdate(heater,{initialTemperatureK:v+273.15})}/>}
    <details><summary>实验步骤与模型范围</summary><p>试管中的样品通过水浴受热。将玻璃泡埋入样品且不碰壁底，先测一种材料，再换样品重新测量。手工观察和记录，不自动填入规律或结论。</p><p>采用水浴—样品两热容与焓法相变的教学模型，计入传热、散热和潜热；材料常数为近似设定。石蜡用分布熔程的混合样品示意，不代表所有牌号。忽略过冷、分解、温度梯度与温度计响应滞后，冷却不用于验证凝固规律。</p></details>
  </section>;
}
