import { useEffect, useRef, useState } from 'react';

export function OpticalStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="experiment-start" aria-labelledby="optical-start-title" onCancel={onCancel}>
    <h2 id="optical-start-title">探究凸透镜成像规律</h2><p>蜡烛、透镜和光屏可独立移动和调高，光屏不自动跳到清晰位置。</p>
    <fieldset><legend>选择光学起点</legend><label><input type="radio" name="optical-start" checked={!empty} onChange={() => setEmpty(false)} />取出一套器材（未同高、未对焦）</label><label><input type="radio" name="optical-start" checked={empty} onChange={() => setEmpty(true)} />光学空白搭建</label></fieldset>
    <div className="experiment-start-actions"><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览光学实验</button></div>
  </dialog>;
}
