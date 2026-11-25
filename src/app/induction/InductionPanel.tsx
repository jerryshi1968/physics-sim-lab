import { useState } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { InductionSimulation } from './useInduction.ts';
import { inductionParts } from '../../equipment/induction/model.ts';
import { GALVANOMETER } from '../../equipment/induction/definitions.ts';
import { deflections, inductionRows } from '../../equipment/induction/measure.ts';
import type { InductionInput } from '../../equipment/induction/measure.ts';

export function InductionPanel({ scene, simulation, onUpdate, onView }: { scene: SceneDocument; simulation: InductionSimulation; onUpdate: (item: EquipmentInstance) => void; onView: (meter: boolean) => void }) {
  const { wire, magnet } = inductionParts(scene), [target, setTarget] = useState<'wire' | 'magnet'>('wire'), [speed, setSpeed] = useState(.1);
  const meter = simulation.outcome?.meters.find(m => scene.equipment.find(i => i.id === m.id)?.type === GALVANOMETER);
  return <section className="config-section thermal-controls" data-testid="induction-panel"><h3>磁生电观察</h3>
    <p>磁场从 N 极指向 S 极。选择左右或上下往复，装置会在行程内自动折返。</p>
    <label>导体形式<select aria-label="导体形式" value={String(wire?.parameters.inductionShape ?? 'rod')} disabled={!wire} onChange={e => { if (wire) onUpdate({ ...wire, parameters: { ...wire.parameters, inductionShape: e.target.value, turns: wire.parameters.turns ?? 10 }, pose: { ...wire.pose, rotationRad: Math.PI / 2, flippedX: false } }); }}><option value="rod">单根导体 AB</option><option value="coil">矩形线圈</option></select></label>
    {wire?.parameters.inductionShape === 'coil' && <label>线圈匝数<select aria-label="线圈匝数" value={Number(wire.parameters.turns ?? 10)} onChange={e => onUpdate({ ...wire, parameters: { ...wire.parameters, turns: Number(e.target.value) } })}>{[1, 10, 20, 50].map(n => <option value={n} key={n}>{n} 匝</option>)}</select></label>}
    <label>磁场强弱<select aria-label="磁场强弱" disabled={!magnet} value={Number(magnet?.parameters.fieldT ?? .1)} onChange={e => { if (magnet) onUpdate({ ...magnet, parameters: { ...magnet.parameters, fieldT: Number(e.target.value) } }); }}><option value={.05}>弱</option><option value={.1}>中</option><option value={.2}>强</option></select></label>
    <button disabled={!magnet} onClick={() => { if (magnet) onUpdate({ ...magnet, parameters: { ...magnet.parameters, reversed: !magnet.parameters.reversed } }); }}>对调磁极</button>
    <label>移动对象<select aria-label="移动对象" value={target} onChange={e => { simulation.stop(); setTarget(e.target.value as 'wire' | 'magnet'); }}><option value="wire">导体 / 线圈</option><option value="magnet">磁体</option></select></label>
    <label>移动速度<select aria-label="移动速度" value={speed} onChange={e => { simulation.stop(); setSpeed(Number(e.target.value)); }}><option value={.05}>慢（5 cm/s）</option><option value={.1}>中（10 cm/s）</option><option value={.2}>快（20 cm/s）</option></select></label>
    <div className="measurement-actions"><button disabled={!wire || !magnet} onClick={() => simulation.start(target, speed, 0)}>左右往复</button><button disabled={!wire || !magnet} onClick={() => simulation.start(target, 0, speed)}>上下往复</button><button onClick={simulation.stop}>停止移动</button><button onClick={simulation.reset}>恢复起点</button></div>
    <p data-testid="induction-motion">{simulation.motion?.running ? '往复运动中' : simulation.motion?.drag ? '手动拖动' : '静止'} · {Number((simulation.motion?.timeS ?? 0).toFixed(2))} s</p>
    <div className="instrument-reading" data-testid="induction-reading" data-status={meter?.status ?? 'unavailable'}><h3>灵敏电流计</h3><strong>{meter?.displayValue !== null && meter?.displayValue !== undefined ? `${Number((meter.displayValue * 1000).toPrecision(4))} mA` : meter?.status === 'over-range' ? '超量程' : '未完整接线或装置无效'}</strong><p>中央为 0，左右均可偏转。</p></div>
    {simulation.outcome && !simulation.outcome.result.ok && <p role="alert">装置超出模型范围，请检查导体和磁体姿态、参数及接线。</p>}
    <div className="measurement-actions"><button onClick={() => onView(true)}>放大灵敏电流计</button><button onClick={() => onView(false)}>查看整个装置</button></div>
    <details><summary>实验操作</summary><p>合上或断开开关，比较静止与移动、不同方向、速度和磁极方向。换成线圈后，可观察线圈在磁场内、进入和离开磁场时的现象。连接导线视为位于磁场外。</p></details>
  </section>;
}
export function InductionTable({ scene }: { scene: SceneDocument }) {
  return <div className="measurement-table-scroll"><table aria-label="磁生电条件与现象表"><thead><tr>{['组别', '导体', '磁场/T', '磁极', '开关', '相对水平速度/(m/s)', '相对竖直速度/(m/s)', '观察', '抄表/mA', '备注'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{inductionRows(scene).map(r => <tr key={r.id}><td>{r.group}</td><td>{r.shape}</td><td>{r.field}</td><td>{r.reversed ? '反向' : '正向'}</td><td>{r.closed ? '闭合' : '断开'}</td><td>{Number(r.vx.toPrecision(4))}</td><td>{Number(r.vy.toPrecision(4))}</td><td>{r.observation}</td><td>{r.current === null ? '—' : Number((r.current * 1000).toPrecision(5))}</td><td>{r.note}</td></tr>)}</tbody></table></div>;
}
export function InductionRecords({ scene, onCapture }: { scene: SceneDocument; onCapture: (input: InductionInput) => string | null }) {
  const [input, setInput] = useState<InductionInput>({ group: '第1组', observation: '未判断', current: '', note: '' }), [error, setError] = useState('');
  return <section className="density-records"><h3>磁生电条件与现象记录</h3><form onSubmit={e => { e.preventDefault(); setError(onCapture(input) ?? ''); }}>
    <label>磁生电实验组别<input value={input.group} maxLength={100} onChange={e => setInput({ ...input, group: e.target.value })} /></label>
    <label>观察：指针偏转<select aria-label="观察：指针偏转" value={input.observation} onChange={e => setInput({ ...input, observation: e.target.value })}>{deflections.map(o => <option key={o}>{o}</option>)}</select></label>
    <label>灵敏电流计抄表（A，可留空）<input inputMode="decimal" value={input.current} onChange={e => setInput({ ...input, current: e.target.value })} maxLength={100} /></label>
    <label>磁生电观察备注<input value={input.note} maxLength={100} onChange={e => setInput({ ...input, note: e.target.value })} /></label><button>保存磁生电观察</button></form>{error && <p role="alert">{error}</p>}<p>按下保存时冻结实际位置、运动速度、磁场与接线；抄表留空保留缺失，观察和结论由学生填写。</p><InductionTable scene={scene} /></section>;
}
