import { useId, useLayoutEffect, useRef, useState } from 'react';

export function AppliedForceInput({ forceN, onChange }: { forceN: number; onChange: (forceN: number) => void }) {
  const anchor = useRef<{ input: HTMLInputElement; container: HTMLElement | null; top: number } | null>(null);
  useLayoutEffect(() => {
    const current = anchor.current; anchor.current = null;
    if (!current || !current.input.isConnected || document.activeElement !== current.input) return;
    const delta = current.input.getBoundingClientRect().top - current.top;
    if (current.container && current.container.scrollHeight > current.container.clientHeight) current.container.scrollTop += delta;
    else window.scrollBy(0, delta);
  }, [forceN]);
  const helpId = useId(), [draft, setDraft] = useState<{ applied: number; text: string } | null>(null);
  const text = draft?.applied === forceN ? draft.text : String(forceN), value = text.trim() === '' ? NaN : Number(text);
  const valid = Number.isFinite(value) && value >= 0 && value <= 100;
  return <><input name="forceN" aria-label="施加拉力（N）" aria-describedby={helpId} aria-invalid={!valid} type="number" step="any" min="0" max="100" required value={text}
    onChange={event => {
      const text = event.currentTarget.value, value = event.currentTarget.valueAsNumber;
      const valid = Number.isFinite(value) && value >= 0 && value <= 100;
      setDraft({ applied: valid ? value : forceN, text });
      if (valid && value !== forceN) {
        const input = event.currentTarget;
        anchor.current = { input, container: input.closest<HTMLElement>('.inspector'), top: input.getBoundingClientRect().top };
        onChange(value);
      }
    }} onBlur={() => setDraft(null)} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(null); }
    }} /><span id={helpId} className="editor-help">{valid ? '修改立即生效，支持上下箭头。' : `请输入 0～100 N；当前仍使用 ${forceN} N。`}</span></>;
}
