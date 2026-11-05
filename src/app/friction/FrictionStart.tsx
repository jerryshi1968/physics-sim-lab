import { useEffect, useRef, useState } from 'react';
export function FrictionStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="friction-start-title" onCancel={onCancel}><h2 id="friction-start-title">滑动摩擦实验</h2><p>水平一维，测力计与牵引器连接。自行选择材料、质量和接触面积，等待匀速稳态再读数。</p><label><input type="radio" name="friction-start" checked={!empty} onChange={() => setEmpty(false)} />一套水平牵引器材</label><label><input type="radio" name="friction-start" checked={empty} onChange={() => setEmpty(true)} />摩擦空白搭建</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览摩擦实验</button></div></dialog>;
}
