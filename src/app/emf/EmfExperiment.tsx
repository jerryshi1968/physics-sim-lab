import { useEffect, useRef, useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { emfStarts } from '../../experiments/emf.ts';
import type { EmfStart } from '../../experiments/emf.ts';
import { emfCircuit, emfLoading, emfWiringLabels } from '../../equipment/electrical/emf.ts';
import type { CaptureInput } from '../measurements/MeasurementPanel.tsx';

export function EmfStartDialog({ onChoose, onCancel }: { onChoose: (start: EmfStart) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [start, setStart] = useState<EmfStart>('inner');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="emf-start-title" onCancel={onCancel}><h2 id="emf-start-title">电源电动势与内阻实验</h2>
    <p>用多组 U、I 数据拟合电源特性，并比较电表加载。起点均断开开关，不预填学生读数。</p>
    {emfStarts.map(choice => <label key={choice.id} style={{ display: 'block', marginBlock: 8 }}><input type="radio" name="emf-start" checked={start === choice.id} onChange={() => setStart(choice.id)} />{choice.label}</label>)}
    <div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(start)}>预览电动势实验</button></div></dialog>;
}

export function EmfGuide({ scene }: { scene: SceneDocument }) {
  const circuit = emfCircuit(scene);
  return <section className="property-editor" aria-label="电动势实验指导"><h3>电源特性与电表加载</h3>
    <p data-testid="emf-wiring">{circuit.ok ? emfWiringLabels[circuit.wiring] : circuit.message}</p>
    <details><summary>接法、步骤与模型范围</summary><ol>
      <li>断开开关后接线：电源 → 开关 → 电流表正端 → 公共端 → 保护电阻与变阻器 → 电源负端。变阻器用一上一下两柱。</li>
      <li>电压表负端接电源负端。内接时正端接电源正端，读电源端电压；外接时正端接电流表公共端，读负载电压。换线前断开开关。</li>
      <li>起点 E=3 V、r=2 Ω、保护电阻 5 Ω，变阻器 30 Ω；从大阻值开始，闭合后调滑片，记录至少五个不同电流的 U、I。自行选合适量程。</li>
      <li>图线用记录值拟合 U=b+kI，E测=b、r测=−k。保持电源与电表参数不变；改变接法或这些参数会分组。手工估读与仪表示数分别拟合。</li>
    </ol><p>电源 E、r 恒定；导线和开关理想，不模拟电池耗竭、温升或接触电阻。有限内阻短路按 E/r 限流；r=0 的理想源短路报告错误。</p>
    <p>内接：电压表分流，U=E/(1+r/RV)−[r/(1+r/RV)]I，E测、r测偏小。外接：电流表分压，U=E−(r+RA)I，r测偏大。RA=0、RV→∞ 时均回到 U=E−rI。RV 是电压表内阻。</p><p>按实际接线识别以上两种结构，任意电路仍可求解，但不支持的结构不作本实验拟合。教材映射待教师核验。</p></details>
    {circuit.ok && <details><summary>查看模型参考值（非学生记录）</summary><p>E={String(circuit.source.parameters.voltageV)} V；r={String(circuit.source.parameters.internalResistanceOhm ?? 0)} Ω；RA={String(circuit.ammeter.parameters.resistanceOhm)} Ω；RV={circuit.voltmeter.parameters.finiteInput ? `${String(circuit.voltmeter.parameters.inputResistanceOhm)} Ω` : '∞'}</p><p>当前接法理论截距 {emfLoading(circuit).intercept.toPrecision(6)} V，负斜率绝对值 {emfLoading(circuit).resistance.toPrecision(6)} Ω。此处参数不参与学生数据拟合。</p></details>}
  </section>;
}

export function EmfRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (entry: CaptureInput) => string | null }) {
  const [group, setGroup] = useState('第1组'), [note, setNote] = useState(''), [i, setI] = useState(''), [u, setU] = useState(''), [error, setError] = useState('');
  const circuit = emfCircuit(scene);
  function capture(source: 'manual' | 'instrument') {
    if (!circuit.ok) return;
    const message = onCapture({ source, setupLabel: group, note, choices: [{ equipmentId: circuit.ammeter.id, pointLabel: '电流I', rawInput: i }, { equipmentId: circuit.voltmeter.id, pointLabel: '电压U', rawInput: u }] });
    setError(message ?? ''); if (!message && source === 'manual') { setI(''); setU(''); }
  }
  return <section className="measurement-panel" aria-label="电动势成组记录"><h3>电动势 U–I 成组记录</h3><p>{circuit.ok ? emfWiringLabels[circuit.wiring] : circuit.message}</p>
    <div className="measurement-context-fields"><label>电动势实验组别<input value={group} maxLength={100} onChange={event => setGroup(event.target.value)} /></label><label>电动势实验备注<input value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label></div>
    <div className="measurement-context-fields"><label>电流 I 抄表值（A）<input inputMode="decimal" value={i} maxLength={1000} onChange={event => setI(event.target.value)} placeholder="自行读数，留空记缺失" /></label><label>电压 U 抄表值（V）<input inputMode="decimal" value={u} maxLength={1000} onChange={event => setU(event.target.value)} placeholder="自行读数，留空记缺失" /></label></div>
    <div className="measurement-actions"><button disabled={!ready || !circuit.ok} onClick={() => capture('manual')}>保存一组 U–I 抄表</button><button disabled={!ready || !circuit.ok} onClick={() => capture('instrument')}>采集一组 U–I 示数</button></div><p>一组两表使用同一求解结果。仪表示数按分度值舍入；反接、超量程、缺失、删去一项的组不参与拟合。完整记录、修改与 CSV 导出见下表。</p>{error && <p role="alert">{error}</p>}
  </section>;
}
