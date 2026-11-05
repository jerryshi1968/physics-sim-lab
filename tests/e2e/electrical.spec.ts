import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createElectricalRegistry, POWER, RESISTOR, SWITCH, LAMP, AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
}
async function place(page: Page, type: string, x: number, y: number, touch = false) {
  const library = page.locator(`[data-library-type="${type}"]`);
  if (touch) await library.tap(); else await library.click();
  const board = page.getByTestId('scene-board');
  const bounds = (await board.boundingBox())!;
  if (touch) await page.touchscreen.tap(bounds.x + bounds.width / 2 + x, bounds.y + bounds.height / 2 + y);
  else await board.click({ position: { x: bounds.width / 2 + x, y: bounds.height / 2 + y } });
  const id = await board.locator(`[data-equipment-type="${type}"]`).last().getAttribute('data-equipment-id');
  return board.locator(`[data-equipment-id="${id}"]`);
}
async function connect(from: Locator, to: Locator, touch = false) {
  if (touch) { await from.tap(); await to.tap(); } else { await from.click(); await to.click(); }
}
const port = (item: Locator, id: string) => item.locator(`[data-port-id="${id}"]`);
async function exported(page: Page) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const file = await event;
  return JSON.parse(await readFile((await file.path())!, 'utf8')) as ReturnType<typeof createEmptyScene>;
}
function meterScene() {
  const registry = createElectricalRegistry();
  const scene = createEmptyScene('meter.scene', '2026-11-04T02:00:00.000Z');
  scene.equipment = [[POWER, 'E', -200, -55], [RESISTOR, 'R', 160, -55], [AMMETER, 'A', -160, 65], [VOLTMETER, 'V', 130, 65]].map(([type, id, x, y]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x) / 600, yM: -Number(y) / 600, rotationRad: 0 },
  }));
  scene.title = '双量程表测试';
  scene.connections = [
    ['E', 'positive', 'A', 'low'], ['A', 'common', 'R', 'a'], ['R', 'b', 'E', 'negative'], ['V', 'high', 'R', 'a'], ['V', 'common', 'R', 'b'],
  ].map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
  return scene;
}
async function imported(page: Page, scene: ReturnType<typeof createEmptyScene>) {
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '电路.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function voltage(page: Page, sourceId: string, value: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(sourceId);
  await page.getByLabel('电源电压（V）', { exact: true }).fill(value);
  
}

test('blank wiring automatically runs two nonlinear series lamps with physical dual-range instruments, pauses and saves only initial state', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  const source = await place(page, POWER, -230, -60);
  await voltage(page, (await source.getAttribute('data-equipment-id'))!, '6');
  const l1 = await place(page, LAMP, -60, -60);
  const l2 = await place(page, LAMP, 120, -60);
  const ammeter = await place(page, AMMETER, -180, 65);
  const voltmeter = await place(page, VOLTMETER, 80, 65);
  const control = await place(page, SWITCH, 270, 65);
  for (const [from, to] of [[port(source, 'positive'), port(ammeter, 'low')], [port(ammeter, 'common'), port(l1, 'a')],
    [port(l1, 'b'), port(l2, 'a')], [port(l2, 'b'), port(control, 'a')], [port(control, 'b'), port(source, 'negative')],
    [port(voltmeter, 'low'), port(l1, 'a')], [port(voltmeter, 'common'), port(l1, 'b')]]) await connect(from!, to!);
  const before = await exported(page);
  await expect(page.getByRole('button', { name: '开始计算', exact: true })).toHaveCount(0);
  const current = page.locator(`[data-meter-reading="${(await ammeter.getAttribute('data-equipment-id'))!}"]`);
  const volts = page.locator(`[data-meter-reading="${(await voltmeter.getAttribute('data-equipment-id'))!}"]`);
  await expect(current.locator('strong')).toHaveText('0 A');
  await control.getByRole('button', { name: '合上开关', exact: true }).click();
  await expect(current).toHaveAttribute('data-meter-status', 'valid');
  await expect(current.locator('strong')).toHaveText('0.3 A');
  await expect(volts.locator('strong')).toHaveText('3 V');
  await page.getByLabel('选择器材', { exact: true }).selectOption((await control.getAttribute('data-equipment-id'))!);
  await page.getByLabel('闭合开关', { exact: true }).uncheck();
  
  await expect(current.locator('strong')).toHaveText('0 A');
  await page.getByLabel('闭合开关', { exact: true }).check();
  
  await expect(current.locator('strong')).toHaveText('0.3 A');
  await expect(l1.locator('[data-lamp-status]')).toHaveAttribute('data-lamp-status', 'valid');
  expect(Number(await l1.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'))).toBeCloseTo(.5, 5);
  expect(Number(await ammeter.locator('[data-meter-dial]').getAttribute('data-needle-fraction'))).toBeCloseTo(.5, 5);
  expect((await exported(page)).equipment.filter(item => item.id !== before.equipment.find(item => item.type === SWITCH)!.id)).toEqual(before.equipment.filter(item => item.type !== SWITCH));
  await control.getByRole('button', { name: '打开开关', exact: true }).click();
  await expect(current.locator('strong')).toHaveText('0 A');
  await expect(l1.locator('[data-lamp-brightness]')).toHaveAttribute('data-lamp-brightness', '0');
  await control.getByRole('button', { name: '合上开关', exact: true }).click();
  await expect(current.locator('strong')).toHaveText('0.3 A');
  for (const item of [source, ammeter, voltmeter]) {
    const id = (await item.getAttribute('data-equipment-id'))!;
    const targetPort = port(item, item === source ? 'positive' : 'common');
    const oldX = (await targetPort.boundingBox())!.x;
    await page.getByLabel('选择器材', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '左右翻转', exact: true }).click();
    await expect(item.locator('.equipment-body')).toHaveAttribute('data-flipped-x', 'true');
    expect((await targetPort.boundingBox())!.x).toBeGreaterThan(oldX + 60);
  }
  await expect(current.locator('strong')).toHaveText('0.3 A');
  await expect(volts.locator('strong')).toHaveText('3 V');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(voltmeter.locator('.equipment-body')).toHaveAttribute('data-flipped-x', 'false');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(voltmeter.locator('.equipment-body')).toHaveAttribute('data-flipped-x', 'true');
  await expect(current.locator('strong')).toHaveText('0.3 A');
  const savedScene = await exported(page);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('nonlinear-series.png'), fullPage: true });
  await page.getByRole('button', { name: '暂停自动更新', exact: true }).click();
  await expect(page.getByTestId('calculation-status')).toContainText('已暂停');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  expect(await exported(page)).toEqual(savedScene);
  await expect(source.locator('.equipment-body')).toHaveAttribute('data-flipped-x', 'true');
  await expect(page.locator('[data-meter-reading] strong').first()).toHaveText('0.3 A');
  await voltage(page, (await source.getAttribute('data-equipment-id'))!, '1000');
  await expect(page.getByRole('alert')).toContainText('灯泡超出电流模型范围');
  await expect(page.locator('[data-meter-reading]')).toHaveCount(0);
  await expect(l1.locator('[data-lamp-status]')).toHaveAttribute('data-lamp-status', 'unavailable');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('[data-meter-reading] strong').first()).toHaveText('0.3 A');
  expect(errors).toEqual([]);
});

test('actual range rewiring, reverse, over-range, invalid multi-range and reset clear stale readings', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  await imported(page, meterScene());
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.3 A');
  await voltage(page, 'E', '9');
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'over-range');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('超量程');
  await page.getByLabel('选择导线', { exact: true }).selectOption('w0');
  await page.getByRole('button', { name: '连接线头 B', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('A');
  await page.getByRole('button', { name: '大量程 +', exact: true }).click();
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'valid');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.9 A');
  await page.getByLabel('选择器材', { exact: true }).selectOption('A');
  await page.getByRole('button', { name: '小量程 +', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('E');
  await page.getByRole('button', { name: '正极 +', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('两个正量程端同时接线');
  await expect(page.locator('[data-meter-reading]')).toHaveCount(0);
  const reverse = meterScene(); reverse.connections[0]!.to!.portId = 'common'; reverse.connections[1]!.from!.portId = 'low';
  await imported(page, reverse);
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'reverse');
  await page.getByRole('button', { name: '暂停自动更新', exact: true }).click();
  await voltage(page, 'E', '6');
  await expect(page.locator('[data-meter-reading]')).toHaveCount(0);
  await expect(page.getByTestId('calculation-status')).toContainText('已暂停自动更新');
  await page.getByRole('button', { name: '恢复自动更新', exact: true }).click();
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'reverse');
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  await expect(page.locator('[data-meter-reading="A"]')).toHaveAttribute('data-meter-status', 'reverse');
});

test('both meter scales stay visible with independent divisions, active-range highlighting and no attached wire letters on the dial', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await ready(page); await imported(page, meterScene());
  const ammeter = page.locator('[data-equipment-id="A"] [data-meter-dial]');
  const voltmeter = page.locator('[data-equipment-id="V"] [data-meter-dial]');
  for (const [dial, low, high] of [[ammeter, ['0', '0.2', '0.4', '0.6'], ['0', '1', '2', '3']], [voltmeter, ['0', '1', '2', '3'], ['0', '5', '10', '15']]] as const) {
    await expect(dial.locator('[data-meter-scale]')).toHaveCount(2);
    await expect(dial.locator('[data-meter-scale="low"] [data-scale-value]')).toHaveText([...low]);
    await expect(dial.locator('[data-meter-scale="high"] [data-scale-value]')).toHaveText([...high]);
    for (const range of ['low', 'high']) await expect(dial.locator(`[data-meter-scale="${range}"] [data-scale-tick]`)).toHaveCount(31);
  }
  await expect(ammeter.locator('[data-meter-scale="low"]')).toHaveAttribute('data-scale-active', 'true');
  await expect(voltmeter.locator('[data-meter-scale="high"]')).toHaveAttribute('data-scale-active', 'true');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.3 A');
  expect(Number(await ammeter.getAttribute('data-needle-fraction'))).toBeCloseTo(.5, 6);
  expect(Number(await voltmeter.getAttribute('data-needle-fraction'))).toBeCloseTo(.2, 6);
  await page.getByLabel('选择导线', { exact: true }).selectOption('w3');
  await expect(page.locator('[data-wire-end-label]')).toHaveCount(0);
  await expect(page.locator('[data-wire-end-of="w3"] [data-wire-end="from"] title')).toContainText('线头 A（已连接）');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('dual-meter-scales.png'), fullPage: true });
  await page.getByLabel('选择导线', { exact: true }).selectOption('w0');
  await page.getByRole('button', { name: '连接线头 B', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('A');
  await page.getByRole('button', { name: '大量程 +', exact: true }).click();
  await expect(ammeter.locator('[data-meter-scale="high"]')).toHaveAttribute('data-scale-active', 'true');
  await expect(ammeter.locator('[data-meter-scale="low"]')).toHaveAttribute('data-scale-active', 'false');
  expect(Number(await ammeter.getAttribute('data-needle-fraction'))).toBeCloseTo(.1, 6);
  await expect(ammeter.locator('[data-meter-scale="low"] [data-scale-value]')).toHaveText(['0', '0.2', '0.4', '0.6']);
  await page.getByLabel('选择器材', { exact: true }).selectOption('A');
  await page.getByLabel('小量程分度值（A）', { exact: true }).fill('0.05');
  
  await expect(ammeter.locator('[data-meter-scale="low"] [data-scale-tick]')).toHaveCount(13);
  await expect(ammeter.locator('[data-meter-scale="high"] [data-scale-tick]')).toHaveCount(31);
  await page.getByRole('button', { name: '左右翻转', exact: true }).click();
  await expect(page.locator('[data-equipment-id="A"] .equipment-body')).toHaveAttribute('data-flipped-x', 'true');
  await expect(ammeter.locator('[data-meter-scale]')).toHaveCount(2);
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.3 A');
  await page.getByLabel('选择导线', { exact: true }).selectOption('w3');
  await page.getByRole('button', { name: '拔开线头 A', exact: true }).click();
  await expect(page.locator('[data-wire-end-of="w3"] [data-wire-end-label="from"]')).toHaveText('线头 A');
  await expect(page.locator('[data-wire-end-of="w3"] [data-wire-end="to"] [data-wire-end-label]')).toHaveCount(0);
});

test('delayed old Worker messages after reset cannot overwrite a newer run or leave extra workers active', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const stats = { created: 0, buffered: 0, active: 0, maximum: 0 };
    (window as unknown as { workerStats: typeof stats }).workerStats = stats;
    class DelayedWorker {
      native: Worker; id: number; ended = false;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      constructor(url: string | URL, options?: WorkerOptions) {
        this.native = new NativeWorker(url, options); this.id = ++stats.created; stats.active++; stats.maximum = Math.max(stats.maximum, stats.active);
        this.native.onmessage = event => { stats.buffered++; window.setTimeout(() => this.onmessage?.(event), this.id === 1 ? 1000 : 30); };
        this.native.onerror = event => this.onerror?.(event);
      }
      postMessage(value: unknown) { this.native.postMessage(value); }
      terminate() { this.native.terminate(); if (!this.ended) { stats.active--; this.ended = true; } }
    }
    window.Worker = DelayedWorker as unknown as typeof Worker;
  });
  await ready(page); await imported(page, meterScene());
  await page.waitForFunction(() => (window as unknown as { workerStats: { buffered: number } }).workerStats.buffered > 0);
  await page.getByRole('button', { name: '重新计算', exact: true }).click();
  await voltage(page, 'E', '6');
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.6 A');
  await page.waitForTimeout(1100);
  await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.6 A');
  const stats = await page.evaluate(() => (window as unknown as { workerStats: { active: number; maximum: number } }).workerStats);
  expect(stats.active).toBe(0); expect(stats.maximum).toBe(1);
  await page.getByRole('button', { name: '新建实验' }).click();
  await expect(page.locator('[data-meter-reading]')).toHaveCount(0);
});

test('lamp glass, filament and halo follow actual power continuously without a rated-power plateau', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  const registry = createElectricalRegistry();
  const scene = createEmptyScene('lamp.brightness', '2026-11-04T04:00:00.000Z');
  scene.title = '灯泡实际功率与亮度';
  scene.equipment = [[POWER, 'E', -220, -70], [LAMP, 'dim', -220, 60], [LAMP, 'rated', 0, 60], [LAMP, 'bright', 220, 60]].map(([type, id, x, y]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x) / 600, yM: -Number(y) / 600, rotationRad: 0 },
  }));
  for (const [index, current] of [[1, .03], [2, .3], [3, .6]]) scene.equipment[index!]!.parameters = {
    ratedVoltageV: 3, ratedCurrentA: current!, coldResistanceOhm: 2, maxCurrentA: 1.8,
  };
  scene.connections = ['dim', 'rated', 'bright'].flatMap(id => [
    { id: `${id}-positive`, kind: 'wire' as const, from: { equipmentId: 'E', portId: 'positive' }, to: { equipmentId: id, portId: 'a' } },
    { id: `${id}-negative`, kind: 'wire' as const, from: { equipmentId: id, portId: 'b' }, to: { equipmentId: 'E', portId: 'negative' } },
  ]);
  await imported(page, scene);
  const bulb = (id: string) => page.locator(`[data-equipment-id="${id}"] [data-lamp-brightness]`);
  const strokes: string[] = [], radii: number[] = [];
  for (const [id, power, brightness] of [['dim', .09, 1 / 11], ['rated', .9, .5], ['bright', 1.8, 2 / 3]] as const) {
    const item = bulb(id);
    await expect.poll(async () => Number(await item.getAttribute('data-lamp-power-w'))).toBeCloseTo(power, 6);
    expect(Number(await item.getAttribute('data-lamp-brightness'))).toBeCloseTo(brightness, 6);
    expect(Number(await item.locator('[data-lamp-emission]').getAttribute('opacity'))).toBeCloseTo(brightness, 6);
    expect(Number(await item.locator('[data-lamp-halo]').getAttribute('opacity'))).toBeCloseTo(brightness, 6);
    strokes.push((await item.locator('[data-lamp-filament]').getAttribute('stroke'))!);
    radii.push(Number(await item.locator('[data-lamp-halo]').getAttribute('rx')));
    await expect(item.locator('title')).toContainText('耗散功率');
  }
  expect(new Set(strokes).size).toBe(3);
  expect(radii[0]!).toBeLessThan(radii[1]!); expect(radii[1]!).toBeLessThan(radii[2]!);
  await page.getByTestId('scene-board').focus();
  await page.screenshot({ path: testInfo.outputPath('lamp-power-comparison.png'), fullPage: true });
  await voltage(page, 'E', '9');
  await expect.poll(async () => Number(await bulb('rated').getAttribute('data-lamp-power-w'))).toBeCloseTo(4.05, 6);
  expect(Number(await bulb('rated').getAttribute('data-lamp-brightness'))).toBeCloseTo(9 / 11, 6);
  expect(await bulb('rated').locator('[data-lamp-filament]').getAttribute('stroke')).not.toBe(strokes[1]);
  await voltage(page, 'E', '0');
  for (const id of ['dim', 'rated', 'bright']) {
    await expect(bulb(id)).toHaveAttribute('data-lamp-brightness', '0');
    await expect(bulb(id).locator('[data-lamp-emission]')).toHaveAttribute('opacity', '0');
    await expect(bulb(id).locator('[data-lamp-halo]')).toHaveAttribute('opacity', '0');
  }
});

test.describe('touch lamp and meter', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test('touch places and connects a real lamp and the correct meter terminals', async ({ page }, testInfo) => {
    await ready(page);
    const source = await place(page, POWER, -100, -90, true);
    const bulb = await place(page, LAMP, 100, -90, true);
    const ammeter = await place(page, AMMETER, 0, 75, true);
    const control = await place(page, SWITCH, 100, 75, true);
    await connect(port(source, 'positive'), port(ammeter, 'low'), true);
    await connect(port(ammeter, 'common'), port(bulb, 'a'), true);
    await connect(port(bulb, 'b'), port(control, 'a'), true);
    await connect(port(control, 'b'), port(source, 'negative'), true);
    await expect(page.locator('[data-meter-reading] strong')).toHaveText('0 A');
    await control.getByRole('button', { name: '合上开关', exact: true }).tap();
    await expect(page.locator('[data-meter-reading] strong')).toHaveText('0.3 A');
    await expect(control.locator('[data-switch-closed]')).toHaveAttribute('data-switch-closed', 'true');
    await control.getByRole('button', { name: '打开开关', exact: true }).tap();
    await expect(page.locator('[data-meter-reading] strong')).toHaveText('0 A');
    await control.getByRole('button', { name: '合上开关', exact: true }).tap();
    await expect(page.locator('[data-meter-reading] strong')).toHaveText('0.3 A');
    expect(Number(await bulb.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'))).toBeCloseTo(.5, 5);
    await expect(control.locator('.equipment-body')).toHaveCSS('outline-style', 'none');
    await page.screenshot({ path: testInfo.outputPath('touch-lamp-meter.png'), fullPage: true });
    await testInfo.attach('switch-style', { body: JSON.stringify(await control.locator('[data-switch-closed]').evaluate(element => {
      const style = getComputedStyle(element);
      const active = document.activeElement!;
      return { focused: element === active, outline: style.outline, tapHighlight: style.getPropertyValue('-webkit-tap-highlight-color'),
        active: active.outerHTML.slice(0, 300), activeOutline: getComputedStyle(active).outline };
    })), contentType: 'application/json' });
    await page.getByTestId('scene-board').focus();
    await page.screenshot({ path: testInfo.outputPath('touch-after-blur.png'), fullPage: true });
  });
});
