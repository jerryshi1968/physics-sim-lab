import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { readFile } from 'node:fs/promises';
async function setup(page: Page) {
  page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '杠杆平衡实验'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).click();
  await page.getByRole('button', { name: '确认空载调平', exact: true }).click();
  for (const [id, hook] of [['left', '-4'], ['right', '2']]) {
    await page.getByLabel('选择器材', { exact: true }).selectOption(id!); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await page.getByLabel('挂点编号', { exact: true }).selectOption(hook!); 
  }
}
async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
async function ends(page: Page) {
  const board = page.getByTestId('scene-board'), left = (await board.locator('[data-equipment-id="lever"] [data-lever-hook="-6"] circle').boundingBox())!, right = (await board.locator('[data-equipment-id="lever"] [data-lever-hook="6"] circle').boundingBox())!;
  return { leftY: left.y, rightY: right.y };
}
test('a left-heavy lever visibly lowers the left end, reverses with load and returns level at balance without changing stored poses', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await setup(page); const banner = page.getByTestId('lever-trend-banner');
  await expect(banner).toContainText('左端下沉'); let position = await ends(page); expect(position.leftY - position.rightY).toBeGreaterThan(50);
  await page.screenshot({ path: info.outputPath('lever-left-sinking.png'), fullPage: true });
  const initial = await exported(page); expect(initial.equipment.find(item => item.id === 'lever')!.pose.rotationRad).toBeCloseTo(0, 9);
  await page.getByLabel('选择器材', { exact: true }).selectOption('right'); await page.getByLabel('钩码总质量（kg）', { exact: true }).fill('.2'); 
  await expect(banner).toHaveCount(0); position = await ends(page); expect(Math.abs(position.leftY - position.rightY)).toBeLessThan(.01); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  await page.getByLabel('钩码总质量（kg）', { exact: true }).fill('.3'); 
  await expect(banner).toContainText('右端下沉'); position = await ends(page); expect(position.rightY - position.leftY).toBeGreaterThan(50);
  const beforeAuxiliary = await exported(page); await page.getByLabel('显示力、作用线与理论（可关闭）', { exact: true }).check(); expect(await exported(page)).toEqual(beforeAuxiliary); await expect(page.locator('[data-lever-initial-axis]')).toHaveCount(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(banner).toHaveCount(0); await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(banner).toContainText('右端下沉');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(banner).toContainText('右端下沉'); expect((await exported(page)).equipment).toEqual(beforeAuxiliary.equipment);
  const board = page.getByTestId('scene-board'), load = (await board.locator('[data-equipment-id="right"] [data-mechanical-type="mechanical.weights"]').boundingBox())!;
  await page.mouse.move(load.x + load.width / 2, load.y + 3); await page.mouse.down(); await expect(board.locator('[data-equipment-id="right"] .equipment-body')).toHaveAttribute('data-selected', 'true'); await page.mouse.move(load.x + load.width / 2 + 15, load.y + 15, { steps: 3 });
  const outer = (await board.locator('[data-equipment-id="lever"] [data-lever-hook="6"] circle').boundingBox())!;
  await page.mouse.move(outer.x + outer.width / 2, outer.y + outer.height / 2, { steps: 5 }); await page.mouse.up();
  expect((await exported(page)).equipment.find(item => item.id === 'right')!.parameters.hookIndex).toBe(6); await expect(banner).toContainText('右端下沉');
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: info.outputPath('lever-loaded-tilt.png'), fullPage: true });
});
test.describe('touch tilted lever', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch hooks a load, shows the left end sinking and keeps the trend explanation on the canvas', async ({ page }, info) => {
    await setup(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await expect(page.getByTestId('lever-trend-banner')).toContainText('左端下沉');
    const position = await ends(page); expect(position.leftY - position.rightY).toBeGreaterThan(25); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('lever-loaded-tilt-touch.png'), fullPage: true });
  });
});
