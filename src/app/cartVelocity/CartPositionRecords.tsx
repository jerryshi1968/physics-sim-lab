import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { manualResult } from '../../core/measurements/records.ts';
import { cartPositionSheets, centimetresInSI, clearTapePoint, positionCalculations } from '../../equipment/cartVelocity/positions.ts';
import type { CartPositionsInput } from '../../equipment/cartVelocity/positions.ts';
import { tapeRulerPlacement } from '../../equipment/ticker/simulate.ts';
import type { CartVelocitySimulation } from './useCartVelocity.ts';
import { CartVelocityResults, number } from './CartVelocityResults.tsx';

type Point = { number: number; value: number | null };
function PositionTable({ points, period, input, select, label }: { points: Point[]; period: number; input: (n: number) => ReactNode; select: (n: number, speed?: boolean) => void; label: string }) {
  const results = positionCalculations(points, period), last = Math.max(...points.map(p => p.number));
  return <div className="cart-sample-table" role="region" aria-label={`${label}，可横向滚动`} tabIndex={0}><table aria-label={label} data-testid="cart-position-table"><thead><tr><th scope="row">计数点</th>{points.map(p => <th key={p.number} scope="col"><button onClick={() => select(p.number)}>{p.number < 0 ? '辅助点（−1）' : p.number}</button></th>)}</tr></thead><tbody>
    <tr><th scope="row">时间t / s</th>{points.map(p => <td key={p.number}>{number(p.number * period)}</td>)}</tr>
    <tr><th scope="row">位置x / cm</th>{points.map(p => <td key={p.number}>{p.number === 0 ? '0（起点）' : input(p.number)}</td>)}</tr>
    <tr><th scope="row">到下一点距离 / cm</th>{points.map(p => { const d = results.find(r => r.number === p.number)?.distanceM; return <td key={p.number}>{number(d == null ? null : d * 100)}</td>; })}</tr>
    <tr><th scope="row">速度v≈ / (m/s)</th>{points.map(p => { const r = results.find(r => r.number === p.number); return <td key={p.number}>{p.number === 0 || p.number === last ? <span>—（端点不计算）</span> : <button aria-label={`查看点${p.number}的速度计算`} onClick={() => select(p.number, true)}>{number(r?.velocityMPerS)}{!points.some(q => q.number === p.number + 1) ? '（缺后一点）' : !points.some(q => q.number === p.number - 1) ? '（缺前一点）' : ''}</button>}</td>; })}</tr>
  </tbody></table></div>;
}
function Formula({ points, period, selected }: { points: Point[]; period: number; selected: number }) {
  const result = positionCalculations(points, period).find(r => r.number === selected), at = (n: number) => points.find(p => p.number === n)?.value;
  return <p data-testid="cart-position-formula">点{selected}：v≈(x{selected + 1}−x{selected - 1}) / (2×{number(period)} s) = ({number(at(selected + 1))}−{number(at(selected - 1))}) m / {number(2 * period)} s = {number(result?.velocityMPerS)} m/s。纸带上高亮前后两点；缺少有效位置时速度留空。</p>;
}
function PositionCorrection({ id, rawInput, label, onCorrect, onSelect }: { id: string; rawInput: string | null; label: string; onCorrect: (id: string, raw: string) => string | null; onSelect: () => void }) {
  const key = `${id}:${rawInput}`, [state, setState] = useState({ key: '', raw: '', error: '' });
  const current = state.key === key ? state : { key, raw: rawInput?.trim() ? String(Number((Number(rawInput) * 100).toPrecision(12))) : '', error: '' };
  if (current !== state) setState(current);
  const save = () => { const si = centimetresInSI(current.raw); setState({ ...current, error: si === null ? '填写有限数字，或留空。' : onCorrect(id, si) ?? '' }); };
  return <><input aria-label={label} inputMode="decimal" maxLength={60} value={current.raw} style={{ width: 94 }} onFocus={onSelect} onChange={e => setState({ ...current, raw: e.target.value, error: '' })} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />{current.error && <span role="alert">{current.error}</span>}</>;
}
export function CartPositionRecords({ scene, simulation: c, onCapture, onCorrect }: { scene: SceneDocument; simulation: CartVelocitySimulation; onCapture: (input: CartPositionsInput) => string | null; onCorrect: (id: string, raw: string) => string | null }) {
  const s = c.ticker, q = c.positions, sheets = cartPositionSheets(scene);
  const [stored, setStored] = useState({ key: '', rawCm: {} as Record<string, string>, group: '', note: '', error: null as string | null });
  const key = `${s.signature}:${s.run?.id}:${q.zero}:${q.stride}`, form = stored.key === key ? stored : { key, rawCm: {}, group: `第${c.trial}次`, note: '', error: null };
  if (form !== stored) setStored(form);
  const set = (v: Partial<typeof form>) => setStored({ ...form, ...v });
  const f = s.run?.frequencyHz ?? (s.rig?.ok ? s.rig.frequencyHz : 50), period = q.stride / f;
  const numbers = s.taken ? q.numbers : Array.from({ length: 7 }, (_, i) => i);
  const length = s.rig?.ok && s.rig.ruler ? Number(s.rig.ruler.parameters.lengthM) : 0;
  const enteredPoints = numbers.map(n => { const si = centimetresInSI(form.rawCm[n] ?? ''), range = { min: n < 0 ? -length : 0, max: n < 0 ? 0 : length, resolution: .001 }; const value = si === null ? null : manualResult(si, 'valid', range); return { number: n, value: n === 0 ? 0 : value?.value ?? null }; });
  const first = q.zero + (q.numbers[0] ?? 0) * q.stride, last = q.zero + q.last * q.stride;
  const aligned = s.taken && s.run && tapeRulerPlacement(scene, s.run, s.paper, first, last);
  const points = aligned ? enteredPoints : enteredPoints.map(p => ({ ...p, value: p.number === 0 ? 0 : null }));
  const saved = sheets.find(sheet => sheet.sample.runId === s.run?.id && sheet.meta.zero === q.zero && sheet.meta.stride === q.stride && sheet.meta.last === q.last);
  return <section className="projectile-records" aria-label="小车速度随时间变化测量"><h3>逐点记录纸带位置</h3><p>① 在清晰区域选起点0，按固定间隔标出计数点。② 逐格填写各点相对起点的位置，单位cm。③ 比较点间距离和速度，再用三条纸带画v–t图。记录0～6点时，只计算1～5点的瞬时速度；0点和末点只参与位置测量，不计算速度。</p>
    <button aria-pressed={q.picking} disabled={!s.taken} onClick={() => { q.pickZero(); document.getElementById('workbench')?.scrollIntoView({ block: 'nearest' }); }}>{q.picking ? '请点击纸带上清晰的点' : '在纸带上选起点0'}</button>
    <label>起点0<select aria-label="小车纸带时间零点0" value={q.zero} disabled={!s.taken} onChange={e => q.setZero(Number(e.target.value))}>{s.run?.dots.map((_, i) => clearTapePoint(s.run!, i) && <option key={i} value={i}>原始第{i}点</option>)}</select></label>
    <label>计数间隔<select aria-label="小车纸带计数间隔" value={q.stride} onChange={e => q.setStride(Number(e.target.value))}>{[3, 5, 6, 10].map(n => <option key={n} value={n}>每{n}个打点间隔（{number(n / f)} s）</option>)}</select></label>
    <p>记录至计数点{q.last}。<button disabled={!s.taken || q.last >= q.maxLast} onClick={() => q.setLast(q.last + 1)}>增加一个计数点</button> <button disabled={!s.taken || q.last <= 2} onClick={() => q.setLast(q.last - 1)}>减少末尾计数点</button></p>
    <p data-testid="cart-velocity-ruler-status">{!s.taken ? '先完成打点，断电开夹，取带移到尺旁。' : aligned ? s.paper?.flippedX ? '尺已就位，计数点从左向右。位置=该点尺读数−0点尺读数（cm）。Tab可移到下一格。' : '尺已就位，纸带为原方向。位置=0点尺读数−该点尺读数（cm）。可点画布上的“左右翻转”方便读尺。' : '把选定的这一段纸带拖到尺旁，让0点和末尾计数点均在尺内。'}</p>
    {!saved && <PositionTable points={points} period={period} select={q.select} label="本次纸带位置记录表" input={n => <input aria-label={`${n < 0 ? '辅助点' : `计数点${n}`}位置（cm）`} inputMode="decimal" maxLength={60} disabled={!s.taken} value={form.rawCm[n] ?? ''} style={{ width: 94 }} onFocus={() => q.select(n)} onChange={e => set({ rawCm: { ...form.rawCm, [n]: e.target.value }, error: null })} />} />}
    {q.speed && !saved && <Formula points={points} period={period} selected={q.selected} />}
    <label>实验组别<input aria-label="小车速度实验组别" maxLength={40} value={form.group} onChange={e => set({ group: e.target.value })} /></label><label>观察与结论<input aria-label="小车速度观察与结论" maxLength={60} value={form.note} onChange={e => set({ note: e.target.value })} /></label>
    <button disabled={!s.taken || s.powered || c.moving || !!saved} onClick={() => set({ error: onCapture({ zero: q.zero, stride: q.stride, last: q.last, rawCm: Object.fromEntries(q.numbers.filter(n => n !== 0).map(n => [n, form.rawCm[n] ?? ''])), group: form.group, note: form.note }) })}>保存这条纸带的位置表</button>{saved && <p>本表已保存，可直接在下方修订位置。换新纸带并改变配重或槽码，完成第2、3次实验。</p>}{form.error && <p role="alert">{form.error}</p>}
    <p>速度用中间计数点前后的位置计算：v₁≈(x₂−x₀)/(2T)，……，v₅≈(x₆−x₄)/(2T)。不需要起点之前的测点。</p>
    {sheets.map(sheet => <section key={sheet.sample.id} data-position-sheet={sheet.sample.id}><h4>{sheet.sample.setupLabel} · 已保存的位置表</h4><PositionTable points={sheet.points.filter(p => p.number >= 0)} period={sheet.meta.stride / sheet.meta.f} label={`${sheet.sample.setupLabel}纸带位置表`} select={(n, speed) => { if (s.run?.id === sheet.sample.runId && q.zero === sheet.meta.zero && q.stride === sheet.meta.stride) q.select(n, speed); }} input={n => { const record = sheet.points.find(p => p.number === n)?.record; return record ? <PositionCorrection id={record.id} rawInput={record.rawInput} label={`${sheet.sample.setupLabel}${n < 0 ? '辅助点' : `计数点${n}`}位置修订（cm）`} onCorrect={onCorrect} onSelect={() => { if (s.run?.id === sheet.sample.runId && q.zero === sheet.meta.zero && q.stride === sheet.meta.stride) q.select(n); }} /> : '缺失记录'; }} />{q.speed && s.run?.id === sheet.sample.runId && q.zero === sheet.meta.zero && q.stride === sheet.meta.stride && <Formula points={sheet.points.filter(p => p.number >= 0)} period={sheet.meta.stride / sheet.meta.f} selected={q.selected} />}<p>速度用前后两个计数点的位置差除以两段时间；仅计算内部计数点的瞬时速度；0点和末点不计算。</p></section>)}
    <CartVelocityResults scene={scene} />
  </section>;
}
