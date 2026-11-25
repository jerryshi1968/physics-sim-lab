import type { MeasurementRecord, SceneDocument } from '../../core/scene/schema.ts';
import { TICKER_DIRECT_MODEL, TICKER_MODEL } from '../../equipment/ticker/simulate.ts';

const display = (row: MeasurementRecord | undefined) => row?.measurementStatus === 'valid' && row.value !== null ? Number(row.value.toPrecision(7)) : '缺失／异常';
export function TickerTable({ scene }: { scene: SceneDocument }) {
  const samples = (scene.measurementSnapshots ?? []).filter(sample => [TICKER_MODEL, TICKER_DIRECT_MODEL].includes(sample.modelVersion)).flatMap(sample => {
    try {
      const note = JSON.parse(sample.note);
      return note.kind === 'ticker-reading' && Number.isInteger(note.origin) && Number.isInteger(note.target) ? [{ sample, origin: note.origin as number, target: note.target as number }] : [];
    } catch { return []; }
  });
  return <div className="cart-sample-table"><table aria-label="纸带时间与位移记录表">
    <thead><tr><th>组别／起点</th><th>原始点编号</th><th>间隔数 n</th><th>时间 t（s）</th><th>位移 x（m）</th></tr></thead>
    <tbody>{samples.length ? samples.map(({ sample, origin, target }) => {
      const rows = scene.measurementRecords.filter(row => row.context?.sampleId === sample.id);
      return <tr key={sample.id}><th scope="row">{sample.setupLabel}</th><td>{origin} → {target}</td>{['打点间隔数', '纸带时间', '纸带位移'].map(label => <td key={label}>{display(rows.find(row => row.context?.pointLabel === label))}</td>)}</tr>;
    }) : <tr><td colSpan={5}>空表：先数间隔、计算时间，再自行读尺并保存。</td></tr>}</tbody>
  </table></div>;
}
