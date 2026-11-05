import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { POWER, RESISTOR, SWITCH } from '../../src/equipment/electrical/definitions.ts';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
}

async function rename(page: Page, name: string) {
  await page.getByRole('button', { name: '修改实验名称', exact: true }).click();
  await page.getByRole('textbox', { name: '实验名称', exact: true }).fill(name);
  await page.getByRole('button', { name: '确定名称', exact: true }).click();
}

async function place(page: Page, type: string, x: number) {
  await page.locator(`[data-library-type="${type}"]`).click();
  const board = page.getByTestId('scene-board');
  const bounds = (await board.boundingBox())!;
  await board.click({ position: { x: bounds.width / 2 + x, y: bounds.height / 2 } });
  return board.locator(`[data-equipment-type="${type}"]`).last();
}

async function exported(page: Page) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await event;
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as ReturnType<typeof createEmptyScene>;
}

async function save(page: Page) {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
}

async function load(page: Page, title: string) {
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^加载实验：${title}（`) }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

async function startDelete(page: Page, title: string, id: string) {
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: `删除实验：${title}（${id}）`, exact: true }).click();
  await expect(page.getByRole('heading', { name: '删除已保存的实验', exact: true })).toBeVisible();
}

test('saving a second experiment preserves the first; loading, renaming and resaving update only the selected document', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  await rename(page, '串联电路实验');
  const source = await place(page, POWER, -120);
  const resistor = await place(page, RESISTOR, 120);
  await source.locator('[data-port-id="positive"]').click();
  await resistor.locator('[data-port-id="a"]').click();
  const series = await exported(page);
  await save(page);
  await page.getByRole('button', { name: '新建实验' }).click();
  await rename(page, '并联电路实验');
  await place(page, SWITCH, -130);
  await place(page, RESISTOR, 0);
  await place(page, RESISTOR, 130);
  const parallel = await exported(page);
  await save(page);
  expect(series.documentId).not.toBe(parallel.documentId);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(parallel);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('saved-experiments.png'), fullPage: true });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(await exported(page)).toEqual(parallel);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: /^加载实验：串联电路实验（/ }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await exported(page)).toEqual(parallel);
  await load(page, '串联电路实验');
  expect(await exported(page)).toEqual(series);
  await rename(page, '串联电路实验（修改）');
  await save(page);
  const updatedSeries = await exported(page);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(2);
  await page.getByRole('button', { name: /^加载实验：并联电路实验（/ }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(parallel);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: /^加载实验：串联电路实验（修改）（/ }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(updatedSeries);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(updatedSeries);
});

test('different experiments with identical names remain separate by document ID', async ({ page }) => {
  await ready(page);
  await place(page, POWER, -70);
  const first = await exported(page);
  await save(page);
  await page.getByRole('button', { name: '新建实验' }).click();
  await place(page, RESISTOR, 70);
  const second = await exported(page);
  await save(page);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：未命名实验（/ })).toHaveCount(2);
  await page.getByRole('button', { name: `加载实验：未命名实验（${first.documentId}）`, exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(first);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: `加载实验：未命名实验（${second.documentId}）`, exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(second);
});

test('upgrading a v1 single-slot database preserves its remaining snapshot and adds it to the experiment list', async ({ page }) => {
  await ready(page);
  const legacy = createEmptyScene('legacy.saved', '2026-11-03T08:00:00.000Z');
  legacy.title = '旧版串联实验';
  legacy.equipment = [{ id: 'legacy-source', type: POWER, definitionVersion: 1, pose: { xM: 0, yM: 0, rotationRad: 0 }, parameters: { voltageV: 6 } }];
  await page.evaluate(async text => {
    await new Promise<void>((resolve, reject) => {
      const removal = indexedDB.deleteDatabase('cn-physics-lab');
      removal.onsuccess = () => resolve();
      removal.onerror = () => reject(removal.error);
    });
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open('cn-physics-lab', 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore('documents');
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const transaction = db.transaction('documents', 'readwrite');
        transaction.objectStore('documents').put(text, 'latest');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    });
  }, JSON.stringify(legacy));
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(legacy);
  await page.getByRole('button', { name: '新建实验' }).click();
  await rename(page, '升级后新实验');
  await save(page);
  await load(page, '旧版串联实验');
  expect(await exported(page)).toEqual(legacy);
  const backup = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const opening = indexedDB.open('cn-physics-lab', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction('documents').objectStore('documents').get('legacy-v1-latest');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
  expect(backup).toBe(JSON.stringify(legacy));
  await startDelete(page, legacy.title, legacy.documentId);
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const removedBackup = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const opening = indexedDB.open('cn-physics-lab', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction('documents').objectStore('documents').get('legacy-v1-latest');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
  expect(removedBackup).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: '升级后新实验', exact: true })).toBeVisible();
});

test('delete requires confirmation, targets the selected ID and leaves current work and other saved experiments intact', async ({ page }, testInfo) => {
  await ready(page);
  await rename(page, '串联电路实验');
  await place(page, POWER, -70);
  const first = await exported(page);
  await save(page);
  await page.getByRole('button', { name: '新建实验' }).click();
  await rename(page, '并联电路实验');
  await place(page, RESISTOR, 70);
  const current = await exported(page);
  await save(page);
  await startDelete(page, first.title, first.documentId);
  await expect(page.getByRole('button', { name: '取消删除', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '取消删除', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(2);
  await page.getByRole('button', { name: `删除实验：${first.title}（${first.documentId}）`, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(2);
  await page.getByRole('button', { name: `删除实验：${first.title}（${first.documentId}）`, exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('delete-confirmation.png'), fullPage: true });
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: `加载实验：${first.title}（${first.documentId}）`, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(current);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(current);
});

test('deleting the current latest save preserves the board, selects another startup save, and deleting all never resurrects old data', async ({ page }) => {
  await ready(page);
  await rename(page, '保留实验');
  await place(page, POWER, -70);
  const first = await exported(page);
  await save(page);
  await page.getByRole('button', { name: '新建实验' }).click();
  await rename(page, '待删实验');
  await place(page, RESISTOR, 70);
  const second = await exported(page);
  await save(page);
  await startDelete(page, second.title, second.documentId);
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('尚未保存');
  expect(await exported(page)).toEqual(second);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(first);
  await startDelete(page, first.title, first.documentId);
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('还没有保存的实验');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(await exported(page)).toEqual(first);
  await save(page);
  await startDelete(page, first.title, first.documentId);
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('还没有保存的实验');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: '未命名实验', exact: true })).toBeVisible();
  await expect(page.getByText('0 件器材 · 0 根导线')).toBeVisible();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('还没有保存的实验');
});

test('a deletion failure rolls back both experiment and latest snapshot and keeps the saved marker', async ({ page }) => {
  await ready(page);
  await rename(page, '删除失败保护');
  await place(page, POWER, -70);
  const saved = await exported(page);
  await save(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      if (this.name === 'documents') throw new Error('模拟删除失败');
      return original.call(this, key);
    };
  });
  await startDelete(page, saved.title, saved.documentId);
  await page.getByRole('button', { name: '确定删除', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('删除失败');
  await page.getByRole('button', { name: '取消删除', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(saved);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(page.getByRole('button', { name: /^加载实验：/ })).toHaveCount(1);
});
