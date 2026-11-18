import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { RefractionCapture } from '../../equipment/refraction/measure.ts';
import { refractionObservations } from '../../equipment/refraction/measure.ts';
import { REFRACTION_MODEL } from '../../equipment/refraction/definitions.ts';
import { displayMeasurement } from '../../core/measurements/display.ts';
export function RefractionRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: RefractionCapture) => string | null }) {
  const [input, setInput] = useState<RefractionCapture>({ incidenceDeg: '', refractionDeg: '', observation: '未判断', setupLabel: '折射探究', note: '' }), [error, setError] = useState('');
  const samples = (scene.measurementSnapshots ?? []).filter(s => s.modelVersion === REFRACTION_MODEL);
  const angle = (id: string, label: string) => { const rows = scene.measurementRecords.filter(r => r.context?.sampleId === id && r.context.pointLabel === label), row = rows[0]; return rows.length === 1 && row?.measurementStatus === 'valid' && row.value !== null ? `${displayMeasurement(row).value}°` : '—'; };
  return <section className="reflection-records"><h3>光折射角度与现象记录</h3><p>角从法线量起，每小格 1°。手工填写估读和观察；没有折射光或量角器未校准时，折射角不能记为正常读数。空白记缺失，系统不代填结论。</p><form onSubmit={e => { e.preventDefault(); setError(onCapture(input) ?? ''); }}><div className="measurement-fields">{([['setupLabel','折射实验组名'],['incidenceDeg','折射实验入射角估读（°）'],['refractionDeg','折射角估读（°）'],['note','折射实验备注']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={label} maxLength={key === 'setupLabel' ? 70 : 100} value={input[key]} onChange={e => setInput(old => ({ ...old, [key]: e.target.value }))} /></label>)}</div><label>观察到的偏折<select aria-label="折射偏折观察" value={input.observation} onChange={e => setInput(old => ({ ...old, observation: e.target.value }))}>{refractionObservations.map(v => <option key={v}>{v}</option>)}</select></label><button disabled={!ready}>保存折射记录</button>{error && <p role="alert">{error}</p>}</form>
    {samples.length > 0 && <div className="reflection-table-scroll"><table aria-label="折射角度记录（度）"><thead><tr><th>组别与方向</th><th>入射角 i</th><th>折射角 r</th><th>偏折观察</th></tr></thead><tbody>{samples.map(s => { const row = scene.measurementRecords.find(r => r.context?.sampleId === s.id && r.context.pointLabel === '折射偏折观察'); return <tr key={s.id} data-testid="refraction-result"><td>{s.setupLabel}</td><td>{angle(s.id, '入射角i')}</td><td>{angle(s.id, '折射角r')}</td><td>{row?.measurementStatus === 'valid' && row.value !== null ? refractionObservations[row.value + 1] ?? '—' : '—'}</td></tr>; })}</tbody></table></div>}
  </section>;
}
