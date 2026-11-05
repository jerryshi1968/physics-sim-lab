import { IdSchema } from '../../core/equipment/schema.ts';

const DATABASE = 'cn-physics-lab';
const STORE = 'documents';
const EXPERIMENTS = 'experiments';
const SLOT = 'latest';
const TIMEOUT_MS = 10_000;

export interface SavedExperiment { id: string; title: string; savedAt: string }
type StoreOperation = { kind: 'latest' } | { kind: 'list' } | { kind: 'read'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'write'; text: string; summary: SavedExperiment };

function sceneIdentity(text: string): { id: string; title: string } | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || !('documentId' in value) || !('title' in value)) return null;
    if (!IdSchema.safeParse(value.documentId).success || typeof value.title !== 'string') return null;
    return { id: value.documentId as string, title: value.title };
  } catch { return null; }
}

function accessStore(operation: StoreOperation): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('本地存储响应超时，请导出 JSON 备份。')), TIMEOUT_MS);
    function finish(error?: unknown, result?: unknown) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) {
        try { transaction?.abort(); } catch { /* The transaction may already have finished. */ }
      }
      database?.close();
      if (error) reject(error);
      else resolve(result);
    }
    let opening: IDBOpenDBRequest;
    try { opening = indexedDB.open(DATABASE, 2); }
    catch (error) { finish(error); return; }
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE);
      if (!opening.result.objectStoreNames.contains(EXPERIMENTS)) {
        const experiments = opening.result.createObjectStore(EXPERIMENTS);
        const legacyStore = opening.transaction!.objectStore(STORE);
        const legacy = legacyStore.get(SLOT);
        legacy.onsuccess = () => {
          try {
            const value: unknown = legacy.result;
            if (value === undefined) return;
            legacyStore.put(value, 'legacy-v1-latest');
            if (typeof value !== 'string') return;
            const identity = sceneIdentity(value);
            if (identity) experiments.put({ ...identity, savedAt: new Date().toISOString(), json: value }, identity.id);
          } catch (reason) { opening.transaction?.abort(); finish(reason); }
        };
      }
    };
    opening.onerror = () => finish(opening.error);
    opening.onblocked = () => finish(new Error('本地存储被其他页面占用，请关闭旧页面后重试或导出 JSON。'));
    opening.onsuccess = () => {
      database = opening.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database?.close();
      try {
        transaction = database.transaction([STORE, EXPERIMENTS], operation.kind === 'write' || operation.kind === 'delete' ? 'readwrite' : 'readonly');
        const store = transaction.objectStore(STORE);
        const experiments = transaction.objectStore(EXPERIMENTS);
        let result: unknown;
        if (operation.kind === 'write') {
          experiments.put({ ...operation.summary, json: operation.text }, operation.summary.id);
          store.put(operation.text, SLOT);
        } else if (operation.kind === 'delete') {
          experiments.delete(operation.id);
          const latest = store.get(SLOT);
          latest.onsuccess = () => {
            const value: unknown = latest.result;
            if (typeof value !== 'string' || sceneIdentity(value)?.id !== operation.id) return;
            let replacement: { json: string; savedAt: string } | undefined;
            const cursor = experiments.openCursor();
            cursor.onsuccess = () => {
              try {
                const current = cursor.result;
                if (!current) {
                  if (replacement) store.put(replacement.json, SLOT);
                  else store.delete(SLOT);
                  return;
                }
                const entry: unknown = current.value;
                if (entry && typeof entry === 'object' && 'json' in entry && typeof entry.json === 'string'
                  && 'savedAt' in entry && typeof entry.savedAt === 'string' && sceneIdentity(entry.json)
                  && (!replacement || entry.savedAt > replacement.savedAt)) replacement = { json: entry.json, savedAt: entry.savedAt };
                current.continue();
              } catch (reason) { finish(reason); }
            };
          };
          const backup = store.get('legacy-v1-latest');
          backup.onsuccess = () => {
            try {
              const value: unknown = backup.result;
              if (typeof value === 'string' && sceneIdentity(value)?.id === operation.id) store.delete('legacy-v1-latest');
            } catch (reason) { finish(reason); }
          };
        } else if (operation.kind === 'list') {
          const summaries: SavedExperiment[] = [];
          const cursor = experiments.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) { result = summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id)); return; }
            const value: unknown = current.value;
            if (value && typeof value === 'object' && 'title' in value && 'savedAt' in value && typeof current.key === 'string') {
              summaries.push({ id: current.key, title: typeof value.title === 'string' ? value.title : '名称损坏的实验',
                savedAt: typeof value.savedAt === 'string' ? value.savedAt : '' });
            } else if (typeof current.key === 'string') summaries.push({ id: current.key, title: '损坏的本地实验', savedAt: '' });
            current.continue();
          };
        } else {
          const request = operation.kind === 'latest' ? store.get(SLOT) : experiments.get(operation.id);
          request.onsuccess = () => {
            const value: unknown = request.result;
            result = operation.kind === 'latest' || value === undefined ? value
              : value && typeof value === 'object' && 'json' in value ? value.json : null;
          };
        }
        transaction.oncomplete = () => finish(undefined, result);
        transaction.onerror = () => finish(transaction?.error ?? new Error('本地存储失败。'));
        transaction.onabort = () => finish(transaction?.error ?? new Error('本地存储操作中止。'));
      } catch (error) { finish(error); }
    };
  });
}

export async function readSavedScene(id?: string): Promise<string | null> {
  const value = await accessStore(id === undefined ? { kind: 'latest' } : { kind: 'read', id });
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new Error('本地保存内容损坏，请导入 JSON 备份。');
  return value;
}

export async function writeSavedScene(text: string): Promise<void> {
  const identity = sceneIdentity(text);
  if (!identity) throw new Error('实验标识或名称无效，未保存。');
  await accessStore({ kind: 'write', text, summary: { ...identity, savedAt: new Date().toISOString() } });
}

export async function listSavedScenes(): Promise<SavedExperiment[]> {
  return await accessStore({ kind: 'list' }) as SavedExperiment[];
}

export async function deleteSavedScene(id: string): Promise<void> {
  await accessStore({ kind: 'delete', id });
}

export function storageErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') return '本地存储空间不足，未保存；请导出 JSON 备份。';
  if (error instanceof Error && error.name === 'SecurityError') return '浏览器禁止本地存储，请使用 JSON 导入导出。';
  return error instanceof Error ? error.message : '本地存储不可用，请使用 JSON 导入导出。';
}
