import { useState } from 'react';
import type { FrictionCapture } from '../../equipment/mechanical/frictionMeasure.ts';
export function FrictionRecords({ ready, onCapture }: { ready: boolean; onCapture: (input: FrictionCapture) => string | null }) {
  const [source, setSource] = useState<'manual' | 'instrument'>('manual'), [setupLabel, setSetupLabel] = useState('摩擦对照'), [note, setNote] = useState(''), [pressureRaw, setPressure] = useState(''), [pullRaw, setPull] = useState(''), [frictionRaw, setFriction] = useState(''), [error, setError] = useState('');
  return <section className="friction-records"><h3>摩擦测量与记录</h3><p>匀速滑动稳态时，水平牵引力大小等于滑动摩擦力。非稳态仍可记录牵引力并保留标签，不将其作为有效摩擦图点。压力由总质量×g 计算；面积、材料、时刻与速度状态随快照保存。</p><form onSubmit={event => { event.preventDefault(); setError(onCapture({ source, setupLabel, note, pressureRaw, pullRaw, frictionRaw }) ?? ''); }}>
    <label>记录来源<select aria-label="摩擦记录来源" value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="manual">手工抄表</option><option value="instrument">采集仪表示数</option></select></label>
    <label>对照组名<input aria-label="摩擦对照组名" value={setupLabel} maxLength={100} onChange={event => setSetupLabel(event.target.value)} /></label>
    {source === 'manual' && <div className="friction-entry"><label>压力（N）<input aria-label="摩擦压力抄表" value={pressureRaw} onChange={event => setPressure(event.target.value)} inputMode="decimal" maxLength={100} /></label><label>牵引力（N）<input aria-label="摩擦牵引力抄表" value={pullRaw} onChange={event => setPull(event.target.value)} inputMode="decimal" maxLength={100} /></label><label>滑动摩擦力（N）<input aria-label="摩擦力抄表" value={frictionRaw} onChange={event => setFriction(event.target.value)} inputMode="decimal" maxLength={100} /></label></div>}
    <label>实验备注<input aria-label="摩擦实验备注" value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label><button disabled={!ready}>保存摩擦记录</button>
  </form>{error && <p role="alert">{error}</p>}</section>;
}
