import { documentDiagnostic } from '../diagnostics/diagnostic.ts';
import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { EquipmentInstance, Pose2D, Scalar } from '../equipment/schema.ts';
import type { Connection, Endpoint } from '../connections/schema.ts';
import { SceneDocumentSchema } from '../scene/schema.ts';
import type { SceneDocument } from '../scene/schema.ts';
import { validateSceneDocument } from '../scene/validate.ts';
import type { DocumentValidation } from '../scene/validate.ts';
import { endpointKey, endpointWorld } from './geometry.ts';
import type { WorldPoint } from './geometry.ts';

function failure(code: string): DocumentValidation {
  return { ok: false, diagnostics: [documentDiagnostic(code, '')] };
}

function finish(document: SceneDocument, candidate: SceneDocument, registry: EquipmentRegistry, timestamp: string): DocumentValidation {
  candidate.revision = document.revision + 1;
  candidate.provenance.updatedAt = timestamp;
  return validateSceneDocument(candidate, registry);
}

export function addEquipment(document: SceneDocument, registry: EquipmentRegistry, type: string, id: string,
  position: WorldPoint, timestamp: string): DocumentValidation {
  const definition = registry.list().find(item => item.type === type);
  if (!definition) return failure('UNKNOWN_EQUIPMENT_VERSION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.equipment.push({ id, type, definitionVersion: definition.definitionVersion,
    pose: { ...position, rotationRad: 0 }, parameters: { ...definition.defaultParameters } });
  return finish(document, candidate, registry, timestamp);
}

export function updateGravity(document: SceneDocument, registry: EquipmentRegistry, gravityMPerS2: number, timestamp: string): DocumentValidation {
  if (!SceneDocumentSchema.shape.simulationConfig.shape.gravityMPerS2.safeParse(gravityMPerS2).success) return failure('INVALID_GRAVITY');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.simulationConfig.gravityMPerS2 = gravityMPerS2;
  return finish(document, candidate, registry, timestamp);
}

export function renameDocument(document: SceneDocument, registry: EquipmentRegistry, title: string, timestamp: string): DocumentValidation {
  const value = title.trim();
  if (!SceneDocumentSchema.shape.title.safeParse(value).success) return failure('INVALID_TITLE');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.title = value;
  return finish(document, candidate, registry, timestamp);
}

export function updateEquipment(document: SceneDocument, registry: EquipmentRegistry, id: string,
  pose: Pose2D, parameters: Record<string, Scalar>, timestamp: string): DocumentValidation {
  if (!document.equipment.some(item => item.id === id)) return failure('UNKNOWN_EQUIPMENT_VERSION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.equipment = candidate.equipment.map(item => item.id === id ? { ...item, pose: { ...pose }, parameters: { ...parameters } } : item);
  return finish(document, candidate, registry, timestamp);
}

export function updateEquipmentMany(document: SceneDocument, registry: EquipmentRegistry, updates: Pick<EquipmentInstance, 'id' | 'pose' | 'parameters'>[], timestamp: string): DocumentValidation {
  if (!updates.length || new Set(updates.map(item => item.id)).size !== updates.length || updates.some(item => !document.equipment.some(existing => existing.id === item.id))) return failure('UNKNOWN_EQUIPMENT_VERSION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.equipment = candidate.equipment.map(item => {
    const update = updates.find(update => update.id === item.id);
    return update ? { ...item, pose: { ...update.pose }, parameters: { ...update.parameters } } : item;
  });
  return finish(document, candidate, registry, timestamp);
}

export function removeEquipment(document: SceneDocument, registry: EquipmentRegistry, id: string, timestamp: string): DocumentValidation {
  return removeEquipmentMany(document, registry, [id], timestamp);
}

export function removeEquipmentMany(document: SceneDocument, registry: EquipmentRegistry, ids: readonly string[], timestamp: string, updates: Pick<EquipmentInstance, 'id' | 'pose' | 'parameters'>[] = []): DocumentValidation {
  const removed = new Set(ids);
  if (!removed.size || ids.some(id => !document.equipment.some(item => item.id === id))) return failure('UNKNOWN_EQUIPMENT_VERSION');
  if (document.measurementRecords.some(record => removed.has(record.equipmentId))) return failure('EQUIPMENT_HAS_MEASUREMENTS');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections = candidate.connections.map(wire => {
    let detached = wire;
    for (const side of ['from', 'to'] as const) {
      const endpoint = wire[side];
      if (endpoint && removed.has(endpoint.equipmentId)) detached = positionWireEnd(detached, side, null, endpointWorld(endpoint, document.equipment, registry));
    }
    return detached;
  });
  if (updates.some(update => removed.has(update.id) || !document.equipment.some(item => item.id === update.id))) return failure('UNKNOWN_EQUIPMENT_VERSION');
  candidate.equipment = candidate.equipment.filter(item => !removed.has(item.id)).map(item => {
    const update = updates.find(update => update.id === item.id);
    return update ? { ...item, pose: { ...update.pose }, parameters: { ...update.parameters } } : item;
  });
  return finish(document, candidate, registry, timestamp);
}

export function connectEndpoints(document: SceneDocument, registry: EquipmentRegistry, id: string,
  from: Endpoint, to: Endpoint, timestamp: string): DocumentValidation {
  if (endpointKey(from) === endpointKey(to)) return failure('SELF_CONNECTION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections.push({ id, kind: 'wire', from: { ...from }, to: { ...to } });
  return finish(document, candidate, registry, timestamp);
}

export function addLooseWire(document: SceneDocument, registry: EquipmentRegistry, id: string,
  position: WorldPoint, timestamp: string): DocumentValidation {
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections.push({ id, kind: 'wire', from: null, to: null,
    freeFromWorldM: { x: position.xM - 0.1, y: position.yM },
    freeToWorldM: { x: position.xM + 0.1, y: position.yM },
    routeWorldM: [{ x: position.xM - 0.04, y: position.yM + 0.05 }, { x: position.xM + 0.04, y: position.yM + 0.05 }] });
  return finish(document, candidate, registry, timestamp);
}

export function updateWireShape(document: SceneDocument, registry: EquipmentRegistry, wire: Connection, timestamp: string): DocumentValidation {
  if (!document.connections.some(item => item.id === wire.id)) return failure('UNKNOWN_CONNECTION');
  if (wire.from && wire.to && endpointKey(wire.from) === endpointKey(wire.to)) return failure('SELF_CONNECTION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections = candidate.connections.map(item => item.id === wire.id ? { ...wire } : item);
  return finish(document, candidate, registry, timestamp);
}

export function positionWireEnd(wire: Connection, side: 'from' | 'to', target: Endpoint | null, point: WorldPoint): Connection {
  const result = { ...wire, [side]: target ? { ...target } : null };
  if (side === 'from') {
    if (target) delete result.freeFromWorldM;
    else result.freeFromWorldM = { x: point.xM, y: point.yM };
  } else {
    if (target) delete result.freeToWorldM;
    else result.freeToWorldM = { x: point.xM, y: point.yM };
  }
  return result;
}

export function updateWireRoute(document: SceneDocument, registry: EquipmentRegistry, id: string,
  points: { x: number; y: number }[], timestamp: string): DocumentValidation {
  if (!document.connections.some(wire => wire.id === id)) return failure('UNKNOWN_CONNECTION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections = candidate.connections.map(wire => wire.id === id ? { ...wire, routeWorldM: points.map(point => ({ ...point })) } : wire);
  return finish(document, candidate, registry, timestamp);
}

export function removeConnection(document: SceneDocument, registry: EquipmentRegistry, id: string, timestamp: string): DocumentValidation {
  if (!document.connections.some(wire => wire.id === id)) return failure('UNKNOWN_CONNECTION');
  const candidate = SceneDocumentSchema.parse(document);
  candidate.connections = candidate.connections.filter(wire => wire.id !== id);
  return finish(document, candidate, registry, timestamp);
}

export function editMessage(code: string): string {
  return ({ INVALID_TITLE: '实验名称不能为空，最多 200 个字符。', SCHEMA_INVALID: '输入无效：请填写有限数值，位置单位为 m，转角单位为 °。',
    DUPLICATE_ID: '器材或导线标识重复，操作未保存。', UNKNOWN_EQUIPMENT_VERSION: '器材或版本不存在。',
    INVALID_EQUIPMENT_PARAMETERS: '器材参数无效：电源电压须大于等于 0 V，电阻须大于 0 Ω；灯泡额定值/冷阻/上限、电表量程/分度值须符合模型；变阻器最大电阻须大于 0 Ω、滑片位置为 0～1。',
    DANGLING_ENDPOINT: '连接的器材不存在。', UNKNOWN_PORT: '接线柱不存在，请重新选择。',
    INCOMPATIBLE_PORT: '端口类型不匹配：导线只能连接电气接线柱。',
    UNSUPPORTED_CONNECTION_KIND: '当前器材不支持这种连接方式。',
    SELF_CONNECTION: '同一接线柱不能连接到自己，请选择另一个接线柱。',
    UNKNOWN_CONNECTION: '导线不存在。', EQUIPMENT_HAS_MEASUREMENTS: '该器材已有历史记录，请先保留记录，当前不能删除。',
    INVALID_GRAVITY: '重力加速度须为大于零的有限数值。',
  } as Record<string, string>)[code] ?? '操作未通过场景校验，原装置保持不变。';
}
