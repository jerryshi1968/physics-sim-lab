import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { createEmfExperiment } from '../../src/experiments/emf.ts';

async function start(page: Page, name = '理想电表参考') {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await openFamily(page, '电动势与内阻实验');
  await page.getByRole('radio', { name: new RegExp(name) }).check();
  await page.getByRole('button', { name: '进入实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function properties(page: Page, id: string, name: string, value: string | boolean) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  if (typeof value === 'boolean') await page.getByLabel(name, { exact: true }).setChecked(value);
  else await page.getByLabel(name, { exact: true }).fill(value);
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

test('finite source properties and actual switch immediately update both meters, support policy and undo', async ({ page }, info) => {
  await start(page, '电流表内接');
  await expect(page.getByRole('button', { name: '采集一组 U–I 示数', exact: true })).toBeDisabled();
  await expect(page.locator('[data-library-type="electrical.lamp"]')).toBeDisabled();
  await expect(page.locator('[data-library-type="electrical.power-supply"]')).toBeDisabled();
  await properties(page, 'S', '闭合开关', true);
  await expect(page.getByTestId('emf-wiring')).toHaveText('电流表内接 · 电压表跨电源端');
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'valid');
  await expect(page.locator('[data-meter-reading="V"]')).toHaveAttribute('data-meter-status', 'valid');
  const before = await page.locator('[data-meter-reading="V"] strong').innerText();
  await properties(page, 'E', '电源内阻（Ω）', '10');
  await expect(page.locator('[data-meter-reading="V"] strong')).not.toHaveText(before);
  await expect(page.getByLabel('电动势 E（V）', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('E');
  await expect(page.getByLabel('电源内阻（Ω）', { exact: true })).toHaveValue('2');
  await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText(before);
  await page.screenshot({ path: info.outputPath('emf-inner.png'), fullPage: true });
});

test('five paired manual estimates fit the recorded U-I line; correction, CSV and JSON retain snapshots', async ({ page }, info) => {
  await start(page); await properties(page, 'S', '闭合开关', true);
  for (const [position, i, u] of [['0', '.43', '2.14'], ['.1', '.3', '2.4'], ['.2', '.23', '2.54'], ['.4', '.16', '2.68'], ['.8', '.1', '2.8']]) {
    await properties(page, 'Rp', '滑片位置（0～1）', position!);
    await page.getByLabel('电流 I 抄表值（A）', { exact: true }).fill(i!); await page.getByLabel('电压 U 抄表值（V）', { exact: true }).fill(u!);
    const capture = page.getByRole('button', { name: '保存一组 U–I 抄表', exact: true }); await expect(capture).toBeEnabled(); await capture.click();
  }
  await expect(page.locator('[data-measurement-id]')).toHaveCount(10);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await expect(page.getByTestId('emf-fit')).toHaveAttribute('data-intercept', '3');
  expect(Number(await page.getByTestId('emf-fit').getAttribute('data-resistance'))).toBeCloseTo(2, 10);
  await expect(page.getByTestId('emf-fit-line')).toBeVisible();
  const fitCsv = await download(page, '导出拟合 CSV'); expect(fitCsv).toContain('E测_V'); expect(fitCsv).toContain('含电表加载');
  await page.screenshot({ path: info.outputPath('emf-fit.png'), fullPage: true });
  const stored = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(stored.measurementSnapshots).toHaveLength(5); expect(stored.measurementSnapshots![0]!.equipment.find(item => item.id === 'Rp')!.parameters.position).toBe(0);
  await properties(page, 'E', '电动势 E（V）', '2');
  await expect(page.getByTestId('emf-fit')).toHaveAttribute('data-intercept', '3');
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'emf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(stored)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('emf-fit')).toHaveAttribute('data-intercept', '3');
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const csv = await download(page, '导出 CSV'); expect(csv).toContain('electrical.emf.v1'); expect(csv).toContain('手工');
  await page.locator('[data-measurement-id]').first().getByRole('button', { name: '修改抄表', exact: true }).click();
  await page.getByLabel('修订抄表值', { exact: true }).fill('.5'); await page.getByRole('button', { name: '确认修订', exact: true }).click();
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('emf-fit')).not.toHaveAttribute('data-intercept', '3');
});

test('outer starter shows the load-only voltage; instrument pairs and partial deletions do not manufacture fits', async ({ page }) => {
  await start(page, '电流表外接'); await properties(page, 'S', '闭合开关', true);
  await expect(page.getByTestId('emf-wiring')).toHaveText('电流表外接 · 电压表跨负载');
  await page.getByRole('button', { name: '采集一组 U–I 示数', exact: true }).click();
  await expect(page.locator('[data-measurement-source="instrument"]')).toHaveCount(2);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('emf-fit')).toHaveCount(0);
  await expect(page.getByText('当前 1 个有效点，需要至少五个不同电流才拟合。', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  await page.locator('[data-measurement-id]').first().getByRole('button', { name: '删除记录', exact: true }).click();
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByText('排除 1 组不完整、异常或不支持接法的数据。', { exact: true })).toBeVisible();
});

test('blank imported EMF scene remains empty, with ordinary apparatus individually available', async ({ page }) => {
  await page.goto('/'); const scene = createEmfExperiment('blank-emf', '2026-11-11T08:00:00.000Z', 'blank');
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'blank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.locator('[data-equipment-id]')).toHaveCount(0);
  for (const type of ['power-supply', 'ammeter', 'voltmeter', 'rheostat', 'switch', 'resistor', 'wire']) await expect(page.locator(`[data-library-type="electrical.${type}"]`)).toBeEnabled();
  await expect(page.locator('[data-library-type="electrical.lamp"]')).toBeDisabled(); await expect(page.getByRole('dialog')).toHaveCount(0);
});
