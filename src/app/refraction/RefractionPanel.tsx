import { RefractionMagnifier } from './RefractionMagnifier.tsx';
import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { RefractionOutcome } from '../../equipment/refraction/simulate.ts';
import { refractionMessage } from '../../equipment/refraction/simulate.ts';
import { EMITTER, PROTRACTOR, NORMAL } from '../../equipment/reflection/definitions.ts';
export function RefractionPanel({ scene, outcome: o, preview, theory, onTheory, reflection, onReflection, onAim, onAlign, onReverse }: { scene: SceneDocument; outcome: RefractionOutcome; preview: boolean; theory: boolean; onTheory: (v: boolean) => void; reflection: boolean; onReflection: (v: boolean) => void; onAim: (degree: number, water: boolean) => void; onAlign: (id: string, lower: boolean) => void; onReverse: () => void }) {
  const emitter = scene.equipment.find(i => i.type === EMITTER), gauges = scene.equipment.filter(i => i.type === PROTRACTOR), normal = scene.equipment.find(i => i.type === NORMAL), water = o.ok && o.fromWater;
  const degree = emitter ? Math.atan2(Math.cos(emitter.pose.rotationRad), Math.abs(Math.sin(emitter.pose.rotationRad))) * 180 / Math.PI : 40;
  const [magnifying, setMagnifying] = useState(false);
  const [draft, setDraft] = useState<{ raw: string; applied: number } | null>(null), value = Number(degree.toFixed(5));
  return <section className="reflection-panel refraction-panel"><h3>折射观察与量角</h3><p data-testid="refraction-status">{preview ? '器材移动预览中，松手后再记录。' : !o.ok ? refractionMessage(o.code) : o.kind === 'total-reflection' ? '当前水面没有折射光线；可减小水中的入射角再观察。' : !o.readable.incident || !o.readable.refracted ? '可观察光路；请将法线、两把量角器中心和零线对齐后读角。' : `光从${water ? '水射入空气' : '空气射入水中'}。改变入射方向并自行读角、记录偏折。`}</p>
    <div className="reflection-actions"><button disabled={!emitter} onClick={() => onAim(value, false)}>从空气射入水中</button><button disabled={!emitter} onClick={() => onAim(Math.min(40, Math.abs(value)), true)}>从水射入空气</button></div>
    {emitter && <label>光源入射方向（°，相对法线）<input aria-label="光源入射方向（°）" type="number" disabled={!o.ok} min="-85" max="85" step="1" value={draft?.applied === value ? draft.raw : value} onChange={e => { const n = e.currentTarget.valueAsNumber, raw = e.currentTarget.value; if (raw !== '' && Number.isFinite(n) && Math.abs(n) <= 85) { setDraft({ raw, applied: n }); onAim(n, water); } else setDraft({ raw, applied: value }); }} onBlur={() => setDraft(null)} /></label>}
    <div className="reflection-actions">{[0,20,40,60].map(v => <button key={v} disabled={!o.ok} onClick={() => onAim(v, water)}>{v === 0 ? '垂直入射' : `入射方向 ${v}°`}</button>)}</div>
    <button disabled={!o.ok || !o.transmitted || o.kind === 'critical'} onClick={onReverse}>沿折射光反向入射</button>
    <button disabled={!o.ok} onClick={() => setMagnifying(true)}>放大量角观察</button>{magnifying && o.ok && <RefractionMagnifier outcome={o} reflection={reflection} onClose={() => setMagnifying(false)} />}
    <p className="editor-help">橙色为入射光，红色为折射光；箭头表示传播方向。两次反向操作可对照原光路。选中光源后拖本体自由移动，拖弯箭头手柄绕当前入射点旋转；退出平移后操作，可用放大量角读细刻线。</p>
    <div className="reflection-actions">{normal && <button disabled={!o.ok} onClick={() => onAlign(normal.id, false)}>法线对齐入射点</button>}{gauges.map((g, index) => <button key={g.id} disabled={!o.ok} onClick={() => onAlign(g.id, index === 1)}>{index === 0 ? '量角器对齐空气侧' : '量角器对齐水侧'}</button>)}</div>
    <label className="checkbox-field"><input type="checkbox" checked={reflection} onChange={e => onReflection(e.currentTarget.checked)} />显示反射光</label><label className="checkbox-field"><input type="checkbox" checked={theory} onChange={e => onTheory(e.currentTarget.checked)} />显示折射理论与模型值（可关闭）</label>
    {theory && o.ok && <div data-testid="refraction-theory"><p>n₁ sin i = n₂ sin r。入射角 {Number((o.incidenceRad * 180 / Math.PI).toFixed(5))}°，折射角 {o.refractionRad === null ? '—' : `${Number((o.refractionRad * 180 / Math.PI).toFixed(5))}°`}。</p><p>空气 n=1，水 n≈4/3；水射向空气超过临界角时不输出正常折射角。</p></div>}
    <details><summary>折射实验步骤与范围</summary><ol><li>从空气以不同方向射入水中，将法线与量角器对齐入射点，从法线量入射角和折射角，记录至少三组及偏折方向。</li><li>垂直入射，观察方向是否改变；沿折射光反向入射，对照两段原光路。</li></ol><p>二维、单一水平空气—水界面；水槽作为可见边界，水下光线到槽壁或槽底即结束，不模拟穿过玻璃壁后的二次折射、散射、干涉与光强。水中光源是密封光源的几何示意；教材映射待教师核验。</p></details>
  </section>;
}
