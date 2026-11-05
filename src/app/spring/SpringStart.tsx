import { useEffect, useRef, useState } from 'react';
export function SpringStart({ onChoose, onCancel }: { onChoose: (empty: boolean) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [empty, setEmpty] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="document-preview" aria-labelledby="spring-start-title" onCancel={onCancel}><h2 id="spring-start-title">弹簧弹力与形变量实验</h2><p>高中定量探究：先无载读原长，再加载、卸载复测，记录至少五个不同形变量，绘制 F–Δx 并拟合劲度系数。教材具体章节待教师核验。</p><label><input type="radio" name="spring-start" checked={!empty} onChange={() => setEmpty(false)} />一套未加载弹簧器材</label><label><input type="radio" name="spring-start" checked={empty} onChange={() => setEmpty(true)} />弹簧空白搭建</label><div><button onClick={onCancel} autoFocus>取消</button><button onClick={() => onChoose(empty)}>预览弹簧实验</button></div></dialog>;
}
