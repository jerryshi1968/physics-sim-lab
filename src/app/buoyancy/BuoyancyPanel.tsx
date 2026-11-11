import type { SceneDocument } from '../../core/scene/schema.ts';
import type { Scalar } from '../../core/equipment/schema.ts';
import { SUPPORT, FORCE_METER } from '../../equipment/mechanical/definitions.ts';
import { BALANCE, BEAKER, CYLINDER } from '../../equipment/density/definitions.ts';
import { BODY, OVERFLOW } from '../../equipment/buoyancy/definitions.ts';
import { buoyancyMessage, isReceiver } from '../../equipment/buoyancy/simulate.ts';
import type { BuoyancyOutcome } from '../../equipment/buoyancy/simulate.ts';

export type BuoyancyAction = 'fill' | 'clear-receiver' | 'receive' | 'pour' | 'fill-beaker' | 'clear-cylinder';
export function BuoyancyPanel({ scene, outcome, onUpdate, onAction }: { scene: SceneDocument; outcome: BuoyancyOutcome;
  onUpdate: (id: string, values: Record<string, Scalar>) => void; onAction: (action: BuoyancyAction) => void }) {
  const support = scene.equipment.find(item => item.type === SUPPORT), meter = scene.equipment.find(item => item.type === FORCE_METER), body = scene.equipment.find(item => item.type === BODY);
  const tank = scene.equipment.find(item => item.type === OVERFLOW), receiver = scene.equipment.find(isReceiver), balance = scene.equipment.find(item => item.type === BALANCE);
  const liquid = scene.equipment.find(item => item.type === BEAKER && !isReceiver(item));
  const cylinder = scene.equipment.find(item => item.type === CYLINDER);
  const weighing = outcome.density.weighing;
  function stepMeter(deltaM: number) {
    if (!meter || !support) return;
    const height = Number(meter.parameters.mountHeightM ?? support.parameters.heightM);
    onUpdate(meter.id, { mountHeightM: Number(Math.max(.1, Math.min(Number(support.parameters.heightM), height + deltaM)).toFixed(5)) });
  }
  return <section className="buoyancy-panel config-section" aria-label="浮力观察与装配"><h3>浮力观察与装配</h3>
    <p data-testid="buoyancy-status">{outcome.ok ? outcome.submergedM3 > 1e-12 ? '物体已浸入液体，测力计指针随浸入程度变化。' : '物体在空气中，可先记录重力。' : buoyancyMessage(outcome.code)}</p>
    {meter && support && <><label>测力计挂接支架<select value={String(meter.parameters.supportId ?? '')} onChange={event => onUpdate(meter.id, { supportId: event.target.value, mountHeightM: Number(meter.parameters.mountHeightM ?? support.parameters.heightM) })}><option value="">未挂接</option><option value={support.id}>当前支架</option></select></label>
      <div className="buoyancy-actions"><button onClick={() => stepMeter(.01)}>提高 1 cm</button><button onClick={() => stepMeter(-.01)}>降低 1 cm</button></div></>}
    {body && meter && <label>圆柱体挂接<select value={String(body.parameters.meterId)} onChange={event => onUpdate(body.id, { meterId: event.target.value })}><option value="">未挂接</option><option value={meter.id}>测力计下挂钩</option></select></label>}
    {liquid && <button onClick={() => onAction('fill-beaker')}>烧杯补充 400 mL 液体</button>}
    {tank && <><button onClick={() => onAction('fill')}>加至溢水口并排尽多余液体</button><p data-testid="buoyancy-spill-status">{tank.parameters.trialId ? `本次累计排液 ${(Number(tank.parameters.spilledM3) * 1e6).toFixed(1)} mL，漏接 ${(Number(tank.parameters.lostM3) * 1e6).toFixed(1)} mL。` : '先将物体提离液面，再给溢水杯补液。'}</p>
      {receiver && <><label>出水口接液杯<select value={String(tank.parameters.receiverId)} onChange={event => onUpdate(tank.id, { receiverId: event.target.value })}><option value="">无接液杯</option><option value={receiver.id}>当前接液杯</option></select></label><button onClick={() => onAction('receive')}>接液杯移到出水口下方</button></>}
    </>}
    {receiver && <><button onClick={() => onAction('clear-receiver')}>清空接液杯</button>{balance && <label>接液杯位置<select value={String(receiver.parameters.targetId)} onChange={event => onUpdate(receiver.id, { targetId: event.target.value })}><option value="">桌面自由放置</option><option value={balance.id}>天平左盘</option></select></label>}
      <button onClick={() => onAction('pour')}>将接液杯液体全部倒入空量筒</button></>}
    {cylinder && <><button onClick={() => onAction('clear-cylinder')}>清空量筒</button><label>量筒读液面视线<select value={Number(cylinder.parameters.eyeLevel)} onChange={event => onUpdate(cylinder.id, { eyeLevel: Number(event.target.value) })}><option value={0}>平视凹液面最低处</option><option value={1}>俯视</option><option value={-1}>仰视</option></select></label></>}
    {balance && <p data-testid="buoyancy-balance-status">{!weighing.ok ? '请检查天平和接液杯。' : !weighing.calibrated ? '天平先空载调零，拖动实验台上的调零螺母。' : weighing.balanced ? '天平指针对准中央，可读质量。' : weighing.residualKg > 0 ? '左盘较重，增加砝码或移动游码。' : '右盘较重，减少砝码或移动游码。'}</p>}
    <details><summary>查看模型参考值</summary><p>浸没体积 {(outcome.submergedM3 * 1e6).toFixed(2)} mL；重力 {outcome.weightN.toFixed(3)} N；浮力 {outcome.buoyancyN.toFixed(3)} N。</p></details>
    <details><summary>实验步骤与范围</summary><ol><li>测力计挂支架，圆柱体挂下钩，先在空气中读数。</li><li>上下拖动测力计，逐渐浸入液体。完全浸没后继续下移，比较示数；更换液体密度再比较。</li><li>验证阿基米德原理时，先称空接液杯，再将杯放到出水口下方。溢水杯补液后浸入物体，称收集的排液，或倒入量筒读体积。</li></ol><p>缓慢浸入的静态实验；碰壁、触底、绳松弛或超量程时不作正常悬挂读数。已排出的液体保留在接液杯，提起物体后需补液才能重新准备。</p></details>
  </section>;
}
