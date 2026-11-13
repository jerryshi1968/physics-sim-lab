import { useState } from 'react';
import type { ThermalSimulation } from './useThermalSimulation.ts';
import type { ThermalCapture } from '../../equipment/thermal/measure.ts';
export function ThermalRecords({ simulation: s, onCapture }: { simulation: ThermalSimulation; onCapture: (input: ThermalCapture) => string | null }) {
  const [input, setInput] = useState<ThermalCapture>({ source: 'manual', timeRaw: '', temperatureRaw: '', setupLabel: '第1组', note: '' }), [message, setMessage] = useState('');
  const change = (key: keyof ThermalCapture, value: string) => setInput(current => ({ ...current, [key]: value }));
  const save = (source: ThermalCapture['source']) => { const result = onCapture({ ...input, source }); setMessage(result ?? '已保存本次热学读数。'); };
  return <section className="spring-records"><h3>水温—时间记录</h3><p>手工抄表留空记缺失，也可采集当前温度计和计时器的示数。记录不随之后的加热改变。</p><div className="measurement-fields">{([['setupLabel','热学组名'],['timeRaw','时间 t（s）'],['temperatureRaw','水温 T（℃）'],['note','气泡与水面现象']] as const).map(([key,label]) => <label key={key}>{label}<input aria-label={label} value={input[key]} maxLength={100} onChange={e => change(key,e.target.value)} /></label>)}</div><div className="projectile-controls"><button disabled={!s.reading.ok || !s.rig.timer} onClick={() => save('manual')}>保存热学抄表</button><button disabled={!s.reading.ok || !s.rig.timer} onClick={() => save('instrument')}>采集当前水温和时间</button></div>{message && <p role="status">{message}</p>}</section>;
}
