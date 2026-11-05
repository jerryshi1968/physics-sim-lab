import { useEffect, useRef, useState } from 'react';
import type { SavedExperiment } from '../persistence/localSceneStore.ts';

export function SavedExperiments({ entries, busy, error, onChoose, onDelete, onCancel }: {
  entries: SavedExperiment[]; busy: boolean; error: string; onChoose: (id: string) => void; onDelete: (id: string) => Promise<boolean>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedExperiment | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (deleteTarget) cancelDelete.current?.focus(); }, [deleteTarget]);
  return <dialog ref={dialog} className="document-preview saved-experiments" aria-labelledby="saved-title" onCancel={event => {
    event.preventDefault();
    if (!busy) { if (deleteTarget) setDeleteTarget(null); else onCancel(); }
  }}>
    <h2 id="saved-title">{deleteTarget ? '删除已保存的实验' : '已保存的实验'}</h2>
    {deleteTarget ? <>
      <p>确定删除本地保存的“{deleteTarget.title}”？此操作不能撤销。</p>
      <p className="saved-experiment-id">实验标识：{deleteTarget.id}</p>
      <p>当前打开的工作台不会被清空；需要保留文件备份时，可取消后先导出。</p>
    </> : <><p>选择一个实验查看加载预览。保存当前实验只会更新它自己，新建实验会另存一份。</p>
    {entries.length === 0 ? <p>还没有保存的实验，请先搭建并点击“保存”。</p> : <ul>
      {entries.map(entry => <li key={entry.id}><button disabled={busy} aria-label={`加载实验：${entry.title}（${entry.id}）`} onClick={() => onChoose(entry.id)}>
        <strong>{entry.title}</strong><span>保存时间：{Number.isFinite(Date.parse(entry.savedAt)) ? new Date(entry.savedAt).toLocaleString('zh-CN') : '未知'}</span>
        <small>实验标识：{entry.id}</small>
      </button><button className="delete-saved-button" disabled={busy} aria-label={`删除实验：${entry.title}（${entry.id}）`} onClick={() => setDeleteTarget(entry)}>删除</button></li>)}
    </ul>}</>}
    {error && <p className="rename-error" role="alert">{error}</p>}
    <div>{deleteTarget ? <>
      <button ref={cancelDelete} disabled={busy} onClick={() => setDeleteTarget(null)}>取消删除</button>
      <button className="delete-saved-button" disabled={busy} onClick={() => {
        void onDelete(deleteTarget.id).then(ok => { if (ok) setDeleteTarget(null); });
      }}>确定删除</button>
    </> : <button disabled={busy} onClick={onCancel} autoFocus>关闭</button>}</div>
  </dialog>;
}
