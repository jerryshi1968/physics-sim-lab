import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { EquipmentInstance, Pose2D, Scalar } from '../../core/equipment/schema.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { ParameterField } from '../../equipment/electrical/definitions.ts';
import { activePropertyDrafts, acknowledgePropertyDrafts, propertyCandidate, propertyValue, validPropertyCandidate } from '../../core/workbench/properties.ts';
import type { PropertyDrafts } from '../../core/workbench/properties.ts';

export function LiveProperties({ instance, registry, fields, optical, canRotate, onApply }: { instance: EquipmentInstance; registry: EquipmentRegistry; fields: readonly ParameterField[]; optical: boolean; canRotate: boolean; onApply: (id: string, pose: Pose2D, parameters: Record<string, Scalar>) => boolean }) {
  const [drafts, setDrafts] = useState<PropertyDrafts>({}), [rejected, setRejected] = useState<string | null>(null), helpId = useId();
  const anchor = useRef<{ input: HTMLElement; top: number; container: HTMLElement | null } | null>(null);
  useLayoutEffect(() => {
    const saved = anchor.current; anchor.current = null;
    if (!saved || !saved.input.isConnected || document.activeElement !== saved.input) return;
    const delta = saved.input.getBoundingClientRect().top - saved.top;
    if (saved.container && saved.container.scrollHeight > saved.container.clientHeight) saved.container.scrollTop += delta;
    else window.scrollBy(0, delta);
  });
  const active = activePropertyDrafts(instance, drafts);
  function remember(input: HTMLElement) { anchor.current = { input, top: input.getBoundingClientRect().top, container: input.closest<HTMLElement>('.inspector') }; }
  function changeNumber(key: string, raw: string, input: HTMLInputElement) {
    const next = { ...active, [key]: { raw, applied: propertyValue(instance, key) } };
    const value = input.valueAsNumber;
    setRejected(null);
    if (raw.trim() === '' || !Number.isFinite(value)) { setDrafts(next); return; }
    let candidate = propertyCandidate(instance, next);
    if (!validPropertyCandidate(candidate, registry)) candidate = propertyCandidate(instance, { [key]: next[key]! });
    if (validPropertyCandidate(candidate, registry)) {
      remember(input);
      if (onApply(instance.id, candidate.pose, candidate.parameters)) { setDrafts(acknowledgePropertyDrafts(candidate, next)); return; }
      setRejected(key);
    }
    setDrafts(next);
  }
  const numericFields = [{ key: 'xM', label: '位置 x（m）' }, { key: 'yM', label: optical ? '光心或基准高度（m）' : '位置 y（m）' }, ...(canRotate ? [{ key: 'degrees', label: '转角（°）' }] : []), ...fields.filter(field => field.kind === 'number').map(field => ({ key: field.key, label: `${field.label}${field.unit ? `（${field.unit}）` : ''}` }))];
  const invalidDraft = Object.entries(active).some(([key, draft]) => draft.raw.trim() === '' || !Number.isFinite(Number(draft.raw)) || !validPropertyCandidate(propertyCandidate(instance, { [key]: draft }), registry));
  return <div className="live-properties">
    {numericFields.map(({ key, label }) => {
    const value = active[key]?.raw ?? String(propertyValue(instance, key));
    const candidate = propertyCandidate(instance, { [key]: { raw: value, applied: propertyValue(instance, key) } });
    const invalid = value.trim() === '' || !Number.isFinite(Number(value)) || !validPropertyCandidate(candidate, registry) || rejected === key;
    return <label key={key}>{label}<input aria-label={label} aria-describedby={helpId} aria-invalid={invalid} name={key} type="number" step="any" value={value}
      onChange={event => changeNumber(key, event.currentTarget.value, event.currentTarget)} onBlur={() => { setDrafts(current => { const remaining = { ...current }; delete remaining[key]; return remaining; }); setRejected(null); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDrafts(current => { const remaining = { ...current }; delete remaining[key]; return remaining; }); setRejected(null); } }} /></label>;
    })}
    {fields.filter(field => field.kind === 'boolean').map(field => <label key={field.key} className="checkbox-field">{field.label}<input name={field.key} type="checkbox" checked={instance.parameters[field.key] === true} onChange={event => {
      let candidate = propertyCandidate(instance, active); candidate.parameters[field.key] = event.currentTarget.checked;
      if (!validPropertyCandidate(candidate, registry)) candidate = { ...instance, parameters: { ...instance.parameters, [field.key]: event.currentTarget.checked } };
      remember(event.currentTarget);
      if (validPropertyCandidate(candidate, registry) && onApply(instance.id, candidate.pose, candidate.parameters)) setDrafts(acknowledgePropertyDrafts(candidate, active));
    }} /></label>)}
    <p id={helpId} className="editor-help" role={invalidDraft || rejected ? 'status' : undefined}>{invalidDraft || rejected ? '未完成、无效或不满足约束的输入未应用；保留当前有效值。失焦或按 Esc 恢复。' : '属性修改立即生效，支持上下箭头；可撤销重做。'}</p>
  </div>;
}
