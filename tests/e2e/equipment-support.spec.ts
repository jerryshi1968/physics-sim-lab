import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { createLeverExperiment } from '../../src/experiments/lever.ts';
import { createWorkbenchRegistry } from '../../src/equipment/registry.ts';

const mechanical = (names: string) => names.split(' ').map(name => `mechanical.${name}`);
const optical = (names: string) => names.split(' ').map(name => `optical.${name}`);
const cases: [string, string[]][] = [
  ['J-ELEC-01', ['power-supply', 'resistor', 'switch', 'lamp', 'ammeter', 'voltmeter', 'rheostat', 'wire'].map(name => `electrical.${name}`)],
  ['J-OPT-02', optical('bench candle convex-lens screen ruler')],
  ['J-OPT-01', optical('plane-mirror ray-box folding-paper protractor normal-marker')],
  ['J-OPT-03', optical('plane-mirror mirror-target mirror-match observation-eye screen ruler')],
  ['J-MECH-02', mechanical('lever support weights force-meter ruler')],
  ['J-MECH-01', mechanical('friction-block friction-surface friction-drive friction-load force-meter ruler')],
  ['H-MECH-01', mechanical('spring support weights ruler')],
  ['H-MECH-02', mechanical('projectile-launcher projectile-ball projectile-timer projectile-scale projectile-ground')],
  ['H-MECH-03', mechanical('cart cart-track cart-photogate cart-ticker')],
  ['J-MEAS-01', mechanical('density-balance density-cylinder density-specimen density-masses density-beaker')],
  ['J-MEAS-01-L', mechanical('density-balance density-cylinder density-specimen density-masses density-beaker')],
  ['J-MECH-03', mechanical('support force-meter ruler density-balance density-cylinder density-masses density-beaker buoyancy-body overflow-can')],
];

async function exported(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function blank(page: Page, id: string) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  const scene = createEmptyScene(`support-${id}`, '2026-11-11T08:00:00.000Z'); scene.experimentId = id;
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'blank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

for (const [id, supported] of cases) test(`${id}: the full catalogue matches its usable apparatus without opening replacement dialogs`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await blank(page, id);
  const library = page.getByRole('region', { name: '器材库', exact: true }), before = await exported(page);
  const enabled: string[] = [];
  for (const domain of ['电学', '光学', '力学']) {
    await library.getByRole('tab', { name: domain, exact: true }).click();
    const buttons = await library.locator('[data-library-type]').evaluateAll(nodes => nodes.map(element => { const node = element as HTMLButtonElement; return { type: node.dataset.libraryType!, disabled: node.disabled, reason: node.title, text: node.textContent }; }));
    for (const button of buttons) {
      if (!button.disabled) enabled.push(button.type);
      else { expect(button.reason).toContain('不支持'); expect(button.text).toContain(button.reason); }
    }
  }
  expect(enabled.sort()).toEqual([...supported].sort());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await exported(page)).toEqual(before);
});

test('buoyancy disables springs and extra meters for mouse, drag and keyboard; delete and undo release the meter limit', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.getByRole('button', { name: '浮力实验', exact: true }).click();
  await page.getByRole('button', { name: '预览浮力实验' }).click(); await page.getByRole('button', { name: '确认替换当前实验' }).click();
  const library = page.getByRole('region', { name: '器材库', exact: true }), board = page.getByTestId('scene-board');
  const spring = library.locator('[data-library-type="mechanical.spring"]'), meter = library.locator('[data-library-type="mechanical.force-meter"]');
  await expect(spring).toBeDisabled(); await expect(meter).toBeDisabled(); await expect(meter).toHaveAttribute('title', /最多放置 1 件/);
  const before = await exported(page);
  await spring.scrollIntoViewIfNeeded(); await spring.click({ force: true });
  const button = (await spring.boundingBox())!, surface = (await board.boundingBox())!;
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2); await page.mouse.down();
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2, { steps: 5 }); await page.mouse.up();
  await spring.evaluate(element => (element as HTMLButtonElement).focus()); await expect(spring).not.toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(await exported(page)).toEqual(before);
  await page.getByLabel('选择器材', { exact: true }).selectOption('buoy-meter'); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(meter).toBeEnabled(); await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(meter).toBeDisabled();
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(meter).toBeEnabled();
  await meter.click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await expect(board.locator('[data-equipment-type="mechanical.force-meter"]')).toHaveCount(1); await expect(meter).toBeDisabled();
  await page.screenshot({ path: info.outputPath('buoyancy-disabled-library.png'), fullPage: true });
});

test('an imported incompatible apparatus stays visible without silently switching the formal experiment', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  const scene = createLeverExperiment('legacy-mixed', '2026-11-11T08:00:00.000Z');
  scene.equipment.push({ id: 'extra-spring', type: 'mechanical.spring', definitionVersion: 1, pose: { xM: .4, yM: .3, rotationRad: 0 }, parameters: createWorkbenchRegistry().get('mechanical.spring', 1)!.defaultParameters });
  scene.equipment.push({ id: 'extra-load', type: 'mechanical.friction-load', definitionVersion: 1, pose: { xM: -.4, yM: .1, rotationRad: 0 }, parameters: createWorkbenchRegistry().get('mechanical.friction-load', 1)!.defaultParameters });
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'mixed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.getByTestId('equipment-support-note')).toContainText('杠杆平衡');
  await expect(page.getByTestId('scene-board').locator('[data-equipment-type="mechanical.spring"]')).toHaveCount(1);
  await expect(page.locator('[data-library-type="mechanical.spring"]')).toBeDisabled();
  await expect(page.getByTestId('lever-status')).toContainText('仅支持');
  expect((await exported(page)).equipment).toEqual(scene.equipment);
  await page.getByLabel('选择器材', { exact: true }).selectOption('meter');
  await expect(page.getByLabel('施加拉力（N）', { exact: true })).toBeVisible();
  await page.getByLabel('选择器材', { exact: true }).selectOption('extra-spring'); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByTestId('lever-status')).toContainText('仅支持');
  await page.getByLabel('选择器材', { exact: true }).selectOption('extra-load'); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByTestId('lever-status')).not.toContainText('仅支持');
});

test.describe('touch apparatus availability', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('projectile disables balances without navigation, and six cart gates remain bounded after undo, redo and reload', async ({ page }, info) => {
    await blank(page, 'H-MECH-02');
    const library = page.getByRole('region', { name: '器材库', exact: true }), balance = library.locator('[data-library-type="mechanical.density-balance"]');
    await expect(balance).toBeDisabled(); const before = await exported(page);
    await balance.tap({ force: true }); await expect(page.getByRole('dialog')).toHaveCount(0); expect(await exported(page)).toEqual(before);
    await blank(page, 'H-MECH-03'); const gate = library.locator('[data-library-type="mechanical.cart-photogate"]');
    for (let index = 0; index < 6; index++) { await expect(gate).toBeEnabled(); await gate.tap(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).tap(); }
    await expect(gate).toBeDisabled(); await expect(gate).toHaveAttribute('title', /最多放置 6 件/);
    await page.getByRole('button', { name: '撤销', exact: true }).tap(); await expect(gate).toBeEnabled();
    await page.getByRole('button', { name: '重做', exact: true }).tap(); await expect(gate).toBeDisabled();
    await page.getByRole('button', { name: '保存', exact: true }).tap(); await page.reload();
    await expect(page.getByTestId('scene-board').locator('[data-equipment-type="mechanical.cart-photogate"]')).toHaveCount(6);
    await expect(page.locator('[data-library-type="mechanical.cart-photogate"]')).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('touch-gate-limit.png'), fullPage: true });
  });
});
