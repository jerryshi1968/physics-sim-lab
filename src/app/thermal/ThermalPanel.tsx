import type { ThermalSimulation } from './useThermalSimulation.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { BEAKER } from '../../equipment/density/definitions.ts';
import { HEATER } from '../../equipment/thermal/definitions.ts';
import { useState } from 'react';

function NumberControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<{ raw: string; value: number } | null>(null);
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={draft?.value === value ? draft.raw : value} onChange={event => { const raw = event.currentTarget.value, n = event.currentTarget.valueAsNumber; if (raw !== '' && Number.isFinite(n) && n >= min && n <= max) { onChange(n); setDraft({ raw, value: n }); } else setDraft({ raw, value }); }} onBlur={() => setDraft(null)} /></label>;
}
export function ThermalPanel({ scene, simulation: s, onUpdate }: { scene: SceneDocument; simulation: ThermalSimulation; onUpdate: (item: EquipmentInstance, values: Record<string, number>) => void }) {
  const heater = scene.equipment.find(i => i.type === HEATER), beaker = scene.equipment.find(i => i.type === BEAKER);
  return <section className="thermal-controls config-section"><h3>水的加热与观察</h3><div className="projectile-controls"><button disabled={!s.rig.ok || !s.state.massKg || !s.rig.contact && !s.heating} onClick={s.heat}>{s.heating ? '停止加热' : '开始加热'}</button><button disabled={!s.running} onClick={s.pause}>暂停计时</button><button disabled={!s.rig.ok || s.running || !s.state.massKg} onClick={s.resume}>继续计时</button><button disabled={!s.rig.ok || !s.state.massKg} onClick={s.step}>单步热学</button><button onClick={s.reset}>重置热学</button></div>
    <p data-testid="thermal-status">时间 {s.clockText} s；{s.running ? '计时中' : '已暂停'}；{s.heating && s.rig.contact ? '正在加热' : '未加热'}</p>
    <p role="status">{s.rig.message || (!s.state.massKg ? '水已蒸干，已停止加热和计时。' : s.state.timeS >= 7200 ? '已达到本次 7200 s 观察上限，请重置。' : s.reading.ok ? '可读温度计，保存温度—时间记录。' : s.reading.message)}</p>
    <p data-testid="thermal-reading">温度计：{s.reading.ok ? `${Number((s.reading.valueK - 273.15).toFixed(4))} ℃` : '—'}</p>
    <label>热学播放速度<select aria-label="热学播放速度" value={s.rate} onChange={e => s.setRate(Number(e.target.value))}>{[1,5,20,60].map(v => <option key={v} value={v}>{v}×</option>)}</select></label>
    <NumberControl label="热学单步间隔（s）" value={s.stepS} min={1} max={300} onChange={s.setStepS} />
    {beaker && <NumberControl label="初始水量（mL）" value={Number((Number(beaker.parameters.liquidM3) * 1e6).toFixed(6))} min={5} max={250} onChange={v => onUpdate(beaker, { liquidM3: v / 1e6 })} />}
    {heater && <><NumberControl label="初始水温（℃）" value={Number((Number(heater.parameters.initialTemperatureK) - 273.15).toFixed(6))} min={0} max={100} onChange={v => onUpdate(heater, { initialTemperatureK: v + 273.15 })} /><NumberControl label="环境温度（℃）" value={Number((Number(heater.parameters.ambientTemperatureK) - 273.15).toFixed(6))} min={0} max={40} onChange={v => onUpdate(heater, { ambientTemperatureK: v + 273.15 })} /></>}
    <p className="editor-help">功率与散热修改即时生效；初始水量、水温或烧杯质量修改会重新计时。停止加热后可继续计时观察冷却。</p>
    <details><summary>实验步骤与模型范围</summary><p>烧杯放在网面上，温度计玻璃泡浸在水中，不碰杯壁、杯底；观察气泡，按固定间隔读温度计并保存。可先暂停再抄表。</p><p>标准大气压下纯水，沸点 100 ℃；水与烧杯温度均匀，水的比热容取 4200 J/(kg·K)，计入散热和汽化潜热；不模拟沸腾前蒸发、温度计响应滞后和气压变化。画面气泡是沸腾状态示意。</p></details>
  </section>;
}
