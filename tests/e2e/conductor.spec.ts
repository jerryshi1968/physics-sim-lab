import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';

async function open(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).click();
  await selectCatalogOption(page, 'conductor');
  for (const name of ['进入实验', '确认替换当前实验']) await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('conductor-panel')).toBeVisible();
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function off(page: Page) { const button = page.getByRole('button', { name: '打开开关', exact: true }); if (await button.count()) await button.click(); }
async function close(page: Page, current: string) {
  await page.getByRole('button', { name: '合上开关', exact: true }).click();
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText(current);
}

test('length, area and material comparisons retain six actual sources, controls, CSV and reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await expect(page.locator('[data-metal-wire="M"]')).toBeVisible();
  await expect(page.locator('[data-conductor-heater="H"]')).toBeVisible();
  await expect(page.getByTestId('scene-board').locator('[data-conductor-temperature]')).toHaveText('20 ℃');
  expect(await page.locator('[data-conductor-heater], [data-conductor-thermometer]').evaluateAll(elements => elements.every(element => getComputedStyle(element).stroke === 'none'))).toBe(true);
  const initial = await exported(page);
  for (const [sample, current] of [['A', '0.2 A'], ['B', '0.1 A'], ['A', '0.2 A'], ['C', '0.4 A'], ['A', '0.2 A'], ['D', '0.4 A']]) {
    await off(page); await page.getByLabel('金属丝样品', { exact: true }).selectOption(sample!); await close(page, current!);
    await expect(page.getByLabel('金属丝材料', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '采集仪表示数', exact: true }).click();
  }
  const s = await exported(page); expect(s.measurementRecords).toHaveLength(6); expect(s.measurementSnapshots).toHaveLength(6);
  expect(s.equipment.find((i: { id: string }) => i.id === 'E')).toEqual(initial.equipment.find((i: { id: string }) => i.id === 'E'));
  expect(s.connections).toEqual(initial.connections);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  const table = page.getByRole('table', { name: '导体电阻因素比较表', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(6);
  for (const text of ['只改变长度', '只改变横截面积', '只改变材料']) await expect(table).toContainText(text);
  await table.screenshot({ path: info.outputPath('conductor-comparisons.png') });
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const dl = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  const csv = await readFile((await (await dl).path())!, 'utf8');
  for (const label of ['镍铬合金', '康铜', '100cm', '0.2mm²', '20℃']) expect(csv).toContain(label);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  await expect(page.getByLabel('金属丝样品', { exact: true })).toHaveValue('D');
  const reloaded = await exported(page); expect(reloaded.measurementRecords).toEqual(s.measurementRecords); expect(reloaded.measurementSnapshots).toEqual(s.measurementSnapshots);
});

test('iron requires the right actual range and temperature changes, heating, cooling and undo change the current', async ({ page }, info) => {
  await open(page); await page.getByLabel('金属丝样品', { exact: true }).selectOption('E');
  await page.getByRole('button', { name: '合上开关', exact: true }).click();
  await expect(page.locator('[data-meter-reading="A"]')).toContainText('超量程');
  await off(page); await page.getByLabel('电流表量程', { exact: true }).selectOption('high'); await close(page, '2.1 A');
  await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); await off(page);
  await page.getByLabel('金属丝温度（℃）', { exact: true }).fill('80'); await close(page, '1.5 A');
  await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); await off(page);
  await page.getByRole('button', { name: '恢复 20 ℃', exact: true }).click();
  const before = await exported(page);
  await page.getByRole('button', { name: '加热 5 s', exact: true }).click();
  await expect(page.getByTestId('scene-board').locator('[data-conductor-temperature]')).toHaveText('30 ℃');
  const hot = await exported(page); expect(hot.revision).toBe(before.revision + 1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await exported(page)).equipment).toEqual(before.equipment);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page.getByRole('button', { name: '冷却 30 s', exact: true }).click();
  const cool = await exported(page); expect(cool.equipment.find((i: { id: string }) => i.id === 'M').parameters.temperatureK).toBeLessThan(hot.equipment.find((i: { id: string }) => i.id === 'M').parameters.temperatureK);
  await page.getByLabel('选择器材', { exact: true }).selectOption('H');
  await page.getByLabel('位置 x（m）', { exact: true }).fill('.8');
  await expect(page.getByRole('button', { name: '加热 5 s', exact: true })).toBeDisabled();
  const temperature = await page.getByTestId('scene-board').locator('[data-conductor-temperature]').textContent();
  await page.getByLabel('选择器材', { exact: true }).selectOption('T');
  await page.getByLabel('位置 x（m）', { exact: true }).fill('.6');
  await expect(page.getByTestId('scene-board').locator('[data-conductor-temperature]')).toHaveText('未接触');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByTestId('scene-board').locator('[data-conductor-temperature]')).toHaveText(temperature!);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await expect(page.getByRole('table', { name: '导体电阻因素比较表', exact: true })).toContainText('只改变温度');
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('temperature-apparatus.png') });
});

test('existing auxiliary apparatus can be restored and the new wire also works in ordinary blank construction', async ({ page }) => {
  await open(page); await page.getByLabel('选择器材', { exact: true }).selectOption('H');
  await page.getByRole('button', { name: '删除器材', exact: true }).click();
  const heater = page.locator('[data-library-type="thermal.heater"]'); await expect(heater).toBeEnabled();
  await heater.click(); await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await expect(page.getByTestId('scene-board').locator('[data-conductor-heater]')).toHaveCount(1);
  await page.getByRole('button', { name: '初中物理实验', exact: true }).click(); await selectCatalogOption(page, 'electrical-blank');
  for (const name of ['进入实验', '确认替换当前实验']) await page.getByRole('button', { name, exact: true }).click();
  await page.locator('[data-library-type="electrical.metal-wire"]').click();
  await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await page.getByLabel('金属丝样品', { exact: true }).selectOption('C');
  const s = await exported(page); expect(s.equipment[0].parameters.areaM2).toBe(2e-7);
});

test.describe('native phone conductor controls', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch sample selection, real readout and thermal stepping fit the narrow workbench', async ({ page }, info) => {
    await open(page); await page.getByLabel('金属丝样品', { exact: true }).selectOption('B');
    await page.getByRole('button', { name: '合上开关', exact: true }).tap();
    await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.1 A');
    await page.getByRole('button', { name: '打开开关', exact: true }).tap();
    await page.getByRole('button', { name: '加热 5 s', exact: true }).tap();
    await expect(page.getByTestId('scene-board').locator('[data-conductor-temperature]')).toHaveText('30 ℃');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('scene-board').screenshot({ path: info.outputPath('phone-conductor.png') });
  });
});
