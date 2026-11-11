import { useEffect, useRef, useState } from 'react';
export function BuoyancyStart({ onChoose, onCancel }: { onChoose: (method: 'factors' | 'archimedes' | 'empty') => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [method, setMethod] = useState<'factors' | 'archimedes' | 'empty'>('factors');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="buoyancy-start-title" onCancel={onCancel}><h2 id="buoyancy-start-title">浮力实验</h2>
    <p>悬挂圆柱体，观察浸没体积与测力计读数。也可用溢水杯和接液杯收集排液，称量验证阿基米德原理。</p>
    {([['factors', '探究浮力的影响因素'], ['archimedes', '验证阿基米德原理'], ['empty', '浮力空白搭建']] as const).map(([value, label]) => <label key={value}><input type="radio" name="buoyancy-start" checked={method === value} onChange={() => setMethod(value)} />{label}</label>)}
    <div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(method)}>预览浮力实验</button></div></dialog>;
}
