import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { linearFit } from '../../core/measurements/fit.ts';
import { cartPositionsCsv, cartVelocitySeriesRows } from '../../equipment/cartVelocity/positions.ts';

export const number = (v: number | null | undefined) => v == null ? '—' : Number(v.toPrecision(6));
const colors = ['#126c63', '#b56524', '#4d71ab', '#986492'];
export function CartVelocityResults({ scene, chart = false }: { scene: SceneDocument; chart?: boolean }) {
  const [fit, setFit] = useState(false), rows = cartVelocitySeriesRows(scene);
  const groups = Array.from(new Set(rows.map(r => r.groupKey))).map(key => ({ key, rows: rows.filter(r => r.groupKey === key).sort((a, b) => a.atTimeS - b.atTimeS) }));
  const times = Array.from(new Set(rows.map(r => r.atTimeS))).sort((a, b) => a - b);
  const maxT = Math.max(.1, ...times), maxV = Math.max(.1, ...rows.map(r => r.velocityMPerS ?? 0));
  const x = (v: number) => 65 + v / maxT * 590, y = (v: number) => 255 - v / maxV * 210;
  if (chart) return <section aria-label="小车速度时间图"><p>由当前手工尺读数计算速度，在时间零点之后逐点描绘。观察三次实验的共同特点，再判断图像是否接近直线；不要求直线经过每个点或原点。</p><label><input type="checkbox" checked={fit} onChange={e => setFit(e.target.checked)} />显示线性拟合（每组至少3个不同时刻）</label>
    {!rows.some(r => r.velocityMPerS !== null) ? <p>暂无有效速度数据，请先读尺并保存。</p> : <svg viewBox="0 0 720 310" role="img" aria-label="小车v–t散点图" data-testid="cart-velocity-chart" style={{ width: '100%', minWidth: 280 }}>
      <text x="16" y="22" fontSize="14">v / (m·s⁻¹)</text><path d="M65 36V255H680" fill="none" stroke="#486862" /><text x="620" y="300" fontSize="14">t / s</text>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><path d={`M65 ${y(maxV * i / 4)}H655`} stroke="#e0e9e4" /><text x="57" y={y(maxV * i / 4) + 4} textAnchor="end" fontSize="12">{number(maxV * i / 4)}</text><text x={x(maxT * i / 4)} y="278" textAnchor="middle" fontSize="12">{number(maxT * i / 4)}</text></g>)}
      {groups.map((g, i) => { const points = g.rows.filter(r => r.velocityMPerS !== null).map(r => ({ x: r.atTimeS, y: r.velocityMPerS! })), line = fit ? linearFit(points, 3) : null; return <g key={g.key} stroke={colors[i % colors.length]}><svg x="65" y="36" width="590" height="219" viewBox="65 36 590 219">{line && <path data-fit-line={g.key} d={`M${x(0)} ${y(line.intercept)}L${x(maxT)} ${y(line.intercept + line.slope * maxT)}`} strokeWidth="1.5" strokeDasharray="5 3" fill="none" />}</svg>{g.rows.filter(r => r.velocityMPerS !== null).map(r => <circle key={r.id} cx={x(r.atTimeS)} cy={y(r.velocityMPerS!)} r={4 + i % 3} fill="white" strokeWidth="2"><title>{r.sample.setupLabel}：t={number(r.atTimeS)} s，v≈{number(r.velocityMPerS)} m/s</title></circle>)}</g>; })}
    </svg>}
    {groups.map((g, i) => { const line = fit ? linearFit(g.rows.filter(r => r.velocityMPerS !== null).map(r => ({ x: r.atTimeS, y: r.velocityMPerS! })), 3) : null; return <p key={g.key} style={{ color: colors[i % colors.length] }}>v{i + 1} · {g.rows[0]!.sample.setupLabel} · 零点{g.rows[0]!.meta.zero}{fit && (line ? `：v≈${number(line.slope)}t + (${number(line.intercept)})；斜率${number(line.slope)} m/s²，R²=${number(line.rSquared)}` : '：有效时刻不足3个，未拟合。')}</p>; })}<p>前后两计数点之间的平均速度近似中间计数点的瞬时速度。两端各估读±0.5 mm时，读尺误差界示意为1 mm/Δt；缩短区间也会放大这一影响。</p></section>;
  return <div className="cart-sample-table"><table aria-label="小车三次实验速度时间表"><thead><tr><th>位置编号</th>{times.map(t => <th key={t}>{Array.from(new Set(rows.filter(r => r.atTimeS === t).map(r => r.pointNumber))).join(" / ")}</th>)}</tr><tr><th>t（s）</th>{times.map(t => <th key={t}>{number(t)}</th>)}</tr></thead><tbody>{groups.map((g, i) => <tr key={g.key}><th scope="row">v{i + 1}（m/s）· {g.rows[0]!.sample.setupLabel}</th>{times.map(t => <td key={t}>{g.rows.filter(r => r.atTimeS === t).map(r => number(r.velocityMPerS)).join(' / ') || '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <p>空表：同一纸带逐点测量，再改变槽码或车上配重，用新纸带重复两次。时间零点与计数间隔不同的数据分别成组。</p>}
    {rows.some(r => r.groupKey.startsWith("legacy:")) && <details><summary>旧版区间记录（保留原始来源）</summary><table aria-label="旧版小车速度记录"><thead><tr><th>组别</th><th>计数点</th><th>t/s</th><th>v≈/(m/s)</th></tr></thead><tbody>{rows.filter(r => r.groupKey.startsWith("legacy:")).map(r => <tr key={r.id}><td>{r.sample.setupLabel}</td><td>{r.pointNumber}</td><td>{number(r.atTimeS)}</td><td>{number(r.velocityMPerS)}</td></tr>)}</tbody></table></details>}
    <button disabled={!rows.length} onClick={() => { const url = URL.createObjectURL(new Blob([cartPositionsCsv(scene)], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = '小车速度随时间变化.csv'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }}>导出小车速度 CSV</button><p>在位置表直接修订cm读数，距离、速度和图像随之重算。缺少前后位置、超范围或位置顺序矛盾时速度留空。每条纸带保存独立的装置来源；0点位置按定义为0。</p></div>;
}
