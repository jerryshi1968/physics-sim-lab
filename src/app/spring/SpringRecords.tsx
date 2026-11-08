import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SpringCapture } from '../../equipment/spring/measure.ts';
import { springRuler, springMessage } from '../../equipment/spring/simulate.ts';
import { MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';
export function SpringRecords({ scene, registry, ready, onCapture }: { scene: SceneDocument; registry: EquipmentRegistry; ready: boolean; onCapture: (input: SpringCapture) => string | null }) {
  const scales = scene.equipment.filter(item => item.type === MECHANICAL_RULER), [scaleId, setScaleId] = useState('');
  const [topRaw, setTop] = useState(''), [bottomRaw, setBottom] = useState(''), [originalRaw, setOriginal] = useState(''), [massRaw, setMass] = useState(''), [phase, setPhase] = useState('加载'), [setupLabel, setSetupLabel] = useState('弹簧1'), [note, setNote] = useState(''), [error, setError] = useState('');
  const rulerId = scales.find(item => item.id === scaleId)?.id ?? scales[0]?.id ?? '', ruler = springRuler(scene, registry, rulerId);
  return <section className="spring-records"><h3>弹簧读尺与记录</h3><p>刻度标数为 cm，细格 1 mm；请估读并换算为 m。两端读数相减得到总长 L，再减无载原长 L0 得形变量。F 按本组填写的钩码质量加配置盘质量计算；输入留空记缺失，不填理论答案。</p>
    <label>弹簧读尺来源<select aria-label="弹簧读尺来源" value={rulerId} onChange={event => setScaleId(event.target.value)}>{scales.map(item => <option key={item.id} value={item.id}>独立刻度尺 · {item.id}</option>)}</select></label>
    {ruler.ok ? <div className="spring-ruler-scroll" tabIndex={0} role="region" aria-label="弹簧读尺放大窗，可纵向滚动"><svg width="260" height={ruler.lengthM * 3000 + 40} role="img" aria-label="弹簧两端实际尺标，不显示自动答案">
      <rect x="90" width="90" height={ruler.lengthM * 3000 + 40} fill="#eee1b8" />{Array.from({ length: Math.floor(ruler.lengthM * 1000) + 1 }, (_, index) => <g key={index}><path d={`M100 ${20 + index * 3}h${index % 10 ? 10 : 20}`} stroke="#51635f" strokeWidth=".8" />{index % 10 === 0 && <text x="140" y={24 + index * 3} fontSize="12">{index / 10}</text>}</g>)}
      {[ruler.topM, ruler.bottomM].map((position, index) => <g key={index} data-spring-ruler-mark={index === 0 ? 'top' : 'bottom'} data-position-m={position}><path d={`M30 ${20 + position * 3000}H122`} stroke={index ? '#b76b28' : '#167e6a'} strokeWidth="1.5" /><text x="26" y={16 + position * 3000} fontSize="12">{index ? '下端' : '上端'}</text></g>)}
    </svg></div> : <p>{springMessage(ruler.code)}</p>}
    <form onSubmit={event => { event.preventDefault(); const message = onCapture({ rulerId, topRaw, bottomRaw, originalRaw, massRaw, phase, setupLabel, note }); setError(message ?? ''); if (!message && phase === '原长测量') setPhase('加载'); }}>
      <div className="spring-entry"><label>弹簧数据组<input aria-label="弹簧数据组" maxLength={100} value={setupLabel} onChange={event => setSetupLabel(event.target.value)} /></label><label>测量阶段<select aria-label="弹簧测量阶段" value={phase} onChange={event => setPhase(event.target.value)}>{['原长测量', '加载', '卸载复测'].map(value => <option key={value}>{value}</option>)}</select></label>
        {[{ label: '弹簧上端读数（m）', value: topRaw, set: setTop }, { label: '弹簧下端读数（m）', value: bottomRaw, set: setBottom }, { label: '无载原长 L0（m）', value: originalRaw, set: setOriginal }, { label: '钩码质量读数（kg，不含盘）', value: massRaw, set: setMass }].map(field => <label key={field.label}>{field.label}<input aria-label={field.label} inputMode="decimal" maxLength={100} value={field.value} onChange={event => field.set(event.target.value)} /></label>)}
      </div><label>弹簧备注<input aria-label="弹簧备注" value={note} maxLength={100} onChange={event => setNote(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button disabled={!ready || !ruler.ok}>保存弹簧读尺记录</button>
    </form><p>原长记录保存成功后，测量阶段切换为“加载”；后续每次保存新增一组，不覆盖之前的记录。原始输入与模型值分别追溯。事后各行可独立修订；修改读数后请同步核对总长、形变量及力，图线与拟合只使用表格有效值。</p>
  </section>;
}
