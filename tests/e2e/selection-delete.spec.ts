import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createElectricalRegistry, POWER, RESISTOR, SWITCH } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';

function fixture() {
  const registry = createElectricalRegistry();
  const scene = createEmptyScene('selection.delete', '2026-11-04T06:00:00.000Z');
  scene.title = '多选删除保留导线';
  scene.equipment = [[POWER, 'E', -.35, .1], [RESISTOR, 'R1', 0, .1], [RESISTOR, 'R2', .35, .1], [SWITCH, 'S', 0, -.12]].map(([type, id, x, y]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x), yM: Number(y), rotationRad: id === 'E' ? Math.PI / 2 : 0, flippedX: id === 'E' },
  }));
  scene.connections = [
    ['E', 'positive', 'R1', 'a'], ['R1', 'b', 'R2', 'a'], ['R2', 'b', 'S', 'a'], ['S', 'b', 'E', 'negative'],
  ].map(([a, ap, b, bp], index) => ({ id: `w${index + 1}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! },
    routeWorldM: [{ x: -.25 + index * .15, y: index % 2 ? -.08 : .24 }] }));
  return scene;
}

async function open(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '多选.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture())) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

async function exported(page: Page) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await event).path())!, 'utf8')) as ReturnType<typeof createEmptyScene>;
}

test('Delete keeps all wires at the deleted rotated apparatus posts; text editing is safe, undo and reload preserve exact structure', async ({ page }, testInfo) => {
  await open(page);
  const source = page.locator('[data-equipment-id="E"] .equipment-body');
  await source.click();
  const input = page.getByLabel('电源电压（V）', { exact: true });
  await input.fill('39'); await input.selectText(); await input.press('Delete');
  await expect(page.getByText('4 件器材 · 4 根导线')).toBeVisible();
  await input.fill('3');
  const before = await exported(page);
  const points = await page.locator('[data-wire-id] .wire-line').evaluateAll(lines => lines.map(line => line.getAttribute('data-points')));
  await source.click();
  await page.keyboard.press('Delete');
  await expect(page.getByText('3 件器材 · 4 根导线')).toBeVisible();
  await expect(page.getByTestId('scene-board')).toBeFocused();
  await expect.poll(() => page.locator('[data-wire-id] .wire-line').evaluateAll(lines => lines.map(line => line.getAttribute('data-points')))).toEqual(points);
  const deleted = await exported(page);
  expect(deleted.revision).toBe(before.revision + 1);
  expect(deleted.connections[0]!.from).toBeNull();
  expect(deleted.connections[0]!.freeFromWorldM!.x).toBeCloseTo(-.35, 10);
  expect(deleted.connections[0]!.freeFromWorldM!.y).toBeCloseTo(.175, 10);
  expect(deleted.connections[3]!.to).toBeNull();
  expect(deleted.connections[3]!.freeToWorldM!.y).toBeCloseTo(.025, 10);
  expect(deleted.connections.slice(1, 3)).toEqual(before.connections.slice(1, 3));
  for (let index = 0; index < 4; index++) expect(deleted.connections[index]!.routeWorldM).toEqual(before.connections[index]!.routeWorldM);
  await page.keyboard.press('Control+z');
  await expect(page.getByText('4 件器材 · 4 根导线')).toBeVisible();
  const restored = await exported(page);
  expect(restored.equipment).toEqual(before.equipment); expect(restored.connections).toEqual(before.connections);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByText('3 件器材 · 4 根导线')).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  const reloaded = await exported(page);
  expect(reloaded.connections).toEqual(deleted.connections); expect(reloaded.equipment).toEqual(deleted.equipment);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('deleted-apparatus-retained-wires.png'), fullPage: true });
  const wire = page.locator('[data-wire-id="w4"] .wire-hit');
  await wire.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Delete');
  await expect(page.getByText('3 件器材 · 3 根导线')).toBeVisible();
});

test('Shift toggles multi-selection including switch handles and keyboard; Delete and inspector remove the group as one undo step', async ({ page }, testInfo) => {
  await open(page);
  const body = (id: string) => page.locator(`[data-equipment-id="${id}"] .equipment-body`);
  await body('R1').click(); await body('R2').click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '已选择 2 件器材' })).toBeVisible();
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(2);
  await body('R1').click({ modifiers: ['Shift'] });
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(1);
  await expect(body('R2')).toHaveAttribute('data-selected', 'true');
  await body('R1').click({ modifiers: ['Shift'] });
  const lever = page.locator('[data-equipment-id="S"] [data-switch-closed]');
  await lever.click({ modifiers: ['Shift'] });
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(3);
  await expect(lever).toHaveAttribute('data-switch-closed', 'false');
  await lever.click({ modifiers: ['Shift'] });
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(2);
  await body('S').focus(); await page.keyboard.press('Shift+Enter');
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(3);
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(2);
  await body('R2').click();
  await expect(page.locator('.equipment-body[data-selected="true"]')).toHaveCount(1);
  await body('R1').click({ modifiers: ['Shift'] });
  const before = await exported(page);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('shift-multiple-selection.png'), fullPage: true });
  await page.getByTestId('scene-board').focus(); await page.keyboard.press('Delete');
  await expect(page.getByText('2 件器材 · 4 根导线')).toBeVisible();
  const deleted = await exported(page);
  expect(deleted.revision).toBe(before.revision + 1);
  expect(deleted.equipment.map(item => item.id)).toEqual(['E', 'S']);
  expect(deleted.connections[0]!.to).toBeNull();
  expect(deleted.connections[1]!.from).toBeNull(); expect(deleted.connections[1]!.to).toBeNull();
  expect(deleted.connections[2]!.from).toBeNull(); expect(deleted.connections[3]).toEqual(before.connections[3]);
  await page.keyboard.press('Control+z');
  await expect(page.getByText('4 件器材 · 4 根导线')).toBeVisible();
  const restored = await exported(page);
  expect(restored.equipment).toEqual(before.equipment); expect(restored.connections).toEqual(before.connections);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByText('2 件器材 · 4 根导线')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByText('4 件器材 · 4 根导线')).toBeVisible();
  await body('R1').click(); await body('R2').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '删除所选器材', exact: true }).click();
  await expect(page.getByText('2 件器材 · 4 根导线')).toBeVisible();
});
