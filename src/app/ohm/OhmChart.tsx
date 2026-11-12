import type { SceneDocument } from '../../core/scene/schema.ts';
import { ohmFits, ohmLabels } from '../../equipment/electrical/ohm.ts';
import { csvCell } from '../../core/measurements/csv.ts';

const number = (value: number | null) => value === null ? '—' : Number(value.toPrecision(7));
export function OhmChart({ scene }: { scene: SceneDocument }) {
  const result = ohmFits(scene);
  const exportResults = () => {
    const rows: (string | number | null)[][] = [['组别', '探究关系', '来源', 'R_ohm_标称值', 'U_V_记录', 'I_A_记录', '控制条件状态', '固定R_ohm', '目标U_V', '允许偏差_V'], ...result.results.map(row => [row.label, row.control ? ohmLabels[row.control.mode] : '无效', row.source === 'manual' ? '手工抄表' : '仪表示数', row.resistance, row.voltage, row.current, row.reason ?? '满足控制条件', row.control?.fixedResistanceOhm ?? null, row.control?.targetVoltageV ?? null, row.control?.voltageToleranceV ?? null]), [], ['系列', '图线', '点数', '不同横坐标数', '斜率', '截距_A', 'R平方']];
    for (const group of result.groups) if (group.fit) rows.push([group.label, ohmLabels[group.control.mode], group.fit.count, group.fit.distinct, group.fit.slope, group.fit.intercept, group.fit.rSquared]);
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = '电流与电压电阻关系-图线.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="measurement-panel ohm-chart"><div className="measurement-toolbar"><h3>I–U 与 I–1/R 图线</h3><button disabled={!result.results.length} onClick={exportResults}>导出电流关系 CSV</button></div>
    <p>I–U 保持定值电阻不变；I–1/R 保持电阻两端电压。按组别、探究关系、控制目标、来源和电源/电表配置分系列；普通最小二乘保留截距，不强迫过原点，至少五个不同横坐标。</p>
    {!result.results.length && <p>尚无记录。先调节电路并保存成组读数。</p>}
    {result.omitted > 0 && <p data-testid="ohm-omitted">{result.omitted} 组未满足控制条件或读数无效，保留记录但不参与拟合。</p>}
    {!!result.results.length && <div className="measurement-table-wrap"><table className="measurement-table"><thead><tr><th>组别</th><th>关系</th><th>R / Ω（标称）</th><th>U / V</th><th>I / A</th><th>控制检查</th></tr></thead><tbody>{result.results.map(row => <tr key={row.id} data-testid="ohm-result"><td>{row.label}</td><td>{row.control ? ohmLabels[row.control.mode] : '无效配置'}</td><td>{number(row.resistance)}</td><td>{number(row.voltage)}</td><td>{number(row.current)}</td><td>{row.reason ?? '满足控制条件'}</td></tr>)}</tbody></table></div>}
    {result.groups.map((group, index) => {
      const xmax = Math.max(.001, ...group.points.map(point => point.x)) * 1.1, fit = group.fit;
      const values = group.points.map(point => point.y); if (fit) values.push(fit.intercept, fit.intercept + fit.slope * xmax);
      const ymin = Math.min(0, ...values), ymax = Math.max(.01, ...values) * 1.1, x = (value: number) => 65 + 510 * value / xmax, y = (value: number) => 270 - 225 * (value - ymin) / (ymax - ymin), label = group.control.mode === 'voltage' ? 'U / V' : '1/R / Ω⁻¹';
      return <section key={group.id}><h4>系列 {index + 1}：{group.label} · {ohmLabels[group.control.mode]}</h4>
        <p>{group.control.mode === 'voltage' ? `固定 R=${group.control.fixedResistanceOhm} Ω` : `保持 U=${group.control.targetVoltageV}±${group.control.voltageToleranceV} V`}{group.finiteVoltmeter ? '；电压表有限内阻，电流包含分流，拟合保留加载影响。' : '；理想电压表不分流。'}</p>
        <svg viewBox="0 0 620 320" style={{ width: '100%', maxWidth: 850, minWidth: 260 }} role="img" aria-label={`${group.label} ${ohmLabels[group.control.mode]}散点与拟合线`}><path d="M65 35V270H585" fill="none" stroke="#647b7c" />
          {[0, 1, 2, 3, 4, 5].map(tick => <g key={tick}><path d={`M${x(xmax * tick / 5)} 270v5M60 ${y(ymin + (ymax - ymin) * tick / 5)}h5`} stroke="#647b7c" /><text x={x(xmax * tick / 5)} y="290" textAnchor="middle" fontSize="12">{number(xmax * tick / 5)}</text><text x="56" y={y(ymin + (ymax - ymin) * tick / 5) + 4} textAnchor="end" fontSize="12">{number(ymin + (ymax - ymin) * tick / 5)}</text></g>)}
          <text x="580" y="311" textAnchor="end" fontSize="14">{label}</text><text x="22" y="25" fontSize="14">I / A</text>
          {fit && <path data-testid="ohm-fit-line" d={`M${x(0)} ${y(fit.intercept)}L${x(xmax)} ${y(fit.intercept + fit.slope * xmax)}`} stroke="#c46c29" strokeWidth="2" fill="none" />}
          {group.points.map(point => <circle key={point.sampleId} cx={x(point.x)} cy={y(point.y)} r="4" fill="#126c63"><title>{label}={number(point.x)}；I={number(point.y)} A</title></circle>)}
        </svg>
        {fit ? <p data-testid="ohm-fit" data-mode={group.control.mode} data-slope={fit.slope} data-intercept={fit.intercept}>斜率={number(fit.slope)} {group.control.mode === 'voltage' ? 'A/V' : 'V'}；截距={number(fit.intercept)} A；R²={number(fit.rSquared)}；{fit.count} 点 / {fit.distinct} 个不同横坐标</p> : <p>当前 {group.points.length} 个有效点，至少五个不同横坐标才拟合。</p>}
      </section>;
    })}
  </section>;
}
