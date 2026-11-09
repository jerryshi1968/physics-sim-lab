import { displayMeasurement } from './display.ts';
import type { SceneDocument } from '../scene/schema.ts';
import { measurementRows, measurementStatusLabel, quantityLabels, sourceLabel } from './table.ts';
import { utf8ByteLength } from '../scene/transfer.ts';

export function csvCell(value: string | number | null): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('NON_FINITE_CSV_NUMBER');
    return String(value);
  }
  const text = value ?? '';
  const safe = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text) ? `\t${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function measurementsCsv(scene: SceneDocument): string {
  const sourceColumn = scene.measurementSnapshots?.some(snapshot => !!snapshot.sourceSnapshotIds?.length);
  const captureColumn = scene.measurementSnapshots?.some(snapshot => !!snapshot.captureState);
  const header = ['实验名称', '记录标识', '组次', '组别或接法', '测点', '器材名称', '器材标识', '物理量', '单位', '记录值', '原始抄表文本', '修订后抄表文本', '来源', '状态',
    '量程最小值', '量程最大值', '分度值', '采样时间', '修订时间', '文档标识', '文档版本', '运行标识', '序号', '采样标识', '模型版本',
    '仪器显示快照', '模型真值快照', '仪器状态', '诊断', '模型配置快照', '器材参数快照', '连接快照', '备注', ...(captureColumn ? ['采样时待发装置快照'] : []), ...(sourceColumn ? ['计算来源采样快照'] : [])];
  const emitted = new Set<string>();
  const rows: (string | number | null)[][] = measurementRows(scene).map(({ record: storedRecord, snapshot, sampleIndex, equipmentLabel, pointLabel, setupLabel }) => {
    const record = displayMeasurement(storedRecord);
    const includeSnapshot = !!snapshot && !emitted.has(snapshot.id);
    if (snapshot) emitted.add(snapshot.id);
    return [
    scene.title, record.id, sampleIndex, setupLabel, pointLabel, equipmentLabel, record.equipmentId, quantityLabels[record.quantity], record.unit,
    record.value, record.context?.originalRawInput ?? record.rawInput, record.correctedAt ? record.rawInput : '', sourceLabel(record.source), measurementStatusLabel(storedRecord), record.range?.min ?? null, record.range?.max ?? null,
    record.range?.resolution ?? null, record.recordedAt, record.correctedAt ?? '', snapshot?.documentId ?? scene.documentId, record.documentRevision,
    record.runId, record.sequence, record.context?.sampleId ?? '', snapshot?.modelVersion ?? '', record.context?.instrumentDisplayValue ?? null,
    record.context?.physicalValue ?? null, record.context?.instrumentStatus ?? '', record.context?.diagnosticCodes.join(';') ?? '',
    JSON.stringify(record.modelConfigSnapshot), includeSnapshot ? JSON.stringify(snapshot.equipment) : '', includeSnapshot ? JSON.stringify(snapshot.connections) : '', snapshot?.note ?? '', ...(captureColumn ? [includeSnapshot && snapshot?.captureState ? JSON.stringify(snapshot.captureState) : ''] : []), ...(sourceColumn ? [includeSnapshot && snapshot?.sourceSnapshotIds ? JSON.stringify(snapshot.sourceSnapshotIds.map(id => scene.measurementSnapshots?.find(source => source.id === id))) : ''] : []),
  ]; });
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  if (utf8ByteLength(csv) > 20 * 1024 * 1024) throw new RangeError('CSV_TOO_LARGE');
  return csv;
}
