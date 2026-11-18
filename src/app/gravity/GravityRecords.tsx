import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { gravityRows } from '../../equipment/gravity/measure.ts';
export interface GravityInput { mass: string; force: string; group: string; note: string }
export function GravityRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: GravityInput) => string | null }) {
  const [mass, setMass] = useState(''), [force, setForce] = useState(''), [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [error, setError] = useState('');
  const value = (n: number | null) => n === null ? '—' : Number(n.toPrecision(7));
  return <section className="density-records"><h3>重力与质量记录</h3><form onSubmit={e => { e.preventDefault(); const failed = onCapture({ mass, force, group, note }); setError(failed ?? ''); if (!failed) { setMass(''); setForce(''); } }}><label>重力实验组名<input value={group} maxLength={100} onChange={e => setGroup(e.target.value)} /></label><label>钩码总质量 m（kg）<input inputMode="decimal" value={mass} maxLength={100} onChange={e => setMass(e.target.value)} /></label><label>测力计重力读数 G（N）<input inputMode="decimal" value={force} maxLength={100} onChange={e => setForce(e.target.value)} /></label><label>重力实验观察与备注<input value={note} maxLength={100} onChange={e => setNote(e.target.value)} /></label><button disabled={!ready}>保存本次重力读数</button></form>{error && <p role="alert">{error}</p>}
    {gravityRows(scene).length > 0 && <div className="measurement-table-wrap"><table aria-label="重力与质量结果"><thead><tr><th>组别</th><th>m/kg</th><th>G/N</th><th>G/m（N/kg）</th></tr></thead><tbody>{gravityRows(scene).map(row => <tr key={row.id}><td>{row.group}</td><td>{value(row.mass)}</td><td>{value(row.force)}</td><td>{value(row.ratio)}</td></tr>)}</tbody></table></div>}
    <p>用已知钩码质量和自己的测力计读数记录；留空保留缺失。图线、比值和 CSV 使用有效手工数据，不自动填写理论值。修订读数后，表格比值和图点随记录更新；改变装置保留旧快照，不同 g 分开成组。</p></section>;
}
