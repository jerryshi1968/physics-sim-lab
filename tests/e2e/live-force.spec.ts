import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { readFile } from 'node:fs/promises';

async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
async function setup(page: Page, calibrated = true) {
  page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '杠杆平衡实验'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).click();
  if (calibrated) await page.getByRole('button', { name: '确认空载调平', exact: true }).click();
  for (const [id, hook] of [['left', '-4'], ['meter', '2']]) {
    await page.getByLabel('选择器材', { exact: true }).selectOption(id!); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await page.getByLabel('挂点编号', { exact: true }).selectOption(hook!); 
  }
}
const force = (page: Page) => page.getByLabel('施加拉力（N）', { exact: true });
const pointer = (page: Page) => page.getByTestId('scene-board').locator('[data-equipment-id="meter"] [data-force-meter-pointer]');
async function indication(page: Page, value: number, fraction = value / 5) {
  await expect(pointer(page)).toHaveAttribute('data-applied-force-n', String(value));
  await expect(pointer(page)).toHaveAttribute('data-pointer-fraction', String(fraction));
  expect(await pointer(page).evaluate(element => (element as SVGPathElement).getPointAtLength(0).x)).toBeCloseTo(.065 + .09 * fraction, 6);
}

test('typing, keyboard arrows and native mouse spinners update force, balance and pointer immediately and survive blur, reselect, undo and save', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await setup(page);
  await force(page).fill('2'); await indication(page, 2); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  await force(page).press('ArrowUp'); await expect(force(page)).toHaveValue('3'); await expect(force(page)).toBeFocused(); await indication(page, 3); await expect(page.getByTestId('lever-trend-banner')).toContainText('右端下沉');
  await force(page).press('ArrowDown'); await indication(page, 2); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  await force(page).evaluate(element => { (element as HTMLInputElement).dataset.nativeSpinnerProbe = 'stable'; });
  await force(page).scrollIntoViewIfNeeded(); let box = (await force(page).boundingBox())!;
  await page.mouse.click(box.x + box.width - 9, box.y + box.height / 2 - 5); await expect(force(page)).toHaveValue('3'); await indication(page, 3); await expect(force(page)).toHaveAttribute('data-native-spinner-probe', 'stable');
  box = (await force(page).boundingBox())!; await page.mouse.click(box.x + box.width - 9, box.y + box.height / 2 - 5); await expect(force(page)).toHaveValue('4'); await indication(page, 4);
  box = (await force(page).boundingBox())!; await page.mouse.click(box.x + box.width - 9, box.y + box.height / 2 + 5); await expect(force(page)).toHaveValue('3'); await indication(page, 3);
  await page.getByRole('heading', { name: '杠杆平衡实验', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption(''); await page.getByLabel('选择器材', { exact: true }).selectOption('meter'); await expect(force(page)).toHaveValue('3');
  expect((await exported(page)).equipment.find(item => item.id === 'meter')!.parameters.forceN).toBe(3);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption('meter'); await expect(force(page)).toHaveValue('4'); await indication(page, 4); await page.getByRole('button', { name: '重做', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption('meter'); await expect(force(page)).toHaveValue('3');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await page.getByLabel('选择器材', { exact: true }).selectOption('meter'); await expect(force(page)).toHaveValue('3'); await indication(page, 3);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: info.outputPath('live-force-pointer.png'), fullPage: true });
  await force(page).fill('6'); await indication(page, 6, 1); await expect(page.locator('[data-force-reading="meter"]')).toContainText('超量程');
  await expect(page.getByTestId('scene-board').locator('[data-equipment-id="meter"] [data-force-meter-status]')).toHaveAttribute('data-force-meter-status', 'over-range');
});

test('pointer reflects applied force before zero confirmation; invalid drafts, zero-arm, over-range and invalid apparatus never become normal measurements', async ({ page }) => {
  await setup(page, false); await force(page).fill('2'); await indication(page, 2); await expect(page.getByTestId('lever-status')).toContainText('尚未确认空载调平'); await expect(page.getByRole('button', { name: '保存力与力臂记录', exact: true })).toBeDisabled();
  const before = await exported(page); await force(page).fill(''); await expect(force(page)).toHaveAttribute('aria-invalid', 'true'); await indication(page, 2); await force(page).blur(); await expect(force(page)).toHaveValue('2'); expect(await exported(page)).toEqual(before);
  for (const text of ['-1', '101']) { await force(page).fill(text); await expect(force(page)).toHaveAttribute('aria-invalid', 'true'); await indication(page, 2); await force(page).blur(); expect(await exported(page)).toEqual(before); }
  await force(page).fill('2.05'); await indication(page, 2.05, .41); await force(page).blur(); await expect(force(page)).toHaveValue('2.05');
  await page.getByLabel('挂点编号', { exact: true }).selectOption('0');  await indication(page, 2.05, .41); await expect(page.locator('[data-force-reading="meter"]')).toContainText('零力臂');
  await page.getByLabel('挂点编号', { exact: true }).selectOption('2');  await force(page).fill('6'); await indication(page, 6, 1); await expect(page.getByRole('button', { name: '保存力与力臂记录', exact: true })).toBeDisabled();
  await page.getByLabel('选择器材', { exact: true }).selectOption('lever'); await page.getByLabel('安装支架', { exact: true }).selectOption('');  await expect(pointer(page)).toHaveCount(0); await expect(page.getByTestId('lever-status')).toContainText('没有有效支架');
});

test.describe('touch live force', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch text edits apply without a separate submit and persist after leaving the input', async ({ page }, info) => {
    await setup(page); await force(page).tap(); await force(page).fill('2'); await indication(page, 2); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
    await page.getByRole('heading', { name: '杠杆平衡实验', exact: true }).tap(); await page.getByLabel('选择器材', { exact: true }).selectOption(''); await page.getByLabel('选择器材', { exact: true }).selectOption('meter'); await expect(force(page)).toHaveValue('2');
    await force(page).tap(); await force(page).fill('1'); await indication(page, 1); await expect(page.getByTestId('lever-trend-banner')).toContainText('左端下沉');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('live-force-touch.png'), fullPage: true });
  });
});
