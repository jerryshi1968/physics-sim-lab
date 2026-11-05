import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { BENCH, CANDLE, LENS, SCREEN, RULER } from '../../src/equipment/optical/definitions.ts';

async function ready(page: Page, empty = false) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '凸透镜成像实验', exact: true }).click();
  if (empty) await page.getByRole('radio', { name: '光学空白搭建', exact: true }).check();
  await page.getByRole('button', { name: '预览光学实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function properties(page: Page, id: string, values: Record<string, string>) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  for (const [name, value] of Object.entries(values)) await page.getByLabel(name, { exact: true }).fill(value);
  
}
async function download(page: Page, name = '导出') {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}
async function exported(page: Page): Promise<SceneDocument> { return JSON.parse(await download(page)) as SceneDocument; }
async function aligned(page: Page) { await properties(page, 'lens', { '光心或基准高度（m）': '.06' }); }
const projection = (page: Page) => page.getByRole('img', { name: '光屏正视图', exact: true });
const status = (page: Page) => page.getByTestId('optical-status');

test('five object distances use real screen rays; preview/undo preserves apparatus and auxiliary virtual observer never becomes a screen image', async ({ page }, testInfo) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => { const original = window.Worker; (window as Window & { opticalWorkerCount?: number }).opticalWorkerCount = 0;
    window.Worker = class extends original { constructor(url: string | URL, options?: WorkerOptions) { super(url, options); const counter = window as Window & { opticalWorkerCount?: number }; counter.opticalWorkerCount = (counter.opticalWorkerCount ?? 0) + 1; } }; });
  await ready(page); await expect(page.locator('[data-library-type]')).toHaveCount(10); await expect(page.locator('[data-library-type="electrical.wire"]')).toHaveCount(0);
  await expect(status(page)).toContainText('离焦'); await expect(page.locator('[data-optical-rays]')).toHaveCount(0);
  await aligned(page); await properties(page, 'screen', { '位置 x（m）': '.65' }); await expect(status(page)).toContainText('清晰实像');
  await expect(page.getByTestId('scene-board').locator('[data-equipment-id="screen"] [data-screen-side-view]')).toHaveAttribute('transform', 'matrix(.36 -.14 0 1 0 0)');
  await expect(page.getByTestId('scene-board').locator('[data-screen-projection]')).toHaveCount(0);
  await expect(projection(page).locator('[data-screen-real-image]')).toHaveCount(1);
  const before = await exported(page), board = page.getByTestId('scene-board');
  const face = board.locator('[data-equipment-id="screen"] [data-screen-face]');
  const box = (await face.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y, { steps: 6 });
  await expect(status(page)).toContainText('离焦'); await expect(board).toHaveAttribute('data-revision', String(before.revision));
  await expect(page.getByRole('button', { name: '保存读尺与观察', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(status(page)).toContainText('清晰实像'); expect(await exported(page)).toEqual(before);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y, { steps: 6 }); await page.mouse.up();
  await expect(board).toHaveAttribute('data-revision', String(before.revision + 1));
  const moved = await exported(page); expect(moved.equipment.find(item => item.id === 'screen')!.pose.xM).toBeCloseTo(.75, 7);
  expect(moved.equipment.filter(item => item.id !== 'screen')).toEqual(before.equipment.filter(item => item.id !== 'screen'));
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(status(page)).toContainText('清晰实像');
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(status(page)).toContainText('离焦');
  for (const [candleX, screenX] of [['.3', '.7'], ['.35', '.8']]) {
    await properties(page, 'candle', { '位置 x（m）': candleX! }); await properties(page, 'screen', { '位置 x（m）': screenX! }); await expect(status(page)).toContainText('清晰实像');
  }
  await properties(page, 'candle', { '位置 x（m）': '.4' }); await page.getByLabel('显示辅助光线与理论（可关闭）', { exact: true }).check();
  await expect(page.getByTestId('optical-theory')).toContainText('无有限像'); await expect(projection(page).locator('[data-screen-real-image]')).toHaveCount(0);
  await properties(page, 'candle', { '位置 x（m）': '.45' }); await expect(page.locator('[data-virtual-observer]')).toBeVisible();
  await expect(page.locator('[data-virtual-ray]')).not.toHaveCount(0); await expect(projection(page).locator('[data-screen-real-image]')).toHaveCount(0);
  const virtual = await exported(page); await page.getByLabel('显示辅助光线与理论（可关闭）', { exact: true }).uncheck();
  await expect(page.locator('[data-virtual-observer]')).toHaveCount(0); expect(await exported(page)).toEqual(virtual);
  expect(await page.evaluate(() => (window as Window & { opticalWorkerCount?: number }).opticalWorkerCount)).toBe(0);
  await page.getByLabel('显示辅助光线与理论（可关闭）', { exact: true }).check();
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('optical-virtual-observer.png'), fullPage: true });
});

test('five classes of manual ruler observations, independent ruler zero, frozen snapshots, chart, CSV, save and JSON reload form one optical experiment', async ({ page }, testInfo) => {
  test.setTimeout(120_000); await page.setViewportSize({ width: 1920, height: 1080 }); await ready(page); await aligned(page);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  const cases = [
    ['.2', '.65', ['.101', '.401', '.552'], '实像', '倒立', '缩小', '清晰'],
    ['.3', '.7', ['.2', '.4', '.6'], '实像', '倒立', '等大', '清晰'],
    ['.35', '.8', ['.25', '.4', '.7'], '实像', '倒立', '放大', '清晰'],
    ['.4', '.8', ['.3', '.4', '.7'], '无有限像', '未判定', '未判定', '未见像'],
    ['.45', '.8', ['.35', '.4', '.7'], '虚像', '正立', '放大', '未见像'],
  ] as const;
  let first: SceneDocument | null = null;
  for (const [index, [cx, sx, readings, nature, orientation, size, clarity]] of cases.entries()) {
    await properties(page, 'candle', { '位置 x（m）': cx }); await properties(page, 'screen', { '位置 x（m）': sx });
    for (const [slot, label] of ['蜡烛位置读数（m）', '透镜位置读数（m）', '光屏位置读数（m）'].entries()) await page.getByLabel(label, { exact: true }).fill(readings[slot]!);
    await page.getByLabel('实测像距 v（m）', { exact: true }).fill(['.151', '.2', '.3', '', ''][index]!);
    await page.getByLabel('组别', { exact: true }).fill(`五类物距第${index + 1}组`);
    for (const [label, value] of [['观察：虚实', nature], ['观察：正倒', orientation], ['观察：大小', size], ['观察：清晰度', clarity]]) await page.getByLabel(label!, { exact: true }).selectOption(value!);
    await page.getByLabel('观察备注', { exact: true }).fill('手工读尺，自己判断像的特点');
    await page.getByRole('button', { name: '保存读尺与观察', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount((index + 1) * 6);
    if (index === 0) first = await exported(page);
  }
  const recorded = await exported(page); expect(recorded.measurementRecords.slice(0, 6)).toEqual(first!.measurementRecords);
  expect(recorded.measurementSnapshots).toHaveLength(5); expect(JSON.parse(recorded.measurementSnapshots![4]!.note).observations.nature).toBe('虚像');
  expect(recorded.measurementRecords[4]!.value).toBeCloseTo(.151, 9); expect(recorded.measurementRecords[4]!.context!.physicalValue).toBeCloseTo(.15, 9);
  const sharpness = await projection(page).getAttribute('data-sharpness'); await properties(page, 'ruler', { '位置 x（m）': '.15' });
  await expect(projection(page)).toHaveAttribute('data-sharpness', sharpness!); await expect(page.getByLabel('蜡烛位置读数（m）', { exact: true })).toHaveValue('.35');
  expect((await exported(page)).measurementSnapshots).toEqual(recorded.measurementSnapshots);
  const csv = await download(page, '导出 CSV'); expect(csv).toContain('物距u'); expect(csv).toContain('屏距s'); expect(csv).toContain('手工读尺'); expect(csv).not.toMatch(/NaN|Infinity/);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(5);
  await page.getByLabel('图线类型', { exact: true }).selectOption('optical-image'); await expect(page.locator('[data-record-id]')).toHaveCount(3);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  const restored = await exported(page); expect(restored.measurementRecords).toEqual(recorded.measurementRecords); expect(restored.measurementSnapshots).toEqual(recorded.measurementSnapshots);
  const backup = await download(page); await page.getByRole('button', { name: '新建实验', exact: true }).click();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '五类成像.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); expect((await exported(page)).measurementRecords).toEqual(recorded.measurementRecords);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('optical-five-cases-chart.png'), fullPage: true });
});

test('native blank optical assembly keeps independent heights, rejects invalid lens values and clears projection for missed or invalid geometry', async ({ page }, testInfo) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 }); await ready(page, true);
  await expect(page.getByTestId('scene-board').locator('[data-equipment-id]')).toHaveCount(0);
  const ids: Record<string, string> = {};
  for (const [type, key, xM, yM] of [[BENCH, 'bench', 0, 0], [CANDLE, 'candle', .2, .06], [LENS, 'lens', .5, .06], [SCREEN, 'screen', .65, .06], [RULER, 'ruler', .1, -.045]] as const) {
    await page.locator(`[data-library-type="${type}"]`).click(); const board = page.getByTestId('scene-board'), bounds = (await board.boundingBox())!;
    await board.click({ position: { x: bounds.width / 2 + (xM - .55) * 600, y: bounds.height / 2 - (yM - .03) * 600 } });
    ids[key] = (await board.locator(`[data-equipment-type="${type}"]`).last().getAttribute('data-equipment-id'))!;
  }
  await expect(status(page)).toContainText('清晰实像'); const before = await exported(page); expect(before.connections).toEqual([]);
  await properties(page, ids.lens!, { '焦距（m）': '0' }); await expect(page.getByLabel('焦距（m）', { exact: true })).toHaveAttribute('aria-invalid', 'true'); await expect(page.locator('.live-properties').getByRole('status')).toContainText('输入未应用'); expect(await exported(page)).toEqual(before);
  await properties(page, ids.screen!, { '光心或基准高度（m）': '.2' }); await expect(status(page)).toContainText('未落入光屏'); await expect(projection(page)).toHaveAttribute('data-captured-fraction', '0');
  await properties(page, ids.screen!, { '光心或基准高度（m）': '.06', '位置 x（m）': '.4' }); await expect(status(page)).toContainText('透镜左侧');
  await properties(page, ids.candle!, { '位置 x（m）': '.5' }); await expect(status(page)).toContainText('不能重合'); await expect(projection(page)).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await properties(page, ids.screen!, { '位置 x（m）': '1.3' }); await expect(status(page)).toContainText('超出光具座');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await properties(page, ids.screen!, { '位置 x（m）': '.65' });
  await expect(status(page)).toContainText('清晰实像');
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: testInfo.outputPath('optical-blank-focused.png'), fullPage: true });
});

test.describe('touch optical bench', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch moves the screen to focus once and pointer cancellation restores it without horizontal page overflow', async ({ page }, testInfo) => {
    test.setTimeout(60_000); await ready(page); await aligned(page);
    const face = page.getByTestId('scene-board').locator('[data-equipment-id="screen"] [data-screen-face]');
    await face.scrollIntoViewIfNeeded(); const box = (await face.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 19.2, y, id: 1 }] });
    await expect(status(page)).toContainText('清晰实像'); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const focused = await exported(page); expect(focused.equipment.find(item => item.id === 'screen')!.pose.xM).toBeCloseTo(.65, 6);
    await face.scrollIntoViewIfNeeded(); const next = (await face.boundingBox())!, nx = next.x + next.width / 2, ny = next.y + next.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nx, y: ny, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: nx + 24, y: ny, id: 2 }] });
    await expect(status(page)).toContainText('离焦'); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(status(page)).toContainText('清晰实像'); expect(await exported(page)).toEqual(focused);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('optical-touch-focused.png'), fullPage: true }); await session.detach();
  });
});
