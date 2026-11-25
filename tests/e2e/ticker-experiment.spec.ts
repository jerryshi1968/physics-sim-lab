import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '高中物理实验', exact: true }).click();
  await selectCatalogOption(page, 'ticker');
  await page.getByRole('button', { name: '进入实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}
async function scale(page: Page) {
  return page.locator('[data-equipment-id="ticker"] .equipment-body').evaluate(element => Math.abs((element as SVGGraphicsElement).getScreenCTM()!.a));
}
async function center(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function rulerGrip(page: Page) {
  return page.getByTestId('ticker-ruler').evaluate(element => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
    return { x: matrix.e + .05 * matrix.a, y: matrix.f + 38 };
  });
}
async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }, touch = false, steps = 12, delay = 20) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    for (let i = 1; i <= steps; i++) {
      const point = { x: start.x + (end.x - start.x) * i / steps, y: start.y + (end.y - start.y) * i / steps };
      if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      else await page.mouse.move(point.x, point.y);
      if (delay) await page.waitForTimeout(delay);
    }
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
  } finally { await cdp?.detach(); }
}
async function produce(page: Page, touch = false, variable = false) {
  await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
  const click = async (name: string) => { const button = page.getByRole('button', { name, exact: true }), control = name === '固定计时器夹具' ? button.locator('rect') : button; if (touch) await control.tap(); else await control.click(); };
  await click('查看纸带全景');
  const fixed = page.getByRole('button', { name: '固定计时器夹具', exact: true });
  if (await fixed.getAttribute('aria-pressed') === 'true') await click('固定计时器夹具');
  const from = await center(page, '[data-testid="ticker-paper"] > rect');
  const machine = await center(page, '[data-equipment-id="ticker"] .equipment-body');
  await drag(page, from, machine, touch, 6, 5);
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-installed', 'true');
  await click('固定计时器夹具');
  await expect(fixed).toHaveAttribute('aria-pressed', 'true');
  const switchBox = (await page.getByRole('button', { name: '计时器电源开关', exact: true }).boundingBox())!, gripBox = (await page.getByTestId('ticker-pull-grip').boundingBox())!;
  expect(gripBox.x).toBeGreaterThan(switchBox.x + switchBox.width);
  await click('计时器电源开关');
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'true');
  await page.waitForTimeout(180);
  const p = await center(page, '[data-testid="ticker-pull-grip"] > rect'), ppm = await scale(page);
  await drag(page, p, { x: p.x + .24 * ppm, y: p.y }, touch, variable ? 8 : 20, variable ? 65 : 28);
  if (variable) {
    const next = await center(page, '[data-testid="ticker-pull-grip"] > rect');
    await drag(page, next, { x: next.x + .16 * ppm, y: next.y }, touch, 8, 16);
  }
  const atRest = Number(await page.getByTestId('ticker-apparatus').getAttribute('data-displacement-m'));
  await page.waitForTimeout(100);
  expect(Number(await page.getByTestId('ticker-apparatus').getAttribute('data-displacement-m'))).toBe(atRest);
  await click('计时器电源开关');
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'false');
  await click('固定计时器夹具');
  await expect(fixed).toHaveAttribute('aria-pressed', 'false');
  const paper = await center(page, '[data-testid="ticker-paper"] > rect');
  const originX = Number(await page.getByTestId('ticker-apparatus').getAttribute('data-paper-x-m'));
  const originY = Number(await page.getByTestId('ticker-apparatus').getAttribute('data-paper-y-m'));
  await drag(page, paper, { x: paper.x + (.42 - originX) * ppm, y: paper.y + (-.11 - originY) * -ppm }, touch, 10, 10);
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-taken', 'true');
  expect(Number(await page.getByTestId('ticker-apparatus').getAttribute('data-paper-x-m'))).toBeCloseTo(.42, 6);
  expect(Number(await page.getByTestId('ticker-apparatus').getAttribute('data-paper-y-m'))).toBeCloseTo(-.11, 6);
  const rulerStart = await rulerGrip(page);
  const rulerYM = Number(await page.locator('[data-equipment-id="ruler"]').getAttribute('data-y-m'));
  await drag(page, rulerStart, { x: rulerStart.x, y: rulerStart.y + (-.11 - rulerYM) * -ppm }, touch, 8, 8);
  expect(Number(await page.locator('[data-equipment-id="ruler"]').getAttribute('data-y-m'))).toBeCloseTo(-.11, 6);
}
async function selectClearPoints(page: Page, n = 5) {
  const origin = page.getByLabel('纸带起始点', { exact: true });
  const positions = await page.locator('[data-ticker-dot]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-dot-displacement-m'))));
  const clear = positions.map((_, i) => i).filter(i => i > 0 && i + n + 1 < positions.length && positions.slice(i, i + n + 2).every((x, j) => x - positions[i + j - 1]! > 1e-8));
  expect(clear.length).toBeGreaterThan(0);
  const a = clear[Math.floor(clear.length / 2)]!;
  expect(a).toBeGreaterThan(0);
  await origin.selectOption(String(a));
  await page.getByLabel('纸带终点', { exact: true }).selectOption(String(a + n));
  await page.getByLabel('数出的间隔数 n', { exact: true }).fill(String(n));
  await expect(page.getByTestId('ticker-ruler-status')).toContainText('已摆到尺旁');
  const position = async (index: number) => Number(await page.locator(`[data-ticker-dot="${index}"]`).getAttribute('data-dot-displacement-m'));
  return { a, b: a + n, distance: (await position(a + n)) - (await position(a)) };
}

test('threading and removing tape reject powered or closed-clamp operations, including replacement and keyboard', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 950 }); await open(page);
  await page.getByRole('button', { name: '查看纸带全景', exact: true }).click();
  const apparatus = page.getByTestId('ticker-apparatus'), status = page.getByTestId('ticker-status'), paper = page.getByTestId('ticker-paper');
  const clamp = page.getByRole('button', { name: '固定计时器夹具', exact: true }), power = page.getByRole('button', { name: '计时器电源开关', exact: true });
  const setClamp = () => clamp.locator('rect').click();
  await expect(apparatus).toHaveAttribute('data-powered', 'false'); await expect(clamp).toHaveAttribute('aria-pressed', 'false');
  await setClamp();
  await drag(page, await center(page, '[data-testid="ticker-paper"] > rect'), await center(page, '[data-equipment-id="ticker"] .equipment-body'), false, 6, 5);
  await expect(apparatus).toHaveAttribute('data-installed', 'false'); await expect(status).toContainText('打开固定夹');
  await paper.press('Enter'); await expect(apparatus).toHaveAttribute('data-installed', 'false');
  await setClamp(); await paper.press('Enter'); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await power.click(); await expect(apparatus).toHaveAttribute('data-powered', 'false'); await expect(status).toContainText('扣上固定夹');
  await setClamp();
  const ppm = await scale(page), originalX = await apparatus.getAttribute('data-paper-x-m'), originalY = await apparatus.getAttribute('data-paper-y-m');
  const tryRemove = async () => {
    const grip = await center(page, '[data-testid="ticker-pull-grip"] > rect');
    await drag(page, grip, { x: grip.x + .1 * ppm, y: grip.y + .1 * ppm }, false, 6, 5);
    await expect(apparatus).toHaveAttribute('data-installed', 'true'); await expect(apparatus).toHaveAttribute('data-taken', 'false');
    await expect(apparatus).toHaveAttribute('data-paper-x-m', originalX!); await expect(apparatus).toHaveAttribute('data-paper-y-m', originalY!);
  };
  await tryRemove(); await expect(status).toContainText('打开固定夹');
  await paper.press('ArrowDown'); await expect(apparatus).toHaveAttribute('data-installed', 'true'); await expect(apparatus).toHaveAttribute('data-paper-y-m', originalY!);
  await page.getByRole('button', { name: '取用新纸带', exact: true }).click(); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await power.click(); await expect(apparatus).toHaveAttribute('data-powered', 'true');
  await setClamp(); await expect(clamp).toHaveAttribute('aria-pressed', 'true'); await expect(status).toContainText('关闭计时器电源');
  const rear = await center(page, '[data-testid="ticker-paper"] > rect:nth-of-type(3)');
  await drag(page, rear, { x: rear.x, y: rear.y + .1 * ppm }, false, 6, 5);
  await expect(apparatus).toHaveAttribute('data-installed', 'true'); await expect(apparatus).toHaveAttribute('data-paper-y-m', originalY!);
  await page.getByRole('button', { name: '取用新纸带', exact: true }).click();
  await expect(apparatus).toHaveAttribute('data-powered', 'true'); await expect(apparatus).toHaveAttribute('data-installed', 'true'); await expect(status).toContainText('关闭计时器电源');
  await power.click(); await tryRemove(); await expect(status).toContainText('打开固定夹');
  await setClamp();
  const grip = await center(page, '[data-testid="ticker-pull-grip"] > rect');
  await drag(page, grip, { x: grip.x + .1 * ppm, y: grip.y + .1 * ppm }, false, 6, 5);
  await expect(apparatus).toHaveAttribute('data-installed', 'false'); await expect(apparatus).toHaveAttribute('data-taken', 'true');
  await expect(apparatus).toHaveAttribute('data-clamp-closed', 'false'); await expect(apparatus).toHaveAttribute('data-powered', 'false');
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('ticker-clamp-open-removed.png') });
  await page.getByRole('button', { name: '取用新纸带', exact: true }).click();
  await expect(apparatus).toHaveAttribute('data-taken', 'false'); await expect(apparatus).toHaveAttribute('data-installed', 'false');
});

test('ticker practice follows assembly and power order, measures arbitrary origin, exports and reloads', async ({ page }, info) => {
  test.setTimeout(60_000); await page.setViewportSize({ width: 1440, height: 950 }); await open(page);
  await expect(page.getByRole('heading', { name: '练习使用打点计时器', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '打点计时器操作' }).getByRole('button')).toHaveText(['查看记录表']);
  await page.getByRole('button', { name: '计时器电源开关', exact: true }).click();
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'false');
  await expect(page.getByRole('button', { name: '保存本次纸带测量', exact: true })).toBeDisabled();
  await expect(page.getByRole('table', { name: '纸带时间与位移记录表', exact: true })).toContainText('空表');
  await expect(page.getByTestId('scene-board').locator('[data-equipment-type]')).toHaveCount(2);
  await expect(page.locator('[data-library-type="mechanical.cart"]')).toBeDisabled();
  await produce(page);
  const selected = await selectClearPoints(page);
  await expect(page.getByTestId('ticker-time')).toContainText('= 0.1 s');
  await expect(page.getByLabel('纸带位移 x（m）', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click();
  expect(await scale(page)).toBeGreaterThanOrEqual(8000);
  await expect(page.getByTestId('ticker-ruler').locator('[data-ruler-tick-mm]')).toHaveCount(1001);
  const overlappedDot = await center(page, `[data-ticker-dot="${selected.a}"] > circle`);
  expect(await page.evaluate(point => !!document.elementFromPoint(point.x, point.y)?.closest('[data-testid="ticker-ruler"]'), overlappedDot)).toBe(true);
  for (const index of [selected.a, selected.b]) {
    const at = await center(page, `[data-ticker-dot="${index}"] > circle`); await page.mouse.click(at.x, at.y);
  }
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-origin', String(selected.a));
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-target', String(selected.b));
  await page.getByLabel('数出的间隔数 n', { exact: true }).fill('6');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('核对间隔数');
  await expect(page.locator('[data-measurement-id]')).toHaveCount(0);
  await page.getByLabel('数出的间隔数 n', { exact: true }).fill('5');
  await page.getByLabel('纸带位移 x（m）', { exact: true }).fill('0.0230');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click();
  await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
  await page.locator('[data-measurement-id]').last().getByRole('button', { name: '修改抄表', exact: true }).click();
  await page.getByLabel('修订抄表值', { exact: true }).fill('.025');
  await page.getByRole('button', { name: '确认修订', exact: true }).click();
  await expect(page.getByRole('table', { name: '纸带时间与位移记录表', exact: true })).toContainText('0.025');
  const csv = await download(page, '导出 CSV'); expect(csv).toContain('纸带位移'); expect(csv).toContain('0.0230');
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(saved.experimentId).toBe('H-MECH-05'); expect(saved.measurementRecords.map(row => row.value)).toEqual([5, .1, .025]);
  expect(saved.measurementRecords[2]!.context!.originalRawInput).toBe('0.0230'); expect(saved.measurementRecords[2]!.context!.physicalValue).toBeCloseTo(selected.distance, 9);
  const note = JSON.parse(saved.measurementSnapshots![0]!.note);
  expect(note.target - note.origin).toBe(5); expect(note.frequencyHz).toBe(50); expect(note.placement[0]).toBeCloseTo(.42, 6); expect(note.placement[1]).toBeCloseTo(-.11, 6);
  expect(note.ruler[0] - note.ruler[1]).toBeCloseTo(selected.distance, 9);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('measurement-chart')).toBeVisible();
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('ticker-direct-ruler.png') });
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload(); await expect(page.getByTestId('ticker-status')).toContainText('固定夹已打开'); await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
  expect(JSON.parse(await download(page, '导出'))).toEqual(saved);
  await produce(page);
  await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'ticker.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.getByTestId('ticker-status')).toContainText('固定夹已打开'); await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
});

test('60 Hz, variable hand speed, blank readings, undo, invalid pose and apparatus removal remain explicit', async ({ page }) => {
  test.setTimeout(60_000); await open(page);
  await page.getByLabel('选择器材', { exact: true }).selectOption('ruler'); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.locator('[data-equipment-id="ruler"]')).toHaveCount(0); await page.getByRole('button', { name: /^撤销/ }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('ticker'); await page.getByLabel(/打点频率/).fill('60');
  await produce(page); await selectClearPoints(page, 6);
  await page.getByLabel('选择器材', { exact: true }).selectOption('ruler'); await page.getByLabel('转角（°）', { exact: true }).fill('90');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('水平正向');
  await page.getByLabel('转角（°）', { exact: true }).fill('0');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
  const data = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(data.measurementRecords[1]!.value).toBe(.1); expect(data.measurementRecords[2]!.measurementStatus).toBe('invalid');
  await page.getByRole('button', { name: /^撤销/ }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(0);
  await page.getByRole('button', { name: /^重做/ }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
  await page.getByRole('button', { name: '取用新纸带', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(3);
  await produce(page, false, true); const selected = await selectClearPoints(page, 6);
  await page.getByLabel('纸带位移 x（m）', { exact: true }).fill('.04');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(6);
  const changed = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(changed.measurementRecords[5]!.context!.physicalValue).toBeCloseTo(selected.distance, 9);
  await page.getByLabel('选择器材', { exact: true }).selectOption('ticker'); await page.getByLabel('转角（°）', { exact: true }).fill('10');
  await expect(page.getByTestId('ticker-apparatus')).toHaveCount(0); await expect(page.getByTestId('ticker-status')).toContainText('水平正向');
  await page.getByLabel('转角（°）', { exact: true }).fill('0');
  await page.getByLabel('选择器材', { exact: true }).selectOption('ruler'); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('历史记录'); await expect(page.locator('[data-equipment-id="ruler"]')).toHaveCount(1); await expect(page.locator('[data-measurement-id]')).toHaveCount(6);
});

for (const [device, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]] as const) test(`${device} touch can pull and measure without horizontal page overflow`, async ({ browser }, info) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }), page = await context.newPage();
  try {
    await open(page); await produce(page, true); await selectClearPoints(page);
    await page.getByLabel('纸带位移 x（m）', { exact: true }).fill('.02'); await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).tap();
    await expect(page.locator('[data-measurement-id]')).toHaveCount(3); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '放大纸带读尺', exact: true }).tap();
    await page.getByTestId('scene-board').screenshot({ path: info.outputPath(`ticker-direct-${device}.png`) });
  } finally { await context.close(); }
});

test('canvas paper gestures follow the pointer, cancel cleanly, and require physical ruler placement', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 950 }); await open(page);
  const machine = page.getByTestId('ticker-apparatus');
  const original = { x: await machine.getAttribute('data-paper-x-m'), y: await machine.getAttribute('data-paper-y-m') };
  const loose = await center(page, '[data-testid="ticker-paper"] > rect'), ppm = await scale(page);
  await page.mouse.move(loose.x, loose.y); await page.mouse.down(); await page.mouse.move(loose.x + 60, loose.y + 30);
  expect(Number(await machine.getAttribute('data-paper-x-m'))).toBeCloseTo(Number(original.x) + 60 / ppm, 6);
  expect(Number(await machine.getAttribute('data-paper-y-m'))).toBeCloseTo(Number(original.y) - 30 / ppm, 6);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(machine).toHaveAttribute('data-paper-x-m', original.x!); await expect(machine).toHaveAttribute('data-installed', 'false');
  await produce(page); await selectClearPoints(page);
  const rulerStart = await rulerGrip(page), rulerScale = await scale(page);
  await drag(page, rulerStart, { x: rulerStart.x, y: rulerStart.y - .15 * rulerScale });
  await expect(page.getByTestId('ticker-ruler-status')).toContainText('请把取下');
  await page.getByRole('button', { name: '保存本次纸带测量', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('刻度尺上沿');
  await expect(page.locator('[data-measurement-id]')).toHaveCount(0);
  const moved = await rulerGrip(page); await drag(page, moved, { x: moved.x, y: moved.y + .15 * rulerScale });
  await expect(page.getByTestId('ticker-ruler-status')).toContainText('已摆到尺旁');
  await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click();
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('ticker-direct-canvas.png') });
});

test('canvas keyboard operations install tape, toggle power and stop pulling without moving the view', async ({ page }) => {
  await open(page);
  const apparatus = page.getByTestId('ticker-apparatus'), paper = page.getByTestId('ticker-paper');
  await expect(page.getByRole('button', { name: '固定计时器夹具', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await paper.focus();
  for (let i = 0; i < 10; i++) await paper.press('ArrowLeft');
  for (let i = 0; i < 8; i++) await paper.press('ArrowDown');
  await paper.press('Enter'); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await page.getByRole('button', { name: '固定计时器夹具', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '固定计时器夹具', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '计时器电源开关', exact: true }).press('Enter');
  await expect(apparatus).toHaveAttribute('data-powered', 'true');
  await page.getByTestId('ticker-pull-grip').focus(); await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Escape'); await page.keyboard.up('ArrowRight');
  const distance = Number(await apparatus.getAttribute('data-displacement-m'));
  expect(distance).toBeCloseTo(.01, 8);
  await page.waitForTimeout(60); expect(Number(await apparatus.getAttribute('data-displacement-m'))).toBe(distance);
  await expect(apparatus).toHaveAttribute('data-powered', 'true');
  await page.getByRole('button', { name: '计时器电源开关', exact: true }).press('Enter');
  await expect(apparatus).toHaveAttribute('data-powered', 'false');
  const scene = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(scene.viewport!.centerXM).toBe(.25); expect(scene.viewport!.centerYM).toBe(.04);
});

test('ruler enlargement labels every centimetre and retains millimetre detail up to the ticker-only zoom limit', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 950 }); await open(page);
  const before = JSON.parse(await download(page, '导出')) as SceneDocument;
  const ruler = before.equipment.find(item => item.id === 'ruler')!;
  before.viewport = { centerXM: ruler.pose.xM + .025, centerYM: ruler.pose.yM + .002, pixelsPerM: 8000 };
  await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'ruler-view.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  const scaleView = page.getByTestId('ticker-ruler-scale');
  for (const cm of [1, 2, 3, 4]) { await expect(scaleView.locator(`[data-ruler-cm="${cm}"]`)).toHaveText(String(cm)); await expect(scaleView.locator(`[data-ruler-cm="${cm}"]`)).toBeInViewport(); }
  const a = (await scaleView.locator('[data-ruler-tick-mm="20"]').boundingBox())!, b = (await scaleView.locator('[data-ruler-tick-mm="21"]').boundingBox())!;
  expect((b.x + b.width / 2) - (a.x + a.width / 2)).toBeCloseTo(8, 3);
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('ruler-1-to-4-cm.png') });
  for (let n = 0; n < 4; n++) await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(scaleView).toHaveAttribute('data-mm-pixels', '12.8');
  const max = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(max.viewport!.pixelsPerM).toBe(12800); expect(max.equipment).toEqual(before.equipment); expect(max.measurementRecords).toEqual(before.measurementRecords);
  await page.getByRole('button', { name: '缩小', exact: true }).click();
  await page.getByTestId('scene-board').hover(); await page.mouse.wheel(0, -1000);
  await expect(scaleView).toHaveAttribute('data-mm-pixels', '12.8');
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('ruler-max-zoom.png') });
  const grip = await rulerGrip(page), initial = await page.getByTestId('ticker-ruler').getAttribute('transform');
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(grip.x + 24, grip.y + 8);
  await expect(page.getByTestId('ticker-ruler')).not.toHaveAttribute('transform', initial!);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.getByTestId('ticker-ruler')).toHaveAttribute('transform', initial!);
  await drag(page, grip, { x: grip.x + 24, y: grip.y + 8 }, false, 5, 0);
  const moved = JSON.parse(await download(page, '导出')) as SceneDocument;
  const changed = moved.equipment.find(item => item.id === 'ruler')!;
  expect(changed.pose.xM - ruler.pose.xM).toBeCloseTo(24 / 12800, 6);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  const undone = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(undone.equipment).toEqual(before.equipment);
});
