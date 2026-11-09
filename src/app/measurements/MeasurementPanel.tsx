import { useState } from 'react';
import { displayMeasurement, measurementInputInSI } from '../../core/measurements/display.ts';
import type { EquipmentRegistry } from '../../core/equipment/registry.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import type { MeasurementChoice } from '../../equipment/electrical/measure.ts';
import { AMMETER, VOLTMETER } from '../../equipment/electrical/definitions.ts';
import { equipmentLabel } from '../workbench/shared.ts';
import { measurementRows, measurementStatusLabel, quantityLabels, sourceLabel } from '../../core/measurements/table.ts';
import { LAMP_CIRCUIT_EXPERIMENT } from '../../experiments/lamp-circuits.ts';

export interface CaptureInput { source: 'manual' | 'instrument'; setupLabel: string; note: string; choices: MeasurementChoice[] }
interface Props {
  scene: SceneDocument; registry: EquipmentRegistry; ready: boolean;
  entryEnabled?: boolean;
  onCapture: (entry: CaptureInput) => string | null;
  onCorrect: (id: string, rawInput: string) => string | null;
  onRemove: (id: string) => void; onExport: () => void;
}
export function MeasurementPanel({ scene, registry, ready, entryEnabled = true, onCapture, onCorrect, onRemove, onExport }: Props) {
  const [excluded, setExcluded] = useState<string[]>([]), [setupLabel, setSetupLabel] = useState(scene.experimentId === LAMP_CIRCUIT_EXPERIMENT ? '第1组' : '自由搭建'), [note, setNote] = useState('');
  const [pointLabels, setPointLabels] = useState<Record<string, string>>({}), [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [editing, setEditing] = useState<string | null>(null), [correction, setCorrection] = useState('');
  const [entryOpen, setEntryOpen] = useState(scene.measurementRecords.length === 0);
  const [traceOpen, setTraceOpen] = useState<Record<string, boolean>>({});
  const meters = entryEnabled ? scene.equipment.filter(item => item.type === AMMETER || item.type === VOLTMETER) : [];
  const rows = measurementRows(scene);
  const choices = meters.filter(item => !excluded.includes(item.id)).map(item => ({ equipmentId: item.id,
    pointLabel: pointLabels[item.id] ?? equipmentLabel(scene, registry, item.id), rawInput: manualValues[item.id] ?? '' }));
  function capture(source: CaptureInput['source']) {
    const message = onCapture({ source, setupLabel, note, choices }); setError(message ?? '');
    if (!message) { setEntryOpen(false); if (source === 'manual') setManualValues({}); }
  }
  return <div className="measurement-panel">
    <div className="measurement-toolbar"><h3>测量与记录</h3><div className="measurement-actions">{meters.length > 0 && <><button aria-expanded={entryOpen} onClick={() => setEntryOpen(value => !value)}>{entryOpen ? '收起测点与抄表' : '展开测点与抄表'}</button><button disabled={!ready || !choices.length} onClick={() => capture('instrument')}>采集仪表示数</button></>}<button disabled={!rows.length} onClick={onExport}>导出 CSV</button></div></div>
    {meters.length > 0 ? <fieldset hidden={!entryOpen} className="measurement-entry"><legend>选择本次测点</legend>
      <div className="measurement-context-fields"><label>组别或接法<input value={setupLabel} maxLength={100} onChange={event => setSetupLabel(event.target.value)} placeholder="如：串联第1组 / 并联第1组" /></label><label>本组备注<input value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label></div>
      {meters.map(item => {
        const label = equipmentLabel(scene, registry, item.id), unit = item.type === AMMETER ? 'A' : 'V';
        return <div className="measurement-meter" key={item.id}>
          <label className="measurement-check"><input type="checkbox" aria-label={`记录${label}`} checked={!excluded.includes(item.id)} onChange={event => setExcluded(current => event.target.checked ? current.filter(id => id !== item.id) : [...current, item.id])} />{label}</label>
          <label>测点名称<input aria-label={`${label}测点名称`} value={pointLabels[item.id] ?? label} maxLength={100} onChange={event => setPointLabels(current => ({ ...current, [item.id]: event.target.value }))} /></label>
          <label>手工抄表（{unit}）<input aria-label={`${label}抄表值（${unit}）`} type="text" inputMode="decimal" maxLength={1000} value={manualValues[item.id] ?? ''} placeholder="自行读表，留空记缺失" onChange={event => setManualValues(current => ({ ...current, [item.id]: event.target.value }))} /></label>
        </div>;
      })}
      <div className="measurement-actions"><button disabled={!ready || !choices.length} onClick={() => capture('manual')}>保存手工抄表</button></div>
      <p>{ready ? '采集保存按分度值显示的数值；异常只记录状态，不保留正常数值。手工留空记为缺失，不会用真值补填。' : '等待当前装置的计算结果；暂停后改动装置须先恢复自动更新。'}</p>
    </fieldset> : entryEnabled && <p>放置并连接电流表或电压表后，可手工抄表或采集仪表示数。</p>}
    {error && <p role="alert" className="measurement-error">{error}</p>}
    {!rows.length ? <div className="measurement-empty"><h3>还没有测量记录</h3><p>完成搭建并测量后，在这里整理实验数据。</p></div> : <div className="measurement-table-scroll" tabIndex={0} role="region" aria-label="测量记录表，可横向滚动">
      <table className="measurement-table"><caption>测量记录：采样后独立保存，后续改线或改参数不覆盖旧值</caption><thead><tr>{['组次', '组别/接法', '测点', '量', '记录值', '单位', '来源', '状态', '量程/分度值', '采样时间', '追溯与操作'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map(({ record: storedRecord, snapshot, sampleIndex, pointLabel, setupLabel: groupLabel, equipmentLabel: capturedLabel }) => { const record = displayMeasurement(storedRecord); return <tr key={record.id} data-measurement-id={record.id} data-measurement-source={record.source} data-measurement-value={record.value ?? ''} data-measurement-status={record.measurementStatus}>
          <td>{sampleIndex}</td><td>{groupLabel}</td><td>{pointLabel}</td><td>{quantityLabels[record.quantity]}</td><td className="measurement-value">{record.value === null ? '—' : String(record.value)}</td><td>{record.unit}</td><td>{sourceLabel(record.source)}</td><td>{measurementStatusLabel(storedRecord)}</td>
          <td>{record.range ? `${record.range.min}～${record.range.max} / ${record.range.resolution}` : '未确定'}</td><td><time dateTime={record.recordedAt}>{record.recordedAt}</time></td>
          <td><details open={!!traceOpen[record.id]} onToggle={event => { const open = event.currentTarget.open; setTraceOpen(current => current[record.id] === open ? current : { ...current, [record.id]: open }); }}><summary>追溯详情</summary>{traceOpen[record.id] && <><dl><div><dt>器材</dt><dd>{capturedLabel}（{record.equipmentId}）</dd></div><div><dt>记录标识</dt><dd>{record.id}</dd></div><div><dt>文档/版本</dt><dd>{snapshot?.documentId ?? scene.documentId} / {record.documentRevision}</dd></div><div><dt>运行/序号</dt><dd>{record.runId} / {record.sequence}</dd></div><div><dt>采样/模型</dt><dd>{record.context?.sampleId ?? '旧记录无接线快照'} / {snapshot?.modelVersion ?? '未提供'}</dd></div><div><dt>采样时抄表</dt><dd>{record.source !== 'manual' ? '非手工来源' : <code>{JSON.stringify(record.context?.originalRawInput ?? record.rawInput)}</code>}</dd></div><div><dt>当前抄表文本</dt><dd>{record.rawInput === null ? '非手工来源' : <code>{JSON.stringify(record.rawInput)}</code>}</dd></div><div><dt>仪器显示快照</dt><dd>{record.context?.instrumentDisplayValue ?? '不可用'}</dd></div><div><dt>模型真值快照</dt><dd>{record.context?.physicalValue ?? '不可用'}</dd></div><div><dt>诊断</dt><dd>{record.context?.diagnosticCodes.join('，') || '无'}</dd></div><div><dt>修订时间</dt><dd>{record.correctedAt ?? '未修订'}</dd></div><div><dt>备注</dt><dd>{snapshot?.note || '无'}</dd></div></dl>{snapshot?.captureState && <p>本次计算采用发射初态；采样时待发配置单独保留，发射文档版本 {snapshot.captureState.launchRevision}。</p>}<pre>{JSON.stringify({ modelConfig: record.modelConfigSnapshot, equipment: snapshot?.equipment, connections: snapshot?.connections, ...(snapshot?.sourceSnapshotIds ? { sources: snapshot.sourceSnapshotIds.map(id => scene.measurementSnapshots?.find(source => source.id === id)) } : {}), ...(snapshot?.captureState ? { captureState: snapshot.captureState } : {}) }, null, 2)}</pre></>}</details>
            {record.source === 'manual' && <button onClick={() => { setEditing(record.id); setCorrection(record.rawInput ?? ''); setError(''); }}>修改抄表</button>}
            <button onClick={() => onRemove(record.id)}>删除记录</button>
            {editing === record.id && <form onSubmit={event => { event.preventDefault(); const rawInput = measurementInputInSI(storedRecord, correction); const message = rawInput === null ? '抄表值须为有限十进制数字；留空可记录缺失值。' : onCorrect(record.id, rawInput); setError(message ?? ''); if (!message) setEditing(null); }}><label>修订抄表值{record.unit === '°' ? '（°）' : ''}<input value={correction} maxLength={1000} onChange={event => setCorrection(event.target.value)} /></label><button type="submit">确认修订</button><button type="button" onClick={() => setEditing(null)}>取消修订</button></form>}
          </td>
        </tr>; })}</tbody>
      </table>
    </div>}
  </div>;
}
