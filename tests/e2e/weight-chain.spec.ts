import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { readFile } from 'node:fs/promises';

async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
async function attach(page: Page, id: string, hook: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await page.getByLabel('挂点编号', { exact: true }).selectOption(hook); 
}
async function setup(page: Page) {
  page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '杠杆平衡实验'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).click();
  await page.getByRole('button', { name: '确认空载调平', exact: true }).click(); await attach(page, 'left', '-4'); await attach(page, 'right', '2');
  const library = page.getByRole('region', { name: '器材库', exact: true }); await library.locator('[data-library-type="mechanical.weights"]').click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  const source = await exported(page); return source.equipment.find(item => !['support', 'lever', 'left', 'right', 'meter', 'ruler'].includes(item.id))!.id;
}
const group = (page: Page, id: string) => page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"]`);
async function pose(page: Page, id: string) {
  return { x: Number(await group(page, id).getAttribute('data-x-m')), y: Number(await group(page, id).getAttribute('data-y-m')) };
}
async function drag(page: Page, id: string, toId: string) {
  const grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, bottom = (await group(page, toId).locator('[data-weight-bottom]').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 3); await page.mouse.down(); await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2, { steps: 6 }); await page.mouse.up();
}

test('mouse chains weights on lower hooks, restores balance, follows parent moves and preserves children when deleting a parent', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); const id = await setup(page);
  await expect(page.getByTestId('lever-trend-banner')).toContainText('左端下沉'); await drag(page, id, 'right');
  expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right'); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  let parent = await pose(page, 'right'), child = await pose(page, id); expect(child.x).toBeCloseTo(parent.x, 9); expect(parent.y - child.y).toBeCloseTo(.064, 9);
  const parentBody = (await group(page, 'right').locator('[data-mechanical-type]').boundingBox())!, childBody = (await group(page, id).locator('[data-mechanical-type]').boundingBox())!;
  expect(childBody.y).toBeGreaterThan(parentBody.y + parentBody.height - 18);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: info.outputPath('serial-weights-balanced.png'), fullPage: true });
  await attach(page, 'right', '3'); parent = await pose(page, 'right'); child = await pose(page, id); expect(child.x).toBeCloseTo(parent.x, 9); expect(parent.y - child.y).toBeCloseTo(.064, 9); await expect(page.getByTestId('lever-trend-banner')).toContainText('右端下沉');
  await page.getByLabel('选择器材', { exact: true }).selectOption(id); await expect(page.getByLabel('串接到钩码', { exact: true })).toHaveValue('right');
  await page.getByLabel('选择器材', { exact: true }).selectOption('right'); await expect(page.getByLabel('串接到钩码').locator(`option[value="${id}"]`)).toHaveCount(0);
  const before = await exported(page); await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); expect((await exported(page)).equipment).toEqual(before.equipment);
  await page.getByLabel('选择器材', { exact: true }).selectOption('right'); child = await pose(page, id); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(group(page, 'right')).toHaveCount(0); expect(await pose(page, id)).toEqual(child); expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); expect((await exported(page)).equipment).toEqual(before.equipment); await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(group(page, 'right')).toHaveCount(0);
});

test('occupied lever hooks are disabled and refuse mouse drops while explicit lower-hook attachment and release remain available', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const id = await setup(page); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await expect(page.getByLabel('挂点编号').locator('option[value="2"]')).toHaveJSProperty('disabled', true);
  const before = await exported(page), grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, occupied = (await group(page, 'right').locator('[data-weight-grip]').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 3); await page.mouse.down(); await page.mouse.move(occupied.x + occupied.width / 2, occupied.y + 3, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('该挂点已有钩码'); expect(await exported(page)).toEqual(before);
  await page.getByLabel('串接到钩码', { exact: true }).selectOption('right');  expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right');
  await page.getByLabel('串接到钩码', { exact: true }).selectOption('left'); 
  expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('left');
  await page.getByLabel('串接到钩码', { exact: true }).selectOption(''); 
  const parameters = (await exported(page)).equipment.find(item => item.id === id)!.parameters; expect(parameters.parentWeightId).toBe(''); expect(parameters.leverId).toBe('');
});

test.describe('touch weight chains', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('native touch cancels without changing references then hangs a new weight below the existing one', async ({ page }, info) => {
    const id = await setup(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
    const grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, bottom = (await group(page, 'right').locator('[data-weight-bottom]').boundingBox())!;
    const x = grip.x + grip.width / 2, y = grip.y + 3, tx = bottom.x + bottom.width / 2, ty = bottom.y + bottom.height / 2, before = await exported(page);
    await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); expect(await exported(page)).toEqual(before);
    await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
    const freshGrip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, freshBottom = (await group(page, 'right').locator('[data-weight-bottom]').boundingBox())!;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: freshGrip.x + freshGrip.width / 2, y: freshGrip.y + 3, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: freshBottom.x + freshBottom.width / 2, y: freshBottom.y + freshBottom.height / 2, id: 2 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right'); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('serial-weights-touch.png'), fullPage: true });
  });
});
