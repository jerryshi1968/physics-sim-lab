import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
async function open(page: Page) {
  page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '杠杆平衡实验'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
test('two end nuts actually level the empty lever; mouse preview cancels, release commits once, keyboard and undo preserve setup', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  const board = page.getByTestId('scene-board'), slider = page.getByRole('slider', { name: '左端平衡螺母', exact: true });
  await expect(board.locator('[data-equipment-id="lever"] [data-balance-nut]')).toHaveCount(2); await expect(page.getByRole('button', { name: '确认空载调平', exact: true })).toBeDisabled();
  await page.getByLabel('选择器材', { exact: true }).selectOption('lever'); await expect(page.getByLabel('转角（°）', { exact: true })).toHaveCount(0); await expect(page.getByLabel('调平螺母位置（m）', { exact: true })).toHaveCount(0);
  const before = await exported(page); await slider.scrollIntoViewIfNeeded(); const box = (await slider.boundingBox())!, x = box.x + 8 + (box.width - 16) / 3, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 35, y, { steps: 6 }); await expect(board).toHaveAttribute('data-revision', String(before.revision));
  await page.keyboard.press('Escape'); await page.mouse.up(); expect(await exported(page)).toEqual(before);
  await slider.focus(); for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('24'); await expect(page.getByRole('button', { name: '确认空载调平', exact: true })).toBeEnabled();
  const left = (await board.locator('[data-equipment-id="lever"] [data-lever-hook="-6"] circle').boundingBox())!, right = (await board.locator('[data-equipment-id="lever"] [data-lever-hook="6"] circle').boundingBox())!; expect(Math.abs(left.y - right.y)).toBeLessThan(.01);
  const leveled = await exported(page); expect(leveled.equipment.filter(item => item.id !== 'lever')).toEqual(before.equipment.filter(item => item.id !== 'lever'));
  await slider.scrollIntoViewIfNeeded(); const next = (await slider.boundingBox())!, nx = next.x + 8 + (next.width - 16) * .4, ny = next.y + next.height / 2;
  await page.mouse.move(nx, ny); await page.mouse.down(); await page.mouse.move(nx + 25, ny, { steps: 5 }); await page.mouse.up();
  const adjusted = await exported(page); expect(adjusted.revision).toBe(leveled.revision + 1); expect(adjusted.equipment.find(item => item.id === 'lever')!.parameters.leftNutOffsetM).not.toBe(.024);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(slider).toHaveValue('24');
  await page.getByRole('button', { name: '确认空载调平', exact: true }).click(); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  await page.getByLabel('选择器材', { exact: true }).selectOption('left'); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await page.getByLabel('挂点编号', { exact: true }).selectOption('-4'); 
  await expect(slider).toBeDisabled(); await expect(page.getByTestId('lever-status')).toContainText('逆时针');
  expect((await exported(page)).equipment.find(item => item.id === 'lever')!.parameters.leftNutOffsetM).toBe(.024);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: info.outputPath('lever-end-nuts.png'), fullPage: true });
});
test.describe('touch balance nuts', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch cancellation restores nut position, step adjustment levels the rod and saved zero survives refresh', async ({ page }, info) => {
    await open(page); const slider = page.getByRole('slider', { name: '右端平衡螺母', exact: true }); await slider.scrollIntoViewIfNeeded();
    const before = await exported(page), box = (await slider.boundingBox())!, x = box.x + 8 + (box.width - 16) / 3, y = box.y + box.height / 2, session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 20, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); expect(await exported(page)).toEqual(before);
    for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).tap();
    await page.getByRole('button', { name: '确认空载调平', exact: true }).tap(); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
    const zeroed = await exported(page); await page.getByRole('button', { name: '保存', exact: true }).tap(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); expect(await exported(page)).toEqual(zeroed);
    await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('lever-end-nuts-touch.png'), fullPage: true });
  });
});
