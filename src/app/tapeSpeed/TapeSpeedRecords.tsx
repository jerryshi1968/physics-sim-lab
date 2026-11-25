import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { parseManualValue } from '../../core/measurements/records.ts';
import { speedNumbers } from '../../equipment/tapeSpeed/model.ts';
import type { TapeSpeedInput } from '../../equipment/tapeSpeed/model.ts';
import { tapeRulerPlacement, tapeSelection } from '../../equipment/ticker/simulate.ts';
import type { TickerSimulation } from '../ticker/useTicker.ts';
import type { TapeSpeedSelection } from './useTapeSpeedSelection.ts';
import { TapeSpeedResults } from './TapeSpeedResults.tsx';

const show = (value: number | null | undefined) => value == null ? '—' : Number(value.toPrecision(7));
export function TapeSpeedRecords({ scene, ticker: s, selection: q, onCapture }: { scene: SceneDocument; ticker: TickerSimulation; selection: TapeSpeedSelection; onCapture: (input: TapeSpeedInput) => string | null }) {
  const [form, setForm] = useState({ key: '', rawA: '', rawB: '', group: '第1条纸带', note: '', error: null as string | null });
  const key = `${s.signature}:${s.run?.id}:${q.mode}:${q.zero}:${q.a}:${q.b}:${q.at}`;
  const current = form.key === key ? form : { ...form, key, rawA: '', rawB: '', error: null };
  if (current !== form) setForm(current);
  const set = (values: Partial<typeof form>) => setForm({ ...current, ...values });
  const dots = s.run?.dots ?? [], parsedA = parseManualValue(current.rawA), parsedB = parseManualValue(current.rawB);
  const frequency = s.run?.frequencyHz ?? (s.rig?.ok ? s.rig.frequencyHz : 50);
  const reference = s.run && tapeSelection(s.run, q.zero, q.b), selected = s.run && tapeSelection(s.run, q.a, q.b);
  const aligned = s.run && tapeRulerPlacement(scene, s.run, s.paper, q.zero, q.b);
  const ready = s.taken && !s.powered && selected && reference && q.zero <= q.a && aligned && (q.mode === 'average' || s.run && tapeSelection(s.run, q.a, q.at) && tapeSelection(s.run, q.at, q.b));
  const length = s.rig?.ok && s.rig.ruler ? Number(s.rig.ruler.parameters.lengthM) : 0;
  const reading = (parsed: ReturnType<typeof parseManualValue>) => ready && parsed.ok && parsed.value !== null && parsed.value >= 0 && parsed.value <= length ? parsed.value : null;
  const calculated = speedNumbers(reading(parsedA), reading(parsedB), q.b - q.a, frequency);
  const segment = q.a >= q.zero && (q.a - q.zero) % q.stride === 0 && q.b - q.a === q.stride ? (q.a - q.zero) / q.stride : -1;
  const count = Math.max(0, Math.floor((dots.length - 1 - q.zero) / q.stride));
  return <section className="projectile-records" aria-label="纸带平均速度与瞬时速度测量">
    <h3>测量纸带的平均速度和瞬时速度</h3>
    <p>在画布穿带、拉带，断电开夹后取带并移到尺旁。选一个清晰点作为参考起点0，量计数点到0的距离x；用Δx=xB−xA、Δt=n/f计算速度。不能把n+1个点当成n+1个间隔。</p>
    <TapeSpeedResults scene={scene} />
    <label>测量方法<select aria-label="纸带测速方法" value={q.mode} onChange={event => q.setMode(event.target.value as 'average' | 'instant')}><option value="average">平均速度</option><option value="instant">瞬时速度近似</option></select></label>
    <label>参考起点0<select aria-label="测速参考起点0" value={q.zero} disabled={!s.taken} onChange={event => q.setZero(Number(event.target.value))}>{dots.map((_, i) => <option key={i} value={i}>原始第{i}点</option>)}</select></label>
    <label>计数间隔<select aria-label="每个计数间隔包含的打点间隔数" value={q.stride} onChange={event => q.setStride(Number(event.target.value))}>{[1, 2, 3, 5, 6, 10, 20, 50].map(n => <option key={n} value={n}>每{n}个打点间隔取一点（{show(n / frequency)} s）</option>)}</select></label>
    <label>相邻计数点<select aria-label="测速相邻计数点" value={segment} disabled={!s.taken || !count} onChange={event => q.setSegment(Number(event.target.value))}><option value={-1}>画布直接选取的区间</option>{Array.from({ length: count }, (_, i) => <option key={i} value={i}>计数{i} → {i + 1}（原始{q.zero + i * q.stride} → {q.zero + (i + 1) * q.stride}）</option>)}</select></label>
    {s.taken && <>
      <p>也可在画布点选任意两个清晰端点，或使用下方列表。参考起点0不得晚于区间起点；x从参考起点量起，不要求尺零刻度对准纸带0点。</p>
      <label>区间起点A<select aria-label="测速区间起点A" value={q.a} onChange={event => s.setPoint('origin', Number(event.target.value))}>{dots.slice(0, -1).map((_, i) => <option key={i} value={i}>原始第{i}点</option>)}</select></label>
      <label>区间终点B<select aria-label="测速区间终点B" value={q.b} onChange={event => s.setPoint('target', Number(event.target.value))}>{dots.map((_, i) => i > q.a && <option key={i} value={i}>原始第{i}点</option>)}</select></label>
    </>}
    {q.mode === 'instant' && <>
      <label>目标点E<select aria-label="瞬时速度目标点E" value={q.at} disabled={!s.taken || q.b - q.a < 2} onChange={event => q.setAt(Number(event.target.value))}>{dots.map((_, i) => i > q.a && i < q.b && <option key={i} value={i}>原始第{i}点</option>)}</select></label>
      <button disabled={!s.taken || q.b - q.a <= 2} onClick={q.shrink}>围绕E缩短区间</button><button disabled={!s.taken || q.at - Math.floor((q.b - q.a) / 2) - 1 < q.zero || q.at + Math.floor((q.b - q.a) / 2) + 1 >= dots.length} onClick={q.expand}>围绕E扩大区间</button>
      <p>短区间平均速度用于近似E点的瞬时速度，并非精确值。优先在E前后对称取点；非对称区间可能偏离E时刻。缩小区间不保证读数更准确，还要考虑毫米刻度造成的误差。</p>
      {q.b - q.a < 2 ? <p role="status">区间内部没有目标点，请扩大区间。</p> : <p data-testid="tape-speed-window">E时刻={(show((q.at - q.zero) / (s.run?.frequencyHz ?? 50)))} s；{Math.abs(q.at - (q.a + q.b) / 2) < 1e-9 ? '区间关于E对称' : '区间不对称，平均速度所代表的中点时刻与E不同'}。</p>}
    </>}
    <p data-testid="ticker-ruler-status">{!s.taken ? '先在画布完成打点，断电开夹并取带。' : !reference || !selected || q.zero > q.a ? '请选择清晰的参考起点和区间端点，避开重合点。' : aligned ? '纸带已摆到尺旁。自行读取参考起点0、A、B处刻度，填写A、B到0的距离。' : '请把纸带拖到水平刻度尺旁，让参考起点0及区间两端都在尺内。'}</p>
    <label>起点位置xA（m）<input aria-label="测速起点位置xA（m）" inputMode="decimal" maxLength={60} value={current.rawA} onChange={event => set({ rawA: event.target.value })} /></label>
    <label>终点位置xB（m）<input aria-label="测速终点位置xB（m）" inputMode="decimal" maxLength={60} value={current.rawB} onChange={event => set({ rawB: event.target.value })} /></label>
    <p data-testid="tape-speed-calculation">n={q.b - q.a}；Δx={show(calculated?.displacementM)} m；Δt={show(calculated?.timeS)} s；{q.mode === 'average' ? '平均速度' : '瞬时速度近似值'}={show(calculated?.velocityMPerS)} m/s。</p>
    {q.mode === 'instant' && <p data-testid="tape-speed-error">若两端各估读±0.5 mm，速度误差上界示意约±{show(calculated?.readingErrorBoundMPerS)} m/s（只考虑读尺，不含近似方法误差）。</p>}
    <label>纸带组别<input aria-label="测速纸带组别" maxLength={40} value={current.group} onChange={event => set({ group: event.target.value })} /></label>
    <label>测量备注<input aria-label="测速备注" maxLength={60} value={current.note} onChange={event => set({ note: event.target.value })} /></label>
    <button disabled={!s.taken || !s.run || s.powered} onClick={() => set({ error: onCapture({ mode: q.mode, zero: q.zero, origin: q.a, target: q.b, at: q.mode === 'instant' ? q.at : null, stride: q.stride, rawA: current.rawA, rawB: current.rawB, group: current.group, note: current.note }) })}>保存本次速度测量</button>
    <p>位置读数不自动填入；留空可保存缺失记录，速度保持空缺。重复选取相邻计数点可形成速度表；对同一E点改变区间，可比较近似值与读尺误差。</p>
    {current.error && <p role="alert">{current.error}</p>}
  </section>;
}
