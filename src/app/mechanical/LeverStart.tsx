import { useEffect, useRef, useState } from 'react';
export function LeverStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="lever-start-title" onCancel={onCancel}><h2 id="lever-start-title">杠杆平衡实验</h2><p>自行调平、挂码、调整拉力并记录，不自动给出平衡装置。</p><label><input type="radio" name="lever-start" checked={!empty} onChange={() => setEmpty(false)} />未调平的一套器材</label><label><input type="radio" name="lever-start" checked={empty} onChange={() => setEmpty(true)} />力学空白搭建</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览杠杆实验</button></div></dialog>;
}
