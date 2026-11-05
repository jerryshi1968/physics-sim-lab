import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
async function formal(page: Page, title: string, preview: string) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled(); await page.getByRole('button', { name: title, exact: true }).click(); await page.getByRole('button', { name: preview, exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
test('friction apparatus clicks show foreground padded outlines and all properties, including attachment selects, apply immediately', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await formal(page, '滑动摩擦实验', '预览摩擦实验'); const board = page.getByTestId('scene-board');
  for (const id of ['load', 'drive', 'surface', 'block']) {
    const body = board.locator(`[data-equipment-id="${id}"] [data-friction-type] rect`).first(); await body.click(); const outline = board.locator(`[data-selection-outline="${id}"] rect`); await expect(outline).toBeVisible(); await expect(outline).toHaveAttribute('stroke-dasharray', '6 4');
    expect(await outline.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none'); const a = (await outline.boundingBox())!, b = (await body.boundingBox())!; expect(a.width).toBeGreaterThan(b.width); expect(a.height).toBeGreaterThan(b.height);
  }
  await expect(page.getByRole('button', { name: '应用属性', exact: true })).toHaveCount(0); const mass = page.getByLabel('木块质量（kg）', { exact: true }); await mass.fill('1'); await expect(mass).toBeFocused(); expect((await exported(page)).equipment.find(item => item.id === 'block')!.parameters.massKg).toBe(1);
  await page.getByLabel('选择器材', { exact: true }).selectOption('load'); await page.getByLabel('砝码承载木块').selectOption('block'); expect((await exported(page)).equipment.find(item => item.id === 'load')!.parameters.blockId).toBe('block');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); await page.getByLabel('选择器材', { exact: true }).selectOption('block'); await expect(mass).toHaveValue('1');
  await page.screenshot({ path: info.outputPath('friction-live-selection.png'), fullPage: true });
});
test('electrical controls apply typed values, native arrows and checkboxes without a submit while invalid drafts never replace the circuit', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled(); const library = page.getByRole('region', { name: '器材库', exact: true });
  for (const type of ['electrical.power-supply', 'electrical.resistor', 'electrical.switch']) { await library.locator(`[data-library-type="${type}"]`).click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click(); }
  const initial = await exported(page), id = (type: string) => initial.equipment.find(item => item.type === type)!.id;
  await page.getByLabel('选择器材', { exact: true }).selectOption(id('electrical.power-supply')); const voltage = page.getByLabel('电源电压（V）', { exact: true }); await voltage.fill('6'); await voltage.press('ArrowUp'); await expect(voltage).toHaveValue('7'); await expect(voltage).toBeFocused();
  await page.getByLabel('选择器材', { exact: true }).selectOption(id('electrical.switch')); await page.getByLabel('闭合开关', { exact: true }).check(); expect((await exported(page)).equipment.find(item => item.type === 'electrical.switch')!.parameters.closed).toBe(true);
  await page.getByLabel('选择器材', { exact: true }).selectOption(id('electrical.resistor')); const resistance = page.getByLabel('电阻（Ω）', { exact: true }), before = await exported(page); await resistance.fill('0'); await expect(resistance).toHaveAttribute('aria-invalid', 'true'); await resistance.blur(); await expect(resistance).toHaveValue('10'); expect(await exported(page)).toEqual(before);
  await resistance.fill('20'); await page.getByRole('button', { name: '撤销', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption(id('electrical.resistor')); await expect(resistance).toHaveValue('10');
});
test('optical and lever controls update immediately without remounting focused fields', async ({ page }) => {
  await formal(page, '凸透镜成像实验', '预览光学实验'); const scene = await exported(page), lens = scene.equipment.find(item => item.type === 'optical.convex-lens')!;
  await page.getByLabel('选择器材', { exact: true }).selectOption(lens.id); const focal = page.getByLabel('焦距（m）', { exact: true }); await focal.fill('.12'); await expect(focal).toBeFocused(); await focal.press('ControlOrMeta+A'); await focal.pressSequentially('0.15'); await expect(focal).toHaveValue('0.15'); await expect(focal).toBeFocused(); expect((await exported(page)).equipment.find(item => item.id === lens.id)!.parameters.focalLengthM).toBe(.15);
  await page.getByRole('button', { name: '杠杆平衡实验', exact: true }).click(); await page.getByRole('button', { name: '预览杠杆实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('left'); await page.getByLabel('挂点编号').selectOption('-4'); await page.getByLabel('挂接杠杆').selectOption('lever'); expect((await exported(page)).equipment.find(item => item.id === 'left')!.parameters.leverId).toBe('lever');
  await page.getByLabel('钩码总质量（kg）', { exact: true }).fill('.2'); expect((await exported(page)).equipment.find(item => item.id === 'left')!.parameters.massKg).toBe(.2);
});
test.describe('touch live editing', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch selection outline and numeric edits remain available on narrow screens', async ({ page }, info) => {
    await formal(page, '滑动摩擦实验', '预览摩擦实验'); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByTestId('scene-board').locator('[data-equipment-id="block"] [data-friction-type] rect').tap(); await expect(page.locator('[data-selection-outline="block"] rect')).toBeVisible();
    await page.getByLabel('木块质量（kg）', { exact: true }).fill('.75'); await expect(page.getByLabel('木块质量（kg）', { exact: true })).toBeFocused(); expect((await exported(page)).equipment.find(item => item.id === 'block')!.parameters.massKg).toBe(.75);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('touch-live-selection.png'), fullPage: true });
  });
});
