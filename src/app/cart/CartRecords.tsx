import { useState } from 'react';
import { cartEstimate, cartSamples } from '../../equipment/cart/simulate.ts';
import type { CartMethod, CartRun } from '../../equipment/cart/simulate.ts';
import type { CartCapture } from '../../equipment/cart/measure.ts';
import { CartPaperTape } from './CartPaperTape.tsx';

const format = (value: number | null) => value === null ? '—' : String(Number(value.toPrecision(7)));

export function CartRecords({ run, ready, method, onMethodChange, onCapture }: { run: CartRun | null; ready: boolean; method: CartMethod; onMethodChange: (method: CartMethod) => void; onCapture: (input: CartCapture) => string | null }) {
  const [every, setEvery] = useState(.1);
  const [point, setPoint] = useState(0);
  const [group, setGroup] = useState('第1组');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hz = Number(run?.rig.ticker?.parameters.frequencyHz ?? 50);
  const stride = Math.round(hz * every);
  const samples = run ? cartSamples(run, method, stride) : [];
  const estimate = run ? cartEstimate(run, method, stride) : null;
  const selected = Math.max(0, Math.min(point, samples.length - 1));
  const visible = method === 'gate' ? samples : samples.slice(Math.max(0, selected - 5), selected + 7);
  const tape = run && method === 'tape' ? cartSamples(run, 'tape', 1) : [];
  const canSave = ready && !!group.trim();
  const record = (index: number | null) => setError(onCapture({ method, stride, index, group, note }));

  return <section className="projectile-records" aria-label="小车测量与记录">
    <h3>小车测量与记录</h3>
    <label>测量方法<select aria-label="测量方法" value={method} onChange={event => { onMethodChange(event.target.value === 'tape' ? 'tape' : 'gate'); setPoint(0); setError(null); }}>
      <option value="gate">光电门</option><option value="tape">打点计时器（纸带）</option>
    </select></label>
    {method === 'gate' ? <p>挡光片通过光电门后读取起止时间。用片长除以挡光时长，得到时间中点的速度。取先后两个不同位置的有效光电门，以速度差除以时间差。</p> : <>
      {!run && <p>释放小车后纸带会逐点出现。暂停或停稳后，可选采样点查看时间和从起点量出的位移。</p>}
      {!!tape.length && <CartPaperTape dots={tape} stride={stride} selectedM={samples[selected]?.displacementM} />}
      <p>棕点为原始打点，绿点为等时间隔采样点，红圈标出所选点。频率 {hz} Hz，位移读到 1 mm。用 x 对 t² 的拟合斜率求加速度。</p>
      <label>纸带取样间隔<select aria-label="纸带取样间隔" value={every} onChange={event => { setEvery(Number(event.target.value)); setPoint(0); }}>
        <option value="0.1">0.10 s（每 {hz / 10} 点）</option><option value="0.2">0.20 s（每 {hz / 5} 点）</option>
      </select></label>
    </>}
    {run && (method === 'tape' ? !run.rig.ticker : !run.rig.gateEvents.length) && <p>请先在实验台放置本方法需要的计时器材。</p>}
    {run && method === 'gate' && run.rig.gateEvents.some(event => !event.reading) && <p>有光电门未对准轨道，或挡光片无法在限位前完整通过。请调整其位置后重试。</p>}
    <label>组别<input value={group} maxLength={90} onChange={event => setGroup(event.target.value)} /></label>
    <label>备注<input value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label>
    <label>采样点<select aria-label="采样点" value={selected} disabled={!samples.length} onChange={event => setPoint(Number(event.target.value))}>
      {!samples.length && <option value="0">暂无读数</option>}
      {samples.map((sample, index) => <option key={index} value={index}>{sample.label} · {format(sample.timeS)} s</option>)}
    </select></label>
    {!!visible.length && <div className="cart-sample-table"><table aria-label="小车本次采样"><thead><tr><th>测点</th><th>时间（s）</th><th>位移（m）</th>{method === 'gate' && <><th>遮光开始（s）</th><th>遮光结束（s）</th><th>速度（m/s）</th></>}</tr></thead>
      <tbody>{visible.map(sample => <tr key={sample.label}><th scope="row">{sample.label}</th><td>{format(sample.timeS)}</td><td>{format(sample.displacementM)}</td>{method === 'gate' && <><td>{format(sample.inS)}</td><td>{format(sample.outS)}</td><td>{format(sample.velocity)}</td></>}</tr>)}</tbody></table></div>}
    <p data-testid="cart-estimate">{estimate === null ? (method === 'gate' ? '等待两个有效光电门读数。' : '至少需要三个等时间隔采样点。') : `测得加速度 ${format(estimate)} m/s²`}</p>
    <div className="simulation-actions">
      <button disabled={!canSave || !samples.length} onClick={() => record(selected)}>记录所选时间与位移</button>
      <button disabled={!canSave || estimate === null} onClick={() => record(null)}>记录本组加速度</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
