import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { LeverOutcome } from '../../equipment/mechanical/simulate.ts';
import { leverMessage } from '../../equipment/mechanical/simulate.ts';
import { LEVER, SUPPORT, WEIGHT, FORCE_METER, mechanicalLabel } from '../../equipment/mechanical/definitions.ts';
import { BalanceNutControls } from './BalanceNutControls.tsx';
import type { NutPreview } from './BalanceNutControls.tsx';

import { occupiedWeightHook, validWeightTargets, weightAttachment, weightMount } from '../../equipment/mechanical/weightChain.ts';

const number = (value: number) => Number(value.toPrecision(6));
export function LeverPanel({ scene, outcome, auxiliary, onAuxiliary, onZero, preview, movingEquipment, onNutPreview, onNutChange }: { scene: SceneDocument; outcome: LeverOutcome; auxiliary: boolean; onAuxiliary: (value: boolean) => void; onZero: () => void; preview: boolean; movingEquipment: boolean; onNutPreview: (value: NutPreview | null) => void; onNutChange: (value: NutPreview) => void }) {
  const status = !outcome.ok ? leverMessage(outcome.code) : !outcome.calibrated ? '尚未确认空载调平：先取下挂载，调至水平平衡，再确认。' : outcome.balanced ? '当前力矩平衡' : outcome.totalTorqueNm > 0 ? '不平衡：有逆时针转动趋势（状态示意）' : '不平衡：有顺时针转动趋势（状态示意）';
  return <section className="lever-panel" aria-label="杠杆观察与诊断"><h3>{preview ? '移动预览' : '杠杆平衡观察'}</h3><p data-testid="lever-status">{status}</p>
    {outcome.ok && <><p>g={scene.simulationConfig.gravityMPerS2} N/kg；测量时{outcome.lever.parameters.includeSelfWeight ? '计入杆与两端螺母自重' : '忽略已调平杆与螺母自重'}。{outcome.horizontal ? !outcome.empty && !outcome.balanced ? '计算原位置为水平，当前画布显示下沉趋势' : '杆已水平' : outcome.lever.pose.rotationRad > 0 ? '计算原位置左端较低' : '计算原位置右端较低'}；{outcome.ignoredLoads} 件钩码/测力计尚未挂接。</p>
      <BalanceNutControls key={scene.documentId} id={outcome.lever.id} leftM={Number(outcome.lever.parameters.leftNutOffsetM ?? .02)} rightM={Number(outcome.lever.parameters.rightNutOffsetM ?? .02)} enabled={outcome.empty && !movingEquipment} onPreview={onNutPreview} onChange={onNutChange} />
      <button disabled={!outcome.canZero || preview} onClick={onZero}>确认空载调平</button>
      {!outcome.empty && <p>重新调平前请先解除钩码和测力计挂接。</p>}
      {!outcome.empty && !outcome.balanced && <p>画布已用倾斜示意{outcome.totalTorqueNm > 0 ? '左端下沉' : '右端下沉'}；虚线及受力辅助对应计算初态，不把示意角度作为测量值。</p>}
      {outcome.meters.map(meter => <p key={meter.id} data-force-reading={meter.id} data-meter-status={meter.status}>测力计：{meter.zeroArm ? '零力臂，作用线通过支点' : meter.displayN === null ? meter.status === 'over-range' ? '超量程，不能读数' : '未调平或当前不可读' : `${meter.displayN} N`}</p>)}
    </>}
    <label><input type="checkbox" checked={auxiliary} onChange={event => onAuxiliary(event.target.checked)} />显示力、作用线与理论（可关闭）</label>
    {auxiliary && outcome.ok && <div data-testid="lever-theory"><p>τ=rxFy−ryFx；d=|τ|/|F|。逆时针为正，斜拉力臂不是沿杆距离。</p><p>逆时针 {number(outcome.counterclockwiseNm)} N·m；顺时针 {number(outcome.clockwiseNm)} N·m；合力矩 {number(outcome.totalTorqueNm)} N·m。支点反力 ({number(outcome.reactionN.x)}, {number(outcome.reactionN.y)}) N。</p>
      {outcome.loads.filter(load => load.forceN > 0).map(load => <p key={load.id}>{mechanicalLabel(scene, load.id)}：F={number(load.forceN)} N，d={number(load.armM)} m，τ={number(load.torqueNm)} N·m</p>)}
      <p>唯一平衡目标（仅供核对，不施加拉力）：{outcome.target.status === 'ok' ? `${number(outcome.target.value.forceN)} N，力臂 ${number(outcome.target.value.armM)} m` : leverMessage(outcome.target.code)}</p>
    </div>}
    <details><summary>实验步骤与范围</summary><ol><li>将杠杆安装到支架，无挂载时调整两端平衡螺母。左端下沉时将螺母向右调整，右端下沉时向左调整，观察至水平，再确认空载调平。无需输入杆转角。</li><li>拖动钩码到挂点（编号间隔等距），或选器材后在挂接区指定杠杆与编号，改变质量/挂点，至少记录三组。</li><li>用测力计替换一侧钩码，分别设置向下竖拉 −90°、向右下斜拉 −30°，自行调力并抄表、读尺。作用线与理论默认关闭。</li></ol><p>空载按重心显示静态倾斜；加载失衡时显示转动趋势示意，虚线保留计算初态，不模拟摆动时间，不自动改力/挂点，也不把示意角写入保存或测量。多个未知拉力不提供唯一目标解；仅支持一根杆，教材待教师核验。</p></details>
  </section>;
}
export function LeverAttachment({ scene, instance, onAttach }: { scene: SceneDocument; instance: EquipmentInstance; onAttach: (parameters: Record<string, Scalar>) => void }) {
  const lever = instance.type === LEVER, [target, setTarget] = useState(String(instance.parameters[lever ? 'supportId' : 'leverId'] ?? '')), [index, setIndex] = useState(Number(instance.parameters.hookIndex ?? 0));
  const [parent, setParent] = useState(String(instance.parameters.parentWeightId ?? ''));
  if (![LEVER, WEIGHT, FORCE_METER].includes(instance.type)) return null;
  function attach(nextTarget: string, nextIndex: number, nextParent: string) {
    const parameters = instance.type === WEIGHT ? weightAttachment(scene, instance, nextTarget, nextIndex, nextParent) : { ...instance.parameters, [lever ? 'supportId' : 'leverId']: nextTarget, ...(!lever ? { hookIndex: nextIndex } : {}) };
    if (parameters) onAttach(parameters);
  }
  const mount = instance.type === WEIGHT ? weightMount(scene.equipment, instance) : null;
  const candidates = scene.equipment.filter(item => item.type === (lever ? SUPPORT : LEVER)), selected = candidates.find(item => item.id === target);
  return <section className="lever-attachment" aria-label="器材挂接"><h3>器材挂接</h3><label>{lever ? '安装支架' : '挂接杠杆'}<select aria-label={lever ? '安装支架' : '挂接杠杆'} value={target} onChange={event => { setTarget(event.target.value); setParent(''); attach(event.target.value, index, ''); }}><option value="">不挂接</option>{candidates.map(item => <option key={item.id} value={item.id}>{mechanicalLabel(scene, item.id)}</option>)}</select></label>
    {instance.type === WEIGHT && <><label>串接到钩码<select aria-label="串接到钩码" value={parent} onChange={event => { setParent(event.target.value); setTarget(''); attach('', index, event.target.value); }}><option value="">不串接（使用杠杆挂点）</option>{validWeightTargets(scene, instance).map(item => <option key={item.id} value={item.id}>{mechanicalLabel(scene, item.id)} 下挂钩</option>)}</select></label>{instance.parameters.parentWeightId && <p>已串接在{mechanicalLabel(scene, String(instance.parameters.parentWeightId))}下方；{mount ? `整串作用于${mechanicalLabel(scene, mount.leverId)}的 ${mount.hookIndex} 号挂点` : '整串尚未挂到杠杆'}。</p>}</>}
    {!lever && <label>挂点编号<select aria-label="挂点编号" value={index} onChange={event => { setIndex(Number(event.target.value)); attach(target, Number(event.target.value), parent); }}>{Array.from({ length: Number(selected?.parameters.halfHooks ?? 6) * 2 + 1 }, (_, slot) => slot - Number(selected?.parameters.halfHooks ?? 6)).map(value => <option key={value} value={value} disabled={instance.type === WEIGHT && occupiedWeightHook(scene.equipment, instance.id, target, value)}>{value}{instance.type === WEIGHT && occupiedWeightHook(scene.equipment, instance.id, target, value) ? '（已挂钩码）' : ''}</option>)}</select></label>}
    {instance.type === WEIGHT && !parent && occupiedWeightHook(scene.equipment, instance.id, target, index) && <p role="status">当前挂点已占用，未应用；请选择空挂点或串接下挂钩。</p>}<p>也可拖到支架顶端或杠杆挂点附近，松手挂接；拖离后解除。钩码可拖到另一个钩码的下挂钩串接；每个挂点只能直接挂一个钩码，增加钩码请串接下挂钩。拖动上级会带动下级。</p>
  </section>;
}
