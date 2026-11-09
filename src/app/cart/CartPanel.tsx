import { useEffect, useRef, useState } from 'react';
import { cartMessage } from '../../equipment/cart/simulate.ts';
import type { CartSimulation } from './useCartSimulation.ts';

export function CartStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="cart-start-title" onCancel={onCancel}>
    <h2 id="cart-start-title">加速度与力、质量实验</h2>
    <p>用悬挂砝码牵引水平轨道上的小车。可分别用两个光电门和打点纸带测加速度。</p>
    <label><input type="radio" name="cart-start" checked={!empty} onChange={() => setEmpty(false)} />一套小车器材（含两种计时方式）</label>
    <label><input type="radio" name="cart-start" checked={empty} onChange={() => setEmpty(true)} />小车实验空白搭建</label>
    <div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览小车实验</button></div>
  </dialog>;
}

export function CartPanel({ simulation, preview, onViewTape }: { simulation: CartSimulation; preview: boolean; onViewTape: () => void }) {
  const { rig, run, running, release, pause, resume, step, reset } = simulation;
  const ended = !!run && run.timeS >= run.rig.endTimeS;
  const available = !!rig?.ok && !preview;
  return <section className="projectile-panel">
    <h3>小车释放与计时</h3>
    <div className="simulation-actions">
      <button disabled={!available} onClick={release}>释放小车</button>
      <button disabled={!running} onClick={pause}>暂停小车</button>
      <button disabled={!available || !run || running || ended} onClick={resume}>继续小车</button>
      <button disabled={!available || !run || running || ended} onClick={step}>单步采样</button>
      <button disabled={!run} onClick={reset}>重置小车</button>
      <button onClick={onViewTape}>查看打点纸带</button>
    </div>
    <p data-testid="cart-status">{rig && !rig.ok ? cartMessage(rig.code) : !run ? '待释放' : ended ? run.rig.stopReason : running ? '运行中（半速播放）' : '已暂停'}{run && ` · ${run.timeS.toFixed(3)} s`}</p>
    {rig?.ok && <>
      <p>系统质量 M = 小车 + 车上配重 + 悬挂总质量（含挂钩）。沿绳运动方向的系统合外力 F = 悬挂总质量 × g。</p>
      <p data-testid="cart-system">M = {Number(rig.systemKg.toPrecision(6))} kg · F = {Number(rig.forceN.toPrecision(6))} N</p>
      <p>研究力时，将配重在车上与悬挂端之间转移以固定 M。研究质量时，保持悬挂质量不变，只改车上配重。</p>
      <p>参数可在器材属性中修改。改动装置会结束当前运行，已保存的测量保留。</p>
      <details><summary>查看理想模型值</summary><p>a = F/M = {Number(rig.acceleration.toPrecision(6))} m/s²</p></details>
    </>}
  </section>;
}
