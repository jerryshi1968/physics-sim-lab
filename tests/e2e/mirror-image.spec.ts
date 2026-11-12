import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openMirror(page: Page, empty = false) {
  await page.goto('/');
  await openFamily(page, '平面镜成像实验');
  if (empty) await page.getByRole('radio', { name: '空白搭建光学实验' }).check();
  await page.getByRole('button', { name: '进入实验' }).click();
  await page.getByRole('button', { name: '确认替换当前实验' }).click();
}

async function moveTo(page: Page, id: string, x: string, y: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  await page.getByLabel('位置 x（m）', { exact: true }).fill(x);
  await page.getByLabel('位置 y（m）', { exact: true }).fill(y);
}

test('uses the eye, comparison, rulers and screen to observe and save the plane-mirror experiment', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await openMirror(page);
  const board = page.getByTestId('scene-board');
  const image = page.getByTestId('mirror-virtual-view'), match = page.getByTestId('mirror-match-view');
  const eye = board.locator('[data-equipment-id="image-eye"]');
  await expect(image).toBeVisible();
  await expect(match).toBeVisible();
  const initialMatch = (await match.getAttribute('transform'))!;
  await expect(image).not.toHaveAttribute('transform', initialMatch);
  await page.getByRole('button', { name: '抬高观察眼' }).click();
  await expect(match).not.toHaveAttribute('transform', initialMatch);
  await page.getByRole('button', { name: '降低观察眼' }).click();
  await expect(page.getByTestId('mirror-image-rays')).toHaveCount(0);
  await page.getByLabel('显示反射光路与虚像').check();
  await expect(page.getByTestId('mirror-image-rays').locator('path[stroke-dasharray]')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('mirror-image-workbench.png'), fullPage: true });
  await page.getByLabel('显示反射光路与虚像').uncheck();

  const matchObject = board.locator('[data-equipment-id="image-match"] [data-mirror-image-equipment]');
  const box = (await matchObject.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 48, y + 16, { steps: 6 });
  await page.mouse.up();
  await expect(board.locator('[data-equipment-id="image-match"]')).not.toHaveAttribute('data-x-m', '0.31');
  await moveTo(page, 'image-match', '0.22', '0.08');
  const samePosition = (await image.getAttribute('transform'))!;
  await expect(match).toHaveAttribute('transform', samePosition);
  await page.getByRole('button', { name: '抬高观察眼' }).click();
  await expect(eye).toHaveAttribute('data-y-m', '0.24');
  await expect(match).toHaveAttribute('transform', (await image.getAttribute('transform'))!);

  await moveTo(page, 'image-screen', '0.22', '0.08');
  await page.getByRole('button', { name: '用光屏验证' }).click();
  await expect(page.getByRole('img', { name: '光屏正面，无清晰成像' })).toBeVisible();
  await expect(image).toHaveCount(0);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  for (const label of ['蜡烛位置读数（m）', '透镜位置读数（m）', '光屏位置读数（m）']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  for (const [label, value] of [['物到镜面的距离', '22'], ['像到镜面的距离', '22.1'], ['物高', '12'], ['像高', '12']] as const) {
    const field = page.getByLabel(`${label}（cm）`, { exact: true });
    await expect(field).toHaveValue('');
    await field.fill(value);
  }
  await page.getByLabel('光屏观察结果').selectOption('0');
  await page.getByRole('button', { name: '保存平面镜记录' }).click();
  await expect(page.locator('[data-measurement-id]')).toHaveCount(5);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await page.getByLabel('图线类型', { exact: true }).selectOption('mirror-height');
  await expect(page.getByTestId('measurement-chart')).toBeVisible();
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  const csv = await readFile((await (await download).path())!, 'utf8');
  expect(csv).toContain('22.1');
  expect(csv).toContain('未接到清晰的像');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByRole('heading', { name: '平面镜成像实验', exact: true })).toBeVisible();
  await expect(page.locator('[data-measurement-id]')).toHaveCount(5);
});

test('the eye view magnifies nearby images and clips at the physical mirror edge', async ({ page }) => {
  await openMirror(page);
  const sight = page.getByRole('img', { name: '从观察眼透过玻璃板所见' });
  const image = sight.getByTestId('mirror-virtual-view').locator('path');
  const height = () => image.evaluate(node => (node as SVGGraphicsElement).getBBox().height);
  const initial = await height();
  expect(initial).toBeGreaterThan(60);

  await moveTo(page, 'image-eye', '-0.20', '0.19');
  expect((await height()) / initial).toBeCloseTo(.61 / .42, 4);
  await moveTo(page, 'image-eye', '-0.75', '0.19');
  expect((await height()) / initial).toBeCloseTo(.61 / .97, 4);

  await moveTo(page, 'image-eye', '-0.39', '0.55');
  await expect(page.getByTestId('mirror-image-status')).toContainText('只看到部分像');
  const clip = sight.locator('clipPath rect');
  expect(Number(await clip.getAttribute('y'))).toBeGreaterThan(8);
  await moveTo(page, 'image-eye', '-0.39', '0.8');
  await expect(image).toHaveCount(0);
});

test.describe('narrow touch layout', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('offers blank assembly, physical optics icons and touch operation', async ({ page }) => {
    await openMirror(page, true);
    const board = page.getByTestId('scene-board');
    await expect(board.locator('[data-equipment-id]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '光学自由搭建', exact: true })).toBeVisible();
    for (const type of ['plane-mirror', 'mirror-target', 'observation-eye']) {
      const item = page.locator(`[data-library-type="optical.${type}"]`);
      await item.tap();
      await page.getByRole('button', { name: '在视口中心放置' }).tap();
      await expect(board.locator(`[data-equipment-type="optical.${type}"]`)).toHaveCount(1);
    }
    await expect(page.getByTestId('mirror-image-status')).toContainText('玻璃板左侧');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
