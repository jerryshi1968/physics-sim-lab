import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createCatalogExperiment } from '../../src/experiments/catalog.ts';
import { createEmfExperiment } from '../../src/experiments/emf.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function replace(page: Page, scene: SceneDocument) {
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'meter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('V');
}
async function exported(page: Page): Promise<SceneDocument> {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
}
const resistance = (page: Page) => page.getByLabel('电压表内阻（Ω）', { exact: true });
const ideal = (page: Page) => page.getByRole('checkbox', { name: '理想电压表', exact: true });
function loadedScene() {
  const scene = createEmfExperiment('resistance-switch', '2026-11-12T08:00:00.000Z', 'inner');
  scene.equipment.find(item => item.id === 'S')!.parameters.closed = true;
  scene.equipment.find(item => item.id === 'Rp')!.parameters.position = .5;
  scene.equipment.find(item => item.id === 'V')!.parameters.inputResistanceOhm = 10;
  return scene;
}

test('junior and ideal-reference meters show infinity while finite starters show the shared million-ohm default', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  for (const id of ['series-same', 'emf-reference', 'emf-inner', 'emf-outer']) {
    const scene = createCatalogExperiment(id, `resistance.${id}`, '2026-11-12T08:00:00.000Z'); await replace(page, scene);
    const isIdeal = id === 'series-same' || id === 'emf-reference';
    if (isIdeal) { await expect(ideal(page)).toBeChecked(); await expect(resistance(page)).toHaveValue('∞'); await expect(resistance(page)).toHaveJSProperty('readOnly', true); }
    else { await expect(ideal(page)).not.toBeChecked(); await expect(resistance(page)).toHaveValue('1000000'); await expect(resistance(page)).toBeEditable(); }
    await expect(page.getByLabel('输入电阻（Ω）', { exact: true })).toHaveCount(0);
    if (id === 'emf-reference') { await resistance(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('ideal-meter-infinity.png'), fullPage: true }); }
  }
});

test('ideal switching changes actual loading, retains custom resistance, and survives undo and browser save without Infinity JSON', async ({ page }) => {
  await page.goto('/'); await replace(page, loadedScene());
  await expect(resistance(page)).toHaveValue('10'); await expect(ideal(page)).not.toBeChecked();
  await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText('2.3 V');
  await ideal(page).check(); await expect(resistance(page)).toHaveValue('∞'); await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText('2.7 V');
  const snapshot = await exported(page), meter = snapshot.equipment.find(item => item.id === 'V')!;
  expect(meter.parameters).toMatchObject({ finiteInput: false, inputResistanceOhm: 10 }); expect(JSON.stringify(snapshot)).not.toContain('∞');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption('V');
  await expect(ideal(page)).not.toBeChecked(); await expect(resistance(page)).toHaveValue('10'); await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText('2.3 V');
  await ideal(page).check(); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload(); await page.getByLabel('选择器材', { exact: true }).selectOption('V'); await expect(resistance(page)).toHaveValue('∞');
  await ideal(page).uncheck(); await expect(resistance(page)).toHaveValue('10'); await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText('2.3 V');
});

test('invalid finite drafts do not become model values or reappear after switching to and from ideal mode', async ({ page }) => {
  await page.goto('/'); await replace(page, loadedScene());
  await resistance(page).fill('0'); await expect(resistance(page)).toHaveAttribute('aria-invalid', 'true');
  expect((await exported(page)).equipment.find(item => item.id === 'V')!.parameters.inputResistanceOhm).toBe(10);
  await ideal(page).check(); await expect(resistance(page)).toHaveValue('∞'); await expect(resistance(page)).not.toHaveAttribute('aria-invalid', 'true');
  await ideal(page).uncheck(); await expect(resistance(page)).toHaveValue('10'); await expect(resistance(page)).toHaveAttribute('aria-invalid', 'false');
  await resistance(page).fill('2000000'); await expect(resistance(page)).toHaveValue('2000000');
  expect((await exported(page)).equipment.find(item => item.id === 'V')!.parameters.inputResistanceOhm).toBe(2_000_000);
});
