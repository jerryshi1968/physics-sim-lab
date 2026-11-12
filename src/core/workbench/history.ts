import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { EquipmentInstance, Pose2D, Scalar } from '../equipment/schema.ts';
import type { Connection, Endpoint } from '../connections/schema.ts';
import type { MeasurementRecord, MeasurementSnapshot, SceneDocument } from '../scene/schema.ts';
import { SceneDocumentSchema } from '../scene/schema.ts';
import { validateSceneDocument } from '../scene/validate.ts';
import type { DocumentValidation } from '../scene/validate.ts';
import { addEquipment, addLooseWire, connectEndpoints, removeConnection, removeEquipment, removeEquipmentMany, renameDocument, updateGravity, updateEquipment, updateEquipmentMany, updateWireRoute, updateWireShape } from './edit.ts';
import type { Viewport, WorldPoint } from './geometry.ts';
import { appendMeasurements, correctManualMeasurement, removeMeasurement } from '../measurements/records.ts';

export type SceneCommand =
  | { type: 'rename'; title: string }
  | { type: 'set-gravity'; gravityMPerS2: number }
  | { type: 'set-experiment'; experimentId: string; title: string }
  | { type: 'add-equipment'; equipmentType: string; id: string; point: WorldPoint }
  | { type: 'add-wire'; id: string; point: WorldPoint }
  | { type: 'update-equipment'; id: string; pose: Pose2D; parameters: Record<string, Scalar> }
  | { type: 'update-equipment-batch'; updates: Pick<EquipmentInstance, 'id' | 'pose' | 'parameters'>[] }
  | { type: 'connect'; id: string; from: Endpoint; to: Endpoint }
  | { type: 'remove-equipment' | 'remove-wire'; id: string }
  | { type: 'remove-equipment-batch'; ids: string[]; updates?: Pick<EquipmentInstance, 'id' | 'pose' | 'parameters'>[] }
  | { type: 'record-measurements'; records: MeasurementRecord[]; snapshot: MeasurementSnapshot }
  | { type: 'correct-measurement'; id: string; rawInput: string }
  | { type: 'remove-measurement'; id: string }
  | { type: 'route'; id: string; points: { x: number; y: number }[] }
  | { type: 'reshape-wire'; wire: Connection };

interface HistoryEntry { label: string; document: SceneDocument }
export interface SceneHistory { present: SceneDocument; undo: HistoryEntry[]; redo: HistoryEntry[] }
export type HistoryResult = { ok: true; history: SceneHistory } | Extract<DocumentValidation, { ok: false }>;
export const MAX_HISTORY_ENTRIES = 100;
export const MAX_HISTORY_BYTES = 20 * 1024 * 1024;

export function createHistory(document: SceneDocument): SceneHistory {
  return { present: SceneDocumentSchema.parse(document), undo: [], redo: [] };
}

function bounded(entries: HistoryEntry[]): HistoryEntry[] {
  let bytes = 0;
  let start = entries.length;
  while (start > 0 && entries.length - start < MAX_HISTORY_ENTRIES) {
    const size = JSON.stringify(entries[start - 1]!.document).length * 2;
    if (bytes + size > MAX_HISTORY_BYTES) break;
    bytes += size;
    start--;
  }
  return entries.slice(start);
}

function editContent(document: SceneDocument): string {
  return JSON.stringify({ ...document, revision: 0, viewport: undefined,
    provenance: { ...document.provenance, updatedAt: '' } });
}

export function executeCommand(history: SceneHistory, command: SceneCommand, registry: EquipmentRegistry, timestamp: string): HistoryResult {
  const current = history.present;
  let result: DocumentValidation;
  let label: string;
  switch (command.type) {
    case 'set-gravity': label = '修改重力加速度'; result = updateGravity(current, registry, command.gravityMPerS2, timestamp); break;
    case 'rename': label = '修改实验名称'; result = renameDocument(current, registry, command.title, timestamp); break;
    case 'set-experiment':
      label = '切换测量方法';
      result = validateSceneDocument({ ...current, experimentId: command.experimentId, title: command.title, revision: current.revision + 1,
        provenance: { ...current.provenance, updatedAt: timestamp } }, registry);
      break;
    case 'add-equipment': label = '放置器材'; result = addEquipment(current, registry, command.equipmentType, command.id, command.point, timestamp); break;
    case 'add-wire': label = '放置导线'; result = addLooseWire(current, registry, command.id, command.point, timestamp); break;
    case 'update-equipment': label = '移动或修改器材'; result = updateEquipment(current, registry, command.id, command.pose, command.parameters, timestamp); break;
    case 'update-equipment-batch': label = '配置器材'; result = updateEquipmentMany(current, registry, command.updates, timestamp); break;
    case 'connect': label = '连接接线柱'; result = connectEndpoints(current, registry, command.id, command.from, command.to, timestamp); break;
    case 'remove-equipment': label = '删除器材（保留导线）'; result = removeEquipment(current, registry, command.id, timestamp); break;
    case 'remove-equipment-batch': label = '批量删除器材（保留导线）'; result = removeEquipmentMany(current, registry, command.ids, timestamp, command.updates); break;
    case 'record-measurements': label = '记录测量快照'; result = appendMeasurements(current, registry, command.records, command.snapshot, timestamp); break;
    case 'correct-measurement': label = '修改手工抄表'; result = correctManualMeasurement(current, registry, command.id, command.rawInput, timestamp); break;
    case 'remove-measurement': label = '删除测量记录'; result = removeMeasurement(current, registry, command.id, timestamp); break;
    case 'remove-wire': label = '删除导线'; result = removeConnection(current, registry, command.id, timestamp); break;
    case 'route': label = '修改导线弯曲'; result = updateWireRoute(current, registry, command.id, command.points, timestamp); break;
    case 'reshape-wire': label = '移动或改接导线'; result = updateWireShape(current, registry, command.wire, timestamp); break;
  }
  if (!result.ok) return result;
  if (editContent(current) === editContent(result.document)) return { ok: true, history };
  return { ok: true, history: { present: result.document,
    undo: bounded([...history.undo, { label, document: SceneDocumentSchema.parse(current) }]), redo: [] } };
}

export function travelHistory(history: SceneHistory, direction: 'undo' | 'redo', registry: EquipmentRegistry, timestamp: string): HistoryResult {
  const stack = history[direction];
  const entry = stack[stack.length - 1];
  if (!entry) return { ok: true, history };
  const document = SceneDocumentSchema.parse(entry.document);
  document.revision = history.present.revision + 1;
  document.provenance.updatedAt = timestamp;
  if (history.present.viewport) document.viewport = { ...history.present.viewport };
  else delete document.viewport;
  const validation = validateSceneDocument(document, registry);
  if (!validation.ok) return validation;
  const opposite = direction === 'undo' ? 'redo' : 'undo';
  return { ok: true, history: { ...history, present: validation.document, [direction]: stack.slice(0, -1),
    [opposite]: bounded([...history[opposite], { label: entry.label, document: SceneDocumentSchema.parse(history.present) }]) } };
}

export function setHistoryViewport(history: SceneHistory, viewport: Viewport): SceneHistory {
  return { ...history, present: { ...history.present, viewport: { ...viewport } } };
}
