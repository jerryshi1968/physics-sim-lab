import type { EquipmentRegistry } from '../equipment/registry.ts';
import { SceneDocumentSchema } from '../scene/schema.ts';
import type { MeasurementRecord, MeasurementSnapshot, SceneDocument } from '../scene/schema.ts';
import { validateSceneDocument } from '../scene/validate.ts';
import type { DocumentValidation } from '../scene/validate.ts';
import { MAX_DOCUMENT_BYTES, utf8ByteLength } from '../scene/transfer.ts';
import { documentDiagnostic } from '../diagnostics/diagnostic.ts';

export function measurementFailure(code: string): Extract<DocumentValidation, { ok: false }> {
  return { ok: false, diagnostics: [documentDiagnostic(code, 'measurementRecords')] };
}

export function parseManualValue(rawInput: string): { ok: true; value: number | null } | { ok: false } {
  const text = rawInput.trim();
  if (!text) return { ok: true, value: null };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { ok: false };
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

export function manualResult(rawInput: string, baseStatus: MeasurementRecord['measurementStatus'], range: MeasurementRecord['range']) {
  const parsed = parseManualValue(rawInput);
  if (!parsed.ok) return null;
  let status = baseStatus;
  if (parsed.value === null && (baseStatus === 'valid' || baseStatus === 'non-steady')) status = 'invalid';
  else if ((baseStatus === 'valid' || baseStatus === 'non-steady') && parsed.value !== null && range) {
    if (parsed.value < range.min) status = 'reverse';
    else if (parsed.value > range.max) status = 'over-range';
  }
  return { value: status === 'valid' || status === 'non-steady' ? parsed.value : null, measurementStatus: status };
}

function finish(candidate: SceneDocument, registry: EquipmentRegistry, timestamp: string): DocumentValidation {
  candidate.revision++;
  candidate.provenance.updatedAt = timestamp;
  const checked = validateSceneDocument(candidate, registry);
  if (!checked.ok) return checked;
  if (utf8ByteLength(JSON.stringify(checked.document, null, 2)) > MAX_DOCUMENT_BYTES) return measurementFailure('MEASUREMENT_DOCUMENT_TOO_LARGE');
  return checked;
}

export function appendMeasurements(document: SceneDocument, registry: EquipmentRegistry, records: MeasurementRecord[], snapshot: MeasurementSnapshot, timestamp: string): DocumentValidation {
  const candidate = SceneDocumentSchema.parse(document);
  const captureSource = snapshot.captureState ?? snapshot;
  if (!records.length || records.some(record => record.context?.sampleId !== snapshot.id)
    || snapshot.documentId !== document.documentId || snapshot.documentRevision !== document.revision
    || JSON.stringify(captureSource.equipment) !== JSON.stringify(candidate.equipment) || JSON.stringify(captureSource.connections) !== JSON.stringify(candidate.connections)
    || JSON.stringify(captureSource.modelConfigSnapshot) !== JSON.stringify(candidate.simulationConfig)) return measurementFailure('STALE_MEASUREMENT');
  if (document.measurementRecords.length + records.length > 10_000 || (document.measurementSnapshots?.length ?? 0) >= 10_000) return measurementFailure('MEASUREMENT_LIMIT');
  candidate.measurementRecords.push(...records);
  candidate.measurementSnapshots = [...(candidate.measurementSnapshots ?? []), snapshot];
  return finish(candidate, registry, timestamp);
}

export function correctManualMeasurement(document: SceneDocument, registry: EquipmentRegistry, id: string, rawInput: string, timestamp: string): DocumentValidation {
  const record = document.measurementRecords.find(item => item.id === id);
  if (!record || record.source !== 'manual') return measurementFailure('MEASUREMENT_NOT_MANUAL');
  if (record.rawInput === rawInput) return { ok: true, document };
  const instrumentStatus = record.context?.instrumentStatus;
  const baseStatus = instrumentStatus === 'valid' ? record.context?.diagnosticCodes.includes('FRICTION_NON_STEADY') ? 'non-steady' : 'valid' : instrumentStatus === 'reverse' ? 'reverse'
    : instrumentStatus === 'over-range' ? 'over-range' : instrumentStatus === 'out-of-model' ? 'out-of-model'
      : instrumentStatus ? 'invalid' : record.measurementStatus;
  const result = manualResult(rawInput, baseStatus, record.range);
  if (!result) return measurementFailure('INVALID_MANUAL_VALUE');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.measurementRecords = candidate.measurementRecords.map(item => item.id === id ? { ...item, ...result, rawInput, correctedAt: timestamp } : item);
  return finish(candidate, registry, timestamp);
}

export function removeMeasurement(document: SceneDocument, registry: EquipmentRegistry, id: string, timestamp: string): DocumentValidation {
  if (!document.measurementRecords.some(item => item.id === id)) return measurementFailure('UNKNOWN_MEASUREMENT');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.measurementRecords = candidate.measurementRecords.filter(item => item.id !== id);
  const used = new Set(candidate.measurementRecords.map(item => item.context?.sampleId));
  for (let size = -1; size !== used.size;) {
    size = used.size;
    for (const snapshot of candidate.measurementSnapshots ?? []) if (used.has(snapshot.id)) for (const source of snapshot.sourceSnapshotIds ?? []) used.add(source);
  }
  if (candidate.measurementSnapshots) candidate.measurementSnapshots = candidate.measurementSnapshots.filter(snapshot => used.has(snapshot.id));
  return finish(candidate, registry, timestamp);
}

export function measurementMessage(code: string): string {
  return ({ STALE_MEASUREMENT: '当前装置的读数尚未就绪，请等待重新计算后采样。', INVALID_MANUAL_VALUE: '抄表值须为有限十进制数字；留空可记录缺失值。',
    UNKNOWN_MEASUREMENT: '记录已不存在。', MEASUREMENT_NOT_MANUAL: '仅手工抄表记录可以修改数值。', INVALID_MEASUREMENT_SELECTION: '请选择有效且不重复的电表和测点名称。',
    MEASUREMENT_DOCUMENT_TOO_LARGE: '记录后文档会超过 5 MiB，请导出备份并减少记录后再采样。',
    MEASUREMENT_LIMIT: '测量记录或采样快照达到 10000 条上限，请导出备份并减少记录。',
  } as Record<string, string>)[code] ?? '测量记录未通过校验，原数据保持不变。';
}
