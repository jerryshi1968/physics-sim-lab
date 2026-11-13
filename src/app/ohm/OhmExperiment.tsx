import { useState } from 'react';
import type { SceneDocument, OhmControl } from '../../core/scene/schema.ts';
import type { SimulationReply } from '../../core/simulation/protocol.ts';
import { ohmCircuit, ohmControl, ohmLabels, ohmQualification, ohmResistanceChoices } from '../../equipment/electrical/ohm.ts';
import { RESISTOR, SWITCH } from '../../equipment/electrical/definitions.ts';
import type { CaptureInput } from '../measurements/MeasurementPanel.tsx';

function ControlNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => boolean }) {
  const [draft, setDraft] = useState<{ raw: string; applied: number } | null>(null), active = draft?.applied === value ? draft : null;
  return <label>{label}<input type="number" step="0.01" aria-label={label} value={active?.raw ?? value} onChange={event => {
    const raw = event.currentTarget.value, number = event.currentTarget.valueAsNumber;
    setDraft({ raw, applied: raw.trim() && Number.isFinite(number) && onChange(number) ? number : value });
  }} onBlur={() => setDraft(null)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(null); } }} /></label>;
}
export function ElectricalRecordMode({ scene, onControl }: { scene: SceneDocument; onControl: (control: OhmControl | null) => boolean }) {
  return <section className="property-editor" aria-label="电学记录模式"><label>记录模式<select aria-label="记录模式" value={scene.ohmControl?.mode ?? 'normal'} onChange={event => {
    if (event.target.value === 'normal') { onControl(null); return; }
    const resistor = scene.equipment.find(item => item.type === RESISTOR);
    onControl({ ...ohmControl(scene), mode: event.target.value as OhmControl['mode'], ...(event.target.value === 'voltage' && resistor ? { fixedResistanceOhm: Number(resistor.parameters.resistanceOhm) } : {}) });
  }}><option value="normal">普通记录</option><option value="voltage">I–U 探究</option><option value="resistance">I–1/R 探究</option><option value="measurement">伏安法测电阻</option><option value="lamp-power">小灯泡电功率</option></select></label></section>;
}
export function OhmGuide({ scene, reply, onControl, onReplace, showModeSelector = true }: { showModeSelector?: boolean; scene: SceneDocument; reply: SimulationReply | null; onControl: (control: OhmControl) => boolean; onReplace: (id: string, value: number) => void }) {
  const control = ohmControl(scene), circuit = ohmCircuit(scene), resistor = scene.equipment.find(item => item.type === RESISTOR), closed = scene.equipment.some(item => item.type === SWITCH && item.parameters.closed);
  const meter = circuit.ok && reply?.documentId === scene.documentId && reply.documentRevision === scene.revision && reply.payload.result.ok ? reply.payload.meters.find(item => item.id === circuit.voltmeter.id && item.status === 'valid') : null;
  const qualification = !circuit.ok ? circuit.message : !meter || !reply?.payload.meters.some(item => item.id === circuit.ammeter.id && item.status === 'valid') ? '等待有效的两表示数，请检查量程与接线。' : ohmQualification(control, Number(circuit.resistor.parameters.resistanceOhm), meter.displayValue);
  return <section className="property-editor ohm-guide" aria-label="电流关系实验控制变量"><h3>电流与电压、电阻的关系</h3>
    {showModeSelector && <label>探究关系<select aria-label="探究关系" value={control.mode} onChange={event => onControl({ ...control, mode: event.target.value as OhmControl['mode'], ...(event.target.value === 'voltage' && resistor ? { fixedResistanceOhm: Number(resistor.parameters.resistanceOhm) } : {}) })}>{Object.entries(ohmLabels).filter(([value]) => value === 'voltage' || value === 'resistance').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    {control.mode === 'voltage' ? <><p>本组保持 R={control.fixedResistanceOhm} Ω。</p><button disabled={!resistor || Number(resistor.parameters.resistanceOhm) === control.fixedResistanceOhm} onClick={() => resistor && onControl({ ...control, fixedResistanceOhm: Number(resistor.parameters.resistanceOhm) })}>以当前电阻开始新系列</button></> : <><ControlNumber label="保持电压（V）" value={control.targetVoltageV} onChange={value => onControl({ ...control, targetVoltageV: value })} /><ControlNumber label="电压允许偏差（V）" value={control.voltageToleranceV} onChange={value => onControl({ ...control, voltageToleranceV: value })} /></>}
    <p data-testid="ohm-control-status">{qualification ?? '当前装置满足控制条件，可记录。'}</p>
    <fieldset className="ohm-replacements"><legend>替换定值电阻</legend>{ohmResistanceChoices.map(value => <button key={value} aria-label={`替换为 ${value} Ω`} aria-pressed={Number(resistor?.parameters.resistanceOhm) === value} disabled={!resistor || closed} onClick={() => resistor && onReplace(resistor.id, value)}>{value} Ω</button>)}</fieldset>
    <p>{closed ? '替换电阻前先断开开关。' : '替换保留现有电阻的位置和接线。'}</p>
    <details><summary>实验步骤与范围</summary><ol><li>使用现有电源、开关、定值电阻、电流表、电压表和四柱变阻器；电压表跨定值电阻，变阻器接一上一下两柱。</li><li>研究 I–U 时保持同一电阻，调节滑片取得不同电压。研究 I–1/R 时断开开关替换电阻，再闭合并调节滑片，使电压回到目标值。</li><li>自行读表或明确采集示数；至少五个不同工作点才拟合。未保持控制条件的记录保留，图线中标记并排除。</li></ol><p>电阻恒定，不模拟温升；电压表默认理想。改为有限内阻后电流表包含电压表分流，图线保留这一影响。允许偏差按表盘示数判断，可按量程精度设置；不会自动把电压调回目标。教材条目待教师核验。</p></details>
  </section>;
}
export function OhmRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: CaptureInput) => string | null }) {
  const [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [current, setCurrent] = useState(''), [voltage, setVoltage] = useState(''), [error, setError] = useState('');
  const circuit = ohmCircuit(scene), control = ohmControl(scene);
  const capture = (source: 'manual' | 'instrument') => {
    if (!circuit.ok) return;
    const message = onCapture({ source, setupLabel: group, note, choices: [{ equipmentId: circuit.ammeter.id, pointLabel: '电流I', rawInput: current }, { equipmentId: circuit.voltmeter.id, pointLabel: '电阻两端电压U', rawInput: voltage }] });
    setError(message ?? ''); if (!message && source === 'manual') { setCurrent(''); setVoltage(''); }
  };
  return <section className="measurement-panel" aria-label="电流关系成组记录"><h3>{ohmLabels[control.mode]} · 成组记录</h3>
    <div className="measurement-context-fields"><label>电流关系实验组别<input aria-label="电流关系实验组别" value={group} maxLength={100} onChange={event => setGroup(event.target.value)} /></label><label>电流关系实验备注<input value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label></div>
    <div className="measurement-context-fields"><label>电流 I（A）<input aria-label="电流 I（A）" inputMode="decimal" value={current} maxLength={1000} onChange={event => setCurrent(event.target.value)} placeholder="手工读表，留空记缺失" /></label><label>电阻两端电压 U（V）<input aria-label="电阻两端电压 U（V）" inputMode="decimal" value={voltage} maxLength={1000} onChange={event => setVoltage(event.target.value)} placeholder="手工读表，留空记缺失" /></label></div>
    <div className="measurement-actions"><button disabled={!ready || !circuit.ok} onClick={() => capture('manual')}>保存一组 I、U 抄表</button><button disabled={!ready || !circuit.ok} onClick={() => capture('instrument')}>采集一组 I、U 示数</button></div>
    <p>本次定值电阻的标称阻值、接线和控制条件随两表示数一起保存；不自动填写手工输入。完整记录、修订和原始 CSV 在下表。</p>{!circuit.ok && <p>{circuit.message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
