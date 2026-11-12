import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function open(page: Page, choice = '探究浮力的影响因素') {
  await page.goto('/');
  await openFamily(page, '浮力实验');
  await page.getByRole('radio', { name: choice, exact: true }).check();
  await page.getByRole('button', { name: '进入实验' }).click();
  await page.getByRole('button', { name: '确认替换当前实验' }).click();
}
async function mount(page: Page, value: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption('buoy-meter');
  await page.getByLabel('支架挂接高度（m）', { exact: true }).fill(value);
}
async function capture(page: Page, phase: string, raw: string) {
  await page.getByLabel('本次浮力读数阶段').selectOption(phase);
  await page.getByLabel(/^浮力手工读数/).fill(raw);
  await page.getByRole('button', { name: '保存本次浮力读数' }).click();
}
async function calculate(page: Page, method: string, count: number) {
  await page.getByLabel('浮力计算方法').selectOption(method);
  for (let index = 1; index <= count; index++) {
    const select = page.getByLabel(`浮力来源${index}`, { exact: true });
    await select.selectOption((await select.locator('option').nth(1).getAttribute('value'))!);
  }
  await page.getByRole('button', { name: '按所选来源计算浮力结果' }).click();
}

test('immersing the cylinder immediately changes the meter and produces traceable measurements', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const board = page.getByTestId('scene-board'), pointer = board.locator('[data-force-meter-pointer]');
  await expect(page.locator('[data-library-type="mechanical.overflow-can"]')).toBeVisible();
  await expect(pointer).toHaveAttribute('data-applied-force-n', '1');
  await expect(page.getByLabel('施加拉力（N）')).toHaveCount(0);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await capture(page, 'air', '1');
  await mount(page, '.39125');
  expect(Number(await pointer.getAttribute('data-applied-force-n'))).toBeCloseTo(.75, 6);
  await capture(page, 'immersed', '.75');
  await capture(page, 'depth', '2.5');
  await calculate(page, 'force', 3);
  await expect(page.locator('[data-measurement-id]')).toHaveCount(6);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await page.getByLabel('图线类型', { exact: true }).selectOption('buoyancy-volume');
  await expect(page.getByTestId('measurement-chart')).toBeVisible();
  await mount(page, '.35');
  expect(Number(await pointer.getAttribute('data-applied-force-n'))).toBeCloseTo(.5, 6);
  await page.getByLabel('选择器材', { exact: true }).selectOption('buoy-vessel');
  await page.getByLabel('液体密度（kg/m³）', { exact: true }).fill('1200');
  expect(Number(await pointer.getAttribute('data-applied-force-n'))).toBeCloseTo(.4, 6);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByRole('heading', { name: '探究浮力的影响因素', exact: true })).toBeVisible();
  await expect(page.locator('[data-measurement-id]')).toHaveCount(6);
  await page.screenshot({ path: info.outputPath('buoyancy-factors.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('weighs and measures displaced water, preserves it on withdrawal and supports undo', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, '验证阿基米德原理');
  const board = page.getByTestId('scene-board');
  const trim = page.getByRole('slider', { name: '调零螺母', exact: true });
  await trim.focus(); await trim.press('Home');
  for (let index = 0; index < 13; index++) await trim.press('ArrowRight');
  await page.getByLabel('接液杯位置').selectOption('buoy-balance');
  await page.getByRole('button', { name: '砝码3 20 g', exact: true }).click();
  await page.getByRole('button', { name: '砝码5 10 g', exact: true }).click();
  await expect(page.getByTestId('buoyancy-balance-status')).toContainText('指针对准中央');
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await capture(page, 'empty', '30'); await capture(page, 'air', '1');
  await page.getByRole('button', { name: '接液杯移到出水口下方' }).click();
  await page.getByRole('button', { name: '加至溢水口并排尽多余液体' }).click();
  await mount(page, '.35');
  await expect(page.getByTestId('buoyancy-spill-status')).toContainText('50.0 mL，漏接 0.0');
  await capture(page, 'immersed', '.5'); await calculate(page, 'force', 2);
  await mount(page, '.60');
  await expect(page.getByTestId('buoyancy-spill-status')).toContainText('50.0 mL');
  await page.getByLabel('接液杯位置').selectOption('buoy-balance');
  await page.getByRole('button', { name: '砝码2 50 g', exact: true }).click();
  await expect(page.getByTestId('buoyancy-balance-status')).toContainText('指针对准中央');
  await capture(page, 'full', '80'); await calculate(page, 'weight', 3);
  await page.getByRole('button', { name: '将接液杯液体全部倒入空量筒' }).click();
  const cylinder = board.locator('[data-equipment-id="buoy-cylinder"] [data-liquid-fill]');
  expect(Number(await cylinder.getAttribute('data-volume-m3'))).toBeCloseTo(.00005, 8);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect(Number(await cylinder.getAttribute('data-volume-m3'))).toBe(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await capture(page, 'volume', '50'); await calculate(page, 'volume', 2);
  await expect(page.locator('[data-measurement-id]')).toHaveCount(11);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
  const csv = await readFile((await (await download).path())!, 'utf8');
  expect(csv).toContain('排液重力'); expect(csv).toContain('"mL"');
  await page.screenshot({ path: info.outputPath('buoyancy-archimedes.png'), fullPage: true });
});

test('drag previews cancel atomically and a round trip keeps the water it displaced', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, '验证阿基米德原理');
  await page.getByRole('button', { name: '加至溢水口并排尽多余液体' }).click();
  const meter = page.getByTestId('scene-board').locator('[data-equipment-id="buoy-meter"] [data-force-meter-status] rect');
  async function immerse() {
    const box = (await meter.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y + 120, { steps: 15 });
    await expect(page.getByTestId('buoyancy-spill-status')).toContainText('50.0 mL');
    return { x, y };
  }
  await immerse(); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.getByTestId('buoyancy-spill-status')).toContainText('0.0 mL，漏接 0.0');
  const origin = await immerse();
  await page.mouse.move(origin.x, origin.y, { steps: 15 }); await page.mouse.up();
  await expect(page.getByTestId('buoyancy-spill-status')).toContainText('50.0 mL');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByTestId('buoyancy-spill-status')).toContainText('0.0 mL，漏接 0.0');
});

test.describe('touch buoyancy', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  // Chromium CDP 的 touchCancel 在最小 HTML 中也会抑制后续兼容 click；取消与提交使用独立浏览器上下文。
  test('touch dragging updates the force and cancellation restores the original scene', async ({ page, context }) => {
    await open(page);
    const board = page.getByTestId('scene-board'), meter = board.locator('[data-equipment-id="buoy-meter"] [data-force-meter-status] rect');
    await board.scrollIntoViewIfNeeded();
    const box = (await meter.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page), pointer = board.locator('[data-force-meter-pointer]'), revision = Number(await board.getAttribute('data-revision'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 72.5, id: 1 }] });
    expect(Number(await pointer.getAttribute('data-applied-force-n'))).toBeCloseTo(.5, 5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(pointer).toHaveAttribute('data-applied-force-n', '1');
    await expect(board).toHaveAttribute('data-revision', String(revision));
    await cdp.detach();
  });
  test('touch controls undo immediately and native dragging remains one history entry', async ({ page, context }) => {
    await open(page);
    const board = page.getByTestId('scene-board'), meter = board.locator('[data-equipment-id="buoy-meter"] [data-force-meter-status] rect');
    await mount(page, '.35');
    await expect(board.locator('[data-force-meter-pointer]')).toHaveAttribute('data-applied-force-n', '0.5');
    await page.getByRole('button', { name: '撤销', exact: true }).tap();
    await expect(board.locator('[data-force-meter-pointer]')).toHaveAttribute('data-applied-force-n', '1');
    await board.scrollIntoViewIfNeeded();
    const box = (await meter.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page), pointer = board.locator('[data-force-meter-pointer]'), revision = Number(await board.getAttribute('data-revision'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 72.5, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(board).toHaveAttribute('data-revision', String(revision + 1));
    expect(Number(await pointer.getAttribute('data-applied-force-n'))).toBeCloseTo(.5, 5);
    await cdp.detach();
    // CDP 原生拖动之后用键盘激活同一按钮，避开浏览器兼容点击抑制；上面独立保留了真实轻点撤销断言。
    await page.getByRole('button', { name: '撤销', exact: true }).press('Enter');
    await expect(board).toHaveAttribute('data-revision', String(revision + 2));
    await expect(pointer).toHaveAttribute('data-applied-force-n', '1');
  });
  test('blank assembly accepts shared apparatus and new physical equipment', async ({ page }) => {
    await open(page, '空白搭建浮力实验');
    for (const type of ['mechanical.support', 'mechanical.force-meter', 'mechanical.buoyancy-body', 'mechanical.density-beaker']) {
      await page.locator(`[data-library-type="${type}"]`).tap();
      await page.getByRole('button', { name: '在视口中心放置' }).tap();
      await expect(page.getByTestId('scene-board').locator(`[data-equipment-type="${type}"]`)).toHaveCount(1);
    }
    await page.getByLabel('杯内液体体积（m³）', { exact: true }).fill('.0004');
    await expect(page.getByTestId('scene-board').locator('[data-buoyancy-container]')).toHaveAttribute('data-buoyancy-liquid-m3', '0.0004');
    await page.getByLabel('杯内液体体积（m³）', { exact: true }).fill('0');
    await page.getByRole('button', { name: '烧杯补充 400 mL 液体' }).tap();
    await expect(page.getByTestId('scene-board').locator('[data-buoyancy-container]')).toHaveAttribute('data-buoyancy-liquid-m3', '0.0004');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
