import { PendulumRuler } from './PendulumRuler.tsx';
import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';
import type { PendulumCapture } from '../../equipment/pendulum/measure.ts';
import type { PendulumSimulation } from './usePendulumSimulation.ts';

export function PendulumRecords({ scene, simulation: s, onCapture }: { scene: SceneDocument; simulation: PendulumSimulation; onCapture: (input: PendulumCapture) => string | null }) {
  const rulers = scene.equipment.filter(item => item.type === MECHANICAL_RULER);
  const [input, setInput] = useState<PendulumCapture>({ rulerId: rulers[0]?.id ?? '', pivotRaw: '', centerRaw: '', cyclesRaw: '', timeRaw: '', setupLabel: '第1组', note: '' }), [error, setError] = useState('');
  const change = (key: keyof PendulumCapture, value: string) => setInput(current => ({ ...current, [key]: value }));
  return <section className="spring-records pendulum-records"><h3>单摆读尺与多周期记录</h3><p>重置后量最低位置的悬点和球心读数，尺上 cm 先换算为 m。t 为 N 个完整周期的时间；留空记缺失。改变摆长请重新计时。</p>
    <label>单摆读尺来源<select aria-label="单摆读尺来源" value={input.rulerId} onChange={event => change('rulerId', event.target.value)}><option value="">请选择</option>{rulers.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label>
    <PendulumRuler scene={scene} rulerId={input.rulerId} />
    <div className="measurement-fields">{([['setupLabel', '单摆实验组名'], ['pivotRaw', '悬点尺读数（m）'], ['centerRaw', '最低点球心尺读数（m）'], ['cyclesRaw', '完整周期数 N（记录）'], ['timeRaw', '多周期时间 t（s）'], ['note', '单摆观察备注']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={label} value={input[key]} maxLength={100} onChange={event => change(key, event.target.value)} /></label>)}</div>
    <div className="projectile-controls"><button disabled={!s.run?.completed} onClick={() => change('timeRaw', String(s.displayS))}>采集秒表示数</button><button disabled={!s.run?.completed} onClick={() => { const message = onCapture(input); setError(message ?? ''); }}>保存本次单摆读数</button></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
