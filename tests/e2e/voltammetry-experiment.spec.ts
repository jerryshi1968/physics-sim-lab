import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import { createVoltammetryExperiment } from '../../src/experiments/voltammetry.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page, id = 'voltammetry', touch = false) {
  await page.goto('/'); const button = page.getByRole('button', { name: '初中物理实验', exact: true });
  if (touch) await button.tap(); else await button.click(); await selectCatalogOption(page, id, touch);
  for (const name of ['进入实验', '确认替换当前实验']) { const next = page.getByRole('button', { name, exact: true }); if (touch) await next.tap(); else await next.click(); }
}
async function exported(page: Page): Promise<SceneDocument> {
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await wait).path())!, 'utf8'));
}
async function property(page: Page, id: string, label: string, value: string | boolean) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  if (typeof value === 'boolean') await page.getByLabel(label, { exact: true }).setChecked(value); else await page.getByLabel(label, { exact: true }).fill(value);
}
async function lowRanges(page: Page) {
  await property(page, 'S', '闭合开关', false);
  for (const [wire, side, id] of [['ohm-wire-1', 'B', 'A'], ['ohm-wire-5', 'A', 'V']]) {
    await page.getByLabel('选择导线', { exact: true }).selectOption(wire!);
    await page.getByRole('button', { name: `连接线头 ${side}`, exact: true }).click();
    await page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"] [data-port-id="low"]`).click();
  }
  await property(page, 'S', '闭合开关', true);
}
async function reading(page: Page, value: string) { await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText(`${value} V`); }
async function capture(page: Page, manual = false) { await page.getByRole('button', { name: manual ? '保存一组 I、U 抄表' : '采集一组 I、U 示数', exact: true }).click(); }
async function importScene(page: Page, scene: SceneDocument) {
  await page.goto('/'); await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'resistance.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

test('junior starter hides the unknown value, actual terminal range selection and three slider points drive measured resistance and export', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await page.getByLabel('选择器材', { exact: true }).selectOption('R'); await expect(page.getByLabel('电阻（Ω）', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('scene-board').locator('[data-equipment-id="R"]')).toContainText('RA');
  await property(page, 'S', '闭合开关', true); await reading(page, '1'); await capture(page);
  await expect(page.getByTestId('voltammetry-result').locator('[data-resistance]')).toHaveAttribute('data-resistance', '10');
  await lowRanges(page);
  for (const [position, voltage] of [['.6', '1.2'], ['.35', '1.8'], ['.225', '2.4']]) {
    await property(page, 'Rp', '滑片位置（0～1）', position!); await reading(page, voltage!); await capture(page);
  }
  await expect(page.getByTestId('voltammetry-result')).toHaveCount(4);
  const scene = await exported(page); expect(scene.experimentId).toBe('J-ELEC-03'); expect(scene.equipment).toHaveLength(6); expect(scene.measurementRecords).toHaveLength(8);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('voltammetry-fit')).toHaveCount(1);
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出伏安法分析 CSV', exact: true }).click(); const csv = await readFile((await (await wait).path())!, 'utf8'); expect(csv).toContain('半分度_A'); expect(csv).toContain('平均R_ohm'); expect(csv).not.toContain('参考阻值');
  await page.screenshot({ path: info.outputPath('voltammetry-analysis.png'), fullPage: true });
});

test('manual ratios, correction, invalid data and saved reload preserve the original paired snapshots', async ({ page }) => {
  await open(page); await lowRanges(page); await reading(page, '0.8');
  await page.getByLabel('电流 I（A）', { exact: true }).fill('.1'); await page.getByLabel('电阻两端电压 U（V）', { exact: true }).fill('.8'); await capture(page, true);
  const row = page.getByRole('row').filter({ hasText: '电流I' }); await row.getByRole('button', { name: '修改抄表', exact: true }).click(); await row.getByLabel('修订抄表值', { exact: true }).fill('.2'); await row.getByRole('button', { name: '确认修订', exact: true }).click();
  await expect(page.getByTestId('voltammetry-result').locator('[data-resistance]')).toHaveAttribute('data-resistance', '4');
  await page.getByLabel('电流 I（A）', { exact: true }).fill('0'); await page.getByLabel('电阻两端电压 U（V）', { exact: true }).fill('0'); await capture(page, true);
  await expect(page.getByTestId('voltammetry-result').last()).toContainText('零读数');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  await expect(page.getByTestId('voltammetry-result')).toHaveCount(2); await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('voltammetry-omitted')).toContainText('1 组'); await expect(page.getByTestId('voltammetry-summary')).toHaveAttribute('data-mean', '4');
});

test('replacement requires an open switch and preserves wires, historic samples remain separate and replacement is undoable', async ({ page }) => {
  await open(page); const wires = (await exported(page)).connections; await lowRanges(page); await reading(page, '0.8'); await capture(page);
  await expect(page.getByRole('button', { name: '电阻 B', exact: true })).toBeDisabled(); await property(page, 'S', '闭合开关', false); await page.getByRole('button', { name: '电阻 B', exact: true }).click();
  expect((await exported(page)).equipment.find(item => item.id === 'R')!.parameters.resistanceOhm).toBe(12.5);
  await page.getByRole('button', { name: /撤销/ }).click(); expect((await exported(page)).equipment.find(item => item.id === 'R')!.parameters.resistanceOhm).toBe(7.5);
  await page.getByRole('button', { name: '电阻 B', exact: true }).click(); await property(page, 'S', '闭合开关', true); await reading(page, '1.2'); await capture(page);
  const after = await exported(page); expect(after.connections.map(wire => wire.id)).toEqual(wires.map(wire => wire.id)); expect(after.measurementSnapshots).toHaveLength(2);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('voltammetry-summary')).toHaveCount(2);
});

test('over-range and wrong rheostat connection are visible and cannot masquerade as normal resistance', async ({ page }) => {
  await open(page); await lowRanges(page); await property(page, 'Rp', '滑片位置（0～1）', '0');
  await expect(page.getByTestId('voltammetry-status')).toContainText('超量程'); await capture(page); await expect(page.getByTestId('voltammetry-result')).toContainText('异常');
  const scene = createVoltammetryExperiment('wrong', '2026-11-12T08:00:00.000Z'); scene.equipment.find(item => item.id === 'S')!.parameters.closed = true; scene.connections.find(wire => wire.to?.equipmentId === 'Rp')!.to!.portId = 'd';
  await importScene(page, scene); await expect(page.getByTestId('voltammetry-status')).toContainText('一上一下'); await expect(page.getByRole('button', { name: '采集一组 I、U 示数', exact: true })).toBeDisabled();
});

test('junior meters are fixed at zero and infinite resistance, and imported non-ideal configurations must be restored before capture', async ({ page }) => {
  await open(page); await page.getByLabel('选择器材', { exact: true }).selectOption('A');
  await expect(page.getByLabel('电流表内阻（Ω）', { exact: true })).toHaveValue('0'); await expect(page.getByLabel('电流表内阻（Ω）', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('选择器材', { exact: true }).selectOption('V'); await expect(page.getByLabel('电压表内阻（Ω）', { exact: true })).toHaveValue('∞'); await expect(page.getByLabel('理想电压表', { exact: true })).toHaveCount(0);
  const scene = createVoltammetryExperiment('nonideal', '2026-11-12T08:00:00.000Z'); scene.equipment.find(item => item.id === 'S')!.parameters.closed = true;
  scene.equipment.find(item => item.id === 'V')!.parameters.finiteInput = true; scene.equipment.find(item => item.id === 'A')!.parameters.resistanceOhm = .1;
  await importScene(page, scene); await expect(page.getByTestId('voltammetry-status')).toContainText('理想电表'); await expect(page.getByRole('button', { name: '采集一组 I、U 示数', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '恢复理想电表', exact: true }).click(); await reading(page, '1'); await capture(page); await expect(page.getByTestId('voltammetry-result')).toHaveCount(1);
  const restored = await exported(page); expect(restored.equipment.find(item => item.id === 'A')!.parameters.resistanceOhm).toBe(0); expect(restored.equipment.find(item => item.id === 'V')!.parameters.finiteInput).toBe(false);
  await page.getByRole('button', { name: /撤销/ }).click(); await page.getByRole('button', { name: /撤销/ }).click();
  const undone = await exported(page); expect(undone.equipment.find(item => item.id === 'A')!.parameters.resistanceOhm).toBe(.1); expect(undone.equipment.find(item => item.id === 'V')!.parameters.finiteInput).toBe(true);
});

test('general blank uses its fourth record mode without changing document identity, wiring or previous records', async ({ page }) => {
  const scene = createVoltammetryExperiment('free', '2026-11-12T08:00:00.000Z'); scene.experimentId = 'J-ELEC-FREE'; scene.equipment.find(item => item.id === 'S')!.parameters.closed = true;
  await importScene(page, scene); const before = await exported(page); await page.getByLabel('记录模式', { exact: true }).selectOption('measurement'); await reading(page, '1'); await capture(page);
  await page.getByLabel('记录模式', { exact: true }).selectOption('normal'); await expect(page.getByRole('heading', { name: '伏安法 U、I 成组记录', exact: true })).toHaveCount(0);
  const after = await exported(page); expect(after.documentId).toBe(before.documentId); expect(after.experimentId).toBe(before.experimentId); expect(after.equipment).toEqual(before.equipment); expect(after.connections).toEqual(before.connections); expect(after.measurementRecords).toHaveLength(2);
  await page.getByRole('button', { name: /撤销/ }).click(); await expect(page.getByLabel('记录模式', { exact: true })).toHaveValue('measurement'); await expect(page.getByTestId('voltammetry-result')).toHaveCount(1);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); await expect(page.getByLabel('记录模式', { exact: true })).toHaveValue('measurement');
});

for (const name of ['iPhone 15', 'iPad (gen 7) landscape']) test(`touch ${name} opens junior resistance experiment and changes an existing apparatus parameter`, async ({ browser }, info) => {
  const context = await browser.newContext({ ...devices[name] }), page = await context.newPage();
  try {
    await open(page, 'voltammetry', true);
    await page.getByRole('button', { name: '电阻 B', exact: true }).tap(); expect((await exported(page)).equipment.find(item => item.id === 'R')!.parameters.sampleLabel).toBe('B');
    await page.getByRole('button', { name: '合上开关', exact: true }).tap();
    await expect(page.getByRole('button', { name: '电阻 B', exact: true })).toBeDisabled(); await expect(page.getByTestId('voltammetry-status')).toContainText('可调节');
    await page.getByRole('button', { name: '采集一组 I、U 示数', exact: true }).tap(); await expect(page.getByTestId('voltammetry-result')).toHaveCount(1);
    await expect(page.getByLabel('电流表量程', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '打开开关', exact: true }).tap();
    await page.getByLabel('电流表量程', { exact: true }).selectOption('low'); await page.getByLabel('电压表量程', { exact: true }).selectOption('low');
    await page.getByRole('button', { name: '合上开关', exact: true }).tap(); await property(page, 'Rp', '滑片位置（0～1）', '.5'); await reading(page, '2'); await capture(page); await expect(page.getByTestId('voltammetry-result')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('voltammetry-touch.png'), fullPage: true });
  } finally { await context.close(); }
});
