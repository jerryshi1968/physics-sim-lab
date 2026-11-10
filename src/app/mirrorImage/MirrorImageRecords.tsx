import { useState } from 'react';
import { mirrorImageLengthLabels } from '../../equipment/mirrorImage/measure.ts';
import type { MirrorImageCapture } from '../../equipment/mirrorImage/measure.ts';

export function MirrorImageRecords({ ready, onCapture }: { ready: boolean; onCapture: (input: MirrorImageCapture) => string | null }) {
  const [draft, setDraft] = useState<MirrorImageCapture>({ setupLabel: '第1组', objectDistance: '', imageDistance: '', objectHeight: '', imageHeight: '', screenObservation: '' });
  const [error, setError] = useState('');
  const fields = Object.entries(mirrorImageLengthLabels) as [keyof typeof mirrorImageLengthLabels, string][];
  function change(field: keyof MirrorImageCapture, value: string) { setDraft(current => ({ ...current, [field]: value })); }
  return <section className="mirror-image-records">
    <h3>平面镜读数与虚像观察</h3>
    <p>刻度尺单位为 cm，每小格 1 cm。先移动观察眼检查重合，再量对照物；用尺上两个位置的刻度差填写距离或高度。每次记录保留当时的装置，留空表示未读。</p>
    <form onSubmit={event => { event.preventDefault(); setError(onCapture(draft) ?? ''); }}>
      <label>成像实验组名<input value={draft.setupLabel} onChange={event => change('setupLabel', event.target.value)} maxLength={100} /></label>
      <div className="measurement-context-fields">
        {fields.map(([key, label]) => <label key={key}>{label}（cm）<input value={draft[key]} onChange={event => change(key, event.target.value)} inputMode="decimal" maxLength={100} /></label>)}
      </div>
      <label>光屏观察结果<select value={draft.screenObservation} onChange={event => change('screenObservation', event.target.value)}><option value="">未记录</option><option value="0">未接到清晰的像</option><option value="1">接到清晰的像</option></select></label>
      <p>光屏需位于像处并覆盖像的高度，才算完成光屏验证。相应刻度尺未覆盖测点、或对照物与像无法完整观察时，保留抄写内容，数值标为不可用。</p>
      <button disabled={!ready || !(draft.screenObservation || fields.some(([key]) => draft[key].trim()))}>保存平面镜记录</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}
