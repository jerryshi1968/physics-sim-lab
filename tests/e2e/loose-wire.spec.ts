import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const POWER = 'electrical.power-supply';
const RESISTOR = 'electrical.resistor';
const WIRE = 'electrical.wire';

async function centre(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Missing target');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function place(page: Page, type: string, dx: number, dy: number) {
  await page.locator(`[data-library-type="${type}"]`).click();
  const board = page.getByTestId('scene-board');
  const point = await centre(board);
  await page.mouse.click(point.x + dx, point.y + dy);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 7 });
  await page.mouse.up();
}

async function onCurve(locator: Locator) {
  return locator.evaluate(element => {
    const path = element as SVGGeometryElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
}

async function points(locator: Locator) {
  return (await locator.getAttribute('data-points'))!.split(' ').map(pair => pair.split(',').map(Number));
}

test('physical apparatus and single-cell battery preview replace symbols; loose wire can be dropped, moved, bent and rewired', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await expect(page.locator('[data-library-type="electrical.junction"]')).toHaveCount(0);
  const batteryPreview = page.locator(`[data-library-type="${POWER}"]`);
  await expect(batteryPreview.locator('[data-appearance="physical"]')).toHaveCount(1);
  await expect(batteryPreview.locator('[data-battery-cell]')).toHaveCount(1);
  await expect(batteryPreview.locator('svg text')).toHaveText(['3 V', '+', '−']);
  await place(page, POWER, -140, -40);
  await place(page, RESISTOR, 140, -40);
  const board = page.getByTestId('scene-board');
  await expect(board.locator('[data-appearance="physical"]')).toHaveCount(2);
  const source = board.locator(`[data-equipment-type="${POWER}"]`);
  await expect(source.locator('[data-battery-cell]')).toHaveCount(1);
  await expect(source.locator('.real-apparatus text')).toHaveText(['3 V', '+', '−']);
  await page.getByLabel('选择器材', { exact: true }).selectOption((await source.getAttribute('data-equipment-id'))!);
  await page.getByLabel('电源电压（V）', { exact: true }).fill('9');
  
  await expect(source.locator('[data-battery-voltage]')).toHaveText('9 V');
  await expect(batteryPreview.locator('[data-battery-voltage]')).toHaveText('3 V');
  const resistor = board.locator(`[data-equipment-type="${RESISTOR}"]`);
  const target = await centre(board);
  await page.locator(`[data-library-type="${WIRE}"]`).scrollIntoViewIfNeeded();
  await drag(page, await centre(page.locator(`[data-library-type="${WIRE}"]`)), { x: target.x, y: target.y + 60 });
  await expect(page.getByText('2 件器材 · 1 根导线')).toBeVisible();
  const wire = board.locator('[data-wire-id]');
  const id = (await wire.getAttribute('data-wire-id'))!;
  const ends = board.locator(`[data-wire-end-of="${id}"]`);
  await expect(wire).toHaveAttribute('data-from', 'null');
  await expect(wire).toHaveAttribute('data-to', 'null');
  const original = await points(wire.locator('.wire-line'));
  const mid = await onCurve(wire.locator('.wire-hit'));
  await drag(page, mid, { x: mid.x + 30, y: mid.y + 15 });
  const moved = await points(wire.locator('.wire-line'));
  expect(moved[0]![0]! - original[0]![0]!).toBeCloseTo(30, 5);
  expect(moved[moved.length - 1]![1]! - original[original.length - 1]![1]!).toBeCloseTo(15, 5);
  const bend = await centre(board.locator('.route-handle').first());
  const beforePath = await wire.locator('.wire-line').getAttribute('d');
  await drag(page, bend, { x: bend.x, y: bend.y - 35 });
  expect(await wire.locator('.wire-line').getAttribute('d')).not.toEqual(beforePath);
  await expect(wire).toHaveAttribute('data-from', 'null');
  const sourcePost = await centre(source.locator('[data-port-id="positive"]'));
  await drag(page, await centre(ends.locator('[data-wire-end="from"]')), sourcePost);
  await expect(ends.locator('[data-wire-end="from"]')).toHaveAttribute('data-attached', 'true');
  await drag(page, await centre(ends.locator('[data-wire-end="to"]')), sourcePost);
  await expect(page.getByRole('alert')).toContainText('同一接线柱不能连接到自己');
  await expect(wire).toHaveAttribute('data-to', 'null');
  await drag(page, await centre(ends.locator('[data-wire-end="to"]')), await centre(resistor.locator('[data-port-id="a"]')));
  await expect(ends.locator('[data-wire-end="to"]')).toHaveAttribute('data-attached', 'true');
  await page.getByRole('button', { name: '拔开线头 A', exact: true }).click();
  await expect(wire).toHaveAttribute('data-from', 'null');
  await page.getByRole('button', { name: '连接线头 A', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption((await source.getAttribute('data-equipment-id'))!);
  await page.getByRole('button', { name: '正极 +', exact: true }).click();
  await expect(ends.locator('[data-wire-end="from"]')).toHaveAttribute('data-attached', 'true');
  const attachedBefore = await points(wire.locator('.wire-line'));
  const position = await onCurve(wire.locator('.wire-hit'));
  await drag(page, position, { x: position.x + 15, y: position.y - 30 });
  const attachedAfter = await points(wire.locator('.wire-line'));
  expect(attachedAfter[0]).toEqual(attachedBefore[0]);
  expect(attachedAfter[attachedAfter.length - 1]).toEqual(attachedBefore[attachedBefore.length - 1]);
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await board.focus();
  await page.screenshot({ path: testInfo.outputPath('real-apparatus.png'), fullPage: true });
});

test.describe('touch wire editing', () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });
  test('touch can move a loose wire, bend it and attach both ends to actual posts', async ({ page, context }, testInfo) => {
    await page.goto('/');
    const board = page.getByTestId('scene-board');
    const middle = await centre(board);
    for (const [type, x, y] of [[POWER, -65, -110], [RESISTOR, 55, 75], [WIRE, 0, 0]] as const) {
      await page.locator(`[data-library-type="${type}"]`).tap();
      await page.touchscreen.tap(middle.x + x, middle.y + y);
    }
    const wire = board.locator('[data-wire-id]');
    await expect(wire).toHaveCount(1);
    const session = await context.newCDPSession(page);
    async function touchDrag(from: { x: number; y: number }, to: { x: number; y: number }) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
      for (let index = 1; index <= 5; index++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * index / 5, y: from.y + (to.y - from.y) * index / 5, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    const original = await points(wire.locator('.wire-line'));
    const mid = await onCurve(wire.locator('.wire-hit'));
    await touchDrag(mid, { x: mid.x + 20, y: mid.y + 25 });
    const moved = await points(wire.locator('.wire-line'));
    expect(moved[0]![0]! - original[0]![0]!).toBeCloseTo(20, 4);
    const bend = await centre(board.locator('.route-handle').first());
    const path = await wire.locator('.wire-line').getAttribute('d');
    await touchDrag(bend, { x: bend.x - 15, y: bend.y - 25 });
    expect(await wire.locator('.wire-line').getAttribute('d')).not.toEqual(path);
    const id = (await wire.getAttribute('data-wire-id'))!;
    const ends = board.locator(`[data-wire-end-of="${id}"]`);
    await touchDrag(await centre(ends.locator('[data-wire-end="from"]')), await centre(board.locator(`[data-equipment-type="${POWER}"] [data-port-id="positive"]`)));
    await expect(ends.locator('[data-wire-end="from"]')).toHaveAttribute('data-attached', 'true');
    await touchDrag(await centre(ends.locator('[data-wire-end="to"]')), await centre(board.locator(`[data-equipment-type="${RESISTOR}"] [data-port-id="a"]`)));
    await expect(ends.locator('[data-wire-end="to"]')).toHaveAttribute('data-attached', 'true');
    await expect(page.locator('.canvas-prompt')).toHaveCount(0);
    await board.focus();
    await page.screenshot({ path: testInfo.outputPath('touch-wire.png'), fullPage: true });
    await session.detach();
  });
});
