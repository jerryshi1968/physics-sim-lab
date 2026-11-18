import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { BEAKER, SPECIMEN } from '../../equipment/density/definitions.ts';
import { massPhases, massSource } from '../../equipment/mass/measure.ts';
import type { MassPhase } from '../../equipment/mass/measure.ts';
export function MassRecords({ scene, ready, onCapture, onCalculate }: { scene: SceneDocument; ready: boolean; onCapture: (input: { phase: MassPhase; raw: string; group: string; note: string }) => string | null; onCalculate: (ids: string[], group: string) => string | null }) {
  const [phase, setPhase] = useState<MassPhase>(scene.equipment.some(i => i.type === SPECIMEN) ? 'solid' : 'tare'), [raw, setRaw] = useState(''), [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [selected, setSelected] = useState<Record<string, string>>({});
  const phases = (Object.keys(massPhases) as MassPhase[]).filter(p => scene.equipment.some(i => i.type === (p === 'solid' ? SPECIMEN : BEAKER))), sources = scene.measurementRecords.flatMap(row => { const source = massSource(scene, row); return source && row.measurementStatus === 'valid' ? [{ row, source }] : []; });
  const activePhase = phases.includes(phase) ? phase : phases[0] ?? 'solid';
  return <section className="density-records"><h3>质量读数与计算</h3><p>右盘砝码质量加游码刻度为天平读数；先配平，再手工填写。留空记缺失，不自动填写答案。</p>
    <form onSubmit={e => { e.preventDefault(); const failure = onCapture({ phase: activePhase, raw, group, note }); setError(failure ?? ''); setMessage(failure ? '' : '已保存本次质量读数。'); if (!failure) { setRaw(''); if (activePhase === 'tare') setPhase('total'); } }}>
      <label>质量实验组名<input value={group} maxLength={100} onChange={e => setGroup(e.target.value)} /></label><label>本次称量阶段<select aria-label="本次称量阶段" value={activePhase} onChange={e => setPhase(e.target.value as MassPhase)}>{phases.map(p => <option key={p} value={p}>{massPhases[p]}</option>)}</select></label>
      <label>天平手工读数（g）<input inputMode="decimal" value={raw} maxLength={100} onChange={e => setRaw(e.target.value)} /></label><label>质量实验备注<input value={note} maxLength={100} onChange={e => setNote(e.target.value)} /></label>
      <button disabled={!ready || !phases.includes(activePhase)}>保存本次质量读数</button>
    </form>
    {scene.equipment.some(i => i.type === BEAKER) && <><fieldset><legend>选择两条来源计算液体质量</legend>{(['tare', 'total'] as const).map(p => <label key={p}>{massPhases[p]}来源<select aria-label={`${massPhases[p]}来源`} value={selected[p] ?? ''} onChange={e => setSelected(s => ({ ...s, [p]: e.target.value }))}><option value="">请选择有效读数</option>{sources.filter(s => s.source.phase === p && s.source.snapshot.setupLabel === group).map(({ row, source }) => <option key={row.id} value={row.id}>{source.snapshot.setupLabel} · 第{row.sequence}次 · {Number((row.value! * 1000).toPrecision(8))} g</option>)}</select></label>)}</fieldset><button disabled={!ready || !selected.tare || !selected.total} onClick={() => { const failure = onCalculate([selected.tare!, selected.total!], group); setError(failure ?? ''); setMessage(failure ? '' : '已按总质量减空杯质量保存液体质量。'); }}>计算液体质量</button></>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}<p>记录和 CSV 使用 g，内部及 JSON 使用 kg；来源保留称量时装置。修订来源后需重新计算，已有结果保留原值。</p>
  </section>;
}
