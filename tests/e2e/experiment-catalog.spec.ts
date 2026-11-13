import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { experimentChoices, schoolLabels, catalogDomainLabels } from '../../src/experiments/catalog.ts';
import type { SchoolStage, CatalogDomain } from '../../src/experiments/catalog.ts';
import { selectCatalogOption } from './catalog-helpers.ts';

async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function begin(page: Page, id: string) {
  const choice = experimentChoices.find(item => item.id === id)!;
  await page.getByRole('button', { name: schoolLabels[choice.stage], exact: true }).click(); await selectCatalogOption(page, id);
  await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function place(page: Page, type: string) {
  await page.locator(`[data-library-type="${type}"]`).click(); await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
}

test('two school entries keep the toolbar compact, all categories are accessible and cancellation preserves work', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/');
  await expect(page.locator('.document-actions .experiment-entry-button')).toHaveText(['初中物理实验', '高中物理实验']);
  const before = await exported(page);
  await page.getByRole('button', { name: '初中物理实验', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '初中物理实验', exact: true });
  await expect(dialog.getByRole('radio')).toHaveCount(10); await expect(dialog.getByRole('button', { name: '进入实验' })).toBeDisabled();
  await dialog.getByRole('tab', { name: '力学实验', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: '电学实验', exact: true })).toBeFocused(); await expect(dialog.getByRole('radio')).toHaveCount(9);
  await page.keyboard.press('End'); await expect(dialog.getByRole('tab', { name: '热学实验', exact: true })).toBeFocused(); await expect(dialog.getByRole('radio')).toHaveCount(2);
  await selectCatalogOption(page, 'reflection'); await page.keyboard.press('Delete'); await page.keyboard.press('Escape');
  expect(await exported(page)).toEqual(before);
  await page.getByRole('button', { name: '高中物理实验', exact: true }).click();
  const senior = page.getByRole('dialog', { name: '高中物理实验', exact: true }); await expect(senior.getByRole('tab')).toHaveText(['力学实验', '电学实验']);
  await senior.screenshot({ path: info.outputPath('senior-catalog.png') }); await senior.getByRole('button', { name: '取消', exact: true }).click();
  expect(await exported(page)).toEqual(before); await page.screenshot({ path: info.outputPath('compact-toolbar.png'), fullPage: true });
});

for (const [stage, domain] of [['junior', 'mechanical'], ['junior', 'electrical'], ['junior', 'optical'], ['junior', 'thermal'], ['senior', 'mechanical'], ['senior', 'electrical']] as [SchoolStage, CatalogDomain][]) {
  test(`${stage}/${domain}: every listed choice opens its own validated start rather than another chooser`, async ({ page }) => {
    test.setTimeout(90_000); await page.goto('/');
    for (const choice of experimentChoices.filter(item => item.stage === stage && item.domain === domain)) {
      await page.getByRole('button', { name: schoolLabels[stage], exact: true }).click(); await selectCatalogOption(page, choice.id);
      await expect(page.getByRole('dialog').getByRole('tabpanel')).toContainText(choice.description);
      await page.getByRole('button', { name: '进入实验', exact: true }).click();
      await expect(page.getByRole('heading', { name: '实验起点预览', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
      await expect(page.locator('h1')).toHaveText(choice.title); await expect(page.getByRole('dialog')).toHaveCount(0);
      const scene = await exported(page); expect(scene.curriculumRef.stage).toBe(stage); expect(scene.measurementRecords).toEqual([]);
      if (choice.id.endsWith('-blank')) expect(scene.equipment).toEqual([]);
      if (choice.id === 'density-liquid') expect(scene.equipment.find((item: { type: string }) => item.type === 'mechanical.density-cylinder').parameters.liquidM3).toBe(0);
    }
  });
}

test('free optics uses placed apparatus to choose the model, releases it on deletion and preserves identity after undo/reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await begin(page, 'optical-blank');
  await expect(page.getByRole('heading', { name: '光学自由搭建', exact: true })).toBeVisible();
  await place(page, 'optical.ruler'); await place(page, 'optical.plane-mirror');
  await expect(page.getByRole('heading', { name: '光学自由搭建', exact: true })).toBeVisible();
  await expect(page.locator('[data-library-type="optical.convex-lens"]')).toBeDisabled();
  await place(page, 'optical.folding-paper'); await expect(page.getByRole('heading', { name: '反射与共面观察', exact: true })).toBeVisible();
  await expect(page.locator('[data-library-type="optical.mirror-target"]')).toBeDisabled();
  const scene = await exported(page), paper = scene.equipment.find((item: { type: string }) => item.type === 'optical.folding-paper'); expect(scene.experimentId).toBe('J-OPT-FREE');
  await page.getByLabel('选择器材', { exact: true }).selectOption(paper.id); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByRole('heading', { name: '光学自由搭建', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(page.getByRole('heading', { name: '反射与共面观察', exact: true })).toBeVisible();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'free-optics.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); await expect(page.getByRole('heading', { name: '反射与共面观察', exact: true })).toBeVisible();
  await page.getByLabel('选择器材', { exact: true }).selectOption(paper.id); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await place(page, 'optical.mirror-target'); await expect(page.getByRole('heading', { name: '平面镜观察', exact: true })).toBeVisible();
  await expect(page.locator('[data-library-type="optical.folding-paper"]')).toBeDisabled();
});

test('senior constant-current blank exposes ordinary electrical records without EMF-specific fitting controls', async ({ page }) => {
  await page.goto('/'); await begin(page, 'current-blank');
  await expect(page.getByRole('heading', { name: '电源特性与电表加载', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '采集一组 U–I 示数', exact: true })).toHaveCount(0);
  await place(page, 'electrical.power-supply'); await expect(page.getByLabel('电源内阻（Ω）', { exact: true })).toHaveValue('0');
  const source = (await exported(page)).equipment[0]; await page.getByLabel('选择器材', { exact: true }).selectOption(source.id);
  await page.getByLabel('电源内阻（Ω）', { exact: true }).fill('2'); expect((await exported(page)).equipment[0].parameters.internalResistanceOhm).toBe(2);
});

test.describe('touch school catalogue', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('list scrolls while the footer remains available and both school buttons fit on a narrow screen', async ({ page }, info) => {
    await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: '初中物理实验', exact: true });
    await dialog.getByRole('radio', { name: '杠杆平衡实验', exact: true }).tap();
    const footer = dialog.getByRole('button', { name: '进入实验', exact: true }); await expect(footer).toBeInViewport();
    await dialog.screenshot({ path: info.outputPath('junior-mobile-catalog.png') }); await footer.tap(); await page.getByRole('button', { name: '取消', exact: true }).tap();
    await expect(page.locator('h1')).toHaveText('未命名实验'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '高中物理实验', exact: true }).tap();
    await page.getByRole('tab', { name: catalogDomainLabels.electrical, exact: true }).tap(); await page.getByRole('radio', { name: '空白搭建恒定电流实验', exact: true }).tap();
    await page.getByRole('button', { name: '进入实验', exact: true }).tap(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).tap();
    await expect(page.locator('h1')).toHaveText('空白搭建恒定电流实验');
  });
});
