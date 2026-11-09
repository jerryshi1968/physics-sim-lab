import { useEffect, useRef, useState } from 'react';
export function DensityStart({ onChoose, onCancel }: { onChoose: (liquid: boolean, empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [liquid, setLiquid] = useState(false), [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="density-start-title" onCancel={onCancel}><h2 id="density-start-title">测量密度实验</h2><p>{empty ? '从空白开始，可在器材库自行添加器材。' : liquid ? '预放托盘天平、砝码盒、空量筒和盛有待测液体的烧杯。' : '预放托盘天平、砝码盒、盛水量筒和待测固体。'}</p><fieldset><legend>测量方法</legend><label><input type="radio" name="density-method" checked={!liquid} onChange={() => setLiquid(false)}/>固体密度：称重与排水法</label><label><input type="radio" name="density-method" checked={liquid} onChange={() => setLiquid(true)}/>液体密度：倒出前后质量差法</label></fieldset><label><input type="checkbox" checked={empty} onChange={event => setEmpty(event.target.checked)}/>从空白搭建密度实验</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(liquid, empty)}>预览密度实验</button></div></dialog>;
}
