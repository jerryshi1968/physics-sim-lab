import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { CART, GATE, TICKER, TRACK } from '../../src/equipment/cart/definitions.ts';

async function open(page: Page, empty = false) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '加速度与力、质量实验', exact: true }).click();
  if (empty) await page.getByRole('radio', { name: '小车实验空白搭建' }).check();
  await page.getByRole('button', { name: '预览小车实验' }).click();
  await page.getByRole('button', { name: '确认替换当前实验' }).click();
}

async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('both instruments measure the cart, record data, plot and survive persistence', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page);
  const status = page.getByTestId('cart-status');
  const estimate = page.getByTestId('cart-estimate');
  const samples = page.getByRole('table', { name: '小车本次采样' });
  const sceneBoard = page.getByTestId('scene-board');
  await expect(page.locator(`[data-library-type="${GATE}"]`)).toBeEnabled();
  await expect(page.locator(`[data-library-type="${TICKER}"]`)).toBeDisabled();
  await expect(page.locator(`[data-library-type="${TICKER}"]`)).toHaveAttribute('title', /最多放置 1 件/);
  await expect(sceneBoard.locator(`[data-equipment-type="${GATE}"]`)).toHaveCount(2);
  await page.getByLabel('选择器材', { exact: true }).selectOption('gate-b');
  await page.getByLabel('位置 x（m）', { exact: true }).fill('0.39');
  await expect(page.getByTestId('cart-system')).toContainText('M = 0.5 kg · F = 0.5 N');
  await page.getByRole('button', { name: '释放小车', exact: true }).click();
  await page.getByRole('button', { name: '暂停小车', exact: true }).click();
  await expect(status).toContainText('已暂停');
  const paused = await status.textContent();
  await page.getByRole('button', { name: '单步采样', exact: true }).click();
  await expect(status).not.toHaveText(paused!);
  await page.getByRole('button', { name: '继续小车', exact: true }).click();
  await expect(status).toContainText('悬挂砝码到达下落限位', { timeout: 10_000 });
  const stoppedXM = Number(await sceneBoard.locator('[data-equipment-id="cart"]').getAttribute('data-x-m'));
  expect(stoppedXM).toBeCloseTo(.7, 6);
  await expect(samples.getByRole('row')).toHaveCount(3);
  await expect(estimate).toContainText('测得加速度');
  await page.getByRole('button', { name: '记录本组加速度', exact: true }).click();

  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await page.getByRole('button', { name: '查看打点纸带', exact: true }).click();
  await expect(page.getByLabel('测量方法', { exact: true })).toHaveValue('tape');
  await expect(page.getByRole('button', { name: '收起记录区', exact: true })).toBeVisible();
  const tape = page.getByRole('img', { name: '打点纸带' });
  await expect(tape).toBeInViewport();
  await expect(tape).toContainText('cm');
  const selectedDot = tape.locator('[data-cart-tape-selected]');
  const origin = await selectedDot.getAttribute('cx');
  await page.getByLabel('采样点', { exact: true }).selectOption('2');
  await expect(selectedDot).not.toHaveAttribute('cx', origin!);
  const scale = page.locator('.cart-tape-scale');
  const fullScale = await scale.textContent();
  const zoomIn = page.getByRole('button', { name: '放大纸带', exact: true });
  for (let step = 0; step < 4; step++) await zoomIn.click();
  await expect(page.locator('[aria-label="纸带放大倍数"]')).toHaveText('16×');
  await expect(zoomIn).toBeDisabled();
  await expect(scale).toContainText('每小格 1 mm');
  await expect(selectedDot).toBeVisible();
  const ticks = await tape.locator('[data-cart-tape-tick-mm]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-cart-tape-tick-mm'))));
  expect(ticks.length).toBeGreaterThan(2);
  expect(ticks[1]! - ticks[0]!).toBe(1);
  const slide = page.getByLabel('沿纸带移动', { exact: true });
  await slide.press('End');
  await expect(scale).toContainText('131.25–140 cm');
  await expect(selectedDot).toHaveCount(0);
  await page.getByRole('button', { name: '定位所选点', exact: true }).click();
  await expect(selectedDot).toBeVisible();
  await page.getByRole('button', { name: '最小化记录区', exact: true }).click();
  await expect(tape).toBeHidden();
  await page.getByRole('button', { name: '查看打点纸带', exact: true }).click();
  await expect(tape).toBeInViewport();
  await expect(zoomIn).toBeDisabled();
  await expect(page.getByLabel('采样点', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: '缩小纸带', exact: true }).click();
  await page.getByRole('button', { name: '查看全带', exact: true }).click();
  await expect(scale).toHaveText(fullScale!);
  await expect(samples.getByRole('row', { name: /纸带第 10 点/ })).toContainText('0.02');
  await page.getByRole('button', { name: '记录所选时间与位移', exact: true }).click();
  await page.getByRole('button', { name: '记录本组加速度', exact: true }).click();
  await expect(page.locator('[data-measurement-id]')).toHaveCount(16);

  await page.getByRole('tab', { name: '图线', exact: true }).click();
  for (const profile of ['cart-force', 'cart-mass', 'cart-time', 'cart-time2']) {
    await page.getByLabel('图线类型', { exact: true }).selectOption(profile);
    await expect(page.getByTestId('measurement-chart')).toBeVisible();
  }
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const csv = await download(page, '导出 CSV');
  expect(csv).toContain('测得加速度');
  expect(csv).toContain('遮光时长');
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(saved.experimentId).toBe('H-MECH-03');
  expect(saved.equipment.find(item => item.id === 'cart')?.pose.xM).toBe(-.7);
  expect(saved.measurementSnapshots).toHaveLength(3);
  const acceleration = saved.measurementRecords.filter(record => record.quantity === 'acceleration');
  expect(acceleration).toHaveLength(2);
  for (const record of acceleration) expect(record.value).toBeCloseTo(1, 2);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(status).toHaveText('待释放');
  await expect(page.locator('[data-measurement-id]')).toHaveCount(16);
  expect(JSON.parse(await download(page, '导出'))).toEqual(saved);
  await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'cart.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.getByRole('button', { name: '确认替换当前实验' }).click();
  await expect(status).toHaveText('待释放');
  await expect(page.locator('[data-measurement-id]')).toHaveCount(16);
  await page.screenshot({ path: info.outputPath('cart-bench.png'), fullPage: true });
});

test('blank setup accepts both instruments from the library and mass edits reset a run', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page, true);
  const board = page.getByTestId('scene-board');
  const release = page.getByRole('button', { name: '释放小车', exact: true });
  const status = page.getByTestId('cart-status');
  await expect(release).toBeDisabled();
  for (const type of [TRACK, CART, GATE, TICKER]) {
    await page.locator(`[data-library-type="${type}"]`).click();
    await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
    await expect(board.locator(`[data-equipment-type="${type}"]`)).toHaveCount(1);
    if (type === CART) await page.getByLabel('位置 x（m）', { exact: true }).fill('-.7');
    if (type === GATE) await page.getByLabel('位置 x（m）', { exact: true }).fill('-.5');
    if (type === TICKER) await page.getByLabel(/打点频率/).fill('60');
  }
  await release.click();
  await expect(status).toContainText('到达下落限位', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: '记录本组加速度' })).toBeDisabled();
  await page.getByLabel('测量方法', { exact: true }).selectOption('tape');
  await expect(page.getByTestId('cart-estimate')).toContainText('测得加速度');
  const cartId = (await board.locator(`[data-equipment-type="${CART}"]`).getAttribute('data-equipment-id'))!;
  await page.getByLabel('选择器材', { exact: true }).selectOption(cartId);
  await page.getByLabel('车上配重质量（kg）', { exact: true }).fill('0.6');
  await expect(status).toHaveText('待释放');
  await expect(page.getByTestId('cart-system')).toContainText('M = 1 kg · F = 0.5 N');
  await expect(page.getByRole('button', { name: '记录本组加速度' })).toBeDisabled();
  await release.click();
  await expect(status).toContainText('到达下落限位', { timeout: 10_000 });
  const result = await page.getByTestId('cart-estimate').textContent();
  expect(Number(result?.match(/测得加速度 ([\d.]+)/)?.[1])).toBeCloseTo(.5, 2);
});
