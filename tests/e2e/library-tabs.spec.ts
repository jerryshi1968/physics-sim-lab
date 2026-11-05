import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('default library exposes both tabs without changing work; optical apparatus can be placed directly and domain replacement is cancellable', async ({ page }, testInfo) => {
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 }); await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  const library = page.getByRole('region', { name: '器材库', exact: true }), board = page.getByTestId('scene-board');
  const before = await exported(page);
  await expect(library.getByRole('tab', { name: '电学', exact: true })).toHaveAttribute('aria-selected', 'true');
  await library.getByRole('tab', { name: '电学', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(library.getByRole('tab', { name: '光学', exact: true })).toBeFocused();
  await expect(library.locator('[data-library-type]')).toHaveCount(10);
  expect(await exported(page)).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('library-default-optical.png'), fullPage: true });
  await library.locator('[data-library-type="optical.convex-lens"]').click();
  await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await expect(board.locator('[data-equipment-type="optical.convex-lens"]')).toHaveCount(1);
  const placed = await exported(page); expect(placed.documentId).toBe(before.documentId); expect(placed.revision).toBe(before.revision + 1);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByLabel('图线类型', { exact: true })).toHaveValue('optical-distance');
  await library.getByRole('tab', { name: '电学', exact: true }).click();
  await expect(library.locator('[data-library-type="electrical.resistor"]')).toBeDisabled();
  expect(await exported(page)).toEqual(placed);
  await library.getByRole('button', { name: '新建电学实验', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(placed);
  await library.getByRole('button', { name: '新建电学实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(library.getByRole('tab', { name: '电学', exact: true })).toHaveAttribute('aria-selected', 'true');
  await library.locator('[data-library-type="electrical.resistor"]').click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  const electrical = await exported(page);
  await library.getByRole('tab', { name: '光学', exact: true }).click();
  await expect(library.locator('[data-library-type="optical.bench"]')).toBeDisabled();
  await library.getByRole('button', { name: '新建光学实验', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(electrical);
  await library.getByRole('button', { name: '新建光学实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(library.getByRole('tab', { name: '光学', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(board.locator('[data-equipment-id]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('library-optical-tab.png'), fullPage: true });
});

test.describe('touch library categories', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch switches categories, cancels pending placement and keeps the two libraries within the page', async ({ page }, testInfo) => {
    await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    const library = page.getByRole('region', { name: '器材库', exact: true });
    await library.getByRole('tab', { name: '光学', exact: true }).tap();
    await library.locator('[data-library-type="optical.screen"]').tap();
    await expect(library.getByRole('button', { name: '取消放置', exact: true })).toBeVisible();
    await library.getByRole('tab', { name: '电学', exact: true }).tap();
    await expect(library.getByRole('button', { name: '取消放置', exact: true })).toHaveCount(0);
    await expect(library.locator('[data-library-type]')).toHaveCount(8);
    await library.getByRole('tab', { name: '光学', exact: true }).tap();
    await expect(library.locator('[data-library-type]')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('library-optical-touch.png'), fullPage: true });
  });
});
