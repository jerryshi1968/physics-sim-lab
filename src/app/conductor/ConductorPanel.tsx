import { useState } from 'react';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { conductorSample, conductorClosed, heaterAligned, conductorRows, conductorContrast } from '../../equipment/conductor/experiment.ts';
import type { conductorChange } from '../../equipment/conductor/experiment.ts';
import { metalSamples, metalSampleId, MetalWireSchema, metalMaterials, metalResistance } from '../../equipment/electrical/conductor.ts';
import { AMMETER } from '../../equipment/electrical/definitions.ts';
import { meterConnection } from '../../core/electrical/instruments.ts';

function NumberSetting({ label, value, min, max, step, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled: boolean; onChange: (value: number) => boolean }) {
  const [draft, setDraft] = useState<{ value: number; raw: string } | null>(null);
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step={step} disabled={disabled} value={draft?.value === value ? draft.raw : Number(value.toFixed(5))} onChange={e => {
    const raw = e.currentTarget.value, n = e.currentTarget.valueAsNumber;
    setDraft({ raw, value: Number.isFinite(n) && n >= min && n <= max && onChange(n) ? n : value });
  }} onBlur={() => setDraft(null)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); } }} /></label>;
}
export function MetalWireSettings({ instance, disabled, onChange }: { instance: EquipmentInstance; disabled: boolean; onChange: (p: Partial<ReturnType<typeof MetalWireSchema.parse>>) => boolean }) {
  const p = MetalWireSchema.parse(instance.parameters);
  return <section className="thermal-controls"><label>金属丝样品<select aria-label="金属丝样品" disabled={disabled} value={metalSampleId(instance)} onChange={e => { const sample = metalSamples.find(s => s.id === e.target.value); if (sample) onChange({ material: sample.material, lengthM: sample.lengthM, areaM2: sample.areaM2 }); }}><option value="自定" disabled>自定样品</option>{metalSamples.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    <label>金属丝材料<select aria-label="金属丝材料" disabled={disabled} value={p.material} onChange={e => onChange({ material: e.target.value as typeof p.material })}>{Object.entries(metalMaterials).map(([id, m]) => <option value={id} key={id}>{m.label}</option>)}</select></label>
    <NumberSetting label="金属丝长度（cm）" value={p.lengthM * 100} min={20} max={200} step={5} disabled={disabled} onChange={n => onChange({ lengthM: n / 100 })} />
    <NumberSetting label="金属丝横截面积（mm²）" value={p.areaM2 * 1e6} min={.05} max={.4} step={.01} disabled={disabled} onChange={n => onChange({ areaM2: Number((n / 1e6).toPrecision(12)) })} />
    <NumberSetting label="金属丝温度（℃）" value={p.temperatureK - 273.15} min={20} max={80} step={1} disabled={disabled} onChange={n => onChange({ temperatureK: n + 273.15 })} />
  </section>;
}
export function ConductorPanel({ scene, onChange }: { scene: SceneDocument; onChange: (change: Parameters<typeof conductorChange>[1]) => boolean }) {
  const wire = conductorSample(scene), p = MetalWireSchema.safeParse(wire?.parameters), closed = conductorClosed(scene), meter = scene.equipment.find(i => i.type === AMMETER);
  if (!p.success || !wire) return <section className="config-section"><h3>导体电阻探究</h3><p>请从器材库添加一件金属丝器材。</p></section>;
  const common = { disabled: closed, onChange: (n: number) => onChange({ parameters: { temperatureK: n + 273.15 } }) };
  return <section className="config-section thermal-controls" data-testid="conductor-panel"><h3>导体电阻探究</h3>
    <label>金属丝样品<select aria-label="金属丝样品" disabled={closed} value={metalSampleId(wire)} onChange={e => onChange({ sample: e.target.value })}><option value="自定" disabled>自定样品</option>{metalSamples.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    <label>金属丝材料<select aria-label="金属丝材料" disabled={closed} value={p.data.material} onChange={e => onChange({ parameters: { material: e.target.value as typeof p.data.material } })}>{Object.entries(metalMaterials).map(([id, m]) => <option value={id} key={id}>{m.label}</option>)}</select></label>
    <NumberSetting label="金属丝长度（cm）" value={p.data.lengthM * 100} min={20} max={200} step={5} disabled={closed} onChange={n => onChange({ parameters: { lengthM: n / 100 } })} />
    <NumberSetting label="金属丝横截面积（mm²）" value={p.data.areaM2 * 1e6} min={.05} max={.4} step={.01} disabled={closed} onChange={n => onChange({ parameters: { areaM2: Number((n / 1e6).toPrecision(12)) } })} />
    <NumberSetting label="金属丝温度（℃）" value={p.data.temperatureK - 273.15} min={20} max={80} step={1} {...common} />
    <label>电流表量程<select aria-label="电流表量程" disabled={closed || !meter} value={meter ? meterConnection(scene, meter.id).range ?? '' : ''} onChange={e => onChange({ range: e.target.value as 'low' | 'high' })}><option value="" disabled>未接量程或接法有误</option><option value="low">0～0.6 A</option><option value="high">0～3 A</option></select></label>
    <div className="measurement-actions"><button disabled={closed || !heaterAligned(scene)} onClick={() => onChange({ thermal: 'heat' })}>加热 5 s</button><button disabled={closed || !heaterAligned(scene)} onClick={() => onChange({ thermal: 'cool' })}>冷却 30 s</button><button disabled={closed} onClick={() => onChange({ thermal: 'reset' })}>恢复 20 ℃</button></div>
    <p>{closed ? '先断开开关，再替换或加热金属丝。' : !heaterAligned(scene) ? '将加热装置放在金属丝下方，再分步加热。' : '温度设置在读表期间保持恒定；分步加热时使用下方加热装置。'}</p>
    <details><summary>温度对比提示</summary><p>部分合金在本温区的变化可能小于电流表分度。温度对比可使用铁丝，并选择合适量程。</p></details>
    <details><summary>显示电阻模型值</summary><p>{Number(metalResistance(p.data).toPrecision(5))} Ω</p></details>
  </section>;
}
export function ConductorResults({ scene }: { scene: SceneDocument }) {
  const rows = conductorRows(scene);
  return <section className="spring-fits"><h3>导体电阻因素比较</h3><p>比较时保持电源和其他条件相同。表中保留实际采样时的样品，电流由学生抄表或主动采集。</p><div className="measurement-table-scroll"><table aria-label="导体电阻因素比较表"><thead><tr>{['组别', '材料', '长度 / cm', '横截面积 / mm²', '温度 / ℃', '电源 / V', '电流 / A', '与上条同组记录比较'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, index) => <tr key={r.id}><td>{r.group}</td><td>{r.material}</td><td>{Number((r.p.lengthM * 100).toFixed(2))}</td><td>{Number((r.p.areaM2 * 1e6).toFixed(3))}</td><td>{Number((r.p.temperatureK - 273.15).toFixed(2))}</td><td>{String(r.voltage ?? '—')}</td><td>{r.value ?? '—'}</td><td>{conductorContrast(rows.slice(0, index).reverse().find(previous => previous.group === r.group), r)}</td></tr>)}</tbody></table></div></section>;
}
