import { useEffect, useRef, useState } from 'react';

export function MirrorImageStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="mirror-image-start-title" onCancel={onCancel}>
    <h2 id="mirror-image-start-title">平面镜成像实验</h2>
    <p>用薄玻璃板观察像，移动镜后对照物并消除视差，再测量像的位置与大小，用光屏检查像能否承接。</p>
    <label><input type="radio" name="mirror-image-start" checked={!empty} onChange={() => setEmpty(false)} /> 一套平面镜成像器材</label>
    <label><input type="radio" name="mirror-image-start" checked={empty} onChange={() => setEmpty(true)} /> 平面镜成像空白搭建</label>
    <div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览平面镜实验</button></div>
  </dialog>;
}
