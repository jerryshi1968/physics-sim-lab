import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { ReflectionCapture } from '../../equipment/reflection/measure.ts';
export function ReflectionRecords({scene,ready,onCapture}:{scene:SceneDocument;ready:boolean;onCapture:(input:ReflectionCapture)=>string|null}){
  const [incidence,setIncidence]=useState(''),[reflected,setReflected]=useState(''),[observation,setObservation]=useState('未判断'),[label,setLabel]=useState('反射对照'),[note,setNote]=useState(''),[error,setError]=useState('');
  const samples=(scene.measurementSnapshots??[]).filter(item=>item.modelVersion==='optical.reflection.spatial.v1');
  const angle=(sample:string,point:string)=>{const row=scene.measurementRecords.find(row=>row.context?.sampleId===sample&&row.context.pointLabel===point);return row?.measurementStatus==='valid'&&row.value!==null?`${Number((row.value*180/Math.PI).toPrecision(6))}°`:'—';};
  return <section className="reflection-records"><h3>量角与折板观察记录</h3><p>量角器每小格 1°，零线沿法线；填写自己的估读。折板上无连续光迹时反射角不可正常读，空白不补零。理论不会代填记录。</p><form onSubmit={event=>{event.preventDefault();setError(onCapture({incidenceDeg:incidence,reflectionDeg:reflected,observation,setupLabel:label,note})??'');}}>
    <label>反射实验组名<input aria-label="反射实验组名" value={label} maxLength={100} onChange={event=>setLabel(event.target.value)}/></label><div className="reflection-entry"><label>入射角估读（°）<input aria-label="入射角估读（°）" inputMode="decimal" value={incidence} maxLength={100} onChange={event=>setIncidence(event.target.value)}/></label><label>反射角估读（°）<input aria-label="反射角估读（°）" inputMode="decimal" value={reflected} maxLength={100} onChange={event=>setReflected(event.target.value)}/></label></div>
    <label>右纸板上的连续反射光迹<select aria-label="右纸板连续光迹观察" value={observation} onChange={event=>setObservation(event.target.value)}>{['未判断','能看到','不能看到'].map(value=><option key={value}>{value}</option>)}</select></label><label>反射实验备注<input aria-label="反射实验备注" value={note} maxLength={100} onChange={event=>setNote(event.target.value)}/></label><button disabled={!ready}>保存反射记录</button>{error&&<p role="alert">{error}</p>}</form>
    <p>角度存储和下方通用表/CSV/图统一用 SI rad；原始度数与折角/观察在追溯备注保留。通用表独立修订按 rad，π/6 rad=30°。</p>
    {samples.length>0&&<div className="reflection-table-scroll"><table aria-label="反射角度记录（度）"><thead><tr><th>组别</th><th>入射角</th><th>反射角</th><th>右纸板光迹</th></tr></thead><tbody>{samples.map(sample=>{const row=scene.measurementRecords.find(row=>row.context?.sampleId===sample.id&&row.context.pointLabel==='右纸板连续反射光迹');return <tr key={sample.id}><td>{sample.setupLabel}</td><td>{angle(sample.id,'入射角i')}</td><td>{angle(sample.id,'反射角r')}</td><td>{row?.value===1?'能看到':row?.value===0?'不能看到':'未记录'}</td></tr>;})}</tbody></table></div>}
  </section>;
}
