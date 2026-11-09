import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { densityMethod } from '../../equipment/density/simulate.ts';
import { densityPhaseList, densityPhases, densitySource } from '../../equipment/density/measure.ts';
import type { DensityPhase } from '../../equipment/density/measure.ts';
export function DensityRecords({ scene, ready, onCapture, onResult }: { scene: SceneDocument; ready: boolean; onCapture: (input: { phase: DensityPhase; raw: string; group: string; note: string }) => string | null; onResult: (ids: string[], group: string) => string | null }) {
  const phases = densityPhaseList(densityMethod(scene)), [phase, setPhase] = useState<DensityPhase>(phases[0]!), [raw, setRaw] = useState(''), [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [selected, setSelected] = useState<Record<string, string>>({});
  const sources = scene.measurementRecords.flatMap(row => { const source = densitySource(scene, row); return source ? [{ row, source }] : []; });
  const mass = ['mass', 'liquid-before', 'liquid-after'].includes(phase);
  return <section className="density-records"><h3>密度读数与计算</h3><p>天平读数 = 右盘砝码质量 + 游码刻度；量筒平视凹液面最低处。每步读数独立保存快照；不自动填写模型值。</p>
    <form onSubmit={event => { event.preventDefault(); const failure = onCapture({ phase, raw, group, note }); setError(failure ?? ''); setMessage(failure ? '' : '已新增一条读数；请选择下一阶段继续测量。'); if (!failure) { const index = phases.indexOf(phase); if (index < 2) setPhase(phases[index + 1]!); setRaw(''); } }}>
      <label>密度实验组名<input aria-label="密度实验组名" value={group} maxLength={100} onChange={event => setGroup(event.target.value)}/></label><label>本次读数阶段<select aria-label="本次读数阶段" value={phase} onChange={event => { setPhase(event.target.value as DensityPhase); setError(''); setMessage(''); }}>{phases.map(value => <option key={value} value={value}>{densityPhases[value]}</option>)}</select></label>
      <label>{mass ? '天平手工读数（g）' : '液面手工读数（mL）'}<input aria-label={mass ? '天平手工读数（g）' : '液面手工读数（mL）'} inputMode="decimal" value={raw} maxLength={100} onChange={event => setRaw(event.target.value)}/></label><label>密度实验备注<input aria-label="密度实验备注" value={note} maxLength={100} onChange={event => setNote(event.target.value)}/></label>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}<button disabled={!ready}>保存本次密度读数</button>
    </form>
    <fieldset><legend>选择三条来源记录计算密度</legend>{phases.map((value, index) => <label key={value}>{densityPhases[value]}来源<select aria-label={`密度来源${index + 1}`} value={selected[value] ?? ''} onChange={event => setSelected(current => ({ ...current, [value]: event.target.value }))}><option value="">请选择有效读数</option>{sources.filter(({ row, source }) => source.phase === value && row.measurementStatus === 'valid').map(({ row, source }) => <option key={row.id} value={row.id}>{source.snapshot.setupLabel} · 第{row.sequence}次 · {Number((row.value! * (row.unit === 'kg' ? 1000 : 1e6)).toPrecision(8))} {row.unit === 'kg' ? 'g' : 'mL'}</option>)}</select></label>)}</fieldset>
    <button disabled={!ready || phases.some(value => !selected[value])} onClick={() => { const failure = onResult(phases.map(value => selected[value]!), group); setError(failure ?? ''); setMessage(failure ? '' : '已按所选手工读数新增质量、体积与密度三行。'); }}>按所选读数计算密度</button>
    <p>表格、修订、图线和 CSV 使用 g、mL（=cm³）、g/cm³；内部与 JSON 用 kg、m³、kg/m³。修改来源后请重新计算；已有结果保留生成时的源值和快照，删除来源行仍保留被结果引用的快照。</p>
  </section>;
}
