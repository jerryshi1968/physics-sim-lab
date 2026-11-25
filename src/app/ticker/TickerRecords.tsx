import { useState } from 'react';
import { tapeRulerPlacement, tapeSelection } from '../../equipment/ticker/simulate.ts';
import type { TickerInput } from '../../equipment/ticker/measure.ts';
import type { TickerSimulation } from './useTicker.ts';
import { TickerTable } from './TickerTable.tsx';
import type { SceneDocument } from '../../core/scene/schema.ts';

export function TickerRecords({ scene, simulation: s, onCapture }: { scene: SceneDocument; simulation: TickerSimulation; onCapture: (input: TickerInput) => string | null }) {
  const origin = s.origin, target = s.target;
  const [count, setCount] = useState('');
  const [rawM, setRawM] = useState(''), [group, setGroup] = useState('第1条纸带'), [note, setNote] = useState(''), [error, setError] = useState<string | null>(null);
  const dots = s.run?.dots ?? [], a = Math.min(origin, Math.max(0, dots.length - 1)), b = Math.min(Math.max(a + 1, target), dots.length - 1);
  const selectionKey = `${s.run?.id}:${a}:${b}`;
  const [previousSelection, setPreviousSelection] = useState(selectionKey);
  if (previousSelection !== selectionKey) { setPreviousSelection(selectionKey); setCount(''); setRawM(''); setError(null); }
  const aligned = s.run && s.taken ? tapeRulerPlacement(scene, s.run, s.paper, a, b) : null;
  const timeS = /^\d+$/.test(count) && Number(count) > 0 && s.run ? Number(count) / s.run.frequencyHz : null;
  const changePoint = () => { setCount(''); setRawM(''); setError(null); };
  return <section className="projectile-records" aria-label="纸带数点与测量">
    <h3>纸带数点与测量</h3>
    <p>先设计记录表：组别、起点与终点、间隔数 n、时间 t、位移 x。下方原始记录可修订、导出；每次测量保存三个数值和当时来源。</p>
    <TickerTable scene={scene} />
    {s.taken && <p data-testid="ticker-ruler-status">{!s.run || !tapeSelection(s.run, a, b) ? '纸带已取下。请先选择两个清晰、不同位置的测点，避开重合点。' : aligned ? '纸带已摆到尺旁。请在画布放大读尺，用起点处尺读数减去终点处尺读数，得到位移。' : '请把取下的纸带拖到水平刻度尺上沿，且使两个测点都在尺的范围内。'}</p>}
    {!s.taken ? <p>通电时只观察纸带。关闭电源并取下后再选点、读尺。</p> : <>
      <p>在画布点选起点和终点：绿圈记作起点 0，红圈为终点。原始打点先后从右向左；尺的刻度从左向右。也可用下方列表精确选点。重合点须避开。</p>
      <label>起始点<select aria-label="纸带起始点" value={a} onChange={event => { s.setPoint('origin', Number(event.target.value)); changePoint(); }}>{dots.slice(0, -1).map((_, i) => <option key={i} value={i}>原始第 {i} 点</option>)}</select></label>
      <label>终点<select aria-label="纸带终点" value={b} onChange={event => { s.setPoint('target', Number(event.target.value)); changePoint(); }}>{dots.map((_, i) => i > a && <option key={i} value={i}>原始第 {i} 点</option>)}</select></label>
    </>}
    <label>数出的间隔数 n<input aria-label="数出的间隔数 n" inputMode="numeric" value={count} onChange={event => setCount(event.target.value)} /></label>
    <p data-testid="ticker-time">{timeS === null ? '数出间隔后，用 t=n/f 计算时间。' : `t = ${count} / ${s.run?.frequencyHz} = ${Number(timeS.toPrecision(7))} s`}</p>
    <label>位移 x（m）<input aria-label="纸带位移 x（m）" inputMode="decimal" value={rawM} maxLength={100} onChange={event => setRawM(event.target.value)} /></label>
    <label>纸带组别<input value={group} maxLength={80} onChange={event => setGroup(event.target.value)} /></label>
    <label>纸带观察备注<input value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label>
    <button disabled={!s.taken || !s.run || s.powered} onClick={() => setError(onCapture({ origin: a, target: b, count, rawM, group, note }))}>保存本次纸带测量</button>
    <p>位移必须自行填写；留空会保存缺失值。图线按纸带、组别和起点分开；修改 n 后须自行重新计算时间。原始点位置与原始输入随每次来源保留。</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
