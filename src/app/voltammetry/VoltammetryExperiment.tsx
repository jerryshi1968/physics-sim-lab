import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import type { Scalar } from '../../core/equipment/schema.ts';
import type { CaptureInput } from '../measurements/MeasurementPanel.tsx';
import { RESISTOR, SWITCH, AMMETER, VOLTMETER } from '../../equipment/electrical/definitions.ts';
import { unknownSamples, voltammetryAnalysis, voltammetryCircuit } from '../../equipment/electrical/voltammetry.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { csvCell } from '../../core/measurements/csv.ts';

const number = (value: number | null) => value === null ? '—' : Number(value.toPrecision(6));
export function VoltammetryGuide({ scene, reply, onReplace, onIdealize, onRange }: { scene: SceneDocument; reply: SimulationReply | null; onReplace: (id: string, values: Record<string, Scalar>) => void; onIdealize: () => void; onRange: (id: string, range: 'low' | 'high') => void }) {
  const resistor = scene.equipment.find(item => item.type === RESISTOR), circuit = voltammetryCircuit(scene), closed = scene.equipment.some(item => item.type === SWITCH && item.parameters.closed);
  const meters = reply?.documentId === scene.documentId && reply.documentRevision === scene.revision && reply.payload.result.ok ? reply.payload.meters : null;
  const status = !circuit.ok ? circuit.message : !meters ? '等待电路计算。' : [circuit.ammeter, circuit.voltmeter].some(item => meters.find(meter => meter.id === item.id)?.status !== 'valid') ? '请检查两表量程、极性与接线；超量程不能用于测量。' : '可调节滑片，记录不同电压下的 U、I。';
  return <section className="property-editor" aria-label="伏安法实验控制"><h3>伏安法测量定值电阻</h3>
    <p data-testid="voltammetry-status">{status}</p>
    {scene.equipment.some(item => item.type === AMMETER && item.parameters.resistanceOhm !== 0 || item.type === VOLTMETER && item.parameters.finiteInput) && <button onClick={onIdealize}>恢复理想电表</button>}
    <fieldset className="ohm-replacements"><legend>待测电阻</legend>{Object.entries(unknownSamples).map(([label, resistanceOhm]) => <button key={label} disabled={!resistor || closed} aria-pressed={resistor?.parameters.sampleLabel === label && resistor.parameters.resistanceOhm === resistanceOhm} onClick={() => resistor && onReplace(resistor.id, { resistanceOhm, concealResistance: true, sampleLabel: label })}>电阻 {label}</button>)}</fieldset>
    {resistor && !resistor.parameters.concealResistance && <button onClick={() => onReplace(resistor.id, { concealResistance: true })}>隐藏当前电阻阻值</button>}
    <p>断开开关后更换待测电阻，原有接线保留。</p>
    {scene.equipment.filter(item => item.type === AMMETER || item.type === VOLTMETER).map(item => {
      const connected = meterConnection(scene, item.id), leads = scene.connections.filter(wire => [wire.from, wire.to].some(end => end?.equipmentId === item.id && ['low', 'high'].includes(end.portId)));
      const label = item.type === AMMETER ? '电流表量程' : '电压表量程', unit = item.type === AMMETER ? 'A' : 'V';
      return <label key={item.id}>{label}<select aria-label={label} value={connected.bothRanges ? '' : connected.range ?? ''} disabled={closed || leads.length !== 1 || connected.bothRanges} onChange={event => onRange(item.id, event.target.value as 'low' | 'high')}><option value="" disabled>请先接好一个正量程端</option>{(['low', 'high'] as const).map(range => <option key={range} value={range}>0～{String(item.parameters[`${range}Range`])} {unit}（每格 {String(item.parameters[`${range}Resolution`])} {unit}）</option>)}</select></label>;
    })}
    <p>断开开关后选择量程，或直接改接接线柱；量程选择会移动已有导线线头。多条导线共用量程端时请逐条改接。</p>
    <details><summary>实验步骤与误差分析</summary><ol><li>开关断开，变阻器接入最大电阻，两表先用大量程。闭合观察后，断开开关，按接线柱改用合适量程。</li><li>调节滑片，至少记录三个不同工作点。保持同一电阻；不自动填入手工读数。</li><li>记录区计算各次 U/I；图线区比较平均值、离散程度、量程分辨率及 U–I 斜率。</li></ol><p>电流表内阻为 0，电压表内阻为 ∞。半分度区间仅估计读数分辨率，不代表仪器准确度或置信区间。隐藏阻值是教学显示设置，可在属性中显式取消；存档保留模型参数。</p></details>
  </section>;
}

export function VoltammetryRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: CaptureInput) => string | null }) {
  const [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [current, setCurrent] = useState(''), [voltage, setVoltage] = useState(''), [error, setError] = useState('');
  const circuit = voltammetryCircuit(scene), results = voltammetryAnalysis(scene).results;
  const capture = (source: 'manual' | 'instrument') => {
    if (!circuit.ok) return;
    const message = onCapture({ source, setupLabel: group, note, choices: [{ equipmentId: circuit.ammeter.id, pointLabel: '电流I', rawInput: current }, { equipmentId: circuit.voltmeter.id, pointLabel: '电阻两端电压U', rawInput: voltage }] });
    setError(message ?? ''); if (!message && source === 'manual') { setCurrent(''); setVoltage(''); }
  };
  return <section className="measurement-panel" aria-label="伏安法成组记录"><h3>伏安法 U、I 成组记录</h3>
    <div className="measurement-context-fields"><label>伏安法实验组别<input value={group} maxLength={100} onChange={event => setGroup(event.target.value)} /></label><label>伏安法实验备注<input value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label></div>
    <div className="measurement-context-fields"><label>电流 I（A）<input inputMode="decimal" value={current} maxLength={1000} onChange={event => setCurrent(event.target.value)} placeholder="手工读表，留空记缺失" /></label><label>电阻两端电压 U（V）<input inputMode="decimal" value={voltage} maxLength={1000} onChange={event => setVoltage(event.target.value)} placeholder="手工读表，留空记缺失" /></label></div>
    <div className="measurement-actions"><button disabled={!ready || !circuit.ok} onClick={() => capture('manual')}>保存一组 I、U 抄表</button><button disabled={!ready || !circuit.ok} onClick={() => capture('instrument')}>采集一组 I、U 示数</button></div>
    <p>量程、分度值与装置随记录保存。完整原始记录可在下表修订、删除；比值与分析随之更新。</p>
    {!circuit.ok && <p>{circuit.message}</p>}{error && <p role="alert">{error}</p>}
    {!!results.length && <div className="measurement-table-wrap"><table className="measurement-table"><thead><tr><th>组别</th><th>待测电阻</th><th>U / V</th><th>I / A</th><th>R=U/I / Ω</th><th>状态</th></tr></thead><tbody>{results.map(row => <tr key={row.id} data-testid="voltammetry-result"><td>{row.label}</td><td>R{row.sample}</td><td>{number(row.voltage)}</td><td>{number(row.current)}</td><td data-resistance={row.resistance ?? ''}>{number(row.resistance)}</td><td>{row.reason ?? '有效'}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function VoltammetryChart({ scene }: { scene: SceneDocument }) {
  const result = voltammetryAnalysis(scene);
  const exportResults = () => {
    const rows: (string | number | null)[][] = [['组别', '待测编号', '来源', 'U_V', 'I_A', 'R_ohm_UI', '状态', '电流量程', '电压量程', '半分度_A', '半分度_V', '读数区间下限_ohm', '读数区间上限_ohm_空为无上界或无效'], ...result.results.map(row => [row.label, row.sample, row.source, row.voltage, row.current, row.resistance, row.reason ?? '有效', row.aRange, row.vRange, row.deltaI, row.deltaU, row.lower, row.upper]), [], ['系列', '有效次数', '不同电流数', '平均R_ohm', '平均绝对偏差_ohm', '相对平均偏差_percent', 'UI斜率_ohm', 'UI截距_V', 'R平方']];
    for (const group of result.groups) rows.push([group.label, group.rows.length, group.distinct, group.mean, group.meanDeviation, group.relativeDeviationPercent, group.fit?.slope ?? null, group.fit?.intercept ?? null, group.fit?.rSquared ?? null]);
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = '伏安法测电阻-分析.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="measurement-panel"><div className="measurement-toolbar"><h3>伏安法测电阻 · U–I 与误差分析</h3><button disabled={!result.results.length} onClick={exportResults}>导出伏安法分析 CSV</button></div>
    {!result.results.length && <p>尚无记录。调节变阻器并保存多组 U、I。</p>}
    {result.omitted > 0 && <p data-testid="voltammetry-omitted">{result.omitted} 组无效，保留原始记录，排除计算与拟合。</p>}
    {result.groups.map((group, index) => {
      const xmax = Math.max(.001, ...group.points.map(point => point.x)) * 1.1, ymax = Math.max(.1, ...group.points.map(point => point.y)) * 1.1;
      const x = (value: number) => 65 + 500 * value / xmax, y = (value: number) => 260 - 215 * value / ymax, fit = group.fit;
      return <section key={group.id}><h4>系列 {index + 1}：{group.label}</h4>
        <p data-testid="voltammetry-summary" data-mean={group.mean}>平均 R={number(group.mean)} Ω；平均绝对偏差={number(group.meanDeviation)} Ω；相对平均偏差={number(group.relativeDeviationPercent)}%。{group.rows.length} 次 / {group.distinct} 个不同电流点。</p>
        {group.distinct < 3 && <p>请至少记录三个不同工作点，再比较多次测量结果。</p>}
        <svg viewBox="0 0 620 310" style={{ width: '100%', maxWidth: 850, minWidth: 260 }} role="img" aria-label={`${group.label} U–I 散点与拟合线`}>
          <defs><clipPath id={`voltammetry-plot-${index}`}><rect x="65" y="35" width="500" height="225" /></clipPath></defs>
          <path d="M65 35V260H565" fill="none" stroke="#647b7c" />
          {[0, 1, 2, 3, 4, 5].map(tick => <g key={tick}><text x={x(xmax * tick / 5)} y="280" textAnchor="middle" fontSize="12">{number(xmax * tick / 5)}</text><text x="56" y={y(ymax * tick / 5) + 4} textAnchor="end" fontSize="12">{number(ymax * tick / 5)}</text></g>)}
          <text x="580" y="302" textAnchor="end" fontSize="14">I / A</text><text x="22" y="25" fontSize="14">U / V</text>
          <g clipPath={`url(#voltammetry-plot-${index})`}>{fit && <path d={`M${x(0)} ${y(fit.intercept)}L${x(xmax)} ${y(fit.intercept + fit.slope * xmax)}`} stroke="#c46c29" strokeWidth="2" fill="none" />}{group.points.map(point => <circle key={point.sampleId} cx={x(point.x)} cy={y(point.y)} r="4" fill="#126c63" />)}</g>
        </svg>
        {fit && <p data-testid="voltammetry-fit" data-slope={fit.slope}>U–I 斜率 R={number(fit.slope)} Ω；截距={number(fit.intercept)} V；R²={number(fit.rSquared)}。拟合保留截距。</p>}
        <div className="measurement-table-wrap"><table className="measurement-table"><thead><tr><th>U / V</th><th>I / A</th><th>R / Ω</th><th>相对本组均值偏差 / %</th><th>半分度读数区间 / Ω</th></tr></thead><tbody>{group.rows.map(row => <tr key={row.id}><td>{number(row.voltage)}</td><td>{number(row.current)}</td><td>{number(row.resistance)}</td><td>{number((row.resistance! - group.mean) / group.mean * 100)}</td><td>{number(row.lower)}～{row.upper === null ? '无上界' : number(row.upper)}</td></tr>)}</tbody></table></div>
      </section>;
    })}
    {!!result.groups.length && <p>按组别、待测电阻和抄表来源分系列，可比较不同量程。偏差相对测量均值；未给定参考值时不称为真实误差。读数区间取 U、I 各半分度的上下界，I 不大于半分度时无有限上界；不包含仪器等级、视差或系统误差。</p>}
  </section>;
}
