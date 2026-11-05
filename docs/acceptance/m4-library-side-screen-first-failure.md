# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library-tabs.spec.ts >> default library exposes both tabs without changing work; optical apparatus can be placed directly and domain replacement is cancellable
- Location: tests\e2e\library-tabs.spec.ts:10:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('scene-board').locator('[data-equipment-type="optical.convex-lens"]')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByTestId('scene-board').locator('[data-equipment-type="optical.convex-lens"]') with timeout 5000ms
  - waiting for getByTestId('scene-board').locator('[data-equipment-type="optical.convex-lens"]')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import type { Page } from '@playwright/test';
  3  | import { readFile } from 'node:fs/promises';
  4  | 
  5  | async function exported(page: Page) {
  6  |   const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  7  |   return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  8  | }
  9  | 
  10 | test('default library exposes both tabs without changing work; optical apparatus can be placed directly and domain replacement is cancellable', async ({ page }, testInfo) => {
  11 |   await page.setViewportSize({ width: 1366, height: 900 }); await page.goto('/');
  12 |   await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  13 |   const library = page.getByRole('region', { name: '器材库', exact: true }), board = page.getByTestId('scene-board');
  14 |   const before = await exported(page);
  15 |   await expect(library.getByRole('tab', { name: '电学', exact: true })).toHaveAttribute('aria-selected', 'true');
  16 |   await library.getByRole('tab', { name: '电学', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  17 |   await expect(library.getByRole('tab', { name: '光学', exact: true })).toBeFocused();
  18 |   await expect(library.locator('[data-library-type]')).toHaveCount(5);
  19 |   expect(await exported(page)).toEqual(before);
  20 |   await page.screenshot({ path: testInfo.outputPath('library-default-optical.png'), fullPage: true });
  21 |   await library.locator('[data-library-type="optical.convex-lens"]').click();
  22 |   await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
> 23 |   await expect(board.locator('[data-equipment-type="optical.convex-lens"]')).toHaveCount(1);
     |                                                                              ^ Error: expect(locator).toHaveCount(expected) failed
  24 |   const placed = await exported(page); expect(placed.documentId).toBe(before.documentId); expect(placed.revision).toBe(before.revision + 1);
  25 |   await library.getByRole('tab', { name: '电学', exact: true }).click();
  26 |   await expect(library.locator('[data-library-type="electrical.resistor"]')).toBeDisabled();
  27 |   expect(await exported(page)).toEqual(placed);
  28 |   await library.getByRole('button', { name: '新建电学实验', exact: true }).click();
  29 |   await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(placed);
  30 |   await library.getByRole('button', { name: '新建电学实验', exact: true }).click();
  31 |   await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  32 |   await expect(library.getByRole('tab', { name: '电学', exact: true })).toHaveAttribute('aria-selected', 'true');
  33 |   await library.locator('[data-library-type="electrical.resistor"]').click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  34 |   const electrical = await exported(page);
  35 |   await library.getByRole('tab', { name: '光学', exact: true }).click();
  36 |   await expect(library.locator('[data-library-type="optical.bench"]')).toBeDisabled();
  37 |   await library.getByRole('button', { name: '新建光学实验', exact: true }).click();
  38 |   await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(electrical);
  39 |   await page.screenshot({ path: testInfo.outputPath('library-optical-tab.png'), fullPage: true });
  40 | });
  41 | 
  42 | test.describe('touch library categories', () => {
  43 |   test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  44 |   test('touch switches categories, cancels pending placement and keeps the two libraries within the page', async ({ page }, testInfo) => {
  45 |     await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  46 |     const library = page.getByRole('region', { name: '器材库', exact: true });
  47 |     await library.getByRole('tab', { name: '光学', exact: true }).tap();
  48 |     await library.locator('[data-library-type="optical.screen"]').tap();
  49 |     await expect(library.getByRole('button', { name: '取消放置', exact: true })).toBeVisible();
  50 |     await library.getByRole('tab', { name: '电学', exact: true }).tap();
  51 |     await expect(library.getByRole('button', { name: '取消放置', exact: true })).toHaveCount(0);
  52 |     await expect(library.locator('[data-library-type]')).toHaveCount(8);
  53 |     await library.getByRole('tab', { name: '光学', exact: true }).tap();
  54 |     await expect(library.locator('[data-library-type]')).toHaveCount(5);
  55 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  56 |     await page.screenshot({ path: testInfo.outputPath('library-optical-touch.png'), fullPage: true });
  57 |   });
  58 | });
  59 | 
```