import { tapeLengthM, tickerTimeLimitS } from '../../equipment/ticker/simulate.ts';
import type { TickerSimulation } from './useTicker.ts';

export function TickerPanel({ simulation: s, onView }: { simulation: TickerSimulation; onView: () => void }) {
  const ready = !!s.rig?.ok;
  return <section className="projectile-panel" aria-label="打点计时器操作">
    <h3>电火花打点计时器</h3>
    <ol><li>关闭电源并打开固定夹，再拖纸带穿入通道。</li><li>扣上固定夹后通电；拖纸带右端水平拉动，松手即停。</li><li>先断电，再打开固定夹，才能取下纸带并移到尺旁读数。</li></ol>
    <p role="status" data-testid="ticker-status">{!ready ? s.rig?.message : s.notice || (s.taken ? '已断电取带，请把纸带摆到尺旁读数。' : s.powered ? `电源已开启 · ${s.dragging ? '纸带跟随指针水平移动' : '纸带静止，打点重合'}` : s.run ? s.fixed ? '已断电，请打开固定夹后取带。' : '已断电且固定夹打开，可拖出纸带。' : s.installed ? s.fixed ? '纸带已夹好，可以通电。' : '纸带已穿入，请先扣上固定夹。' : s.fixed ? '请先打开固定夹，再穿入纸带。' : '电源已关闭、固定夹已打开，可以穿入纸带。')}</p>
    <button onClick={onView}>查看记录表</button>
    <p>{s.rig?.ok ? `频率 ${s.rig.frequencyHz} Hz，相邻两点间隔 ${Number((1 / s.rig.frequencyHz).toPrecision(5))} s。` : ''}起始点不计入 n，n 个间隔对应 n+1 个点。</p>
    {s.run && <p>已打 {s.run.dots.length} 个点 · 已拉出 {Number(s.run.displacementM.toFixed(3))} m{s.run.displacementM >= tapeLengthM ? ' · 纸带到末端，停止拉动' : ''}{s.run.timeS >= tickerTimeLimitS ? ' · 已达本次通电时限，自动断电' : ''}</p>}
    <p>纸带运动跟随鼠标或触屏，松手停止拉动，计时器继续打点。刻度尺可拖到纸带上叠放，再用“放大读尺”查看每厘米数字和毫米细格；可平移读另一端。纸带方向从右向左，位移取两个尺读数之差。</p>
    <details><summary>键盘操作提示</summary><p>Tab 选择夹具或开关，Enter 操作。选中纸带后，方向键移动，Shift 为 1 mm 微调；移到通道后 Enter 穿带。通电时右方向键拉带，松键停手；Esc 取消摆放或停手。已存记录不会随换新纸带丢失。</p></details>
  </section>;
}
