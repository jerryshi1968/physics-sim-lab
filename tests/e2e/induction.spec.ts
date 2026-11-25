import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import { createInductionExperiment } from '../../src/experiments/induction.ts';
import { simulateElectrical } from '../../src/equipment/electrical/simulate.ts';
import { buildInductionReading } from '../../src/equipment/induction/measure.ts';
import { appendMeasurements } from '../../src/core/measurements/records.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';

async function open(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).click(); await selectCatalogOption(page, 'induction');
  for (const name of ['进入实验', '确认替换当前实验']) await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('induction-panel')).toBeVisible();
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
const current = (page: Page) => page.getByTestId('induction-reading').locator('strong');
async function close(page: Page) { await page.getByRole('button', { name: '合上开关', exact: true }).click(); }

test('a genuine sensitive galvanometer gives signed deflection, moving snapshots, CSV and initial-state reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page); await page.clock.install();
  const board = page.getByTestId('scene-board'), dial = board.locator('[data-galvanometer="G"]');
  await expect(dial).toHaveAttribute('data-needle-fraction', '0.5');
  await expect(board.locator('[data-equipment-type="electrical.ammeter"]')).toHaveCount(0);
  await close(page); await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(200);
  await expect(current(page)).toHaveText('0.02 mA'); await expect(dial).toHaveAttribute('data-needle-fraction', '0.55');
  await board.getByRole('button', { name: '选择灵敏电流计 3', exact: true }).click();
  await expect(current(page)).toHaveText('0.02 mA');
  await page.getByLabel('观察：指针偏转', { exact: true }).selectOption('向右偏转');
  await page.getByLabel('灵敏电流计抄表（A，可留空）', { exact: true }).fill('.00002');
  await page.getByRole('button', { name: '保存磁生电观察', exact: true }).click();
  const saved = await exported(page); expect(saved.measurementRecords).toHaveLength(1);
  const snap = saved.measurementSnapshots[0]; expect(snap.equipment.find((i: { id: string }) => i.id === 'M').parameters.velocityXMPerS).toBe(.1);
  expect(snap.equipment.find((i: { id: string }) => i.id === 'M').pose.xM).not.toBe(snap.captureState.equipment.find((i: { id: string }) => i.id === 'M').pose.xM);
  await page.getByRole('button', { name: '停止移动', exact: true }).click(); await expect(current(page)).toHaveText('0 mA');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByLabel('移动对象', { exact: true }).selectOption('magnet');
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(200);
  await page.getByRole('button', { name: '停止移动', exact: true }).click();
  const magnetPosition = await board.locator('[data-equipment-id="B"]').getAttribute('data-x-m');
  expect(Number(magnetPosition)).toBeGreaterThan(-.22);
  await page.getByLabel('移动对象', { exact: true }).selectOption('wire');
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(2500); await page.clock.runFor(100);
  await expect(board.locator('[data-equipment-id="B"]')).toHaveAttribute('data-x-m', magnetPosition!);
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(2500); await page.clock.runFor(100);
  await expect(current(page)).toHaveText('-0.02 mA'); await expect(dial).toHaveAttribute('data-needle-fraction', '0.45');
  await page.getByRole('button', { name: '停止移动', exact: true }).click();
  await page.getByRole('button', { name: '对调磁极', exact: true }).click();
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(2500); await page.clock.runFor(100); await expect(current(page)).toHaveText('0.02 mA');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  const dl = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  expect(await readFile((await (await dl).path())!, 'utf8')).toContain('induction-motion');
  await board.screenshot({ path: info.outputPath('induction-board.png') });
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(100);
  await expect(current(page)).toHaveText('-0.02 mA');
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('dialog', { name: '已保存的实验', exact: true }).getByRole('button', { name: /^加载实验：/ }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); await expect(current(page)).toHaveText('0 mA');
  await page.reload(); await expect(current(page)).toHaveText('0 mA'); expect((await exported(page)).measurementSnapshots).toEqual(saved.measurementSnapshots);
});

test('stationary strong field, axial motion, open circuit, and a coil wholly inside the field have no current; coil exit does', async ({ page }) => {
  await open(page); await page.clock.install(); await close(page);
  await page.getByLabel('磁场强弱', { exact: true }).selectOption('0.2'); await expect(current(page)).toHaveText('0 mA');
  await page.getByRole('button', { name: '上下往复', exact: true }).click(); await page.clock.runFor(200); await expect(current(page)).toHaveText('0 mA');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByRole('button', { name: '打开开关', exact: true }).click(); await page.getByRole('button', { name: '左右往复', exact: true }).click();
  await page.clock.runFor(200); await expect(current(page)).toHaveText('0 mA');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click(); await close(page);
  await page.getByLabel('导体形式', { exact: true }).selectOption('coil');
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(200); await expect(current(page)).toHaveText('0 mA');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('M'); await page.getByLabel('位置 x（m）', { exact: true }).fill('.02');
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(100); await expect(current(page)).toHaveText('0.18 mA');
  await page.getByRole('button', { name: '停止移动', exact: true }).click();
  await page.getByLabel('选择导线', { exact: true }).selectOption('induction-wire-1'); await page.getByRole('button', { name: '拔开线头 B', exact: true }).click();
  await expect(page.getByTestId('induction-reading')).toHaveAttribute('data-status', 'disconnected');
});

test('dragging creates a transient deflection, holding still returns to zero, Escape cancels, and panning is not induction', async ({ page }) => {
  await open(page); await close(page); await page.clock.install();
  const before = await exported(page), board = page.getByTestId('scene-board');
  const rod = board.locator('[data-equipment-id="M"] .equipment-body'); const box = (await rod.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.clock.runFor(100); await page.mouse.move(x + 4, y); await page.clock.runFor(50); await page.mouse.move(x + 8, y);
  await expect.poll(async () => await current(page).textContent()).not.toBe('0 mA');
  await page.clock.runFor(200); await expect(current(page)).toHaveText('0 mA');
  await page.keyboard.press('Escape'); await page.mouse.up(); expect((await exported(page)).equipment).toEqual(before.equipment);
  await page.getByRole('button', { name: '平移', exact: true }).click(); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 25, { steps: 5 }); await page.mouse.up();
  await expect(current(page)).toHaveText('0 mA'); const after = await exported(page); expect(after.equipment).toEqual(before.equipment); expect(after.viewport).not.toEqual(before.viewport);
});

test('left-right and up-down reciprocation reverse at the limits and remain inside the fitted apparatus after 20 seconds', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page); await close(page); await page.clock.install();
  const board = page.getByTestId('scene-board'), rod = board.locator('[data-equipment-id="M"]');
  await expect(board.locator('[data-induction-perspective="horseshoe"]')).toBeVisible();
  await expect(board.locator('[data-induction-field]')).toHaveAttribute('data-induction-field', 'downward');
  await page.evaluate(() => {
    const rod = document.querySelector('[data-equipment-id="M"]')!;
    const audit = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    Object.assign(window, { inductionBoundsAudit: audit });
    new MutationObserver(() => {
      const x = Number(rod.getAttribute('data-x-m')), y = Number(rod.getAttribute('data-y-m'));
      audit.minX = Math.min(audit.minX, x); audit.maxX = Math.max(audit.maxX, x); audit.minY = Math.min(audit.minY, y); audit.maxY = Math.max(audit.maxY, y);
    }).observe(rod, { attributes: true, attributeFilter: ['data-x-m', 'data-y-m'] });
  });
  await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(2600); await expect(current(page)).toHaveText('-0.02 mA');
  await page.clock.runFor(4500); await expect(current(page)).toHaveText('0.02 mA');
  await page.clock.runFor(25_000); await expect(page.getByTestId('induction-motion')).toContainText('往复运动中');
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByRole('button', { name: '上下往复', exact: true }).click(); await page.clock.runFor(800);
  expect(Number(await rod.getAttribute('data-y-m'))).toBeGreaterThan(.03); await expect(current(page)).toHaveText('0 mA');
  await page.clock.runFor(25_000); await expect(current(page)).toHaveText('0 mA'); await expect(page.getByTestId('induction-motion')).toContainText('往复运动中');
  const audit = await page.evaluate(() => (window as unknown as { inductionBoundsAudit: { minX: number; maxX: number; minY: number; maxY: number } }).inductionBoundsAudit);
  expect(audit.minX).toBeGreaterThanOrEqual(-.45000001); expect(audit.maxX).toBeLessThanOrEqual(.01000001);
  expect(audit.minY).toBeGreaterThanOrEqual(-.02500001); expect(audit.maxY).toBeLessThanOrEqual(.08500001);
  await page.getByRole('button', { name: '恢复起点', exact: true }).click();
  await page.getByLabel('移动对象', { exact: true }).selectOption('magnet'); await page.getByRole('button', { name: '左右往复', exact: true }).click();
  await page.clock.runFor(2200); await page.getByRole('button', { name: '停止移动', exact: true }).click();
  await page.getByRole('button', { name: '复位视图', exact: true }).click();
  const frame = (await board.boundingBox())!, magnet = (await board.locator('[data-equipment-id="B"] .equipment-body').boundingBox())!;
  expect(magnet.x).toBeGreaterThanOrEqual(frame.x); expect(magnet.x + magnet.width).toBeLessThanOrEqual(frame.x + frame.width);
  for (const path of await board.locator('.wire-line').all()) {
    const bounds = (await path.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(frame.x); expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(bounds.y).toBeGreaterThanOrEqual(frame.y); expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame.y + frame.height);
  }
  await board.screenshot({ path: info.outputPath('perspective-reciprocal.png') });
});

test('10 and 50 turns give visibly different real galvanometer deflections with the same field and speed', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page); await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await close(page); await page.getByLabel('导体形式', { exact: true }).selectOption('coil');
  const fractions: number[] = [];
  for (const [turns, text, raw] of [['10', '-0.09 mA', '-.00009'], ['50', '-0.14 mA', '-.00014']]) {
    await page.getByRole('button', { name: '恢复起点', exact: true }).click();
    await page.getByLabel('线圈匝数', { exact: true }).selectOption(turns!);
    await page.getByRole('button', { name: '左右往复', exact: true }).click(); await page.clock.runFor(2150);
    await expect(current(page)).toHaveText(text!); await expect(page.getByTestId('induction-reading')).toHaveAttribute('data-status', 'valid');
    fractions.push(Number(await page.getByTestId('scene-board').locator('[data-galvanometer="G"]').getAttribute('data-needle-fraction')));
    await page.getByLabel('灵敏电流计抄表（A，可留空）', { exact: true }).fill(raw!);
    await page.getByLabel('观察：指针偏转', { exact: true }).selectOption('向左偏转');
    await page.getByRole('button', { name: '保存磁生电观察', exact: true }).click();
  }
  expect(fractions[0]).toBeCloseTo(.275, 6); expect(fractions[1]).toBeCloseTo(.15, 6);
  const s = await exported(page); expect(s.measurementRecords).toHaveLength(2);
  for (const [index, turns] of [10, 50].entries()) {
    const snapshot = s.measurementSnapshots[index]; expect(snapshot.equipment.find((i: { id: string }) => i.id === 'M').parameters.turns).toBe(turns);
    expect(snapshot.equipment.find((i: { id: string }) => i.id === 'G').parameters.resistanceOhm).toBe(100);
  }
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('coil-50-loaded.png') });
});

test('old default galvanometers upgrade on import and boot, retaining frozen records and explicit custom zero resistance', async ({ page }) => {
  const time = '2026-11-24T00:00:00.000Z', registry = createWorkbenchRegistry();
  const legacy = createInductionExperiment('legacy-galvanometer', time);
  legacy.equipment.find(i => i.id === 'G')!.parameters = { maximumA: .001, resolutionA: .00005, resistanceOhm: 0 };
  const built = buildInductionReading(legacy, legacy, simulateElectrical(legacy), { group: '旧观察', observation: '不偏转', current: '0', note: '旧默认设置' }, 'original', time);
  if (!built.ok) throw new Error(built.message);
  const archived = appendMeasurements(legacy, registry, built.records, built.snapshot, time);
  if (!archived.ok) throw new Error('Invalid legacy test fixture');
  await page.goto('/'); await page.getByLabel('导入实验 JSON').setInputFiles({ name: '旧默认电流计.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archived.document)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  const migrated = await exported(page), g = migrated.equipment.find((i: { id: string }) => i.id === 'G');
  expect(g.parameters).toMatchObject({ resistanceOhm: 100, maximumA: .0002, resolutionA: .00001, calibrationVersion: 1 });
  expect(migrated.measurementSnapshots).toEqual(archived.document.measurementSnapshots); expect(migrated.measurementRecords).toEqual(JSON.parse(JSON.stringify(archived.document.measurementRecords)));
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.evaluate(({ json, id, title, savedAt }) => new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open('cn-physics-lab', 2);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, tx = db.transaction(['documents', 'experiments'], 'readwrite');
      tx.objectStore('documents').put(json, 'latest'); tx.objectStore('experiments').put({ id, title, savedAt, json }, id);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { json: JSON.stringify(archived.document), id: archived.document.documentId, title: archived.document.title, savedAt: time });
  await page.reload();
  const rebooted = await exported(page);
  expect(rebooted.equipment.find((i: { id: string }) => i.id === 'G').parameters.resistanceOhm).toBe(100);
  expect(rebooted.measurementSnapshots).toEqual(archived.document.measurementSnapshots);
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByRole('dialog', { name: '已保存的实验', exact: true }).getByRole('button', { name: /^加载实验：/ }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  expect((await exported(page)).equipment.find((i: { id: string }) => i.id === 'G').parameters.resistanceOhm).toBe(100);
  await page.getByLabel('选择器材', { exact: true }).selectOption('G'); await page.getByLabel('灵敏电流计内阻（Ω）', { exact: true }).fill('0');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  expect((await exported(page)).equipment.find((i: { id: string }) => i.id === 'G').parameters.resistanceOhm).toBe(0);
});

test.describe('native touch induction', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('phone controls, signed dial, magnification, observations and restored apparatus work', async ({ page }, info) => {
    await open(page); await page.clock.install(); await close(page);
    await page.getByRole('button', { name: '左右往复', exact: true }).tap(); await page.clock.runFor(100); await expect(current(page)).toHaveText('0.02 mA');
    await page.getByRole('button', { name: '停止移动', exact: true }).tap();
    await page.getByRole('button', { name: '放大灵敏电流计', exact: true }).tap(); await page.getByTestId('scene-board').screenshot({ path: info.outputPath('phone-galvanometer.png') });
    await page.getByRole('button', { name: '查看整个装置', exact: true }).tap();
    const board = page.getByTestId('scene-board'), frame = (await board.boundingBox())!;
    for (const path of await board.locator('.wire-line').all()) {
      const bounds = (await path.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(frame.x); expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame.x + frame.width);
    }
    await page.getByRole('button', { name: '保存磁生电观察', exact: true }).tap(); expect((await exported(page)).measurementRecords[0].value).toBe(null);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('选择器材', { exact: true }).selectOption('M'); await page.getByRole('button', { name: '删除器材', exact: true }).tap();
    const library = page.locator('[data-library-type="electrical.metal-wire"]'); await expect(library).toBeEnabled(); await library.tap(); await page.getByRole('button', { name: '在视口中心放置', exact: true }).tap();
    await expect(page.getByTestId('scene-board').locator('[data-induction-conductor="rod"]')).toHaveCount(1);
  });
});
