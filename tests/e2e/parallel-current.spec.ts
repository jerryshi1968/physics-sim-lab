import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import { createParallelCurrentExperiment } from '../../src/experiments/parallel-current.ts';
import { createLampCircuitExperiment } from '../../src/experiments/lamp-circuits.ts';

async function open(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).click();
  await selectCatalogOption(page, 'parallel-current');
  for (const name of ['并联 · 相同灯泡', '并联 · 不同灯泡']) await expect(page.getByRole('radio', { name, exact: true })).toHaveCount(0);
  for (const name of ['进入实验', '确认替换当前实验']) await page.getByRole('button', { name, exact: true }).click();
}
async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function close(page: Page) { await page.getByRole('button', { name: '合上开关', exact: true }).click(); }

test('six lamp and position combinations save actual currents, comparison rows, CSV and reload without a voltmeter', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await expect(page.getByTestId('parallel-current-panel')).toBeVisible();
  await expect(page.getByTestId('scene-board').locator('[data-equipment-id]')).toHaveCount(5);
  await expect(page.locator('[data-library-type="electrical.voltmeter"]')).toBeDisabled();
  const readout = page.locator('[data-meter-reading="A"] strong');
  await expect(readout).toHaveText('0 A');
  for (const lamps of ['different', 'same']) for (const position of ['main', 'branch1', 'branch2']) {
    await page.getByLabel('灯泡组合', { exact: true }).selectOption(lamps);
    await page.getByLabel('电流表接入位置', { exact: true }).selectOption(position);
    await expect(readout).toHaveText('0 A'); await close(page);
    const current = position === 'main' ? lamps === 'same' ? .6 : .5 : position === 'branch1' || lamps === 'same' ? .3 : .2;
    await expect(readout).toHaveText(`${current} A`);
    await page.getByRole('button', { name: '采集仪表示数', exact: true }).click();
  }
  const s = await exported(page); expect(s.equipment.find((i: { id: string }) => i.id === 'E').parameters.voltageV).toBe(3);
  expect(s.measurementRecords).toHaveLength(6); expect(s.measurementSnapshots).toHaveLength(6);
  expect(s.equipment.some((i: { type: string }) => i.type === 'electrical.voltmeter')).toBe(false);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  const table = page.getByRole('table', { name: '并联电流比较表', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody tr').first()).toContainText('0.5');
  await expect(table.getByRole('cell', { name: '0.3', exact: true })).toHaveCount(3);
  await table.screenshot({ path: info.outputPath('parallel-currents.png') });
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  const csv = await readFile((await (await download).path())!, 'utf8');
  for (const label of ['干路', 'L1 支路', 'L2 支路', '相同灯泡', '不同灯泡']) expect(csv).toContain(label);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload();
  await expect(page.getByLabel('电流表接入位置', { exact: true })).toHaveValue('branch2');
  await expect(page.getByLabel('灯泡组合', { exact: true })).toHaveValue('same');
  const restored = await exported(page); expect(restored.measurementRecords).toEqual(s.measurementRecords); expect(restored.measurementSnapshots).toEqual(s.measurementSnapshots);
});

test('atomic undo, fixed source, explicit custom-wire recovery and manual correction retain real evidence', async ({ page }) => {
  await open(page); await close(page); const before = await exported(page);
  await page.getByLabel('电流表接入位置', { exact: true }).selectOption('branch1');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0 A');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('电流表接入位置', { exact: true })).toHaveValue('main');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.5 A');
  expect((await exported(page)).connections).toEqual(before.connections);
  await page.getByLabel('选择器材', { exact: true }).selectOption('E');
  await page.getByLabel('电源电压（V）', { exact: true }).fill('2.5');
  const source = (await exported(page)).equipment.find((i: { id: string }) => i.id === 'E');
  await page.getByLabel('灯泡组合', { exact: true }).selectOption('same');
  expect((await exported(page)).equipment.find((i: { id: string }) => i.id === 'E')).toEqual(source);
  await page.getByLabel('选择导线', { exact: true }).selectOption('parallel-wire-0');
  await page.getByRole('button', { name: '删除导线', exact: true }).click();
  await expect(page.getByLabel('电流表接入位置', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '恢复并联参考接线', exact: true }).click();
  await expect(page.getByLabel('电流表接入位置', { exact: true })).toHaveValue('main');
  await close(page); await page.getByLabel('电流表 3抄表值（A）', { exact: true }).fill('.48');
  await page.getByRole('button', { name: '保存手工抄表', exact: true }).click();
  await page.getByRole('button', { name: '修改抄表', exact: true }).click();
  await page.getByLabel('修订抄表值', { exact: true }).fill('.50'); await page.getByRole('button', { name: '确认修订', exact: true }).click();
  expect((await exported(page)).measurementRecords[0].context.originalRawInput).toBe('.48');
});

test('matching five-appliance imports gain controls while old six-appliance parallel and series imports retain their wiring', async ({ page }) => {
  await page.goto('/'); const teacher = createParallelCurrentExperiment('teacher', '2026-11-24T00:00:00.000Z'); teacher.experimentId = 'J-ELEC-01'; teacher.title = '教师并联装置';
  for (const s of [teacher, createLampCircuitExperiment('six', '2026-11-24T00:00:00.000Z', 'parallel-different'), createLampCircuitExperiment('series', '2026-11-24T00:00:00.000Z', 'series-same')]) {
    await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(s)) });
    await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
    expect((await exported(page)).connections).toEqual(s.connections);
    if (s === teacher) {
      await expect(page.getByTestId('parallel-current-panel')).toBeVisible();
      await page.getByLabel('电流表接入位置', { exact: true }).selectOption('branch2');
      await expect(page.locator('h1')).toHaveText('教师并联装置');
    } else { await expect(page.getByTestId('parallel-current-panel')).toHaveCount(0); await expect(page.getByTestId('lamp-circuit-guide')).toBeVisible(); }
  }
});

test.describe('native touch parallel entry', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('phone entry and three current selections fit and retain the supply', async ({ page }, info) => {
    await open(page);
    for (const [position, current] of [['main', '.5'], ['branch1', '.3'], ['branch2', '.2']]) {
      await page.getByLabel('电流表接入位置', { exact: true }).selectOption(position!);
      await page.getByRole('button', { name: '合上开关', exact: true }).tap();
      await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText(`${Number(current)} A`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('scene-board').screenshot({ path: info.outputPath('phone-parallel-bench.png') });
  });
});
