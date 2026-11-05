import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createElectricalRegistry, POWER, RESISTOR, RHEOSTAT, AMMETER, VOLTMETER, LAMP } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';

const registry = createElectricalRegistry();
async function ready(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
}
async function exported(page: Page) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await event).path())!, 'utf8')) as ReturnType<typeof createEmptyScene>;
}
async function place(page: Page, type: string, x: number, y: number, drag = false) {
  const card = page.locator(`[data-library-type="${type}"]`), board = page.getByTestId('scene-board');
  await card.scrollIntoViewIfNeeded(); const area = (await board.boundingBox())!;
  if (drag) {
    const bounds = (await card.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2 + x, area.y + area.height / 2 + y, { steps: 10 }); await page.mouse.up();
  } else { await card.click(); await board.click({ position: { x: area.width / 2 + x, y: area.height / 2 + y } }); }
  const id = await board.locator(`[data-equipment-type="${type}"]`).last().getAttribute('data-equipment-id');
  return board.locator(`[data-equipment-id="${id}"]`);
}
const port = (item: Locator, id: string) => item.locator(`[data-port-id="${id}"]`);
async function connect(a: Locator, b: Locator) { await a.click(); await b.click(); }
async function setPosition(page: Page, id: string, position: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  await page.getByLabel('滑片位置（0～1）', { exact: true }).fill(position); 
}
function circuit(from = 'a', to = 'c', rotated = false) {
  const scene = createEmptyScene('rheostat.e2e', '2026-11-04T10:00:00.000Z'); scene.title = '四柱变阻器';
  scene.equipment = [[POWER, 'E', -.2, .1], [RESISTOR, 'R', 0, .1], [RHEOSTAT, 'RH', .18, .1], [AMMETER, 'I', -.12, -.1], [VOLTMETER, 'V', .12, -.1]].map(([type, id, x, y]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x), yM: Number(y), rotationRad: id === 'RH' && rotated ? Math.PI / 2 : 0, flippedX: id === 'RH' && rotated },
  }));
  scene.equipment[0]!.parameters.voltageV = 6;
  scene.connections = [['E', 'positive', 'I', 'low'], ['I', 'common', 'R', 'a'], ['R', 'b', 'RH', from], ['RH', to, 'E', 'negative'], ['V', 'high', 'R', 'a'], ['V', 'common', 'R', 'b']].map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
  return scene;
}
async function imported(page: Page, scene: ReturnType<typeof createEmptyScene>) {
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '四柱.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

test('library drag creates a physical four-post rheostat; live wiper preview drives lamp/meters without saving or sampling until one committed move', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await ready(page);
  const source = await place(page, POWER, -250, -60), lamp = await place(page, LAMP, -40, -60);
  const rheostat = await place(page, RHEOSTAT, 180, -60, true);
  const ammeter = await place(page, AMMETER, -160, 70), voltmeter = await place(page, VOLTMETER, 100, 70);
  const sourceId = (await source.getAttribute('data-equipment-id'))!, rhId = (await rheostat.getAttribute('data-equipment-id'))!;
  await page.getByLabel('选择器材', { exact: true }).selectOption(sourceId); await page.getByLabel('电源电压（V）', { exact: true }).fill('6'); 
  await expect(rheostat.locator('[data-port-id]')).toHaveCount(4);
  for (const [a, b] of [[port(source, 'positive'), port(ammeter, 'low')], [port(ammeter, 'common'), port(lamp, 'a')], [port(lamp, 'b'), port(rheostat, 'a')], [port(rheostat, 'c'), port(source, 'negative')], [port(voltmeter, 'high'), port(lamp, 'a')], [port(voltmeter, 'common'), port(lamp, 'b')]]) await connect(a!, b!);
  const current = page.locator(`[data-meter-reading="${(await ammeter.getAttribute('data-equipment-id'))!}"] strong`);
  await expect(current).toHaveText('0.3 A');
  await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(2);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  const before = await exported(page), slider = rheostat.getByRole('slider');
  const brightness = Number(await lamp.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'));
  const bounds = (await slider.boundingBox())!, x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 27, y, { steps: 6 });
  await expect(current).toHaveText('0.22 A');
  await expect(page.getByTestId('calculation-status')).toContainText('滑片预览');
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(before.revision));
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await expect(page.getByRole('button', { name: '采集仪表示数', exact: true })).toBeDisabled();
  expect(Number(await lamp.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'))).toBeLessThan(brightness);
  await page.mouse.up();
  await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(before.revision + 1));
  await expect(page.getByRole('button', { name: '采集仪表示数', exact: true })).toBeEnabled();
  const after = await exported(page); expect(after.equipment.find(item => item.id === rhId)!.parameters.position).toBeCloseTo(1, 7);
  expect(after.connections).toEqual(before.connections); expect(after.measurementRecords).toEqual(before.measurementRecords);
  expect(after.measurementSnapshots![0]!.equipment.find(item => item.id === rhId)!.parameters.position).toBe(.5);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(current).toHaveText('0.3 A');
  await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(current).toHaveText('0.22 A');
  await slider.focus(); await page.keyboard.press('Home'); await expect(current).toHaveText('0.38 A');
  expect(Number(await lamp.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'))).toBeGreaterThan(brightness);
  await page.keyboard.press('End'); await expect(current).toHaveText('0.22 A');
  const beforeCancel = await exported(page), cancelBounds = (await slider.boundingBox())!;
  await page.mouse.move(cancelBounds.x + cancelBounds.width / 2, cancelBounds.y + cancelBounds.height / 2); await page.mouse.down();
  await page.mouse.move(cancelBounds.x + cancelBounds.width / 2 - 27, cancelBounds.y + cancelBounds.height / 2, { steps: 6 });
  await expect(current).toHaveText('0.3 A'); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(current).toHaveText('0.22 A'); expect(await exported(page)).toEqual(beforeCancel);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload(); await expect(current).toHaveText('0.22 A');
  expect((await exported(page)).equipment.find(item => item.id === rhId)!.parameters.position).toBeCloseTo(1, 7);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('rheostat-lamp-and-record.png'), fullPage: true });
});

test('A-B remains fixed, C-D stays a conductor and the opposite lower terminal reverses adjustment', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await ready(page);
  for (const [from, to, expected] of [['a', 'b', [.2, .2]], ['c', 'd', [.6, .6]], ['b', 'd', [.2, .6]]] as const) {
    await imported(page, circuit(from, to));
    for (const [index, position] of ['0', '1'].entries()) {
      await setPosition(page, 'RH', position);
      await expect(page.locator('[data-meter-reading="I"] strong')).toHaveText(`${expected[index]} A`);
    }
  }
  await page.getByLabel('选择器材', { exact: true }).selectOption('RH');
  const before = await exported(page); await page.getByLabel('最大电阻（Ω）', { exact: true }).fill('-1'); 
  await expect(page.getByLabel('最大电阻（Ω）', { exact: true })).toHaveAttribute('aria-invalid', 'true'); await expect(page.locator('.live-properties').getByRole('status')).toContainText('输入未应用'); expect(await exported(page)).toEqual(before);
});

test('low zoom keeps all four posts distinct; wire reconnection and Delete preserve rheostat endpoint positions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await ready(page); await imported(page, circuit());
  const rheostat = page.locator('[data-equipment-id="RH"]');
  for (let step = 0; step < 12; step++) await page.getByRole('button', { name: '缩小', exact: true }).click();
  await connect(port(rheostat, 'c'), port(rheostat, 'd'));
  await connect(port(rheostat, 'a'), port(rheostat, 'b'));
  const before = await exported(page); expect(before.connections.at(-2)!.from!.portId).toBe('c'); expect(before.connections.at(-2)!.to!.portId).toBe('d');
  expect(before.connections.at(-1)!.from!.portId).toBe('a'); expect(before.connections.at(-1)!.to!.portId).toBe('b');
  await page.getByRole('button', { name: '复位视图', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('RH');
  await page.getByRole('button', { name: '左右翻转', exact: true }).click();
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('rheostat-four-posts.png'), fullPage: true });
  await page.getByTestId('scene-board').focus(); await page.keyboard.press('Delete');
  await expect(rheostat).toHaveCount(0);
  const removed = await exported(page); expect(removed.connections).toHaveLength(before.connections.length);
  expect(removed.connections.every(wire => wire.from?.equipmentId !== 'RH' && wire.to?.equipmentId !== 'RH')).toBe(true);
  expect(removed.connections.at(-1)!.from).toBeNull(); expect(removed.connections.at(-1)!.to).toBeNull();
  await page.keyboard.press('Control+z'); await expect(rheostat).toBeVisible();
  expect((await exported(page)).connections).toEqual(before.connections);
});

test.describe('rotated touch rheostat', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test('touch slides a rotated flipped wiper, commits once and rolls pointer cancellation back', async ({ page }, testInfo) => {
    await ready(page); await imported(page, circuit('a', 'c', true));
    const slider = page.locator('[data-equipment-id="RH"]').getByRole('slider'), current = page.locator('[data-meter-reading="I"] strong');
    await expect(current).toHaveText('0.3 A'); const before = await exported(page);
    await slider.scrollIntoViewIfNeeded(); const bounds = (await slider.boundingBox())!, x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 27, id: 1 }] });
    await expect(current).toHaveText('0.2 A');
    await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(before.revision));
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('scene-board')).toHaveAttribute('data-revision', String(before.revision + 1));
    const saved = await exported(page); expect(saved.equipment.find(item => item.id === 'RH')!.parameters.position).toBeCloseTo(1, 7);
    const next = (await slider.boundingBox())!, nx = next.x + next.width / 2, ny = next.y + next.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nx, y: ny, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: nx, y: ny - 27, id: 2 }] });
    await expect(current).toHaveText('0.3 A');
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(current).toHaveText('0.2 A'); expect(await exported(page)).toEqual(saved);
    await slider.focus(); await page.keyboard.press('Home'); await expect(current).toHaveText('0.6 A');
    await expect(slider).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: testInfo.outputPath('rheostat-touch-rotated.png'), fullPage: true });
    await session.detach();
  });
});
