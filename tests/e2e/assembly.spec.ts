import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const POWER = 'electrical.power-supply';
const RESISTOR = 'electrical.resistor';
const SWITCH = 'electrical.switch';
const WIRE = 'electrical.wire';

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error('Missing visible target');
  return value;
}

async function place(page: Page, type: string, xM: number, yM: number) {
  await page.locator(`[data-library-type="${type}"]`).click();
  const board = page.getByTestId('scene-board');
  const bounds = await box(board);
  await board.click({ position: { x: bounds.width / 2 + xM * 600, y: bounds.height / 2 - yM * 600 } });
  const equipment = board.locator(`[data-equipment-type="${type}"]`).last();
  await expect(equipment).toBeVisible();
  return equipment;
}

async function drag(page: Page, locator: Locator, dx: number, dy: number) {
  const bounds = await box(locator);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

async function terminals(page: Page) {
  return page.getByTestId('scene-board').locator('[data-wire-id]').evaluateAll(elements =>
    elements.map(element => [element.getAttribute('data-from'), element.getAttribute('data-to')]));
}

test('blank assembly forms a source/resistor/closed-switch loop, follows movement and supports route/color/deletion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const source = await place(page, POWER, -0.22, 0.07);
  const resistor = await place(page, RESISTOR, 0.15, 0.07);
  const control = await place(page, SWITCH, 0, -0.13);
  const sourceId = (await source.getAttribute('data-equipment-id'))!;
  const resistorId = (await resistor.getAttribute('data-equipment-id'))!;
  await page.getByLabel('闭合开关', { exact: true }).check();
  
  for (const [from, to] of [
    [source.locator('[data-port-id="positive"]'), resistor.locator('[data-port-id="a"]')],
    [resistor.locator('[data-port-id="b"]'), control.locator('[data-port-id="a"]')],
    [control.locator('[data-port-id="b"]'), source.locator('[data-port-id="negative"]')],
  ] as const) { await from.click(); await to.click(); }
  await expect(page.getByText('3 件器材 · 3 根导线')).toBeVisible();
  const board = page.getByTestId('scene-board');
  const graphBefore = await terminals(page);
  const wires = board.locator('[data-wire-id]');
  const firstWireId = (await wires.first().getAttribute('data-wire-id'))!;
  const originalPoints = (await wires.first().locator('.wire-line').getAttribute('data-points'))!;
  await page.getByLabel('选择器材', { exact: true }).selectOption(sourceId);
  await page.getByLabel('位置 x（m）', { exact: true }).fill('-0.12');
  
  const movedPoints = (await wires.first().locator('.wire-line').getAttribute('data-points'))!;
  expect(Number(movedPoints.split(' ')[0]!.split(',')[0]) - Number(originalPoints.split(' ')[0]!.split(',')[0])).toBeCloseTo(60, 6);
  expect(await terminals(page)).toEqual(graphBefore);
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(page.getByLabel('电源电压（V）', { exact: true })).toHaveValue('3');
  await expect(source).toHaveAttribute('data-x-m', '-0.12');
  expect(await terminals(page)).toEqual(graphBefore);
  await page.getByLabel('选择导线', { exact: true }).selectOption(firstWireId);
  await page.getByRole('button', { name: '添加弯曲点', exact: true }).click();
  const beforeBend = await wires.first().locator('.wire-line').getAttribute('data-points');
  await drag(page, board.locator('.route-handle'), 24, 20);
  expect(await wires.first().locator('.wire-line').getAttribute('data-points')).not.toEqual(beforeBend);
  const afterDrag = await wires.first().locator('.wire-line').getAttribute('data-points');
  await board.locator('.route-handle').focus();
  await page.keyboard.press('ArrowUp');
  expect(await wires.first().locator('.wire-line').getAttribute('data-points')).not.toEqual(afterDrag);
  await page.getByLabel('导线颜色', { exact: true }).selectOption('#b76b18');
  await expect(wires.first().locator('.wire-line')).toHaveAttribute('stroke', '#b76b18');
  expect(await terminals(page)).toEqual(graphBefore);
  await expect(page.getByText('3 件器材 · 3 根导线')).toBeVisible();
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('assembled-circuit.png'), fullPage: true });
  await page.getByRole('button', { name: '删除导线', exact: true }).click();
  await expect(page.getByText('3 件器材 · 2 根导线')).toBeVisible();
  await page.getByLabel('选择器材', { exact: true }).selectOption(resistorId);
  await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByText('2 件器材 · 2 根导线')).toBeVisible();
  await expect(page.getByText('0 条记录', { exact: true })).toBeVisible();
});

test('pointer library drag creates one item, equipment drag commits once, cancel rolls back and pan preserves metres', async ({ page }) => {
  await page.goto('/');
  const board = page.getByTestId('scene-board');
  const target = await box(board);
  const card = await box(page.locator(`[data-library-type="${POWER}"]`));
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(board.locator('[data-equipment-id]')).toHaveCount(1);
  const source = board.locator('[data-equipment-id]');
  const body = source.locator('.equipment-body');
  const beforeRevision = Number(await board.getAttribute('data-revision'));
  const bounds = await box(body);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y - 30, { steps: 5 });
  expect(Number(await board.getAttribute('data-revision'))).toBe(beforeRevision);
  await page.mouse.up();
  expect(Number(await board.getAttribute('data-revision'))).toBe(beforeRevision + 1);
  expect(Number(await source.getAttribute('data-x-m'))).toBeCloseTo(0.1, 5);
  expect(Number(await source.getAttribute('data-y-m'))).toBeCloseTo(0.05, 5);
  const afterX = await source.getAttribute('data-x-m');
  const afterY = await source.getAttribute('data-y-m');
  const cancelBounds = await box(body);
  await page.mouse.move(cancelBounds.x + cancelBounds.width / 2, cancelBounds.y + cancelBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelBounds.x + cancelBounds.width / 2 + 30, cancelBounds.y + cancelBounds.height / 2 + 30);
  await board.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
  await page.mouse.up();
  await expect(source).toHaveAttribute('data-x-m', afterX!);
  await expect(source).toHaveAttribute('data-y-m', afterY!);
  expect(Number(await board.getAttribute('data-revision'))).toBe(beforeRevision + 1);
  await page.getByRole('button', { name: '平移', exact: true }).click();
  const oldTransform = await body.getAttribute('transform');
  await page.mouse.move(target.x + 30, target.y + 50);
  await page.mouse.down();
  await page.mouse.move(target.x + 70, target.y + 70);
  await page.mouse.up();
  expect(await body.getAttribute('transform')).not.toEqual(oldTransform);
  await expect(source).toHaveAttribute('data-x-m', afterX!);
  expect(Number(await board.getAttribute('data-revision'))).toBe(beforeRevision + 1);
  await page.getByRole('button', { name: '复位视图', exact: true }).click();
  await body.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await source.getAttribute('data-x-m'))).toBeCloseTo(Number(afterX) + 0.01, 6);
  const beforeZoomRevision = await board.getAttribute('data-revision');
  await page.mouse.move(target.x + 80, target.y + 80);
  await page.mouse.wheel(0, -200);
  await expect(page.getByLabel('缩放比例')).toHaveText('122%');
  expect(Number(await source.getAttribute('data-x-m'))).toBeCloseTo(Number(afterX) + 0.01, 6);
  await expect(board).toHaveAttribute('data-revision', beforeZoomRevision!);
});

test('keyboard/click alternative supports placement, property validation and wires sharing apparatus posts', async ({ page }) => {
  await page.goto('/');
  const board = page.getByTestId('scene-board');
  const ids: string[] = [];
  for (const type of [POWER, RESISTOR]) {
    await page.locator(`[data-library-type="${type}"]`).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '在视口中心放置', exact: true }).focus();
    await page.keyboard.press('Enter');
    ids.push((await board.locator('[data-equipment-id]').last().getAttribute('data-equipment-id'))!);
  }
  await page.locator(`[data-library-type="${WIRE}"]`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '在视口中心放置', exact: true }).focus();
  await page.keyboard.press('Enter');
  const looseId = (await board.locator('[data-wire-id]').first().getAttribute('data-wire-id'))!;
  const select = page.getByLabel('选择器材', { exact: true });
  await select.selectOption(ids[0]!);
  await page.getByRole('button', { name: '正极 +', exact: true }).click();
  await page.getByRole('button', { name: '正极 +', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('同一接线柱不能连接到自己');
  await expect(page.getByText('2 件器材 · 1 根导线')).toBeVisible();
  await select.selectOption(ids[1]!);
  await page.getByLabel('电阻（Ω）', { exact: true }).fill('0');
  
  await expect(page.getByLabel('电阻（Ω）', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.live-properties').getByRole('status')).toContainText('输入未应用');
  await select.selectOption(ids[0]!);
  await select.selectOption(ids[1]!);
  await expect(page.getByLabel('电阻（Ω）', { exact: true })).toHaveValue('10');
  await page.getByLabel('位置 x（m）', { exact: true }).fill('0.25');
  await page.getByLabel('位置 y（m）', { exact: true }).fill('-0.05');
  await page.getByLabel('转角（°）', { exact: true }).fill('90');
  
  const dimensions = await box(board);
  const portTransform = await board.locator(`[data-equipment-id="${ids[1]}"] [data-port-id="a"]`).getAttribute('transform');
  const position = portTransform!.match(/translate\(([-\d.e+]+) ([-\d.e+]+)\)/)!;
  expect(Number(position[1])).toBeCloseTo(dimensions.width / 2 + 150, 6);
  expect(Number(position[2])).toBeCloseTo(dimensions.height / 2 + 75, 6);
  await page.getByRole('button', { name: '端点 A', exact: true }).click();
  await page.getByLabel('选择导线', { exact: true }).selectOption(looseId);
  await page.getByRole('button', { name: '连接线头 A', exact: true }).click();
  await select.selectOption(ids[0]!);
  await page.getByRole('button', { name: '正极 +', exact: true }).click();
  await page.getByRole('button', { name: '连接线头 B', exact: true }).click();
  await select.selectOption(ids[1]!);
  await page.getByRole('button', { name: '端点 A', exact: true }).click();
  await expect(page.getByText('2 件器材 · 2 根导线')).toBeVisible();
  const graph = await terminals(page);
  expect(graph.every(edge => JSON.parse(edge[0]!)[0] === ids[0] && JSON.parse(edge[1]!)[0] === ids[1])).toBe(true);
  await page.getByRole('button', { name: '新建实验' }).click();
  await expect(page.getByText('0 件器材 · 0 根导线')).toBeVisible();
});

test.describe('touch pointer interaction', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test('tap placement, real touch drag and tap-to-connect work', async ({ page, context }, testInfo) => {
    await page.goto('/');
    const board = page.getByTestId('scene-board');
    await page.locator(`[data-library-type="${POWER}"]`).tap();
    const bounds = await box(board);
    await page.touchscreen.tap(bounds.x + bounds.width / 2 - 55, bounds.y + bounds.height / 2 - 65);
    const source = board.locator(`[data-equipment-type="${POWER}"]`);
    await expect(source).toHaveCount(1);
    const originalX = Number(await source.getAttribute('data-x-m'));
    const body = await box(source.locator('.equipment-body'));
    const x = body.x + body.width / 2;
    const y = body.y + body.height / 2;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let index = 1; index <= 5; index++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 12 * index, y, id: 1 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(Number(await source.getAttribute('data-x-m'))).toBeCloseTo(originalX + 0.1, 5);
    await page.locator(`[data-library-type="${RESISTOR}"]`).tap();
    await expect(page.locator(`[data-library-type="${RESISTOR}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.touchscreen.tap(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 70);
    const resistor = board.locator(`[data-equipment-type="${RESISTOR}"]`);
    await expect(resistor).toHaveCount(1);
    await source.locator('[data-port-id="positive"]').tap();
    await resistor.locator('[data-port-id="a"]').tap();
    await expect(page.getByText('2 件器材 · 1 根导线')).toBeVisible();
    await expect(page.locator('.canvas-prompt')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('touch-assembly.png'), fullPage: true });
    await session.detach();
  });
});

test('low zoom keeps terminals distinct and Escape cancels from the inspector', async ({ page }) => {
  await page.goto('/');
  const source = await place(page, POWER, -0.1, 0);
  const resistor = await place(page, RESISTOR, 0.15, 0);
  for (let index = 0; index < 10; index++) await page.getByRole('button', { name: '缩小', exact: true }).click();
  await expect(page.getByLabel('缩放比例')).toHaveText('17%');
  await source.locator('[data-port-id="positive"]').click();
  await expect(source.locator('[data-port-id="positive"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.canvas-prompt')).toContainText('正极 +');
  await page.getByLabel('选择器材', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-prompt')).toHaveCount(0);
  await source.locator('[data-port-id="positive"]').click();
  await resistor.locator('[data-port-id="a"]').click();
  await expect(page.getByText('2 件器材 · 1 根导线')).toBeVisible();
  const graph = await terminals(page);
  expect(JSON.parse(graph[0]![0]!)[1]).toBe('positive');
  expect(JSON.parse(graph[0]![1]!)[1]).toBe('a');
});
