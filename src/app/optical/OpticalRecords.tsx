import { useState } from 'react';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from '../../equipment/optical/definitions.ts';
import type { OpticalCapture } from '../../equipment/optical/measure.ts';

export function OpticalRecords({ scene, ready, onCapture }: { scene: SceneDocument; ready: boolean; onCapture: (input: OpticalCapture) => string | null }) {
  const scales = scene.equipment.filter(item => [BENCH, RULER].includes(item.type));
  const [scaleId, setScaleId] = useState(''), [raw, setRaw] = useState<[string, string, string]>(['', '', '']);
  const [nature, setNature] = useState('未判定'), [orientation, setOrientation] = useState('未判定'), [size, setSize] = useState('未判定'), [clarity, setClarity] = useState('未判定');
  const [note, setNote] = useState(''), [setupLabel, setSetupLabel] = useState('第1组'), [error, setError] = useState('');
  const ruler = scales.find(item => item.id === scaleId) ?? scales.find(item => item.type === RULER) ?? scales[0];
  const length = Number(ruler?.parameters.lengthM ?? 1), width = length * 3000 + 30, tickStep = ruler?.type === BENCH ? 10 : 1;
  return <div className="optical-records"><h3>读尺与成像观察</h3><p>读刻度后换算为 m；位置输入留空记缺失，物距 u 和屏距 s 从手工读数相减。屏距不自动当成像距，虚像/无有限像也不填理论答案。</p>
    <label>读尺来源<select aria-label="读尺来源" value={ruler?.id ?? ''} onChange={event => setScaleId(event.target.value)}>{scales.map(item => <option key={item.id} value={item.id}>{item.type === RULER ? '独立刻度尺' : '光具座刻度'} · {item.id}</option>)}</select></label>
    {ruler && <div className="optical-ruler-scroll" tabIndex={0} role="region" aria-label="读尺放大窗，可横向滚动"><svg width={width} height="100" role="img" aria-label="刻度尺放大读数，标记不显示自动答案">
      <rect width={width} height="100" fill="#f2e7c7" />{Array.from({ length: Math.floor(length * (ruler.type === BENCH ? 100 : 1000)) + 1 }, (_, index) => <g key={index}><path d={`M${15 + index * tickStep * 3} 60v${(index * tickStep) % 10 === 0 ? 18 : 8}`} stroke="#51635f" strokeWidth=".8" />{(index * tickStep) % 10 === 0 && <text x={15 + index * tickStep * 3} y="94" textAnchor="middle" fontSize="11">{index * tickStep / 10}</text>}</g>)}
      {[CANDLE, LENS, SCREEN].map((type, index) => { const item = scene.equipment.find(equipment => equipment.type === type); if (!item) return null; const x = 15 + (item.pose.xM - ruler.pose.xM) * 3000; if (!Number.isFinite(x) || x < 0 || x > width) return null;
        return <g key={type}><path d={`M${x} ${12 + index * 14}V78`} stroke={['#c37532', '#3b8fa1', '#5d7567'][index]} /><text x={x + 3} y={12 + index * 14} fontSize="11">{['蜡烛', '透镜', '光屏'][index]}</text></g>; })}
    </svg></div>}
    <p>刻度标数为 cm，细格 1 mm；座上刻度的实际分度为 1 cm。移动独立尺会改变零点，不会移动器材。</p>
    <p>物距/屏距按采样时输入计算；事后各行独立修订，修改位置行后请同时核对相应距离。</p>
    <p>找到清晰实像后，将观察选为“实像”和“清晰”；保存时由光屏与透镜的位置读数相减，记为实测像距 v，无需重复填写。未确认或未找到清晰实像时，像距留空。</p>
    <form onSubmit={event => { event.preventDefault(); setError(onCapture({ rulerId: ruler?.id ?? '', rawPositions: raw, nature, orientation, size, clarity, note, setupLabel }) ?? ''); }}>
      <div className="optical-entry-fields"><label>组别<input value={setupLabel} maxLength={100} onChange={event => setSetupLabel(event.target.value)} /></label>
        {['蜡烛位置读数（m）', '透镜位置读数（m）', '光屏位置读数（m）'].map((label, index) => <label key={label}>{label}<input inputMode="decimal" value={raw[index]} maxLength={100} onChange={event => setRaw(current => current.map((value, slot) => slot === index ? event.target.value : value) as [string, string, string])} /></label>)}
        {([{ label: '观察：虚实', value: nature, change: setNature, options: ['未判定', '实像', '虚像', '无有限像'] }, { label: '观察：正倒', value: orientation, change: setOrientation, options: ['未判定', '正立', '倒立'] }, { label: '观察：大小', value: size, change: setSize, options: ['未判定', '放大', '等大', '缩小'] }, { label: '观察：清晰度', value: clarity, change: setClarity, options: ['未判定', '清晰', '模糊', '未见像'] }]).map(field => <label key={field.label}>{field.label}<select aria-label={field.label} value={field.value} onChange={event => field.change(event.target.value)}>{field.options.map(option => <option key={option}>{option}</option>)}</select></label>)}
      </div><label>观察备注<input value={note} maxLength={150} onChange={event => setNote(event.target.value)} /></label><button type="submit" disabled={!ready || !ruler}>保存读尺与观察</button>
    </form>{error && <p role="alert">{error}</p>}
  </div>;
}
