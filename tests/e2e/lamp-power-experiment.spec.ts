import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import { createLampPowerExperiment } from '../../src/experiments/lamp-power.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page, touch = false) {
  await page.goto('/'); const start = page.getByRole('button', { name: '初中物理实验', exact: true }); if (touch) await start.tap(); else await start.click(); await selectCatalogOption(page, 'lamp-power', touch);
  for (const name of ['进入实验', '确认替换当前实验']) { const button = page.getByRole('button', { name, exact: true }); if (touch) await button.tap(); else await button.click(); }
}
async function exported(page: Page): Promise<SceneDocument> { const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await wait).path())!, 'utf8')); }
async function property(page: Page, id: string, label: string, value: string | boolean) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  if (typeof value === 'boolean') await page.getByLabel(label, { exact: true }).setChecked(value); else await page.getByLabel(label, { exact: true }).fill(value);
}
async function importScene(page: Page, scene: SceneDocument) { await page.goto('/'); await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'power.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); }
async function lowRanges(page: Page) { await property(page, 'S', '闭合开关', false); await page.getByLabel('电流表量程', { exact: true }).selectOption('low'); await page.getByLabel('电压表量程', { exact: true }).selectOption('low'); await property(page, 'S', '闭合开关', true); }
async function reading(page: Page, voltage: string) { await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText(`${voltage} V`); }
const slider = (page: Page, position: string) => property(page, 'Rp', '滑片位置（0～1）', position);
async function capture(page: Page, manual = false) { await page.getByRole('button', { name: manual ? '保存一组灯泡抄表' : '采集一组灯泡示数', exact: true }).click(); }
const bulb = (page: Page) => page.getByTestId('scene-board').locator('[data-equipment-id="L1"] [data-lamp-brightness]');

test('junior power experiment reuses the nonlinear lamp, selects ranges and records actual below/rated/above powers without mixing their average', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page); const before = await exported(page); expect(before.experimentId).toBe('J-ELEC-04'); expect(before.equipment).toHaveLength(6); expect(before.measurementRecords).toEqual([]);
  await expect(page.locator('[data-library-type="electrical.resistor"]')).toBeDisabled(); await expect(page.getByRole('button', { name: '采集一组灯泡示数', exact: true })).toBeDisabled(); await lowRanges(page);
  await slider(page, '.72'); await reading(page, '0.6'); const dim = Number(await bulb(page).getAttribute('data-lamp-brightness')); await page.getByLabel('亮度观察与备注').fill('较暗'); await capture(page);
  expect(Number(await page.getByTestId('lamp-power-result').first().locator('[data-power]').getAttribute('data-power'))).toBeCloseTo(.096, 8);
  await slider(page, '.2'); await reading(page, '3'); await expect(page.getByTestId('lamp-power-status')).toContainText('额定工作点'); const rated = Number(await bulb(page).getAttribute('data-lamp-brightness')); expect(rated).toBeGreaterThan(dim); await page.getByLabel('亮度观察与备注').fill('正常发光'); await capture(page);
  await slider(page, '.03'); await expect(page.locator('[data-meter-reading="V"]')).toHaveAttribute('data-meter-status', 'over-range'); await capture(page); await expect(page.getByTestId('lamp-power-result').last()).toContainText('异常');
  await property(page, 'S', '闭合开关', false); await page.getByLabel('电压表量程', { exact: true }).selectOption('high'); await property(page, 'S', '闭合开关', true); await reading(page, '5.5'); expect(Number(await bulb(page).getAttribute('data-lamp-brightness'))).toBeGreaterThan(rated); await page.getByLabel('亮度观察与备注').fill('较亮'); await capture(page);
  await expect(page.getByTestId('lamp-power-result')).toHaveCount(4); expect(Number(await page.getByTestId('lamp-power-result').last().locator('[data-power]').getAttribute('data-power'))).toBeCloseTo(2.09, 8);
  const after = await exported(page); expect(after.connections.map(wire => wire.id)).toEqual(before.connections.map(wire => wire.id)); expect(after.measurementSnapshots).toHaveLength(4);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); expect(Number(await page.getByTestId('lamp-rated-power').getAttribute('data-power'))).toBeCloseTo(.9, 8); await expect(page.getByTestId('lamp-power-omitted')).toContainText('1 组');
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出灯泡功率 CSV', exact: true }).click(); const csv = await readFile((await (await wait).path())!, 'utf8'); expect(csv).toContain('P_W_UI'); expect(csv).toContain('额定工作点平均P_W'); expect(csv).toContain('正常发光');
  await page.screenshot({ path: info.outputPath('lamp-power-pu.png'), fullPage: true });
});

test('manual corrections recalculate measured power and rated classification, lamp rating edits preserve snapshots and save reload restores records', async ({ page }) => {
  await open(page); await slider(page, '.2'); await property(page, 'S', '闭合开关', true); await reading(page, '3');
  await page.getByLabel('灯泡电流 I（A）', { exact: true }).fill('.28'); await page.getByLabel('灯泡两端电压 U（V）', { exact: true }).fill('3'); await capture(page, true);
  expect(Number(await page.getByTestId('lamp-power-result').locator('[data-power]').getAttribute('data-power'))).toBeCloseTo(.84, 8);
  const row = page.getByRole('row').filter({ hasText: '灯泡电流I' }); await row.getByRole('button', { name: '修改抄表', exact: true }).click(); await row.getByLabel('修订抄表值', { exact: true }).fill('.3'); await row.getByRole('button', { name: '确认修订', exact: true }).click();
  const voltage = page.getByRole('row').filter({ hasText: '灯泡两端电压U' }); await voltage.getByRole('button', { name: '修改抄表', exact: true }).click(); await voltage.getByLabel('修订抄表值', { exact: true }).fill('3.6'); await voltage.getByRole('button', { name: '确认修订', exact: true }).click();
  expect(Number(await page.getByTestId('lamp-power-result').locator('[data-power]').getAttribute('data-power'))).toBeCloseTo(1.08, 8); await expect(page.getByTestId('lamp-power-result')).toContainText('高于额定');
  await property(page, 'L1', '额定电压（V）', '6'); const scene = await exported(page); expect(scene.measurementSnapshots![0]!.equipment.find(item => item.id === 'L1')!.parameters.ratedVoltageV).toBe(3);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.getByTestId('lamp-power-result')).toContainText('高于额定'); await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('lamp-rated-power-empty')).toContainText('Uₙ=3 V');
});

test('wrong rheostat wiring blocks collection and solver/model failures remain invalid instead of producing a rated answer', async ({ page }) => {
  const scene = createLampPowerExperiment('wrong', '2026-11-13T02:00:00.000Z'); scene.equipment.find(item => item.id === 'S')!.parameters.closed = true; scene.connections.find(wire => wire.to?.equipmentId === 'Rp')!.to!.portId = 'd';
  await importScene(page, scene); await expect(page.getByTestId('lamp-power-status')).toContainText('一上一下'); await expect(page.getByRole('button', { name: '采集一组灯泡示数', exact: true })).toBeDisabled();
  scene.connections.find(wire => wire.to?.equipmentId === 'Rp')!.to!.portId = 'a'; scene.equipment.find(item => item.id === 'Rp')!.parameters.position = 0; scene.equipment.find(item => item.id === 'E')!.parameters.voltageV = 1000;
  await importScene(page, scene); await expect(page.getByTestId('calculation-status')).toContainText('计算不可用'); await capture(page); await expect(page.getByTestId('lamp-power-result').locator('[data-power]')).toHaveAttribute('data-power', '');
});

test('power measurements use readonly ideal junior meters and restore an imported non-ideal pair in one reversible command', async ({ page }) => {
  await open(page); await page.getByLabel('选择器材', { exact: true }).selectOption('A'); await expect(page.getByLabel('电流表内阻（Ω）', { exact: true })).toHaveValue('0'); await expect(page.getByLabel('电流表内阻（Ω）', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('选择器材', { exact: true }).selectOption('V'); await expect(page.getByLabel('电压表内阻（Ω）', { exact: true })).toHaveValue('∞'); await expect(page.getByLabel('理想电压表', { exact: true })).toHaveCount(0);
  const scene = createLampPowerExperiment('restore', '2026-11-13T02:00:00.000Z'); scene.equipment.find(item => item.id === 'S')!.parameters.closed = true; scene.equipment.find(item => item.id === 'A')!.parameters.resistanceOhm = 1; scene.equipment.find(item => item.id === 'V')!.parameters.finiteInput = true;
  await importScene(page, scene); await expect(page.getByTestId('lamp-power-status')).toContainText('理想电表'); await page.getByRole('button', { name: '恢复理想电表', exact: true }).click(); await expect(page.getByTestId('lamp-power-status')).toContainText('低于额定'); await page.getByRole('button', { name: /撤销/ }).click(); const restored = await exported(page); expect(restored.equipment.find(item => item.id === 'A')!.parameters.resistanceOhm).toBe(1); expect(restored.equipment.find(item => item.id === 'V')!.parameters.finiteInput).toBe(true);
});

test('one existing electrical blank selects power records without adding apparatus or losing prior data on mode changes and reload', async ({ page }) => {
  const scene = createLampPowerExperiment('free', '2026-11-13T02:00:00.000Z'); scene.experimentId = 'J-ELEC-FREE'; scene.equipment.find(item => item.id === 'S')!.parameters.closed = true; scene.equipment.find(item => item.id === 'Rp')!.parameters.position = .2;
  await importScene(page, scene); await page.getByLabel('记录模式', { exact: true }).selectOption('lamp-power'); await reading(page, '3'); await capture(page); const before = await exported(page);
  await page.getByLabel('记录模式', { exact: true }).selectOption('normal'); const after = await exported(page); expect(after.equipment).toEqual(before.equipment); expect(after.connections).toEqual(before.connections); expect(after.measurementRecords).toEqual(before.measurementRecords); expect(after.documentId).toBe(before.documentId); await page.getByRole('button', { name: /撤销/ }).click(); await expect(page.getByLabel('记录模式', { exact: true })).toHaveValue('lamp-power');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); await expect(page.getByTestId('lamp-power-result')).toHaveCount(1);
});

test('dragging from either track endpoint commits once, preserves wires and permits fine adjustment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page); await lowRanges(page);
  const before = await exported(page), base = page.getByTestId('scene-board').locator('[data-rheostat-base]'), thumb = page.getByTestId('scene-board').locator('[data-rheostat-thumb]'); await thumb.scrollIntoViewIfNeeded(); const box = (await thumb.boundingBox())!, rail = (await base.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - rail.width / .164 * .09 * .8, y, { steps: 8 }); await page.mouse.up(); const after = await exported(page); expect(after.connections).toEqual(before.connections); expect(after.revision).toBe(before.revision + 1); expect(after.equipment.find(item => item.id === 'Rp')!.parameters.position).toBeCloseTo(.2, 5);
  await page.getByRole('button', { name: /撤销/ }).click(); expect((await exported(page)).equipment.find(item => item.id === 'Rp')!.parameters.position).toBe(1);
  const grip = page.getByRole('slider', { name: '滑动变阻器滑片', exact: true }); await grip.focus(); await page.keyboard.press('Home');
  const left = (await thumb.boundingBox())!, lx = left.x + left.width / 2, ly = left.y + left.height / 2; await page.mouse.move(lx, ly); await page.mouse.down(); await page.mouse.move(lx + rail.width / .164 * .09 * .2, ly, { steps: 5 }); await page.mouse.up(); const fromLeft = await exported(page); expect(fromLeft.equipment.find(item => item.id === 'Rp')!.parameters.position).toBeCloseTo(.2, 5); expect(fromLeft.connections).toEqual(before.connections);
  await slider(page, '.2'); await reading(page, '3');
});

for (const name of ['iPhone 15', 'iPad (gen 7) landscape']) test(`touch ${name} selects ranges, slides and fine-adjusts a rated power record`, async ({ browser }, info) => {
  const context = await browser.newContext({ ...devices[name] }), page = await context.newPage();
  try {
    await open(page, true); await page.getByLabel('电流表量程', { exact: true }).selectOption('low'); await page.getByLabel('电压表量程', { exact: true }).selectOption('low'); await page.getByRole('button', { name: '合上开关', exact: true }).tap();
    const thumb = page.getByTestId('scene-board').locator('[data-rheostat-thumb]'), base = page.getByTestId('scene-board').locator('[data-rheostat-base]'); await thumb.scrollIntoViewIfNeeded(); const box = (await thumb.boundingBox())!, rail = (await base.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    const session = await context.newCDPSession(page); await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - rail.width / .164 * .09 * .8, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    expect(Number(await page.getByRole('slider', { name: '滑动变阻器滑片', exact: true }).getAttribute('aria-valuenow'))).toBeLessThan(90);
    await slider(page, '.2'); await page.getByLabel('滑片位置（0～1）', { exact: true }).blur(); await reading(page, '3'); await expect(page.getByTestId('calculation-status')).toHaveText('自动更新 · 准静态直流'); await expect(page.getByTestId('lamp-power-status')).toContainText('额定工作点'); const sample = page.getByRole('button', { name: '采集一组灯泡示数', exact: true }); await expect(sample).toBeEnabled();
    await sample.tap(); await expect(page.getByTestId('lamp-power-result')).toHaveCount(1); await page.getByRole('tab', { name: '图线', exact: true }).tap(); expect(Number(await page.getByTestId('lamp-rated-power').getAttribute('data-power'))).toBeCloseTo(.9, 8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath('lamp-power-touch.png'), fullPage: true });
  } finally { await context.close(); }
});
