import { useState } from 'react';
import type { EquipmentInstance, Scalar } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { SPRING } from '../../equipment/spring/definitions.ts';
import { springMessage, springAttachment } from '../../equipment/spring/simulate.ts';
import type { SpringOutcome } from '../../equipment/spring/simulate.ts';
import { SUPPORT, WEIGHT, mechanicalLabel } from '../../equipment/mechanical/definitions.ts';
import { weightDescendants } from '../../equipment/mechanical/weightChain.ts';
export function SpringPanel({ outcome, preview, gravity }: { outcome: SpringOutcome; preview: boolean; gravity: number }) {
  const [auxiliary, setAuxiliary] = useState(false);
  return <section className="spring-panel"><h3>弹簧静态观察</h3><p data-testid="spring-status">{preview ? springMessage('TRANSITIONING') : outcome.ok ? '静态平衡，可自行读尺' : springMessage(outcome.code)}</p><p>竖直无质量理想弹簧，g={gravity} N/kg；挂载后立即更新静态长度，不模拟振动或塑性变形。</p>
    {outcome.ok && <p>已挂 {outcome.loads.length} 件钩码，盘质量 {String(outcome.spring.parameters.trayMassKg)} kg。测原长时须取下全部钩码并将盘质量设为零；总长不是形变量。</p>}
    <label className="checkbox-field"><input type="checkbox" checked={auxiliary} onChange={event => setAuxiliary(event.target.checked)} />显示弹簧模型值与理论（可关闭）</label>
    {auxiliary && outcome.ok && !preview && <dl data-testid="spring-theory"><dt>模型 F=mg=kΔx</dt><dd>{Number(outcome.value.forceN.toPrecision(8))} N</dd><dt>模型原长 L0 / 总长 L / 形变量 Δx</dt><dd>{Number(outcome.spring.parameters.originalLengthM)} / {Number(outcome.value.lengthM.toPrecision(8))} / {Number(outcome.value.extensionM.toPrecision(8))} m</dd></dl>}
    <details><summary>弹簧实验步骤与范围</summary><ol><li>安装弹簧，将独立尺竖直向下摆在旁边，移动尺零点以覆盖两端。无挂码且盘质量为零时，读取两端并相减得到 L0。</li><li>加载已知质量钩码，读两端得到总长 L；输入原长，按 Δx=L−L0 计算。F=(钩码质量+盘质量)g。</li><li>在范围内至少记录五个不同工作点，再卸载复测；切到图线，以记录值拟合 F=kΔx+b，斜率单位 N/m。</li></ol><p>最大线性伸长与额定载荷均是模型配置，超限无正常长度/采样，不预测永久变形。未实现过渡动画，拖动预览中禁止采样。教材映射待教师核验。</p></details>
  </section>;
}
export function SpringAssembly({ scene, instance, onAttach }: { scene: SceneDocument; instance: EquipmentInstance; onAttach: (parameters: Record<string, Scalar>) => boolean }) {
  const [error, setError] = useState('');
  if (![SPRING, WEIGHT].includes(instance.type)) return null;
  const spring = instance.type === SPRING, excluded = weightDescendants(scene.equipment, instance.id);
  const parents = scene.equipment.filter(item => item.type === WEIGHT && !excluded.has(item.id) && !scene.equipment.some(child => child.id !== instance.id && child.parameters.parentWeightId === item.id));
  function attach(target: string, parent = '') { const parameters = springAttachment(scene, instance, target, parent); setError(!parameters ? '该挂点已占用或会产生循环，请串接空闲下挂钩。' : onAttach(parameters) ? '' : '挂接未通过校验，原装置保持。'); }
  return <section className="spring-panel"><h3>弹簧器材装配</h3><label>{spring ? '弹簧安装支架' : '挂接弹簧'}<select aria-label={spring ? '弹簧安装支架' : '挂接弹簧'} value={String(instance.parameters[spring ? 'supportId' : 'springId'] ?? '')} onChange={event => attach(event.target.value)}><option value="">不挂接</option>{scene.equipment.filter(item => item.type === (spring ? SUPPORT : SPRING)).map(item => <option key={item.id} value={item.id}>{mechanicalLabel(scene, item.id)}</option>)}</select></label>
    {!spring && <label>弹簧钩码串接<select aria-label="弹簧钩码串接" value={String(instance.parameters.parentWeightId ?? '')} onChange={event => attach('', event.target.value)}><option value="">不串接</option>{parents.map(item => <option key={item.id} value={item.id}>{mechanicalLabel(scene, item.id)} 下挂钩</option>)}</select></label>}
    <p>设置立即生效。也可拖弹簧上端到支架横臂末端，拖钩码上钩到弹簧下端或其他钩码下挂钩，松手挂接，拖离解除。每个下挂点只接一件钩码。</p>{error && <p role="alert">{error}</p>}
  </section>;
}
