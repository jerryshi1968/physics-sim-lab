import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function download(page: Page, name = '导出') {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click(); return readFile((await (await pending).path())!, 'utf8');
}
const exported = async (page: Page): Promise<SceneDocument> => JSON.parse(await download(page)) as SceneDocument;
const status = (page: Page) => page.getByTestId('friction-status');
async function open(page: Page, empty = false) {
  page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '滑动摩擦实验'); if (empty) await page.getByRole('radio', { name: '空白搭建滑动摩擦实验', exact: true }).check();
  await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function properties(page: Page, id: string, fields: Record<string, string>) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  for (const [name, value] of Object.entries(fields)) await page.getByLabel(name, { exact: true }).fill(value);
  
}
async function steady(page: Page, reading: string) {
  await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect(status(page)).toHaveText('滑动稳态：可比较摩擦力'); await expect(page.getByTestId('friction-reading')).toContainText(`测力计：${reading} N`); await page.getByRole('button', { name: '暂停牵引', exact: true }).click();
}

test('four controlled comparisons and transient data form traceable F-N, CSV, JSON and saved experiments without storing dynamic poses', async ({ page }, info) => {
  test.setTimeout(120_000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  await expect(page.getByRole('button', { name: '确认空载调平', exact: true })).toHaveCount(0); await expect(page.locator('[data-friction-link]')).toHaveCount(1);
  await expect(page.getByTestId('friction-reading')).toContainText('尚未开始');
  for (const text of await page.getByTestId('scene-board').locator('[data-friction-type] text').all()) expect(await text.evaluate(element => getComputedStyle(element).stroke)).toBe('none');
  const initial = await exported(page); await page.getByRole('button', { name: '展开记录区', exact: true }).click(); await page.getByLabel('摩擦记录来源').selectOption('instrument');
  await page.getByRole('button', { name: '单步牵引', exact: true }).click(); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click();
  let document = await exported(page); expect(document.measurementRecords[1]!.measurementStatus).toBe('non-steady'); expect(document.measurementRecords[2]!.value).toBeNull();
  await steady(page, '1'); await page.screenshot({ path: info.outputPath('friction-running.png'), fullPage: true }); const firstPose = await page.getByTestId('scene-board').locator('[data-equipment-id="block"]').getAttribute('data-x-m'); expect(Number(firstPose)).toBeGreaterThan(-.6);
  await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click(); document = await exported(page); expect(document.equipment).toEqual(initial.equipment); expect(document.measurementRecords.slice(-3).map(row => row.value)).toEqual([5, 1, 1]);
  await page.getByLabel('选择器材', { exact: true }).selectOption('load'); await page.getByLabel('砝码承载木块').selectOption('block');  await expect(page.getByTestId('friction-time')).toHaveText('0.00');
  await steady(page, '2'); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click(); document = await exported(page); expect(document.measurementRecords.slice(-3).map(row => row.value)).toEqual([10, 2, 2]);
  await page.getByLabel('砝码承载木块').selectOption('');  await page.getByLabel('摩擦材料对').selectOption('cloth'); await steady(page, '2'); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click();
  await page.getByLabel('摩擦材料对').selectOption('board'); await properties(page, 'block', { '接触面积（m²）': '.004' }); await steady(page, '1'); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click();
  document = await exported(page); expect(document.measurementRecords).toHaveLength(15); expect(document.measurementSnapshots).toHaveLength(5);
  expect(document.measurementRecords.slice(-3).map(row => row.value)).toEqual([5, 1, 1]); const last = JSON.parse(document.measurementSnapshots!.at(-1)!.note) as { areaM2: number; massKg: number; steady: boolean }; expect(last).toMatchObject({ areaM2: .004, massKg: .5, steady: true });
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(4); await page.getByRole('tab', { name: '记录表', exact: true }).click(); const csv = await download(page, '导出 CSV'); expect(csv).toContain('非稳态'); expect(csv).toContain('areaM2'); expect(csv).toContain('滑动摩擦力');
  const beforeReset = await exported(page); await page.getByRole('button', { name: '重置牵引', exact: true }).click(); expect(await exported(page)).toEqual(beforeReset); await expect(page.getByTestId('friction-time')).toHaveText('0.00');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); expect(await exported(page)).toEqual(beforeReset); await expect(page.getByTestId('friction-time')).toHaveText('0.00');
  const backup = await download(page); await page.getByRole('button', { name: '新建实验', exact: true }).click(); await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'friction.json', mimeType: 'application/json', buffer: Buffer.from(backup) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); expect(await exported(page)).toEqual(beforeReset);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); expect(errors).toEqual([]); await page.screenshot({ path: info.outputPath('friction-comparisons.png'), fullPage: true });
});

test('controlled pull matches static demand, breaks threshold, stops at zero and reverses without resetting runtime; invalid models and over-range are explicit', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  await page.getByLabel('摩擦材料对').selectOption('custom'); await properties(page, 'surface', { '静摩擦系数': '.5' }); await page.getByLabel('牵引方式').selectOption('force'); await page.getByLabel('牵引控制拉力').fill('2.5');
  await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect(status(page)).toContainText('静止'); await expect.poll(async () => Number(await page.getByTestId('friction-time').textContent())).toBeGreaterThan(.1); await expect(page.getByTestId('friction-velocity')).toContainText('速度 0 m/s');
  const t = Number(await page.getByTestId('friction-time').textContent()); await page.getByLabel('牵引控制拉力').fill('2.6'); await expect(status(page)).toContainText('非稳态'); await expect.poll(async () => Number((await page.getByTestId('friction-velocity').textContent())!.match(/速度 ([^ ]+)/)![1])).toBeGreaterThan(.05);
  expect(Number(await page.getByTestId('friction-time').textContent())).toBeGreaterThanOrEqual(t);
  await page.getByLabel('牵引控制拉力').fill('0'); await expect(status(page)).toContainText('静止'); await expect(page.getByTestId('friction-velocity')).toContainText('速度 0 m/s');
  await page.getByLabel('牵引控制拉力').fill('-2.6'); await expect.poll(async () => Number((await page.getByTestId('friction-velocity').textContent())!.match(/速度 ([^ ]+)/)![1])).toBeLessThan(-.02); await page.getByRole('button', { name: '暂停牵引', exact: true }).click();
  await page.getByLabel('牵引控制拉力').fill('6'); await expect(page.getByTestId('friction-reading')).toContainText('超量程'); await expect(page.getByTestId('scene-board').locator('[data-equipment-id="friction-meter"] [data-force-meter-pointer]')).toHaveAttribute('data-pointer-fraction', '1');
  await page.getByLabel('摩擦记录来源').selectOption('instrument'); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).click(); expect((await exported(page)).measurementRecords[1]!.measurementStatus).toBe('over-range');
  await properties(page, 'friction-meter', { '拉力方向（右为0，上为90）（°）': '-30' }); await expect(status(page)).toContainText('水平拉力'); await expect(page.getByRole('button', { name: '开始牵引', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: '保存摩擦记录', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('friction-invalid-angle.png'), fullPage: true });
});

test('blank apparatus assembles horizontally, drag-loads a weight, cancels and undoes as one command and keeps initial-state positioning honest', async ({ page }) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 }); await open(page, true);
  const library = page.getByRole('region', { name: '器材库', exact: true });
  for (const type of ['mechanical.friction-surface', 'mechanical.friction-block', 'mechanical.friction-drive', 'mechanical.force-meter', 'mechanical.friction-load']) { await library.locator(`[data-library-type="${type}"]`).click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click(); }
  const source = await exported(page), id = (type: string) => source.equipment.find(item => item.type === type)!.id;
  const block = id('mechanical.friction-block'), surface = id('mechanical.friction-surface'), meter = id('mechanical.force-meter'), drive = id('mechanical.friction-drive'), load = id('mechanical.friction-load');
  await page.getByLabel('选择器材', { exact: true }).selectOption(block); await page.getByLabel('木块接触面').selectOption(surface); await page.getByLabel('木块牵引器').selectOption(drive); await page.getByLabel('木块测力计').selectOption(meter);  await page.getByRole('button', { name: '放到接触面上', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始牵引', exact: true })).toBeEnabled(); await properties(page, load, { '位置 x（m）': '.4', '位置 y（m）': '.3' });
  const board = page.getByTestId('scene-board'), metal = board.locator(`[data-equipment-id="${load}"] [data-friction-type] rect`), wood = board.locator(`[data-equipment-id="${block}"] [data-friction-type] rect`);
  const from = (await metal.boundingBox())!, to = (await wood.boundingBox())!, before = await exported(page);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y, { steps: 5 }); await page.keyboard.press('Escape'); await page.mouse.up(); expect(await exported(page)).toEqual(before);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y, { steps: 5 }); await page.mouse.up();
  const loaded = await exported(page); expect(loaded.equipment.find(item => item.id === load)!.parameters.blockId).toBe(block); expect(loaded.revision).toBe(before.revision + 1); await steady(page, '2');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); expect((await exported(page)).equipment.find(item => item.id === load)!.parameters.blockId).toBe(''); await steady(page, '1');
  await page.getByLabel('选择器材', { exact: true }).selectOption(block); await page.getByLabel('木块牵引器').selectOption(''); 
  await page.getByLabel('选择器材', { exact: true }).selectOption(drive); await page.getByRole('button', { name: '删除器材', exact: true }).click(); await expect(page.getByLabel('牵引方式')).toHaveValue('force');
  await page.getByLabel('牵引控制拉力').fill('2.6'); await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect.poll(async () => Number((await page.getByTestId('friction-velocity').textContent())!.match(/速度 ([^ ]+)/)![1])).toBeGreaterThan(.05);
  await page.getByLabel('牵引控制拉力').fill('1'); await expect(status(page)).toHaveText('滑动稳态：可比较摩擦力'); await expect(page.getByTestId('friction-reading')).toContainText('测力计：1 N'); await page.getByRole('button', { name: '暂停牵引', exact: true }).click();
});

test.describe('touch friction experiment', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch enters the mechanical experiment, reaches steady state, reads and records without overflow or accidental state changes on cancel', async ({ page }, info) => {
    await open(page); await steady(page, '1'); await page.getByLabel('摩擦记录来源').selectOption('manual'); await page.getByLabel('摩擦压力抄表').fill('5'); await page.getByLabel('摩擦牵引力抄表').fill('1'); await page.getByLabel('摩擦力抄表').fill('1'); await page.getByRole('button', { name: '保存摩擦记录', exact: true }).tap();
    const before = await exported(page); expect(before.measurementRecords.map(row => row.value)).toEqual([5, 1, 1]); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
    const body = (await page.getByTestId('scene-board').locator('[data-equipment-id="block"] [data-friction-type] rect').boundingBox())!, x = body.x + body.width / 2, y = body.y + body.height / 2, session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 20, y: y - 20, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); expect(await exported(page)).toEqual(before);
    const captions = await page.getByTestId('scene-board').locator('[data-friction-caption]').all();
    for (let i = 0; i < captions.length; i++) for (let j = i + 1; j < captions.length; j++) {
      const a = (await captions[i]!.boundingBox())!, b = (await captions[j]!.boundingBox())!;
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('friction-touch.png'), fullPage: true });
  });
});
