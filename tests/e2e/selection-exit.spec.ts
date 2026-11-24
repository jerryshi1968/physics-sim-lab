import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { createElectricalRegistry, POWER, RESISTOR, RHEOSTAT } from '../../src/equipment/electrical/definitions.ts';

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing interaction target');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function load(page: Page) {
  const scene = createEmptyScene('selection-exit.test', '2026-11-24T00:00:00.000Z');
  const registry = createElectricalRegistry();
  scene.viewport = { centerXM: 0, centerYM: 0, pixelsPerM: 400 };
  scene.equipment = [[POWER, 'source', -.3, .15], [RESISTOR, 'resistor', .3, .15], [RHEOSTAT, 'slider', 0, -.1]].map(([type, id, xM, yM]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(xM), yM: Number(yM), rotationRad: 0 },
  }));
  scene.connections = [{ id: 'loose', kind: 'wire', from: null, to: null, freeFromWorldM: { x: -.25, y: -.3 }, freeToWorldM: { x: .25, y: -.3 } }];
  await page.goto('/');
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'selection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  return page.getByTestId('scene-board');
}

for (const touch of [false, true]) test.describe(touch ? 'native touch selection exit' : 'mouse selection exit', () => {
  test.use({ hasTouch: touch, viewport: { width: 1366, height: 900 } });

  test('wire and equipment replace each other; body, blank and Escape cancel pending wiring without editing the scene', async ({ page }) => {
    const board = await load(page);
    const source = board.locator('[data-equipment-id="source"]');
    const resistor = board.locator('[data-equipment-id="resistor"] .equipment-body');
    const wire = board.locator('[data-wire-id="loose"]');
    const end = board.locator('[data-wire-end-of="loose"] [data-wire-end="from"]');
    const post = source.locator('[data-port-id="positive"]');
    const prompt = page.locator('.canvas-prompt');
    const revision = (await board.getAttribute('data-revision'))!;
    async function tap(target: Locator) { if (touch) await target.tap(); else await target.click(); }
    async function blank() {
      const box = (await board.boundingBox())!;
      if (touch) await page.touchscreen.tap(box.x + 30, box.y + 30);
      else await page.mouse.click(box.x + 30, box.y + 30);
    }
    async function cleared() {
      await expect(board.locator('.equipment-body[data-selected="true"]')).toHaveCount(0);
      await expect(board.locator('.wire-line.is-selected')).toHaveCount(0);
      await expect(prompt).toHaveCount(0);
      await expect(board.locator('.equipment-port.is-active')).toHaveCount(0);
    }
    const curve = await wire.locator('.wire-hit').evaluate(element => {
      const path = element as SVGGeometryElement;
      const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
      return { x: point.x, y: point.y };
    });
    if (touch) await page.touchscreen.tap(curve.x, curve.y); else await page.mouse.click(curve.x, curve.y);
    await expect(wire.locator('.wire-line')).toHaveClass(/is-selected/);
    await tap(resistor);
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    await expect(wire.locator('.wire-line')).not.toHaveClass(/is-selected/);
    await tap(end);
    await expect(prompt).toBeVisible();
    await tap(resistor);
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    await expect(prompt).toHaveCount(0);
    await tap(end);
    await blank();
    await cleared();
    await tap(post);
    await expect(post).toHaveAttribute('aria-pressed', 'true');
    await tap(resistor);
    await expect(post).toHaveAttribute('aria-pressed', 'false');
    await tap(post);
    await blank();
    await cleared();
    await tap(post);
    await expect(post).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await cleared();
    await tap(end);
    await page.keyboard.press('Escape');
    await cleared();
    await tap(resistor);
    await page.keyboard.press('Escape');
    await cleared();
    await tap(end);
    await page.getByLabel('选择器材', { exact: true }).selectOption('resistor');
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    await expect(prompt).toHaveCount(0);
    await tap(end);
    await tap(board.locator('[data-equipment-id="slider"] .rheostat-slider'));
    await expect(board.locator('[data-equipment-id="slider"] .equipment-body')).toHaveAttribute('data-selected', 'true');
    await expect(prompt).toHaveCount(0);
    await page.keyboard.press('Escape');
    await cleared();
    await expect(board).toHaveAttribute('data-revision', revision);
    await expect(wire).toHaveAttribute('data-from', 'null');
    await expect(board.locator('[data-wire-id]')).toHaveCount(1);
    await tap(post);
    await tap(board.locator('[data-equipment-id="resistor"] [data-port-id="a"]'));
    await expect(board.locator('[data-wire-id]')).toHaveCount(2);
    await expect(prompt).toHaveCount(0);
    await expect(board).toHaveAttribute('data-revision', String(Number(revision) + 1));
  });

  test('end dragging finishes wiring; pan taps select or clear while pan drags only move the view', async ({ page, context }) => {
    const board = await load(page);
    const resistor = board.locator('[data-equipment-id="resistor"] .equipment-body');
    const source = board.locator('[data-equipment-id="source"]');
    const wire = board.locator('[data-wire-id="loose"]');
    const from = board.locator('[data-wire-end-of="loose"] [data-wire-end="from"]');
    const to = board.locator('[data-wire-end-of="loose"] [data-wire-end="to"]');
    const session = touch ? await context.newCDPSession(page) : null;
    async function tap(target: Locator) { if (touch) await target.tap(); else await target.click(); }
    async function drag(a: { x: number; y: number }, b: { x: number; y: number }) {
      if (session) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
        for (let i = 1; i <= 6; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
      }
    }
    await drag(await centre(from), await centre(source.locator('[data-port-id="positive"]')));
    await expect(from).toHaveAttribute('data-attached', 'true');
    await expect(page.locator('.canvas-prompt')).toHaveCount(0);
    await tap(resistor);
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    await tap(to);
    await tap(board.locator('[data-equipment-id="resistor"] [data-port-id="a"]'));
    await expect(wire).toHaveAttribute('data-to', JSON.stringify(['resistor', 'a']));
    await expect(page.locator('.canvas-prompt')).toHaveCount(0);
    const revision = (await board.getAttribute('data-revision'))!;
    const xM = (await source.getAttribute('data-x-m'))!;
    const pan = page.getByRole('button', { name: '平移', exact: true });
    await pan.click();
    await tap(resistor);
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    const box = (await board.boundingBox())!;
    const blank = { x: box.x + 30, y: box.y + 30 };
    if (touch) await page.touchscreen.tap(blank.x, blank.y); else await page.mouse.click(blank.x, blank.y);
    await expect(board.locator('.equipment-body[data-selected="true"]')).toHaveCount(0);
    const before = await centre(source.locator('.equipment-body'));
    await drag(blank, { x: blank.x + 40, y: blank.y + 20 });
    const after = await centre(source.locator('.equipment-body'));
    expect(after.x - before.x).toBeCloseTo(40, 3);
    expect(after.y - before.y).toBeCloseTo(20, 3);
    await expect(source).toHaveAttribute('data-x-m', xM);
    await expect(board).toHaveAttribute('data-revision', revision);
    await page.getByLabel('选择器材', { exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(pan).toHaveAttribute('aria-pressed', 'false');
    await expect(board.locator('.wire-line.is-selected')).toHaveCount(0);
    await tap(resistor);
    await expect(resistor).toHaveAttribute('data-selected', 'true');
    await session?.detach();
  });
});
