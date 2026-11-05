import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { FrictionSimulation } from './useFrictionSimulation.ts';
import { BLOCK, SURFACE, DRIVE, LOAD, materials } from '../../equipment/mechanical/frictionDefinitions.ts';
import { FORCE_METER } from '../../equipment/mechanical/definitions.ts';
import { frictionMessage } from '../../equipment/mechanical/frictionScene.ts';

const number = (value: number) => Number(value.toPrecision(6));
function SignedControl({ label, value, limit, onChange }: { label: string; value: number; limit: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<{ applied: number; text: string } | null>(null);
  const text = draft?.applied === value ? draft.text : String(value);
  const number = text.trim() === '' ? NaN : Number(text), valid = Number.isFinite(number) && Math.abs(number) <= limit;
  return <><input aria-label={label} aria-invalid={!valid} type="number" step="any" min={-limit} max={limit} value={text} onBlur={() => setDraft(null)} onChange={event => {
    const next = event.currentTarget.valueAsNumber, valid = Number.isFinite(next) && Math.abs(next) <= limit;
    setDraft({ applied: valid ? next : value, text: event.currentTarget.value });
    if (valid && next !== value) onChange(next);
  }} />{!valid && <span>未应用；请填写 −{limit}～{limit}，当前使用 {value}。</span>}</>;
}
function MaterialControl({ surface, onUpdate }: { surface: EquipmentInstance; onUpdate: (item: EquipmentInstance, parameters: Record<string, Scalar>) => void }) {
  return <label>材料对<select aria-label="摩擦材料对" value={String(surface.parameters.material)} onChange={event => {
    const material = materials[event.target.value as keyof typeof materials];
    onUpdate(surface, { ...surface.parameters, material: event.target.value, ...(material ? { staticCoefficient: material.mus, kineticCoefficient: material.muk } : {}) });
  }}>{Object.entries(materials).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}<option value="custom">自定义材料参数</option></select></label>;
}
export function FrictionPanel({ scene, simulation, onUpdate }: { scene: SceneDocument; simulation: FrictionSimulation; onUpdate: (item: EquipmentInstance, parameters: Record<string, Scalar>) => void }) {
  const [auxiliary, setAuxiliary] = useState(false), { sample, rig, state } = simulation;
  const status = !sample?.ok ? frictionMessage(sample?.code ?? 'FRICTION_BLOCK_COUNT') : state.timeS === 0 ? '初态：尚未开始牵引，请开始或单步后读数' : sample.forces.steady ? '滑动稳态：可比较摩擦力' : sample.forces.state === 'static' ? '静止：静摩擦按需匹配' : '非稳态：测力计示数不能当作滑动摩擦力';
  return <section className="friction-panel" aria-label="摩擦观察与控制"><h3>滑动摩擦观察</h3><p data-testid="friction-status">{status}</p><div className="friction-actions"><button onClick={simulation.running ? simulation.pause : simulation.start} disabled={!sample?.ok}>{simulation.running ? '暂停牵引' : '开始牵引'}</button><button onClick={simulation.step} disabled={!sample?.ok || simulation.running}>单步牵引</button><button onClick={simulation.reset} disabled={!rig?.ok}>重置牵引</button></div>
    <p>g={scene.simulationConfig.gravityMPerS2} N/kg；时间 <span data-testid="friction-time">{state.timeS.toFixed(2)}</span> s。拖动器材只改变实验初态，不代表施加拉力。</p>
    {rig?.ok && <><label>牵引方式<select aria-label="牵引方式" value={rig.config.mode} disabled={rig.drive.type !== DRIVE} onChange={event => onUpdate(rig.drive, { ...rig.drive.parameters, mode: event.target.value })}><option value="speed">匀速牵引（含启动过程）</option><option value="force">可控水平拉力</option></select></label>
      <label>{rig.config.mode === 'speed' ? '目标速度（m/s，右正左负）' : '牵引力（N，右正左负）'}<SignedControl key={rig.config.mode} label={rig.config.mode === 'speed' ? '牵引目标速度' : '牵引控制拉力'} value={rig.config.mode === 'speed' ? rig.config.targetMPerS : rig.config.pullN} limit={rig.config.mode === 'speed' ? 1 : rig.drive.type === DRIVE ? 1000 : 100} onChange={value => onUpdate(rig.drive, rig.drive.type === DRIVE ? { ...rig.drive.parameters, [rig.config.mode === 'speed' ? 'targetMPerS' : 'pullN']: value } : { ...rig.drive.parameters, forceN: Math.abs(value), directionDeg: value < 0 ? 180 : 0 })} /></label>
      {rig.drive.type !== DRIVE && <p>未安装匀速牵引器，当前直接控制水平拉力；在装配区接入牵引器后可使用匀速模式。</p>}
      <MaterialControl surface={rig.surface} onUpdate={onUpdate} />
      <p>总质量 {number(rig.config.massKg)} kg；接触面积 {Number(rig.block.parameters.areaM2)} m²。改变面积不自动改变质量/材料。</p>
    </>}
    {!rig?.ok && scene.equipment.find(item => item.type === SURFACE) && <MaterialControl surface={scene.equipment.find(item => item.type === SURFACE)!} onUpdate={onUpdate} />}
    {sample?.ok && <><p data-testid="friction-reading">测力计：{state.timeS === 0 ? '尚未开始，暂不读数' : sample.reading.displayN === null ? sample.reading.status === 'over-range' ? '超量程，不可正常读数' : '当前不可读' : `${sample.reading.displayN} N`}；量程 {sample.rig.meter.parameters.rangeN} N</p><p data-testid="friction-velocity">速度 {number(state.velocityMPerS)} m/s；{sample.forces.steady ? '滑动稳态' : '非稳态/静止'}；稳态窗口 {number(state.steadyS)} s / 0.3 s。</p></>}
    <label><input type="checkbox" checked={auxiliary} onChange={event => setAuxiliary(event.target.checked)} />显示受力理论（可关闭）</label>
    {auxiliary && sample?.ok && <div data-testid="friction-theory"><p>N={number(sample.forces.normalN)} N；摩擦力 {number(sample.forces.frictionN)} N；实际牵引力 {number(sample.forces.pullN)} N；加速度 {number(sample.forces.accelerationMPerS2)} m/s²。</p><p>μs={sample.rig.config.staticCoefficient}，μk={sample.rig.config.kineticCoefficient}；Fpull+Ff=ma。Matter.js 仅同步形状和接触，自研模型独占一维运动。</p></div>}
    <details><summary>实验步骤与模型范围</summary><ol><li>把木块放到水平接触面，在装配区指定牵引器和水平测力计；砝码可放到木块上。</li><li>使用匀速牵引，等连续 0.3 s 滑动稳态后读表。静止与加速时示数不是滑动摩擦力，可保留非稳态记录。</li><li>保持材料/面积不变比较总质量 0.5、1 kg；保持质量比较木板与布面；再保持质量/材料改变接触面积。</li></ol><p>限一只木块和水平干摩擦，忽略测力计质量；不模拟斜拉、碰撞或变形。达到接触面边缘/300 s 时停止。更改器材、质量或材料重置运动；牵引力/目标速度可在运行中调整。保存初态和记录，不保存运行时刻；教材待核验。</p></details>
  </section>;
}
export function FrictionAssembly({ scene, instance, onUpdate, onPlace }: { scene: SceneDocument; instance: EquipmentInstance; onUpdate: (item: EquipmentInstance, parameters: Record<string, Scalar>) => void; onPlace: (item: EquipmentInstance) => void }) {
  if (![BLOCK, LOAD].includes(instance.type)) return null;
  function choices(type: string) { return scene.equipment.filter(item => item.type === type).map(item => <option key={item.id} value={item.id}>{type === SURFACE ? '接触面' : type === DRIVE ? '牵引器' : type === FORCE_METER ? '弹簧测力计' : '木块'} {scene.equipment.indexOf(item) + 1}</option>); }
  return <section className="friction-panel" aria-label="摩擦器材装配"><h3>摩擦器材装配</h3>{instance.type === BLOCK ? <>
    <label>接触面<select aria-label="木块接触面" value={String(instance.parameters.surfaceId ?? '')} onChange={event => onUpdate(instance, { ...instance.parameters, surfaceId: event.target.value })}><option value="">未放置</option>{choices(SURFACE)}</select></label>
    <label>牵引器<select aria-label="木块牵引器" value={String(instance.parameters.driverId ?? '')} onChange={event => onUpdate(instance, { ...instance.parameters, driverId: event.target.value })}><option value="">不安装（直接控制拉力）</option>{choices(DRIVE)}</select></label>
    <label>测力计<select aria-label="木块测力计" value={String(instance.parameters.meterId ?? '')} onChange={event => onUpdate(instance, { ...instance.parameters, meterId: event.target.value })}><option value="">未连接</option>{choices(FORCE_METER)}</select></label>
    <button onClick={() => onPlace(instance)}>放到接触面上</button>
  </> : <><label>承载木块<select aria-label="砝码承载木块" value={String(instance.parameters.blockId ?? '')} onChange={event => onUpdate(instance, { ...instance.parameters, blockId: event.target.value })}><option value="">不加载</option>{choices(BLOCK)}</select></label></>}</section>;
}
