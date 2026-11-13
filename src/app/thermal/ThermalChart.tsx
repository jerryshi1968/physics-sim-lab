import type { SceneDocument } from '../../core/scene/schema.ts';
import { thermalRows } from '../../equipment/thermal/measure.ts';
import { csvCell } from '../../core/measurements/csv.ts';
export function ThermalChart({ scene }: { scene: SceneDocument }) {
  const rows = thermalRows(scene), valid = rows.filter(r => r.timeS !== null && r.temperatureC !== null), maxTime = Math.max(60,...valid.map(r => r.timeS!));
  const groups = [...new Set(valid.map(r => `${r.series}:${r.label}`))];
  function download() {
    const lines = [['组别','时间(s)','温度(℃)','加热状态','观察备注'],...rows.map(r => [r.label,r.timeS,r.temperatureC,r.heating ? '加热' : '未加热',r.note])];
    const url = URL.createObjectURL(new Blob(['\ufeff'+lines.map(row => row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='水沸腾温度-时间.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <section className="spring-fits"><h3>温度—时间图线</h3><button disabled={!rows.length} onClick={download}>导出温度—时间 CSV</button><p>使用已保存的读数；缺失或无效读数不绘点。重置后的记录另画一组。</p><svg role="img" aria-label="水温与时间图线" viewBox="0 0 640 310" style={{width:'100%',maxWidth:800}}><path d="M55 20V260H610" fill="none" stroke="#79908b" /><text x="3" y="15" fontSize="12">T / ℃</text><text x="565" y="300" fontSize="12">t / s</text>{[0,20,40,60,80,100].map(t => <g key={t}><path d={`M55 ${260-t*2.1}H610`} stroke="#dae7e5" /><text x="22" y={264-t*2.1} fontSize="11">{t}</text></g>)}{[0,1,2,3,4].map(n => <text key={n} x={55+n*137} y="280" fontSize="11">{Number((maxTime*n/4).toFixed(1))}</text>)}{groups.map((key,index) => { const points=valid.filter(r => `${r.series}:${r.label}`===key).sort((a,b) => a.timeS!-b.timeS!); const color=['#16786f','#b77728','#4c70aa'][index%3]!; return <g key={key}><polyline points={points.map(r => `${55+r.timeS!/maxTime*548},${260-r.temperatureC!*2.1}`).join(' ')} stroke={color} fill="none" />{points.map(r => <circle key={r.id} cx={55+r.timeS!/maxTime*548} cy={260-r.temperatureC!*2.1} r="4" fill={color}><title>{r.label}：{r.timeS} s；{r.temperatureC} ℃</title></circle>)}</g>; })}</svg><div className="measurement-table-scroll"><table><thead><tr><th>组别</th><th>时间 / s</th><th>温度 / ℃</th><th>状态</th><th>观察</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} data-testid="thermal-result"><td>{r.label}</td><td>{r.timeS ?? '—'}</td><td>{r.temperatureC ?? '—'}</td><td>{r.heating ? '加热' : '未加热'}</td><td>{r.note}</td></tr>)}</tbody></table></div></section>;
}
