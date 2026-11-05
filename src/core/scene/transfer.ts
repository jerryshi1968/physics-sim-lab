import type { EquipmentRegistry } from '../equipment/registry.ts';
import type { Diagnostic } from '../diagnostics/diagnostic.ts';
import type { SceneDocument } from './schema.ts';
import { validateSceneDocument } from './validate.ts';
import { migrateSceneDocument } from './migrate.ts';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const IMPORT_LIMITS = { equipment: 200, connections: 500, measurementRecords: 10_000, measurementSnapshots: 10_000 } as const;
export type TransferResult = { ok: true; document: SceneDocument; fromVersion: number }
  | { ok: false; message: string; diagnostics?: Diagnostic[] };

export function utf8ByteLength(text: string): number {
  let length = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    length += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return length;
}

export function parseSceneJson(text: string, registry: EquipmentRegistry): TransferResult {
  if (utf8ByteLength(text) > MAX_DOCUMENT_BYTES) return { ok: false, message: '文件超过 5 MiB，未加载。' };
  let input: unknown;
  let unsafeKey = false;
  try { input = JSON.parse(text, (key, value: unknown) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) unsafeKey = true;
    return value;
  }); }
  catch { return { ok: false, message: '文件不是有效的 JSON，原实验保持不变。' }; }
  if (unsafeKey) return { ok: false, message: '文件包含不允许的对象字段，原实验保持不变。' };
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [key, limit] of Object.entries(IMPORT_LIMITS)) {
      const values = (input as Record<string, unknown>)[key];
      if (Array.isArray(values) && values.length > limit) return { ok: false, message: `文件的 ${key} 数量超过上限 ${limit}，未加载。` };
    }
  }
  const migration = migrateSceneDocument(input);
  if (!migration.ok) return { ok: false, message: migration.code === 'UNSUPPORTED_SCHEMA_VERSION'
    ? '不支持此场景版本（仅支持 1 和 2），原实验保持不变。' : '版本 1 文件结构无效，未迁移或加载。' };
  const validation = validateSceneDocument(migration.value, registry);
  if (!validation.ok) {
    const first = validation.diagnostics[0];
    return { ok: false, message: `场景校验失败：${first?.code ?? 'SCHEMA_INVALID'}${first?.path ? `（${first.path}）` : ''}。原实验保持不变。`,
      diagnostics: validation.diagnostics };
  }
  return { ok: true, document: validation.document, fromVersion: migration.fromVersion };
}

export function serializeScene(document: SceneDocument, registry: EquipmentRegistry): string {
  const validation = validateSceneDocument(document, registry);
  if (!validation.ok) throw new Error('场景校验失败，未保存或导出。');
  const text = JSON.stringify(validation.document, null, 2);
  if (utf8ByteLength(text) > MAX_DOCUMENT_BYTES) throw new Error('场景超过 5 MiB，请减少记录或器材后再保存。');
  return text;
}
