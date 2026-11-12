import type { SceneDocument } from '../../core/scene/schema.ts';
import { emfFits } from '../../equipment/electrical/emf.ts';
import { csvCell } from '../../core/measurements/csv.ts';

const number = (value: number) => Number(value.toPrecision(7));
export function EmfChart({ scene }: { scene: SceneDocument }) {
  const result = emfFits(scene);
  function exportFits() {
    const rows: (string | number)[][] = [['组别/接法/来源', '有效点数', '不同电流数', '截距_V', '斜率_V每A', 'E测_V', 'r测_ohm', 'R平方', '物理解释']];
    for (const group of result.groups) if (group.fit) rows.push([group.label, group.fit.count, group.fit.distinct, group.fit.intercept, group.fit.slope, group.physical ? group.fit.intercept : '', group.physical ? -group.fit.slope : '', group.fit.rSquared, group.physical ? '含电表加载的测量结果，未自动修正' : '非物理拟合，检查记录']);
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = '电动势-U-I-拟合.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="measurement-panel"><div className="measurement-toolbar"><h3>U–I 图线与电动势、内阻拟合</h3><button onClick={exportFits} disabled={!result.groups.some(group => group.fit)}>导出拟合 CSV</button></div>
    <p>普通最小二乘 U=b+kI，不强迫过原点；至少五个不同电流。按组别、来源、接法、电源及电表配置分组，改变负载可继续采样；重复电流不补足工作点。E测=b、r测=−k，保留电表加载与读数舍入的影响。</p>
    {!result.groups.length && <p>尚无成对有效记录。请在记录表采样，并调节变阻器取得不同电流。</p>}
    {result.omitted > 0 && <p>排除 {result.omitted} 组不完整、异常或不支持接法的数据。</p>}
    {result.groups.map((group, seriesIndex) => {
      const fit = group.fit, xmax = Math.max(.001, ...group.points.map(point => point.x)) * 1.1;
      const values = group.points.map(point => point.y); if (fit) values.push(fit.intercept, fit.intercept + fit.slope * xmax);
      const ymin = Math.min(0, ...values), ymax = Math.max(.01, ...values) * 1.1, x = (value: number) => 65 + 510 * value / xmax, y = (value: number) => 270 - 225 * (value - ymin) / (ymax - ymin);
      return <section key={group.id} className="emf-fit-series"><h4>系列 {seriesIndex + 1}：{group.label}</h4>
        <details><summary>采样配置（同名组改变配置后另列系列）</summary><p>E={String(group.circuit.source.parameters.voltageV)} V；r={String(group.circuit.source.parameters.internalResistanceOhm ?? 0)} Ω；RA={String(group.circuit.ammeter.parameters.resistanceOhm)} Ω；RV={group.circuit.voltmeter.parameters.finiteInput ? `${String(group.circuit.voltmeter.parameters.inputResistanceOhm)} Ω` : '∞'}。每个点的量程、接线与原始读数在记录表追溯详情中。</p></details>
        <svg viewBox="0 0 620 320" style={{ width: '100%', maxWidth: 850, minWidth: 260 }} role="img" aria-label={`${group.label} U–I 散点与拟合线`}><path d="M65 35V270H585" fill="none" stroke="#647b7c" />
          {[0, 1, 2, 3, 4, 5].map(tick => <g key={tick}><path d={`M${x(xmax * tick / 5)} 270v5M60 ${y(ymin + (ymax - ymin) * tick / 5)}h5`} stroke="#647b7c" /><text x={x(xmax * tick / 5)} y="290" textAnchor="middle" fontSize="12">{number(xmax * tick / 5)}</text><text x="56" y={y(ymin + (ymax - ymin) * tick / 5) + 4} textAnchor="end" fontSize="12">{number(ymin + (ymax - ymin) * tick / 5)}</text></g>)}
          <text x="580" y="311" textAnchor="end" fontSize="14">I / A</text><text x="22" y="25" fontSize="14">U / V</text>
          {fit && <path data-testid="emf-fit-line" d={`M${x(0)} ${y(fit.intercept)}L${x(xmax)} ${y(fit.intercept + fit.slope * xmax)}`} stroke="#c46c29" strokeWidth="2" fill="none" />}
          {group.points.map((point, index) => <circle key={index} cx={x(point.x)} cy={y(point.y)} r="4" fill="#126c63"><title>I={point.x} A；U={point.y} V</title></circle>)}
        </svg>
        {fit ? <><p data-testid="emf-fit" data-intercept={fit.intercept} data-resistance={-fit.slope}>U={number(fit.intercept)} {fit.slope < 0 ? '−' : '+'} {number(Math.abs(fit.slope))} I；R²={number(fit.rSquared)}；{fit.count} 点 / {fit.distinct} 个不同电流</p><p>{group.physical ? `E测=${number(fit.intercept)} V；r测=${number(-fit.slope)} Ω（未修正电表加载）` : '截距非正或斜率为正，不能解释为正常放电电源的 E、r，请检查读数。'}</p></> : <p>当前 {group.points.length} 个有效点，需要至少五个不同电流才拟合。</p>}
      </section>;
    })}
  </div>;
}
