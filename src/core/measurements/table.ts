import type { MeasurementRecord, MeasurementSnapshot, SceneDocument } from '../scene/schema.ts';

export const quantityLabels: Record<MeasurementRecord['quantity'], string> = {
  length: '长度', mass: '质量', time: '时间', current: '电流', voltage: '电压', resistance: '电阻', force: '力', torque: '力矩',
  velocity: '速度', acceleration: '加速度', angle: '角度', dimensionless: '无量纲',
  volume: '体积', density: '密度', temperature: '温度',
};
export const sourceLabel = (source: MeasurementRecord['source']) => source === 'manual' ? '手工抄表' : '仪表采集';
export function measurementStatusLabel(record: MeasurementRecord): string {
  if (record.source === 'manual' && record.value === null && !record.rawInput?.trim()) return '缺失';
  return ({ valid: '有效', invalid: '无效', 'over-range': '超量程', reverse: '反偏', 'out-of-model': '超出模型', 'non-steady': '非稳态' })[record.measurementStatus];
}
export interface MeasurementRow { record: MeasurementRecord; snapshot: MeasurementSnapshot | undefined; sampleIndex: number; equipmentLabel: string; pointLabel: string; setupLabel: string }

export function measurementRows(scene: SceneDocument): MeasurementRow[] {
  const snapshots = new Map((scene.measurementSnapshots ?? []).map(item => [item.id, item]));
  const groups = new Map<string, number>();
  return scene.measurementRecords.map(record => {
    const sampleId = record.context?.sampleId ?? record.id;
    if (!groups.has(sampleId)) groups.set(sampleId, groups.size + 1);
    const snapshot = record.context ? snapshots.get(record.context.sampleId) : undefined;
    return { record, snapshot, sampleIndex: groups.get(sampleId)!, equipmentLabel: record.context?.equipmentLabel ?? record.equipmentId,
      pointLabel: record.context?.pointLabel ?? record.equipmentId, setupLabel: snapshot?.setupLabel ?? '旧记录（无接线快照）' };
  });
}

export function validPlotValue(record: MeasurementRecord): number | null {
  return record.measurementStatus === 'valid' && record.value !== null && Number.isFinite(record.value) ? record.value : null;
}
