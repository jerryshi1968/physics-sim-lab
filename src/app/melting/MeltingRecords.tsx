import { useState } from 'react';
import type { MeltingCapture } from '../../equipment/melting/measure.ts';
import type { MeltingSimulation } from './useMelting.ts';
export function MeltingRecords({simulation:s,onCapture}:{simulation:MeltingSimulation;onCapture:(input:MeltingCapture)=>string|null}) {
  const[input,setInput]=useState<MeltingCapture>({source:'manual',timeRaw:'',temperatureRaw:'',setupLabel:'第1组',note:''}),[message,setMessage]=useState('');
  const save=(source:MeltingCapture['source'])=>setMessage(onCapture({...input,source})??'已保存本次样品读数。');
  return <section className="spring-records"><h3>熔化过程的温度与时间记录</h3><p>时间填 min、温度填 ℃；先记录海波，再换石蜡比较。填写颗粒、固液共存或液体等实际观察，留空记缺失。</p><div className="measurement-fields">{([['setupLabel','熔化实验组名'],['timeRaw','记录时间（min）'],['temperatureRaw','样品温度（℃）'],['note','样品物态与观察']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} value={input[key]} maxLength={100} onChange={e=>setInput(old=>({...old,[key]:e.target.value}))}/></label>)}</div><div className="projectile-controls"><button disabled={!s.reading.ok||!s.rig.bathRig.timer} onClick={()=>save('manual')}>保存熔化抄表</button><button disabled={!s.reading.ok||!s.rig.bathRig.timer} onClick={()=>save('instrument')}>采集样品温度和记录时间</button></div>{message&&<p role="status">{message}</p>}</section>;
}
