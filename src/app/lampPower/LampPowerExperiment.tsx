import { useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import type { Scalar } from '../../core/equipment/schema.ts';
import type { CaptureInput } from '../measurements/MeasurementPanel.tsx';
import { LAMP, SWITCH, AMMETER, VOLTMETER } from '../../equipment/electrical/definitions.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';
import { lampPowerCircuit, lampPowerPoint, lampPowerPointLabels, lampPowerAnalysis } from '../../equipment/electrical/lamp-power.ts';
import { csvCell } from '../../core/measurements/csv.ts';

const number = (value: number | null) => value === null ? '—' : Number(value.toPrecision(6));
export function LampPowerGuide({ scene, reply, onRange, onIdealize }: { scene: SceneDocument; reply: SimulationReply | null; onRange: (id: string, range: 'low' | 'high') => void; onIdealize: () => void; onReplace?: (id: string, values: Record<string, Scalar>) => void }) {
  const circuit = lampPowerCircuit(scene), lamp = scene.equipment.find(item => item.type === LAMP), closed = scene.equipment.some(item => item.type === SWITCH && item.parameters.closed);
  const fresh = reply?.documentId === scene.documentId && reply.documentRevision === scene.revision ? reply : null;
  const meters = fresh?.payload.result.ok ? fresh.payload.meters : null;
  const voltage = circuit.ok ? meters?.find(item => item.id === circuit.voltmeter.id && item.status === 'valid') : null;
  const current = circuit.ok ? meters?.find(item => item.id === circuit.ammeter.id && item.status === 'valid') : null;
  const point = voltage && current && (voltage.displayValue ?? 0) > 0 && (current.displayValue ?? 0) > 0 ? lampPowerPoint(voltage.displayValue!, Number(lamp!.parameters.ratedVoltageV), voltage.resolution) : null;
  return <section className="property-editor" aria-label="小灯泡电功率控制"><h3>小灯泡电功率</h3>
    {lamp && <p>灯泡额定电压 Uₙ={String(lamp.parameters.ratedVoltageV)} V</p>}
    <p data-testid="lamp-power-status">{!circuit.ok ? circuit.message : fresh && !fresh.payload.result.ok ? '电路计算不可用，请检查诊断；本次不能得到有效功率。' : !meters ? '等待电路计算。' : !point ? '请检查两表量程、极性与电路诊断。' : `${lampPowerPointLabels[point]}；可记录本次 U、I 与亮度观察。`}</p>
    {scene.equipment.some(item => item.type === AMMETER && item.parameters.resistanceOhm !== 0 || item.type === VOLTMETER && item.parameters.finiteInput) && <button onClick={onIdealize}>恢复理想电表</button>}
    {scene.equipment.filter(item => item.type === AMMETER || item.type === VOLTMETER).map(item => {
      const connected = meterConnection(scene, item.id), leads = scene.connections.filter(wire => [wire.from, wire.to].some(end => end?.equipmentId === item.id && ['low', 'high'].includes(end.portId)));
      const label = item.type === AMMETER ? '电流表量程' : '电压表量程', unit = item.type === AMMETER ? 'A' : 'V';
      return <label key={item.id}>{label}<select aria-label={label} value={connected.bothRanges ? '' : connected.range ?? ''} disabled={closed || leads.length !== 1 || connected.bothRanges} onChange={event => onRange(item.id, event.target.value as 'low' | 'high')}><option value="" disabled>请先接好一个正量程端</option>{(['low', 'high'] as const).map(range => <option key={range} value={range}>0～{String(item.parameters[`${range}Range`])} {unit}（每格 {String(item.parameters[`${range}Resolution`])} {unit}）</option>)}</select></label>;
    })}
    <p>断开开关后选量程；调滑片找到额定电压，再记录额定工作点。</p>
    <details><summary>实验步骤与模型范围</summary><ol><li>变阻器接一上一下两柱，从最大接入电阻开始。电流表串联，电压表跨灯泡；先大量程观察，再断开开关改量程。</li><li>分别记录低于、达到和略高于额定电压时的 U、I 与亮度。高于额定不表示允许真实实验长时间过压。</li><li>每次 P=UI；只有额定电压附近的记录用于额定功率，不能把不同工作点的功率混合平均。</li></ol><p>沿用首版非线性灯泡，亮度随耗散功率变化；不以恒定电阻代替灯丝，不模拟热惯性或烧毁。理想电表内阻为 0 / ∞；额定工作点按电压表半分度判断，粗量程可能不足以区分相邻状态。模型越界、超量程不输出正常测量。</p></details>
  </section>;
}

function CaptureButton({ disabled, onPress, label }: { disabled: boolean; onPress: () => void; label: string }) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null), touchHandled = useRef(false);
  return <button disabled={disabled} style={{ touchAction: 'manipulation' }} onPointerDown={event => {
    touchHandled.current = false;
    start.current = event.isPrimary && event.pointerType !== 'mouse' ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }} onPointerUp={event => {
    const down = start.current; start.current = null;
    if (!down || down.id !== event.pointerId || !event.isPrimary) return;
    touchHandled.current = true;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 10) onPress();
  }} onPointerCancel={() => { start.current = null; touchHandled.current = true; }} onClick={event => {
    if (touchHandled.current && event.detail !== 0) { touchHandled.current = false; return; }
    touchHandled.current = false; onPress();
  }}>{label}</button>;
}

export function LampPowerRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: CaptureInput) => string | null }) {
  const [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [current, setCurrent] = useState(''), [voltage, setVoltage] = useState(''), [error, setError] = useState('');
  const circuit = lampPowerCircuit(scene), result = lampPowerAnalysis(scene);
  const capture = (source: 'manual' | 'instrument') => {
    if (!circuit.ok) return;
    const message = onCapture({ source, setupLabel: group, note, choices: [{ equipmentId: circuit.ammeter.id, pointLabel: '灯泡电流I', rawInput: current }, { equipmentId: circuit.voltmeter.id, pointLabel: '灯泡两端电压U', rawInput: voltage }] });
    setError(message ?? ''); if (!message && source === 'manual') { setCurrent(''); setVoltage(''); }
  };
  return <section className="measurement-panel" aria-label="灯泡功率成组记录"><h3>小灯泡 U、I 与功率记录</h3>
    <div className="measurement-context-fields"><label>灯泡功率实验组别<input value={group} maxLength={100} onChange={event => setGroup(event.target.value)} /></label><label>亮度观察与备注<input value={note} maxLength={500} onChange={event => setNote(event.target.value)} placeholder="自行观察填写" /></label></div>
    <div className="measurement-context-fields"><label>灯泡电流 I（A）<input inputMode="decimal" value={current} maxLength={1000} onChange={event => setCurrent(event.target.value)} placeholder="手工读表，留空记缺失" /></label><label>灯泡两端电压 U（V）<input inputMode="decimal" value={voltage} maxLength={1000} onChange={event => setVoltage(event.target.value)} placeholder="手工读表，留空记缺失" /></label></div>
    <div className="measurement-actions"><CaptureButton disabled={!ready || !circuit.ok} onPress={() => capture('manual')} label="保存一组灯泡抄表" /><CaptureButton disabled={!ready || !circuit.ok} onPress={() => capture('instrument')} label="采集一组灯泡示数" /></div>
    <p>功率由本次保存的 U、I 计算；额定电压、量程和灯泡设置随快照保存。原始读数可在下表修订、删除。</p>
    {!circuit.ok && <p>{circuit.message}</p>}{error && <p role="alert">{error}</p>}
    {!!result.results.length && <div className="measurement-table-wrap"><table className="measurement-table"><thead><tr><th>组别</th><th>U / V</th><th>I / A</th><th>P=UI / W</th><th>工作点</th><th>亮度观察与备注</th></tr></thead><tbody>{result.results.map(row => <tr key={row.id} data-testid="lamp-power-result"><td>{row.label}</td><td>{number(row.voltage)}</td><td>{number(row.current)}</td><td data-power={row.power ?? ''}>{number(row.power)}</td><td>{row.reason ?? `${lampPowerPointLabels[row.point!]}${row.workPointWarning ? '；' + row.workPointWarning : ''}`}</td><td>{row.note}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function LampPowerChart({ scene }: { scene: SceneDocument }) {
  const result = lampPowerAnalysis(scene);
  const exportResults = () => {
    const rows: (string | number | null)[][] = [['组别', '来源', 'U_V_记录', 'I_A_记录', 'P_W_UI', '额定U_V_快照', '工作点状态', '工作点核对', '电流量程', '电压量程', '电压分度_V', '亮度观察与备注'], ...result.results.map(row => [row.label, row.source, row.voltage, row.current, row.power, row.ratedVoltage, row.reason ?? lampPowerPointLabels[row.point!], row.workPointWarning, row.aRange, row.vRange, row.resolution, row.note]), [], ['系列', '有效工作点数', '额定工作点数', '额定工作点平均P_W']];
    for (const group of result.groups) rows.push([group.label, group.rows.length, group.ratedCount, group.ratedPower]);
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = '小灯泡电功率-记录.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="measurement-panel"><div className="measurement-toolbar"><h3>小灯泡 P–U 图线与额定功率</h3><button disabled={!result.results.length} onClick={exportResults}>导出灯泡功率 CSV</button></div>
    {!result.results.length && <p>尚无成组记录。请自行调滑片并保存 U、I。</p>}
    {result.omitted > 0 && <p data-testid="lamp-power-omitted">{result.omitted} 组读数无效，保留原始记录并排除功率比较。</p>}
    {result.groups.map((group, index) => {
      const xmax = Math.max(group.ratedVoltage, ...group.rows.map(row => row.voltage!)) * 1.1, ymax = Math.max(.01, ...group.rows.map(row => row.power!)) * 1.1;
      const x = (value: number) => 65 + 500 * value / xmax, y = (value: number) => 260 - 215 * value / ymax;
      return <section key={group.id}><h4>系列 {index + 1}：{group.label}</h4>
        {group.ratedPower === null ? <p data-testid="lamp-rated-power-empty">尚无额定工作点记录；请自行调至 Uₙ={group.ratedVoltage} V 后读表。</p> : <p data-testid="lamp-rated-power" data-power={group.ratedPower}>额定工作点测得功率={number(group.ratedPower)} W（{group.ratedCount} 次额定记录）；低压和过压记录未参与此平均。</p>}
        <p>按同一灯泡参数、组别和抄表来源分系列；保留非线性散点，不作恒定电阻直线拟合。</p>
        <svg viewBox="0 0 620 310" style={{ width: '100%', maxWidth: 850, minWidth: 260 }} role="img" aria-label={`${group.label} 灯泡 P–U 散点图`}>
          <path d="M65 35V260H565" fill="none" stroke="#647b7c" />
          {[0, 1, 2, 3, 4, 5].map(tick => <g key={tick}><text x={x(xmax * tick / 5)} y="280" textAnchor="middle" fontSize="12">{number(xmax * tick / 5)}</text><text x="56" y={y(ymax * tick / 5) + 4} textAnchor="end" fontSize="12">{number(ymax * tick / 5)}</text></g>)}
          <path d={`M${x(group.ratedVoltage)} 35V260`} stroke="#c46c29" strokeDasharray="5 4" /><text x={x(group.ratedVoltage)} y="28" textAnchor="middle" fontSize="12">Uₙ={group.ratedVoltage} V</text>
          <text x="580" y="302" textAnchor="end" fontSize="14">U / V</text><text x="22" y="25" fontSize="14">P / W</text>
          {group.rows.map(row => <circle key={row.id} cx={x(row.voltage!)} cy={y(row.power!)} r={row.point === 'rated' && !row.workPointWarning ? 6 : 4} fill={row.point === 'rated' && !row.workPointWarning ? '#c46c29' : '#126c63'}><title>{lampPowerPointLabels[row.point!]}：{number(row.voltage)} V，{number(row.power)} W</title></circle>)}
        </svg>
      </section>;
    })}
  </section>;
}
