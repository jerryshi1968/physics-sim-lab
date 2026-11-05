import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { POWER, RESISTOR, SWITCH, WIRE } from '../../src/equipment/electrical/definitions.ts';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
}

async function place(page: Page, type: string, x: number, y: number) {
  await page.locator(`[data-library-type="${type}"]`).click();
  const board = page.getByTestId('scene-board');
  const bounds = (await board.boundingBox())!;
  await board.click({ position: { x: bounds.width / 2 + x, y: bounds.height / 2 + y } });
  return board.locator(`[data-equipment-type="${type}"]`).last();
}

async function exported(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const file = await downloading;
  return JSON.parse(await readFile((await file.path())!, 'utf8')) as ReturnType<typeof createEmptyScene>;
}

async function drag(page: Page, locator: Locator, dx: number, dy: number, cancel = false) {
  const rect = (await locator.boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 20 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

async function upload(page: Page, text: string) {
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '实验.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

async function chooseSaved(page: Page) {
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('button', { name: /^加载实验：/ }).first().click();
}

function fixture() {
  const scene = createEmptyScene('import.fixture', '2026-11-03T08:00:00.000Z');
  scene.title = '迁移与恢复实验';
  scene.equipment = [
    { id: 'source', type: POWER, definitionVersion: 1, pose: { xM: -.2, yM: 0, rotationRad: 0 }, parameters: { voltageV: 6 } },
    { id: 'resistor', type: RESISTOR, definitionVersion: 1, pose: { xM: .2, yM: 0, rotationRad: 0 }, parameters: { resistanceOhm: 20 } },
  ];
  scene.connections = [{ id: 'wire', kind: 'wire', from: { equipmentId: 'source', portId: 'positive' }, to: { equipmentId: 'resistor', portId: 'a' }, routeWorldM: [{ x: 0, y: .1 }] }];
  return scene;
}

test('experiment rename validates and cancels, supports undo/redo, persists and names the exported file', async ({ page }, testInfo) => {
  await open(page);
  await place(page, POWER, -80, 0);
  const baseline = await exported(page);
  await page.getByRole('button', { name: '修改实验名称', exact: true }).click();
  const input = page.getByRole('textbox', { name: '实验名称', exact: true });
  await expect(input).toBeFocused();
  await input.fill('   ');
  await page.getByRole('button', { name: '确定名称', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('名称不能为空');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await exported(page)).toEqual(baseline);
  await page.getByRole('button', { name: '修改实验名称', exact: true }).click();
  await input.fill('  串联电路实验  ');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: '串联电路实验', exact: true })).toBeVisible();
  expect((await exported(page)).equipment).toEqual(baseline.equipment);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('heading', { name: '未命名实验', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByRole('heading', { name: '串联电路实验', exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('串联电路实验.json');
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).title).toBe('串联电路实验');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await expect(page.getByRole('heading', { name: '串联电路实验', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('renamed-experiment.png'), fullPage: true });
  await page.getByRole('button', { name: '新建实验' }).click();
  await expect(page.getByRole('heading', { name: '未命名实验', exact: true })).toBeVisible();
});

test('one drag is one history transaction; undo/redo, cancelled drag, delete restoration and export agree', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  const source = await place(page, POWER, -140, -35);
  const resistor = await place(page, RESISTOR, 140, -35);
  await source.locator('[data-port-id="positive"]').click();
  await resistor.locator('[data-port-id="a"]').click();
  await place(page, WIRE, 0, 60);
  await page.getByRole('button', { name: '连接线头 A', exact: true }).click();
  await source.locator('[data-port-id="negative"]').click();
  const baseline = await exported(page);
  await drag(page, source.locator('[data-battery-cell]'), 45, 20);
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(baseline.revision + 1));
  const moved = await exported(page);
  expect(moved.equipment[0]!.pose.xM - baseline.equipment[0]!.pose.xM).toBeCloseTo(.075, 5);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await exported(page)).equipment).toEqual(baseline.equipment);
  await page.getByTestId('scene-board').focus();
  await page.keyboard.press('Control+Shift+Z');
  expect((await exported(page)).equipment).toEqual(moved.equipment);
  const beforeCancel = await exported(page);
  await drag(page, source.locator('[data-battery-cell]'), -30, -25, true);
  expect(await exported(page)).toEqual(beforeCancel);
  await page.getByLabel('选择器材', { exact: true }).selectOption(baseline.equipment[0]!.id);
  await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByText('1 件器材 · 2 根导线')).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  const restored = await exported(page);
  expect(restored.equipment).toEqual(moved.equipment);
  expect(restored.connections).toEqual(moved.connections);
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(page.getByRole('button', { name: '重做', exact: true })).toBeEnabled();
  await page.getByLabel('选择器材', { exact: true }).selectOption(baseline.equipment[0]!.id);
  const revision = (await exported(page)).revision;
  
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(revision));
  await expect(page.getByRole('button', { name: '重做', exact: true })).toBeEnabled();
  const voltage = page.getByLabel('电源电压（V）', { exact: true });
  await voltage.fill('9');
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(revision + 1));
  await expect(voltage).toBeFocused();
  await voltage.press('Control+z');
  await expect(voltage).toHaveValue('3');
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(revision + 2));
  expect((await exported(page)).equipment).toEqual(restored.equipment);
  await voltage.fill('9');
  
  await expect(page.getByRole('button', { name: '重做', exact: true })).toBeDisabled();
  expect((await exported(page)).equipment[0]!.parameters.voltageV).toBe(9);
});

test('blank assembly saves to IndexedDB, refresh restores exact structure, editing and explicit load continue', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  const source = await place(page, POWER, -155, -50);
  const resistor = await place(page, RESISTOR, 155, -50);
  const control = await place(page, SWITCH, 0, 70);
  await page.getByLabel('闭合开关', { exact: true }).check();
  
  for (const [from, to] of [
    [source.locator('[data-port-id="positive"]'), resistor.locator('[data-port-id="a"]')],
    [resistor.locator('[data-port-id="b"]'), control.locator('[data-port-id="a"]')],
    [control.locator('[data-port-id="b"]'), source.locator('[data-port-id="negative"]')],
  ]) { await from!.click(); await to!.click(); }
  await place(page, WIRE, -80, 40);
  await drag(page, page.getByTestId('scene-board').locator('.route-handle').first(), -20, -15);
  await page.getByRole('button', { name: '连接线头 A', exact: true }).click();
  await source.locator('[data-port-id="positive"]').click();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  const saved = await exported(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(saved);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await page.getByLabel('选择器材', { exact: true }).selectOption(saved.equipment[0]!.id);
  await page.getByLabel('电源电压（V）', { exact: true }).fill('12');
  
  await expect(page.getByTestId('save-state')).toHaveText('有未保存更改');
  await chooseSaved(page);
  await expect(page.getByRole('dialog')).toContainText('重载后从实验初态重新运行');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect((await exported(page)).equipment[0]!.parameters.voltageV).toBe(12);
  await chooseSaved(page);
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(saved);
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.screenshot({ path: testInfo.outputPath('saved-restored.png'), fullPage: true });
});

test('bad and oversized imports preserve current work; supported v1 migrates after a cancellable inert preview', async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) requests.push(request.url()); });
  await open(page);
  await place(page, POWER, -100, 0);
  const baseline = await exported(page);
  const duplicate = fixture(); duplicate.equipment[1]!.id = 'source';
  const dangling = fixture(); dangling.connections[0]!.from!.equipmentId = 'absent';
  const badPort = fixture(); badPort.connections[0]!.to!.portId = 'absent';
  const unknown = fixture(); unknown.equipment[0]!.type = 'future.device';
  const wrongVersion = fixture(); wrongVersion.equipment[0]!.definitionVersion = 9;
  const unknownField = { ...fixture(), script: 'window.importExecuted=true' };
  const cases = ['{bad', ' '.repeat(5 * 1024 * 1024 + 1), JSON.stringify({ ...fixture(), schemaVersion: 99 }),
    JSON.stringify({ ...fixture(), equipment: Array(201).fill({}) }), JSON.stringify({ ...fixture(), connections: Array(501).fill({}) }),
    ...[duplicate, dangling, badPort, unknown, wrongVersion, unknownField].map(scene => JSON.stringify(scene))];
  for (const text of cases) {
    await upload(page, text);
    await expect(page.getByRole('alert')).not.toBeEmpty();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await exported(page)).toEqual(baseline);
  }
  const scene = { ...fixture(), schemaVersion: 1 };
  scene.title = '<img src="https://invalid.example/x" onerror="window.importExecuted=true">';
  await upload(page, JSON.stringify(scene));
  await expect(page.getByRole('dialog')).toContainText('旧版 1 已校验并迁移');
  await expect(page.getByRole('dialog').getByRole('heading', { name: scene.title, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await exported(page)).toEqual(baseline);
  await upload(page, JSON.stringify(scene));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('import-preview-narrow.png'), fullPage: true });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual({ ...scene, schemaVersion: 2 });
  expect(await page.evaluate(() => 'importExecuted' in window)).toBe(false);
  expect(requests).toEqual([]);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
});

test('blocked local storage still allows editing and JSON export without claiming saved', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new DOMException('disabled', 'SecurityError'); } } });
  });
  await open(page);
  await expect(page.getByRole('alert')).toContainText('浏览器禁止本地存储');
  await place(page, POWER, -100, 0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('浏览器禁止本地存储');
  await expect(page.getByTestId('save-state')).toHaveText('尚未保存');
  expect((await exported(page)).equipment.length).toBe(1);
});

test('failed save leaves the last committed IndexedDB snapshot intact', async ({ page }) => {
  await open(page);
  await place(page, POWER, -100, 0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  const saved = await exported(page);
  await place(page, RESISTOR, 100, 0);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'documents') throw new DOMException('full', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('本地存储空间不足');
  await expect(page.getByTestId('save-state')).toHaveText('有未保存更改');
  expect((await exported(page)).equipment.length).toBe(2);
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(saved);
});

test('corrupt local data does not replace current work and JSON backup can recover after refresh', async ({ page }) => {
  await open(page);
  await place(page, POWER, -100, 0);
  const baseline = await exported(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open('cn-physics-lab', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction(['documents', 'experiments'], 'readwrite');
      transaction.objectStore('documents').put('{"schemaVersion":999}', 'latest');
      transaction.objectStore('experiments').put({ id: 'broken.scene', title: '损坏实验', savedAt: '', json: '{"schemaVersion":999}' }, 'broken.scene');
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await chooseSaved(page);
  await expect(page.getByRole('alert')).toContainText('不支持此场景版本');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(await exported(page)).toEqual(baseline);
  await page.reload();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText('本地保存未加载');
  await expect(page.getByText('0 件器材 · 0 根导线')).toBeVisible();
  await upload(page, JSON.stringify(baseline));
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect(await exported(page)).toEqual(baseline);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
});
