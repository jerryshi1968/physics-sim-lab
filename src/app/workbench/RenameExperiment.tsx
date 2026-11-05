import { useEffect, useRef, useState } from 'react';

export function RenameExperiment({ title, onRename, onCancel }: {
  title: string; onRename: (title: string) => boolean; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(title);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); input.current?.select(); }, []);
  return <dialog ref={dialog} className="document-preview rename-experiment" aria-labelledby="rename-title" onCancel={onCancel}>
    <h2 id="rename-title">修改实验名称</h2>
    <form onSubmit={event => {
      event.preventDefault();
      if (!value.trim() || value.trim().length > 200) { setError('名称不能为空，最多 200 个字符。'); return; }
      if (onRename(value.trim())) onCancel();
    }}>
      <label>实验名称<input ref={input} value={value} onChange={event => { setValue(event.target.value); setError(''); }}
        maxLength={200} required autoFocus placeholder="例如：串联电路实验" aria-describedby="rename-help" aria-invalid={!!error} /></label>
      <p id="rename-help">最多 200 个字符；改名后点击“保存”可在下次打开时保留。</p>
      {error && <p className="rename-error" role="alert">{error}</p>}
      <div><button type="button" onClick={onCancel}>取消</button><button type="submit" className="confirm-replace">确定名称</button></div>
    </form>
  </dialog>;
}
