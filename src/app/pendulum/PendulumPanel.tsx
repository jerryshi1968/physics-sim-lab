import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { PENDULUM } from '../../equipment/pendulum/definitions.ts';
import { SUPPORT } from '../../equipment/mechanical/definitions.ts';
import type { PendulumSimulation } from './usePendulumSimulation.ts';

export function PendulumPanel({ scene, simulation: s, onAttach, onGravity }: { scene: SceneDocument; simulation: PendulumSimulation; onAttach: (id: string, supportId: string) => void; onGravity: (value: number) => boolean }) {
  const bob = scene.equipment.find(item => item.type === PENDULUM);
  const [gravityDraft, setGravityDraft] = useState<{ raw: string; applied: number } | null>(null);
  const activeGravity = gravityDraft?.applied === scene.simulationConfig.gravityMPerS2 ? gravityDraft : null;
  return <section className="projectile-panel pendulum-panel"><h3>单摆释放与计时</h3>
    <label>重力加速度 g（m/s²）<input aria-label="重力加速度 g（m/s²）" type="number" min="0" step="0.01" value={activeGravity?.raw ?? scene.simulationConfig.gravityMPerS2}
      onChange={event => {
        const raw = event.currentTarget.value, value = event.currentTarget.valueAsNumber;
        const valid = raw.trim() !== '' && Number.isFinite(value) && value > 0;
        const applied = valid && onGravity(value) ? value : scene.simulationConfig.gravityMPerS2;
        setGravityDraft({ raw, applied });
      }} onBlur={() => setGravityDraft(null)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setGravityDraft(null); } }} /></label>
    {activeGravity && (!(Number(activeGravity.raw) > 0) || !Number.isFinite(Number(activeGravity.raw))) && <p role="status">请输入大于零的有限重力加速度；无效输入未应用，失焦恢复。</p>}
    {bob && <label>单摆连接支架<select aria-label="单摆连接支架" value={String(bob.parameters.supportId)} onChange={event => onAttach(bob.id, event.target.value)}><option value="">未连接</option>{scene.equipment.filter(item => item.type === SUPPORT).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label>}
    <label>完整周期数 N<select aria-label="完整周期数 N" value={s.cycles} onChange={event => s.setCycles(Number(event.target.value))}>{[1, 5, 10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <div className="projectile-controls"><button onClick={s.release} disabled={!s.rig.ok || !s.rig.timer || Math.abs(s.rig.amplitudeRad) < 1e-10}>释放并计时</button><button onClick={s.pause} disabled={!s.running}>暂停单摆</button><button onClick={s.resume} disabled={!s.run || s.running || s.run.completed}>继续单摆</button><button onClick={s.step} disabled={!s.run || s.running || s.run.completed}>单步计时</button><button onClick={s.reset}>重置单摆</button></div>
    <label>播放速度<select aria-label="单摆播放速度" value={s.rate} onChange={event => s.setRate(Number(event.target.value))}>{[.25, 1, 5, 10].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
    {!s.rig.ok ? <p role="status">{s.rig.message}</p> : <>
      {!s.rig.timer && <p role="status">请添加计时器后进行多周期计时。</p>}
      {Math.abs(s.rig.amplitudeRad) < 1e-10 && <p role="status">释放摆角为零，摆球保持静止；请重置并设置非零摆角。</p>}
      <p data-testid="pendulum-clock" data-time-s={s.displayS}>{s.displayS.toFixed(s.rig.ok && s.rig.timer ? Math.min(4, Math.max(0, Math.ceil(-Math.log10(Number(s.rig.timer.parameters.resolutionS))))) : 3)} s；完整周期 {s.countedCycles} / {s.run?.targetCycles ?? s.cycles}{s.run?.completed ? '；计时完成' : s.running ? '；计时中' : '；已暂停或待释放'}</p>
      <p>{s.rig.smallAngle ? '小角条件：释放摆角不超过 5°。' : '摆角超过 5°：可研究角度影响，按小角公式求 g 会偏小。'}</p>
      <details><summary>查看本装置模型值</summary><p>摆长 L={Number(s.rig.lengthM.toPrecision(6))} m；周期 T={Number(s.rig.periodS.toPrecision(7))} s；g={s.rig.gravity} m/s²。</p></details>
    </>}
    <details><summary>操作与摆长定义</summary><p>摆长为悬点到球心的距离，即摆线长度加摆球半径。重置后可拖动摆球调整角度；摆长、摆角、挂接及计时参数修改立即生效并清除本次计时；移动独立尺不清除计时。</p><p>从释放端点开始计时，回到同一端点一次才算一个完整周期。计时器在 N 个完整周期后停止；暂停会冻结模拟时间。放慢或加速播放不改变计时结果。尺和秒表读数由自己填写，可选择采集秒表示数。</p><p>模型为无阻尼质点单摆，摆球半径仅用于摆长；大摆角使用非线性方程，忽略摆球转动惯量和空气阻力。</p></details>
  </section>;
}
