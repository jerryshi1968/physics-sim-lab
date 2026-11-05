import { useState } from 'react';
import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';
import type { LeverCapture, LeverEntry } from '../../equipment/mechanical/measure.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { mechanicalLabel } from '../../equipment/mechanical/definitions.ts';
export function LeverRecords({ scene, outcome, ready, onCapture }: { scene: SceneDocument; outcome: LeverOutcome; ready: boolean; onCapture: (entry: LeverCapture) => string | null }) {
  const [entries, setEntries] = useState<Record<string, LeverEntry>>({}), [setupLabel, setSetupLabel] = useState('第1组'), [note, setNote] = useState(''), [observation, setObservation] = useState('未判定'), [error, setError] = useState('');
  const loads = outcome.ok ? outcome.loads.filter(load => load.kind === 'weight' || load.kind === 'meter' || load.forceN > 0) : [];
  function entry(id: string): LeverEntry { return entries[id] ?? { equipmentId: id, forceRaw: '', armRaw: '', turn: '' }; }
  return <div className="lever-records"><h3>杠杆测量与记录</h3><p>独立尺可摆放、缩放读数；力臂是到作用线的垂直距离，斜拉不能直接填沿杆距离。力/力臂手工填写，选力矩方向后由本组输入相乘计算力矩；留空记缺失，不填理论答案。挂点、方向、自重、平衡状态与器材快照随组保存。</p>
    <form onSubmit={event => { event.preventDefault(); setError(onCapture({ entries: loads.map(load => entry(load.id)), setupLabel, note, observation }) ?? ''); }}>
      <label>组别<input value={setupLabel} maxLength={100} onChange={event => setSetupLabel(event.target.value)} /></label>
      {loads.map(load => <fieldset key={load.id}><legend>{mechanicalLabel(scene, load.id)} · {load.hookIndex === null ? load.kind === 'self' ? '杆自重' : '调平螺母' : `挂点 ${load.hookIndex}`}</legend><div className="lever-entry-row">
        <label>力（N）<input aria-label={`${mechanicalLabel(scene, load.id)} 力（N）`} inputMode="decimal" value={entry(load.id).forceRaw} onChange={event => setEntries(current => ({ ...current, [load.id]: { ...entry(load.id), forceRaw: event.target.value } }))} maxLength={100} /></label>
        <label>力臂（m）<input aria-label={`${mechanicalLabel(scene, load.id)} 力臂（m）`} inputMode="decimal" value={entry(load.id).armRaw} onChange={event => setEntries(current => ({ ...current, [load.id]: { ...entry(load.id), armRaw: event.target.value } }))} maxLength={100} /></label>
        <label>力矩方向<select aria-label={`${mechanicalLabel(scene, load.id)} 力矩方向`} value={entry(load.id).turn} onChange={event => setEntries(current => ({ ...current, [load.id]: { ...entry(load.id), turn: event.target.value as LeverEntry['turn'] } }))}><option value="">未判定</option><option value="ccw">逆时针（正）</option><option value="cw">顺时针（负）</option></select></label>
      </div></fieldset>)}
      <div className="lever-entry-row"><label>观察平衡状态<select aria-label="观察平衡状态" value={observation} onChange={event => setObservation(event.target.value)}><option>未判定</option><option>平衡</option><option>不平衡</option></select></label><label>本组备注<input value={note} onChange={event => setNote(event.target.value)} maxLength={120} /></label></div>
      <button disabled={!ready || !loads.length}>保存力与力臂记录</button>
    </form>{error && <p role="alert">{error}</p>}
  </div>;
}
