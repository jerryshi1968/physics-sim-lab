import type { SceneDocument } from '../../core/scene/schema.ts';
import { pendulumResults, pendulumFits } from '../../equipment/pendulum/measure.ts';
import { csvCell } from '../../core/measurements/csv.ts';

const number = (value: number | null) => value === null ? '—' : Number(value.toPrecision(7));
export function PendulumChart({ scene }: { scene: SceneDocument }) {
  const rows = pendulumResults(scene), fits = pendulumFits(scene), valid = rows.filter(row => row.valid);
  const maxL = Math.max(.1, ...valid.map(row => row.length!)), maxT = Math.max(1, ...valid.map(row => row.period! ** 2));
  const exportResults = () => {
    const lines = [['组别', '摆长L(m)', '释放摆角(°)', '周期T(s)', 'T²(s²)', '小角公式g(m/s²)', '状态'], ...rows.map(row => [row.label, row.length ?? '', row.angle, row.period ?? '', row.period === null ? '' : row.period ** 2, row.g ?? '', !row.valid ? '读数缺失或周期计数无效' : row.smallAngle ? '小角有效' : '大角度：不参与小角拟合'])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.map(line => line.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '单摆测g.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="spring-fits pendulum-results"><h3>单摆记录计算与图线</h3><p>L=球心读数−悬点读数；T=t/N；g=4π²L/T²。下表与图线随原始读数修订即时重算，不使用理论周期代替抄表。</p>
    <button disabled={!rows.length} onClick={exportResults}>导出单摆计算 CSV</button>
    <div className="measurement-table-scroll"><table><thead><tr><th>组别</th><th>L / m</th><th>摆角 / °</th><th>T / s</th><th>g / (m/s²)</th><th>状态</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} data-testid="pendulum-result"><td>{row.label}</td><td>{number(row.length)}</td><td>{row.angle}</td><td>{number(row.period)}</td><td>{number(row.g)}</td><td>{!row.valid ? '缺失或无效读数' : row.smallAngle ? '小角有效' : '大角度；g 为小角公式的表观值'}</td></tr>)}</tbody></table></div>
    <svg viewBox="0 0 640 300" role="img" aria-label="单摆 T平方与摆长图线" style={{ width: '100%', maxWidth: 760 }}><path d="M58 18V258H620" fill="none" stroke="#79908b" /><text x="6" y="18" fontSize="13">T² / s²</text><text x="553" y="290" fontSize="13">L / m</text>{[0, 1, 2, 3, 4].map(n => <g key={n} fontSize="11"><text x={58 + n * 137} y="276">{number(maxL * n / 4)}</text><text x="4" y={258 - n * 58}>{number(maxT * n / 4)}</text></g>)}{valid.map(row => <circle key={row.id} cx={58 + row.length! / maxL * 548} cy={258 - row.period! ** 2 / maxT * 232} r="4" fill={row.smallAngle ? '#16786f' : '#ba8035'}><title>{row.label}；摆角 {row.angle}°；T={number(row.period)} s</title></circle>)}</svg>
    <h4>由 T²–L 斜率求 g</h4><p>至少五个不同摆长，同组、相同摆角与摆球配置，且摆角不超过 5°；普通最小二乘保留截距。橙色点为大角度，不参与小角拟合。改变摆角时可固定摆长，在上表比较周期。</p>
    {fits.map(group => <p key={group.signature} data-testid="pendulum-fit">{group.label}：{group.fit ? `g=${number(group.g)} m/s²；斜率=${number(group.fit.slope)} s²/m；截距=${number(group.fit.intercept)} s²；R²=${number(group.fit.rSquared)}` : `${group.count} 个有效点，尚不足五个不同摆长。`}</p>)}
  </section>;
}
