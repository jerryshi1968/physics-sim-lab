import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Scalar } from '../../core/equipment/schema.ts';
import { BALANCE, MASS_SET, SPECIMEN } from '../../equipment/density/definitions.ts';
import { aluminumBlocks, massVolumeMessage } from '../../equipment/massVolume/simulate.ts';
import type { MassVolumeOutcome } from '../../equipment/massVolume/simulate.ts';
export function MassVolumePanel({ scene, outcome, preview, onUpdate, onClear, onAlign, onReadView, onOverview }: { scene: SceneDocument; outcome: MassVolumeOutcome; preview: boolean; onUpdate: (id: string, values: Record<string, Scalar>) => void; onClear: () => void; onAlign: () => void; onReadView: () => void; onOverview: () => void }) {
  const balance = scene.equipment.find(i => i.type === BALANCE), box = scene.equipment.find(i => i.type === MASS_SET), block = scene.equipment.find(i => i.type === SPECIMEN), w = outcome.weighing;
  const status = !w.ok ? massVolumeMessage(w.code) : w.overRange ? '天平超量程。' : w.balanced ? '天平指针对准中央。' : `天平未平衡，${w.residualKg > 0 ? '左' : '右'}盘较重，下沉。`;
  return <section className="density-panel"><h3>铝块称量与读尺</h3><p data-testid="mass-volume-status">{preview ? '调整预览中，松手后再记录。' : status}</p>{!outcome.ok && <p>{massVolumeMessage(outcome.code)}</p>}<p>先空载调平，点击砝码盒、拖游码配平。称量后把铝块放回桌面，用尺读正面一条边的两端刻度。</p>
    {balance && <button disabled={preview} onClick={onClear}>清空天平并游码归零</button>}
    {balance && box && <label>砝码盒关联天平<select aria-label="砝码盒关联天平" value={String(box.parameters.balanceId)} disabled={preview} onChange={e => onUpdate(box.id, { balanceId: e.target.value })}><option value="">不关联</option><option value={balance.id}>当前天平右盘</option></select></label>}
    {block && <><label>更换铝块<select aria-label="更换铝块" value={String(block.parameters.sampleCode)} disabled={!!block.parameters.targetId || preview} onChange={e => { const sample = aluminumBlocks.find(b => b.code === e.target.value); if (sample) onUpdate(block.id, { sampleCode: sample.code, volumeM3: sample.volumeM3, massKg: sample.massKg }); }}>{!aluminumBlocks.some(b => b.code === block.parameters.sampleCode) && <option value={String(block.parameters.sampleCode)}>请选择铝块</option>}{aluminumBlocks.map(b => <option key={b.code}>{b.code}</option>)}</select></label>{!!block.parameters.targetId && <p>先将铝块从左盘取下，再更换下一块。</p>}{balance && <label>铝块位置<select aria-label="铝块位置" value={String(block.parameters.targetId)} disabled={preview} onChange={e => onUpdate(block.id, { targetId: e.target.value })}><option value="">桌面读尺</option><option value={balance.id}>天平左盘</option></select></label>}</>}
    <div className="density-actions"><button disabled={preview || !outcome.ok || !!block?.parameters.targetId || !outcome.ruler} onClick={onAlign}>将尺移到铝块下沿</button><button disabled={preview || !outcome.ok || !!block?.parameters.targetId} onClick={onReadView}>放大读尺</button><button onClick={onOverview}>回到称量视图</button></div>
    <p data-testid="mass-volume-ruler-status">{outcome.ok && outcome.rulerReadable ? '尺已覆盖正面下沿两端；读两端的刻度，相减得边长。' : '将铝块放在桌面，尺水平放在下沿附近并覆盖两端；放大后可读 1 mm 刻线。'}</p>
    <details><summary>实验步骤与范围</summary><ol><li>空载、游码归零，调螺母至指针对准中央；左物右码称质量并保存。</li><li>将同一块铝块移到桌面，水平放尺，读两端刻度并保存；本实验用正方体，体积等于边长的三次方。</li><li>选择该块的两项来源计算，换不同大小的铝块重复，观察 m–V 图，自行归纳关系。</li></ol><p>四块均为同一种铝的教学样品；正面边长按世界比例绘制，顶面/侧面的斜边是立体示意，不用来量边长。忽略加工偏差、温度形变、空气浮力和砝码误差。教材映射待教师核验。</p></details>
  </section>;
}
