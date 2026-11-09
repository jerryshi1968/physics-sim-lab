import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Scalar } from '../../core/equipment/schema.ts';
import { convertUnit } from '../../core/units/units.ts';
import { densityMessage, densityMethod } from '../../equipment/density/simulate.ts';
import type { DensityOutcome } from '../../equipment/density/simulate.ts';
import { BALANCE, CYLINDER, SPECIMEN, BEAKER, MASS_SET, solidSamples, specimenMassLimitsKg } from '../../equipment/density/definitions.ts';
import { DensityGraphic } from './DensityGraphic.tsx';
import { DensityRange } from './DensityRange.tsx';

const specimenMassMinG = convertUnit(specimenMassLimitsKg.min, 'kg', 'g');
const specimenMassMaxG = convertUnit(specimenMassLimitsKg.max, 'kg', 'g');

export interface DensityPreview { id: string; key: string; value: number }
export function DensityPanel({ scene, outcome, preview, onMethodChange, onUpdate, onPreview, onPour, onClear }: { scene: SceneDocument; outcome: DensityOutcome; preview: boolean; onMethodChange: (method: ReturnType<typeof densityMethod>) => void; onUpdate: (id: string, values: Record<string, Scalar>) => void; onPreview: (value: DensityPreview | null) => void; onPour: (amountM3: number) => void; onClear: () => void }) {
  const [amount, setAmount] = useState('30'), [auxiliary, setAuxiliary] = useState(false);
  const [massDraft, setMassDraft] = useState<{ specimenId: string; appliedKg: number; text: string; invalid: boolean } | null>(null);
  const get = (type: string) => scene.equipment.find(item => item.type === type), balance = get(BALANCE), cylinder = get(CYLINDER), specimen = get(SPECIMEN), masses = get(MASS_SET), beaker = get(BEAKER), good = outcome.ok ? outcome : null;
  const activeMassDraft = massDraft && massDraft.specimenId === specimen?.id && massDraft.appliedKg === specimen.parameters.massKg ? massDraft : null;
  const range = (id: string, key: string, label: string, value: number, min: number, max: number, factor: number, disabled = false) => <DensityRange key={key} label={label} value={Math.round(value / factor)} min={min} max={max} step={1} disabled={disabled} onPreview={value => onPreview(value === null ? null : { id, key, value: value * factor })} onChange={value => onUpdate(id, { [key]: Number((value * factor).toPrecision(12)) })}/>;
  const canAttach = (id: string) => !scene.equipment.some(item => item.id !== id && [SPECIMEN, BEAKER].includes(item.type) && item.parameters.targetId === balance?.id);
  const weighing = outcome.weighing;
  const volume = outcome.volume.ok ? outcome.volume : null;
  const message = !weighing.ok ? densityMessage(weighing.code) : weighing.overRange ? '天平超量程，先减小载荷。'
    : weighing.balanced ? '天平指针对准中央。' : `天平未平衡，${weighing.residualKg > 0 ? '左盘较重，下沉' : '右盘较重，下沉'}。`;
  return <section className="density-panel"><h3>称量与液面观察</h3>
    <label>密度记录方法<select aria-label="密度记录方法" value={densityMethod(scene)} disabled={preview} onChange={event => onMethodChange(event.target.value === 'liquid' ? 'liquid' : 'solid')}>
      <option value="solid">固体密度（称量与排水）</option><option value="liquid">液体密度（倒出前后质量差）</option>
    </select></label>
    <p data-testid="density-status">{message}</p>
    {weighing.ok && !outcome.ok && <p>{densityMessage(outcome.code)}</p>}
    {balance && <><p>天平量程 200 g，游码每格 0.2 g；调零不需要额外确认。</p>
      {weighing.ok && !weighing.canZero && <p>先清空两盘并将游码归零，才能调节螺母。</p>}
      {weighing.ok && !weighing.calibrated && <p>天平尚未调零。请在空载且游码归零时，用螺母将指针对准中央。</p>}
      <p>在实验台拖动调零螺母和游码。游码以左边缘对准的刻线为准。</p>
      <button onClick={onClear}>清空天平并游码归零</button>
    </>}
    {masses && balance && <><label>砝码盒关联天平<select aria-label="砝码盒关联天平" value={String(masses.parameters.balanceId)} onChange={event => onUpdate(masses.id, { balanceId: event.target.value })}><option value="">不关联</option><option value={balance.id}>当前天平右盘</option></select></label><p>点击实验台盒内的砝码放上右盘，点击对应空格取回。砝码盒可拖到右盘关联。</p></>}
    {balance && [specimen, beaker].map(item => item && <label key={item.id}>{item.type === SPECIMEN ? '待测固体位置' : '烧杯位置'}<select aria-label={item.type === SPECIMEN ? '待测固体位置' : '烧杯位置'} value={String(item.parameters.targetId)} onChange={event => onUpdate(item.id, { targetId: event.target.value, ...(item.type === SPECIMEN ? { liftM: 0 } : {}) })}><option value="">桌面自由放置</option><option value={balance.id} disabled={!canAttach(item.id)}>天平左盘</option>{item.type === SPECIMEN && cylinder && <option value={cylinder.id}>量筒内</option>}</select></label>)}
    {specimen && <>
      <label>更换待测固体
        <select aria-label="更换待测固体" aria-describedby="density-specimen-help" value={String(specimen.parameters.sampleCode)} disabled={!!specimen.parameters.targetId} onChange={event => {
          const sample = solidSamples[Number(event.target.selectedOptions[0]?.dataset.index)];
          if (sample) onUpdate(specimen.id, { massKg: sample.massKg, volumeM3: sample.volumeM3, sampleCode: event.target.value });
        }}>
          {solidSamples.map((sample, i) => <option key={i} data-index={i} value={String.fromCharCode(65 + i)}>{sample.label}</option>)}
        </select>
      </label>
      <p id="density-specimen-help">{specimen.parameters.targetId ? '将「待测固体位置」设为「桌面自由放置」，即可更换样品。' : '选择 A、B 或 C，换用不同质量和体积的样品。'}</p>
      <details>
        <summary>设置固体质量</summary>
        <label>固体质量（g）
          <input type="number" inputMode="decimal" required step="any" min={specimenMassMinG} max={specimenMassMaxG}
            value={activeMassDraft?.text ?? Number(convertUnit(Number(specimen.parameters.massKg), 'kg', 'g').toPrecision(15))}
            aria-describedby="density-mass-help" aria-invalid={activeMassDraft?.invalid ?? false} disabled={preview}
            onChange={event => {
              const input = event.currentTarget;
              const currentKg = Number(specimen.parameters.massKg);
              const invalid = !input.validity.valid;
              const massKg = invalid ? currentKg : Number(convertUnit(input.valueAsNumber, 'g', 'kg').toPrecision(15));
              setMassDraft({ specimenId: specimen.id, appliedKg: massKg, text: input.value, invalid });
              if (massKg !== currentKg) onUpdate(specimen.id, { massKg });
            }}
            onBlur={() => setMassDraft(null)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setMassDraft(null);
              }
            }}
          />
        </label>
        <p id="density-mass-help">{activeMassDraft?.invalid ? `请输入 ${specimenMassMinG}～${specimenMassMaxG} g。` : `范围 ${specimenMassMinG}～${specimenMassMaxG} g，支持小数。可用 54.6 g 练习用游码配平。`}</p>
      </details>
      {specimen.parameters.targetId === cylinder?.id && range(specimen.id, 'liftM', '提起固体（mm）', Number(specimen.parameters.liftM), 0, 200, .001)}
    </>}
    {cylinder && <><label>读液面视线<select aria-label="读液面视线" value={Number(cylinder.parameters.eyeLevel)} onChange={event => onUpdate(cylinder.id, { eyeLevel: Number(event.target.value) })}><option value={0}>平视凹液面最低处</option><option value={1}>俯视</option><option value={-1}>仰视</option></select></label><p data-testid="density-volume-status">{!outcome.volume.ok ? densityMessage(outcome.volume.code) : outcome.volume.liquid.overflow ? '量筒已溢出，不能用当前液面求体积。' : !outcome.volume.readableVolume ? '视线未与凹液面最低处水平，请调整。' : outcome.volume.inCylinder && !outcome.volume.liquid.fullyImmersed ? '固体尚未完全浸没；排水量小于固体总体积。' : '量筒 100 mL，每格 1 mL；平视凹液面最低处读数。'}</p>
      <svg viewBox="0 0 240 280" role="img" aria-label="量筒液面与刻度放大图"><g transform="translate(95 263) scale(1000)"><DensityGraphic instance={cylinder} outcome={outcome}/></g>{volume && <path d={`M8 ${238 - Math.min(1, volume.liquid.readingM3 / .0001) * 200 - Number(cylinder.parameters.eyeLevel) * 22}L65 ${238 - Math.min(1, volume.liquid.readingM3 / .0001) * 200}`} stroke="#c58246" strokeDasharray="4 3" fill="none"/>}</svg>
      <div className="density-actions"><button disabled={!!specimen && specimen.parameters.targetId === cylinder.id} onClick={() => onUpdate(cylinder.id, { liquidM3: 0 })}>清空量筒</button><button disabled={!!specimen && specimen.parameters.targetId === cylinder.id} onClick={() => onUpdate(cylinder.id, { liquidM3: .00005, liquidDensityKgPerM3: 1000 })}>量筒加入50 mL水</button></div></>}
    {beaker && <><label>本次倒入量筒（mL）<input aria-label="本次倒入量筒（mL）" type="number" min="1" max="100" value={amount} onChange={event => setAmount(event.target.value)}/></label><button disabled={!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || preview} onClick={() => onPour(Number(amount) * .000001)}>从烧杯倒入量筒</button><div className="density-actions"><button onClick={() => onUpdate(beaker.id, { liquidM3: .00008 })}>烧杯补充至80 mL</button><label>待测液体<select aria-label="待测液体" disabled={Number(beaker.parameters.liquidM3) !== 0 || Number(cylinder?.parameters.liquidM3) !== 0} value={String(beaker.parameters.liquidCode)} onChange={event => onUpdate(beaker.id, { liquidCode: event.target.value, liquidDensityKgPerM3: event.target.value === 'B' ? 800 : 1000 })}><option value="A">液体 A</option><option value="B">液体 B</option></select></label><button onClick={() => onUpdate(beaker.id, { liquidM3: 0 })}>清空烧杯</button></div><p>换液体前先清空烧杯和量筒；倒液操作同时减少烧杯液量并增加量筒液量。模型忽略挂壁损失与蒸发。</p></>}
    <label className="checkbox-field"><input type="checkbox" checked={auxiliary} onChange={event => setAuxiliary(event.target.checked)}/>显示密度模型值（可关闭）</label>{auxiliary && good && <p data-testid="density-theory">模型参考。{good.specimen && <>固体质量 {Number(good.specimen.parameters.massKg) * 1000} g，体积 {Number(good.specimen.parameters.volumeM3) * 1e6} mL。</>}{good.beaker && <>液体密度 {Number(good.beaker.parameters.liquidDensityKgPerM3) / 1000} g/cm³。</>}当前量筒 {Number((good.liquid.readingM3 * 1e6).toFixed(3))} mL，左盘 {Number((good.leftKg * 1000).toFixed(3))} g。</p>}
    <details><summary>密度实验步骤与范围</summary><ol><li>游码归零、两盘空载调零；固体称重，或先称烧杯和液体总质量。</li><li>固体：记录原有水面，再完全浸没固体记录水面；液体：空量筒接倒出的液体，称剩余液体与烧杯总质量，再读量筒。</li><li>每步保存自己的读数，选三条来源计算密度，至少做多组比较；估读误差保留，不填模型答案。</li></ol><p>静态等臂天平；量筒为等截面容器，固体限定下沉、不溶解、不吸水。未调零/未平衡、超量程、俯仰视、溢出、未浸没及跨样品拼接均不作为正常读数。教材条目待教师核验。</p></details>
  </section>;
}
