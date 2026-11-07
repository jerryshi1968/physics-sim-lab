import { test, expect } from '@playwright/test';

for (const touch of [false, true]) test.describe(touch ? 'touch wire points' : 'mouse wire points', () => {
  test.use({ hasTouch: touch, viewport: { width: 1366, height: 900 } });
  test('individual points can be added, removed, undone and saved without changing terminals', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    const board = page.getByTestId('scene-board');
    const bounds = (await board.boundingBox())!;
    for (const [type, offset] of [['electrical.power-supply', -140], ['electrical.resistor', 140]] as const) {
      await page.locator(`[data-library-type="${type}"]`).click();
      await page.mouse.click(bounds.x + bounds.width / 2 + offset, bounds.y + bounds.height / 2);
    }
    await board.locator('[data-port-id="positive"]').click();
    await board.locator('[data-port-id="a"]').click();
    const wire = board.locator('[data-wire-id]');
    const id = (await wire.getAttribute('data-wire-id'))!;
    const from = await wire.getAttribute('data-from'), to = await wire.getAttribute('data-to');
    await page.getByLabel('选择导线', { exact: true }).selectOption(id);
    const handles = board.locator('.route-handle');
    const add = page.getByRole('button', { name: '添加弯曲点', exact: true });
    const clear = page.getByRole('button', { name: '清除弯曲点', exact: true });
    const points = async () => (await wire.locator('.wire-line').getAttribute('data-points'))!.split(' ');
    for (let index = 0; index < 4; index++) await add.click();
    await expect(handles).toHaveCount(4);
    const original = await points();
    if (touch) await page.getByRole('button', { name: '删除弯曲点 2', exact: true }).tap();
    else {
      await handles.nth(1).scrollIntoViewIfNeeded();
      const point = (await handles.nth(1).boundingBox())!;
      await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2, { button: 'right' });
    }
    await expect(handles).toHaveCount(3);
    expect(await points()).toEqual(original.filter((_, index) => index !== 2));
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    expect(await points()).toEqual(original);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await page.getByLabel('选择导线', { exact: true }).selectOption(id);
    await handles.nth(1).focus();
    await page.keyboard.press('Delete');
    await expect(handles).toHaveCount(2);
    await expect(wire).toHaveCount(1);
    await handles.first().focus();
    await page.keyboard.press('Backspace');
    await expect(handles).toHaveCount(1);
    await page.getByRole('button', { name: '删除弯曲点 1', exact: true }).click();
    await expect(handles).toHaveCount(0);
    await expect(clear).toBeDisabled();
    await add.click();
    await expect(handles).toHaveCount(1);
    await clear.click();
    await expect(handles).toHaveCount(0);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.getByLabel('选择导线', { exact: true }).selectOption(id);
    await expect(handles).toHaveCount(1);
    await expect(wire).toHaveAttribute('data-from', from!);
    await expect(wire).toHaveAttribute('data-to', to!);
    const saved = await points();
    await page.screenshot({ path: testInfo.outputPath('wire-points.png'), fullPage: true });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByTestId('save-state')).toHaveText('已保存');
    await page.reload();
    await expect(wire).toHaveCount(1);
    expect(await points()).toEqual(saved);
    await expect(wire).toHaveAttribute('data-from', from!);
    await expect(wire).toHaveAttribute('data-to', to!);
  });
});
