import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { buoyancyPhases } from '../../equipment/buoyancy/measure.ts';
import type { BuoyancyPhase, BuoyancyCalculation } from '../../equipment/buoyancy/measure.ts';

export function BuoyancyRecords({ scene, ready, onCapture, onCalculate }: { scene: SceneDocument; ready: boolean;
  onCapture: (phase: BuoyancyPhase, raw: string, group: string) => string | null; onCalculate: (kind: BuoyancyCalculation, ids: string[], group: string) => string | null }) {
  const [group, setGroup] = useState('第1组'), [phase, setPhase] = useState<BuoyancyPhase>('air'), [raw, setRaw] = useState(''), [error, setError] = useState('');
  const [kind, setKind] = useState<BuoyancyCalculation>('force'), [sources, setSources] = useState<string[]>(['', '', '']);
  const unit = phase === 'empty' || phase === 'full' ? 'g' : phase === 'volume' ? 'mL' : phase === 'depth' ? 'cm' : 'N';
  const labels = kind === 'force' ? [buoyancyPhases.air, buoyancyPhases.immersed, buoyancyPhases.depth] : kind === 'weight' ? ['称重法浮力', buoyancyPhases.empty, buoyancyPhases.full] : ['称重法浮力', buoyancyPhases.volume];
  return <section className="buoyancy-records"><h3>浮力读数与排液测量</h3><p>读数由自己填写。每阶段独立保存，计算时选择同一组、同一物体或同一次完整排液的来源。</p>
    <label>浮力实验组名<input value={group} maxLength={100} onChange={event => setGroup(event.target.value)} /></label>
    <form onSubmit={event => { event.preventDefault(); setError(onCapture(phase, raw, group) ?? ''); }}><div className="measurement-context-fields">
      <label>本次浮力读数阶段<select value={phase} onChange={event => { setPhase(event.target.value as BuoyancyPhase); setRaw(''); }}>{Object.entries(buoyancyPhases).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>浮力手工读数（{unit}）<input inputMode="decimal" value={raw} onChange={event => setRaw(event.target.value)} maxLength={100} /></label>
    </div><button disabled={!ready}>保存本次浮力读数</button></form>
    <label>浮力计算方法<select value={kind} onChange={event => { setKind(event.target.value as BuoyancyCalculation); setSources(['', '', '']); }}><option value="force">计算称重法浮力</option><option value="weight">比较浮力与排液重力</option><option value="volume">比较浮力与排液体积</option></select></label>
    <div className="measurement-context-fields">{labels.map((label, index) => <label key={`${kind}-${index}`}>浮力来源{index + 1} · {label}<select aria-label={`浮力来源${index + 1}`} value={sources[index] ?? ''} onChange={event => setSources(current => current.map((value, slot) => slot === index ? event.target.value : value))}><option value="">请选择来源</option>{scene.measurementRecords.filter(record => record.context?.pointLabel === label).map(record => <option key={record.id} value={record.id}>{scene.measurementSnapshots?.find(sample => sample.id === record.context?.sampleId)?.setupLabel} · {label} · {record.id.slice(-8)}</option>)}</select></label>)}</div>
    {kind === 'force' && <p>浸入高度可选；若填写并选择，可按圆柱体横截面积计算排水体积并绘图。</p>}
    <button disabled={!ready} onClick={() => setError(onCalculate(kind, kind === 'force' && !sources[2] ? sources.slice(0, 2) : sources.slice(0, labels.length), group) ?? '')}>按所选来源计算浮力结果</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
