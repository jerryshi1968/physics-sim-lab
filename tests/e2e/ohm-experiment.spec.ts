import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { createOhmExperiment } from '../../src/experiments/ohm.ts';

async function open(page: Page, id = 'ohm-voltage') {
  await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).click(); await selectCatalogOption(page, id);
  await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function exported(page: Page): Promise<SceneDocument> {
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await wait).path())!, 'utf8'));
}
async function property(page: Page, id: string, label: string, value: string | boolean) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  if (typeof value === 'boolean') await page.getByLabel(label, { exact: true }).setChecked(value); else await page.getByLabel(label, { exact: true }).fill(value);
}
const slider = (page: Page, value: number) => property(page, 'Rp', '滑片位置（0～1）', String(value));
async function readVoltage(page: Page, voltage: number) { await expect(page.locator('[data-meter-reading="V"]')).toHaveAttribute('data-meter-status', 'valid'); await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText(`${voltage} V`); }
async function capture(page: Page) { const button = page.getByRole('button', { name: '采集一组 I、U 示数', exact: true }); await expect(button).toBeEnabled(); await button.click(); }

test('junior I-U experiment uses existing apparatus and five actual slider settings produce a same-record graph and CSV', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  const initial = await exported(page); expect(initial.experimentId).toBe('J-ELEC-02'); expect(initial.equipment).toHaveLength(6); expect(initial.measurementRecords).toEqual([]);
  await expect(page.locator('[data-library-type="electrical.lamp"]')).toBeDisabled(); await expect(page.getByRole('button', { name: '采集一组 I、U 示数', exact: true })).toBeDisabled();
  await property(page, 'S', '闭合开关', true);
  for (const voltage of [1, 1.4, 1.8, 2.2, 2.6]) { await slider(page, 10 * (6 / voltage - 1) / 50); await readVoltage(page, voltage); await capture(page); }
  await expect(page.getByLabel('电流 I（A）', { exact: true })).toHaveValue(''); await expect(page.getByLabel('电阻两端电压 U（V）', { exact: true })).toHaveValue('');
  const saved = await exported(page); expect(saved.measurementRecords).toHaveLength(10); expect(saved.measurementSnapshots).toHaveLength(5);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); const fit = page.getByTestId('ohm-fit'); await expect(fit).toHaveCount(1); await expect(fit).toHaveAttribute('data-mode', 'voltage'); expect(Number(await fit.getAttribute('data-slope'))).toBeCloseTo(.1, 8); await expect(page.getByTestId('ohm-fit-line')).toHaveCount(1);
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出电流关系 CSV', exact: true }).click(); const csv = await readFile((await (await wait).path())!, 'utf8'); expect(csv).toContain('R_ohm_标称值'); expect(csv).toContain('满足控制条件');
  await page.screenshot({ path: info.outputPath('ohm-voltage-fit.png'), fullPage: true });
});
test('replacing five resistors preserves leads, demands an open switch and excludes data until voltage is restored', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page, 'ohm-resistance'); const initial = await exported(page);
  for (const resistance of [5, 10, 15, 20, 25]) {
    await property(page, 'S', '闭合开关', false); await page.getByRole('button', { name: `替换为 ${resistance} Ω`, exact: true }).click(); await property(page, 'S', '闭合开关', true);
    await expect(page.getByRole('button', { name: '替换为 5 Ω', exact: true })).toBeDisabled();
    if (resistance === 10) { await readVoltage(page, 3); await expect(page.getByTestId('ohm-control-status')).toContainText('未保持目标值'); await capture(page); }
    await slider(page, 2 * resistance / 50); await readVoltage(page, 2); await expect(page.getByTestId('ohm-control-status')).toContainText('满足控制条件'); await capture(page);
  }
  const scene = await exported(page); expect(scene.connections).toEqual(initial.connections); expect(scene.equipment.find(item => item.id === 'R')!.parameters.resistanceOhm).toBe(25); expect(scene.measurementSnapshots).toHaveLength(6);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('ohm-omitted')).toContainText('1 组'); await expect(page.getByTestId('ohm-result')).toHaveCount(6); await expect(page.getByTestId('ohm-fit')).toHaveAttribute('data-mode', 'resistance'); expect(Number(await page.getByTestId('ohm-fit').getAttribute('data-slope'))).toBeCloseTo(2, 1);
  await page.screenshot({ path: info.outputPath('ohm-resistance-fit.png'), fullPage: true });
});
test('raw manual correction recalculates the plot and control settings survive mode changes, undo and saved reload', async ({ page }) => {
  await open(page); await property(page, 'S', '闭合开关', true); await readVoltage(page, 1);
  await page.getByLabel('电流 I（A）', { exact: true }).fill('.1'); await page.getByLabel('电阻两端电压 U（V）', { exact: true }).fill('1'); await page.getByRole('button', { name: '保存一组 I、U 抄表', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: '电流I' }); await row.getByRole('button', { name: '修改抄表', exact: true }).click(); await row.getByLabel('修订抄表值', { exact: true }).fill('.12'); await row.getByRole('button', { name: '确认修订', exact: true }).click();
  const before = await exported(page); await page.getByLabel('探究关系', { exact: true }).selectOption('resistance'); await page.getByLabel('保持电压（V）', { exact: true }).fill('1.5');
  await page.getByLabel('电压允许偏差（V）', { exact: true }).fill('.1'); await page.getByRole('button', { name: /撤销/ }).click(); await expect(page.getByLabel('电压允许偏差（V）', { exact: true })).toHaveValue('0.05');
  const after = await exported(page); expect(after.equipment).toEqual(before.equipment); expect(after.connections).toEqual(before.connections); expect(JSON.parse(after.measurementSnapshots![0]!.note).control.mode).toBe('voltage');
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('ohm-result')).toContainText('0.12');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.getByLabel('探究关系', { exact: true })).toHaveValue('resistance'); await expect(page.getByLabel('保持电压（V）', { exact: true })).toHaveValue('1.5'); expect((await exported(page)).measurementRecords).toHaveLength(2);
});
test('wrong rheostat wiring blocks inquiry capture and editing resistance with a closed switch is rejected', async ({ page }) => {
  await open(page); await property(page, 'S', '闭合开关', true); await readVoltage(page, 1); await property(page, 'R', '电阻（Ω）', '20'); await expect(page.locator('.diagnostic-empty')).toContainText('先断开开关'); expect((await exported(page)).equipment.find(item => item.id === 'R')!.parameters.resistanceOhm).toBe(10);
  for (const upper of [false, true]) {
    const scene = createOhmExperiment(`bad-${upper}`, '2026-11-12T08:00:00.000Z'); scene.equipment.find(item => item.id === 'S')!.parameters.closed = true;
    if (upper) scene.connections.find(wire => wire.to?.equipmentId === 'Rp')!.to!.portId = 'd'; else scene.connections.find(wire => wire.from?.equipmentId === 'Rp')!.from!.portId = 'b';
    await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
    await expect(page.getByTestId('ohm-control-status')).toContainText('一上一下'); await expect(page.getByRole('button', { name: '采集一组 I、U 示数', exact: true })).toBeDisabled();
  }
});
test('unified electrical blank preserves free equipment and supports inquiry assembly without changing experiment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page, 'electrical-blank'); await page.getByLabel('记录模式', { exact: true }).selectOption('voltage');
  const positions = [['electrical.power-supply', '-.4', '.17'], ['electrical.switch', '-.12', '.17'], ['electrical.ammeter', '.18', '.17'], ['electrical.resistor', '.4', '-.11'], ['electrical.rheostat', '.08', '-.11'], ['electrical.voltmeter', '.3', '-.31']];
  for (const [type, x, y] of positions) {
    await page.locator(`[data-library-type="${type}"]`).click(); await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
    await page.getByLabel('位置 x（m）', { exact: true }).fill(x!); await page.getByLabel('位置 y（m）', { exact: true }).fill(y!);
  }
  const scene = await exported(page), ids = Object.fromEntries(scene.equipment.map(item => [item.type, item.id]));
  const port = async (type: string, id: string) => { await page.getByTestId('scene-board').locator(`[data-equipment-id="${ids[type]}"] [data-port-id="${id}"]`).click(); };
  const pairs = [['power-supply', 'positive', 'switch', 'a'], ['switch', 'b', 'ammeter', 'low'], ['ammeter', 'common', 'resistor', 'a'], ['resistor', 'b', 'rheostat', 'a'], ['rheostat', 'c', 'power-supply', 'negative'], ['voltmeter', 'low', 'resistor', 'a'], ['voltmeter', 'common', 'resistor', 'b']];
  for (const [a, ap, b, bp] of pairs) { await port(`electrical.${a}`, ap!); await port(`electrical.${b}`, bp!); }
  await property(page, ids['electrical.switch']!, '闭合开关', true); await expect(page.getByTestId('ohm-control-status')).toContainText('满足控制条件'); await capture(page);
  const saved = await exported(page); expect(saved.experimentId).toBe('J-ELEC-FREE'); expect(saved.measurementRecords).toHaveLength(2);
  await page.getByLabel('记录模式', { exact: true }).selectOption('resistance'); await page.getByLabel('保持电压（V）', { exact: true }).fill('1.5'); await capture(page);
  await page.getByLabel('记录模式', { exact: true }).selectOption('normal'); await page.getByRole('button', { name: '采集仪表示数', exact: true }).click();
  const normal = await exported(page); expect(normal.documentId).toBe(saved.documentId); expect(normal.experimentId).toBe(saved.experimentId); expect(normal.equipment).toEqual(saved.equipment); expect(normal.connections).toEqual(saved.connections); expect(normal.measurementRecords).toHaveLength(6); expect(normal.ohmControl).toBeUndefined();
  expect(normal.measurementSnapshots!.filter(snapshot => snapshot.modelVersion === 'electrical.ohm.inquiry.v1')).toHaveLength(2);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.getByLabel('记录模式', { exact: true })).toHaveValue('normal');
  await page.getByLabel('记录模式', { exact: true }).selectOption('resistance'); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.getByLabel('记录模式', { exact: true })).toHaveValue('resistance');
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('ohm-result')).toHaveCount(2);
});

test('one electrical blank offers all record modes and keeps freely placed equipment when switching or undoing', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '初中物理实验', exact: true }).click(); await page.getByRole('dialog').getByRole('tab', { name: '电学实验', exact: true }).click();
  await expect(page.getByRole('radio', { name: '空白搭建电流与电压、电阻关系实验', exact: true })).toHaveCount(0); await expect(page.getByRole('radio', { name: '空白搭建电学实验', exact: true })).toHaveCount(1);
  await selectCatalogOption(page, 'electrical-blank'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  const mode = page.getByLabel('记录模式', { exact: true }); await expect(mode).toHaveValue('normal');
  await page.locator('[data-library-type="electrical.lamp"]').click(); await page.getByRole('button', { name: '在视口中心放置', exact: true }).click(); const before = await exported(page);
  await mode.selectOption('voltage'); await expect(page.getByLabel('探究关系', { exact: true })).toHaveCount(0); await expect(page.getByLabel('电流关系成组记录')).toBeVisible(); await expect(page.locator('[data-library-type="electrical.lamp"]')).toBeEnabled();
  const after = await exported(page); expect(after.documentId).toBe(before.documentId); expect(after.experimentId).toBe(before.experimentId); expect(after.equipment).toEqual(before.equipment); expect(after.connections).toEqual(before.connections);
  await page.getByRole('button', { name: /撤销/ }).click(); await expect(mode).toHaveValue('normal'); expect((await exported(page)).equipment).toEqual(before.equipment);
});
test('phone and tablet reuse the real switch and rheostat slider with touch, retain wires on replacement and avoid page overflow', async ({ browser }, info) => {
  for (const name of ['iPhone 13', 'iPad (gen 7) landscape']) {
    const context = await browser.newContext({ ...devices[name] }), page = await context.newPage(); await open(page, 'ohm-resistance');
    await property(page, 'Rp', '滑片位置（0～1）', '.8'); await page.getByRole('button', { name: '合上开关', exact: true }).tap();
    await expect(page.getByTestId('ohm-control-status')).toContainText('未保持目标值');
    const before = await exported(page), thumb = page.getByTestId('scene-board').locator('[data-rheostat-thumb]'), box = (await thumb.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2, session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 5; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 12 * i / 5, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const moved = await exported(page); expect(moved.equipment.find(item => item.id === 'Rp')!.parameters.position).not.toBe(before.equipment.find(item => item.id === 'Rp')!.parameters.position);
    await page.getByRole('button', { name: '打开开关', exact: true }).tap(); await page.getByRole('button', { name: '替换为 20 Ω', exact: true }).tap();
    expect((await exported(page)).connections).toEqual(before.connections); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`ohm-${name.split(' ')[0]}.png`), fullPage: true }); await context.close();
  }
});
