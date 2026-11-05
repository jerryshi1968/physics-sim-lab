import { useEffect, useRef, useState } from 'react';
import { lampCircuitStarts } from '../../experiments/lamp-circuits.ts';
import type { LampCircuitStart as Start } from '../../experiments/lamp-circuits.ts';

export function LampCircuitStart({ onChoose, onCancel }: { onChoose: (start: Start) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [selected, setSelected] = useState<Start>('blank');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="experiment-start" aria-labelledby="experiment-start-title" onCancel={onCancel}>
    <h2 id="experiment-start-title">探究灯泡串并联电路规律</h2>
    <p>从空白自行搭建，或选择可编辑模板。预览确认后才替换当前工作；当前实验可先保存或导出。</p>
    <fieldset><legend>选择起点</legend>{lampCircuitStarts.map(item => <label key={item.id}>
      <input type="radio" name="lamp-circuit-start" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} />
      <span><strong>{item.title}</strong><small>{item.description}</small></span>
    </label>)}</fieldset>
    <p>模板使用两只灯泡及一对双量程电表，初始开关断开、接大量程；可自行增减器材、改线与参数。教材具体章节待教师核验。</p>
    <div className="experiment-start-actions"><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(selected)}>预览实验</button></div>
  </dialog>;
}
