import { useState } from 'react';
import type { AverageSpeedSimulation } from './useAverageSpeed.ts';
export function AverageSpeedPanel({simulation:s,angle,onAngle,onStop}:{simulation:AverageSpeedSimulation;angle:number;onAngle:(degrees:number)=>void;onStop:(half:boolean)=>void}) {
  const[draft,setDraft]=useState<string|null>(null);
  return <section className="config-section average-speed-panel"><h3>平均速度：释放与计时</h3><div className="projectile-controls"><button disabled={!s.rig.ok} onClick={s.release}>释放并计时</button><button disabled={!s.running} onClick={s.pause}>暂停运动</button><button disabled={!s.run||s.running||s.completed} onClick={s.resume}>继续运动</button><button disabled={!s.run||s.completed} onClick={s.step}>单步运动</button><button onClick={s.reset}>重置到起点</button></div>
    <p data-testid="average-speed-clock" data-time-s={s.displayS}>{s.completed?'已撞到挡片，停表':s.running?'运动中':s.run?'已暂停':'待释放'}：{s.displayS.toFixed(s.rig.ok?Math.min(4,Math.ceil(-Math.log10(s.rig.resolutionS))):2)} s</p>
    {!s.rig.ok&&<p role="status">{s.rig.message}</p>}
    <label>运动播放速度<select aria-label="运动播放速度" value={s.rate} onChange={e=>s.setRate(Number(e.target.value))}>{[.25,.5,1].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
    <label>斜面坡度（°）<input aria-label="斜面坡度（°）" type="number" min="1" max="8" step=".1" value={draft??Number(angle.toFixed(4))} onChange={e=>{const n=e.currentTarget.valueAsNumber;setDraft(e.currentTarget.value);if(Number.isFinite(n)&&n>=1&&n<=8)onAngle(n);}} onBlur={()=>setDraft(null)}/></label>
    <div className="projectile-controls"><button disabled={!s.rig.ok} onClick={()=>onStop(false)}>挡片移到低端</button><button disabled={!s.rig.ok} onClick={()=>onStop(true)}>挡片移到中部</button></div>
    <p>也可直接拖动金属挡片。移片后小车回到原起点，再静止释放一次；用同一小车前端作为路程标记。</p>
    <details><summary>实验步骤与模型范围</summary><p>将斜面右端垫高，保持小坡度。沿斜面读起始车头和挡片位置，先测全程；移挡片后重新释放，测上半程。保存各自的路程与时间，用 v=s/t 比较平均速度。</p><p>简化为沿无阻力斜面运动的质点，a=g·sinθ；忽略车轮转动惯量、摩擦及人工按表误差。撞片时截断，不模拟反弹。播放速度只改变观看快慢，停表显示实验时间；改变起点、坡度或挡片需重新释放。</p></details>
  </section>;
}
