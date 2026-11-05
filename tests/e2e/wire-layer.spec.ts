import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createEmptyScene } from '../../src/core/scene/create.ts';
import { createElectricalRegistry, RESISTOR, AMMETER } from '../../src/equipment/electrical/definitions.ts';

async function overlapScene(page: Page) {
  const registry = createElectricalRegistry(), scene = createEmptyScene('wire-layer.test', '2026-11-04T00:00:00.000Z');
  scene.equipment = [[RESISTOR, 'left', -.3], [RESISTOR, 'right', .3], [AMMETER, 'meter', 0]].map(([type, id, x]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x), yM: 0, rotationRad: 0 },
  }));
  scene.connections = [{ id: 'overlap', kind: 'wire', from: { equipmentId: 'left', portId: 'b' }, to: { equipmentId: 'right', portId: 'a' }, routeWorldM: [{ x: 0, y: 0 }] }];
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '导线前景.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}

for (const touch of [false, true]) test.describe(touch ? 'touch foreground wires' : 'mouse foreground wires', () => {
  test.use({ hasTouch: touch, viewport: { width: 1366, height: 900 } });
  test('wire crossing a meter stays visible and selectable while actual terminal centres remain connectable', async ({ page }, testInfo) => {
    await overlapScene(page);
    const board = page.getByTestId('scene-board'), wire = board.locator('[data-wire-id="overlap"]');
    const middle = await wire.locator('.wire-line').evaluate(element => {
      const path = element as SVGGeometryElement;
      const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
      return { x: point.x, y: point.y };
    });
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-wire-id]')?.getAttribute('data-wire-id'), middle)).toBe('overlap');
    if (touch) await page.touchscreen.tap(middle.x, middle.y);
    else {
      const revision = Number(await board.getAttribute('data-revision'));
      await page.mouse.move(middle.x, middle.y); await page.mouse.down();
      await page.mouse.move(middle.x, middle.y - 24, { steps: 6 }); await page.mouse.up();
      await expect(board).toHaveAttribute('data-revision', String(revision + 1));
      await expect(board.locator('.route-handle')).toHaveCount(1);
      await page.getByRole('button', { name: '撤销', exact: true }).click();
      await page.mouse.click(middle.x, middle.y);
    }
    await expect(wire.locator('.wire-line')).toHaveClass(/is-selected/);
    const start = board.locator('[data-equipment-id="left"] [data-port-id="a"]');
    const target = board.locator('[data-equipment-id="meter"] [data-port-id="low"]');
    if (touch) { await start.tap(); await target.tap(); } else { await start.click(); await target.click(); }
    await expect(board.locator('[data-wire-id]')).toHaveCount(2);
    const second = board.locator('[data-wire-id]').last();
    await expect(second).toHaveAttribute('data-to', JSON.stringify(['meter', 'low']));
    await page.getByLabel('选择器材', { exact: true }).selectOption('meter');
    if (touch) await target.tap(); else await target.click();
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(touch ? 'wire-layer-touch.png' : 'wire-layer-mouse.png'), fullPage: true });
  });
});
