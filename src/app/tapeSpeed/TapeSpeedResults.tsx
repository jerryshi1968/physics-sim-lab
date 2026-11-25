import type { SceneDocument } from '../../core/scene/schema.ts';
import { useState } from 'react';
import { tapeSpeedChartScene, tapeSpeedCsv, tapeSpeedProfiles, tapeSpeedRows } from '../../equipment/tapeSpeed/model.ts';
import { MeasurementChart } from '../measurements/MeasurementChart.tsx';

const display = (value: number | null | undefined) => value == null ? '缺失／异常' : Number(value.toPrecision(7));
export function TapeSpeedResults({ scene, chart = false }: { scene: SceneDocument; chart?: boolean }) {
  const [windowComparison, setWindowComparison] = useState(false);
  if (chart) return <div><p>曲线由当前手工位置读数计算；平均速度标在区间中点时刻，瞬时速度只表示目标点的近似。</p><label><input type="checkbox" checked={windowComparison} onChange={event => setWindowComparison(event.target.checked)} />比较同一E点的不同取样区间</label><MeasurementChart scene={tapeSpeedChartScene(scene, windowComparison)} profiles={windowComparison ? tapeSpeedProfiles.slice(2) : tapeSpeedProfiles.slice(0, 2)} /></div>;
  const rows = tapeSpeedRows(scene);
  return <div className="cart-sample-table">
    <table aria-label="纸带平均速度和瞬时速度记录表"><thead><tr><th>组别／方法</th><th>计数点／原始点</th><th>xA（m）</th><th>xB（m）</th><th>Δx（m）</th><th>Δt（s）</th><th>v（m/s）</th><th>对应时刻（s）</th></tr></thead><tbody>
      {rows.length ? rows.map(row => <tr key={row.sample.id} data-speed-sample={row.sample.id}><th scope="row">{row.sample.setupLabel}</th><td>{(row.meta.a - row.meta.zero) % row.meta.stride === 0 && (row.meta.b - row.meta.zero) % row.meta.stride === 0 ? `计数${(row.meta.a - row.meta.zero) / row.meta.stride} → ${(row.meta.b - row.meta.zero) / row.meta.stride}；` : ''}原始{row.meta.a} → {row.meta.b}{row.meta.e === null ? '' : `；E${row.meta.e}`}</td><td>{display(row.readings[0]?.value)}</td><td>{display(row.readings[1]?.value)}</td><td>{display(row.displacementM)}</td><td>{display(row.timeS)}</td><td>{display(row.velocityMPerS)}{row.meta.mode === 'instant' ? '（近似）' : ''}</td><td>{display(row.atTimeS)}</td></tr>) : <tr><td colSpan={8}>空表：选取计数点，自行读尺后保存。平均速度和瞬时速度近似分别记录。</td></tr>}
    </tbody></table>
    <button disabled={!rows.length} onClick={() => {
      const url = URL.createObjectURL(new Blob([tapeSpeedCsv(scene)], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a');
      anchor.href = url; anchor.download = '纸带平均速度与瞬时速度.csv'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>导出纸带速度 CSV</button>
    <p>原始位置读数在下方可修订；Δx、Δt和v由当前读数及冻结的打点频率重新计算。缺失、超范围或xB≤xA时不输出速度。JSON保留原始读数、修订、测点、纸带位置和尺读数来源。</p>
  </div>;
}
