import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '高中物理实验', exact: true }).click(); await selectCatalogOption(page, 'cart-velocity');
  await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function download(page: Page, label: string) { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: label, exact: true }).click(); return readFile((await (await pending).path())!, 'utf8'); }
async function center(page: Page, selector: string) { const box = (await page.locator(selector).first().boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, touch: boolean, steps = 12, delay = 20) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] }); else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
    for (let i = 1; i <= steps; i++) { const at = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }; if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] }); else await page.mouse.move(at.x, at.y); await page.waitForTimeout(delay); }
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
  } finally { await cdp?.detach(); }
}
async function produce(page: Page, touch = false) {
  await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
  const click = async (label: string) => { const b = page.getByRole('button', { name: label, exact: true }), c = label === '固定计时器夹具' ? b.locator('rect').first() : label === '放开小车' ? b.locator('rect') : b; if (touch) await c.tap(); else await c.click(); };
  await click('查看计时器安装区');
  const machine = await page.locator('[data-equipment-id="ticker"] .equipment-body').evaluate(element => { const m = (element as SVGGraphicsElement).getScreenCTM()!; return { x: m.e, y: m.f, ppm: m.a }; });
  await drag(page, await center(page, '[data-testid="ticker-paper"] > rect'), machine, touch, 6, 5);
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-installed', 'true');
  const rear = { x: machine.x + .24 * machine.ppm, y: machine.y };
  await drag(page, await center(page, '[data-testid="ticker-pull-grip"] > rect'), rear, touch, 8, 8);
  await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-attached', 'true');
  await click('固定计时器夹具'); await click('计时器电源开关');
  await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'true');
  await page.waitForTimeout(160); expect(Number(await page.getByTestId('ticker-apparatus').getAttribute('data-displacement-m'))).toBe(0);
  await click('放开小车'); await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-moving', 'true');
  await click('查看纸带全景'); await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-moving', 'false', { timeout: 8000 });
  await click('计时器电源开关'); await click('固定计时器夹具');
  const ppm = await page.locator('[data-equipment-id="ticker"] .equipment-body').evaluate(el => (el as SVGGraphicsElement).getScreenCTM()!.a);
  const paper = page.getByTestId('ticker-apparatus'), xM = Number(await paper.getAttribute('data-paper-x-m')), yM = Number(await paper.getAttribute('data-paper-y-m'));
  const from = await center(page, '[data-testid="ticker-paper"] > rect');
  await drag(page, from, { x: from.x + (-.30 - xM) * ppm, y: from.y - (-.96 - yM) * ppm }, touch, 10, 8);
  await expect(paper).toHaveAttribute('data-taken', 'true');
  await expect(paper).toHaveAttribute('data-paper-flipped', 'true');
  const dots = await page.locator('[data-ticker-dot]').evaluateAll(elements => elements.map(el => Number(el.getAttribute('data-dot-displacement-m'))));
  const zero = dots.findIndex(v => v > .015);
  await page.getByRole('button', { name: '查看记录表', exact: true }).click();
  await page.getByLabel('小车纸带时间零点0', { exact: true }).selectOption(String(zero));
  await expect(page.getByTestId('cart-velocity-ruler-status')).toContainText('尺已就位');
  return { zero, dots };
}
async function positions(page: Page, multiplier = 1) {
  const values: Record<string, string> = { '计数点1': multiplier === 1 ? '2.500' : String(2.5 * multiplier), '计数点2': String(6 * multiplier), '计数点3': String(10.5 * multiplier), '计数点4': String(16 * multiplier), '计数点5': String(22.5 * multiplier), '计数点6': String(30 * multiplier) };
  for (const [point, value] of Object.entries(values)) await page.getByLabel(`${point}位置（cm）`, { exact: true }).fill(value);
}

test('cart drives the existing paper and three runs create a manual speed table, scatter plot and revisable sources', async ({ page }, info) => {
  test.setTimeout(120_000); await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  for (let g = 1; g <= 3; g++) {
    if (g > 1) { await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '取用新纸带', exact: true }).click(); await page.getByLabel('选择器材', { exact: true }).selectOption('cart'); await page.getByLabel(/悬挂总质量/).fill(String(g * .02)); }
    await produce(page); await positions(page, g); await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(g);
  }
  const summary = page.getByRole('table', { name: '小车三次实验速度时间表', exact: true }); await expect(summary).toContainText('v3'); await expect(summary).toContainText('位置编号'); await summary.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('cart-position-summary.png') });
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('cart-velocity-chart')).toBeVisible(); await expect(page.locator('[data-fit-line]')).toHaveCount(0); await page.getByLabel('显示线性拟合（每组至少3个不同时刻）', { exact: true }).check(); await expect(page.locator('[data-fit-line]')).toHaveCount(3); await page.screenshot({ path: info.outputPath('cart-position-chart.png') });
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  await page.getByLabel('第1次计数点2位置修订（cm）', { exact: true }).fill('7'); await page.getByLabel('第1次计数点2位置修订（cm）', { exact: true }).press('Tab');
  await expect(page.getByRole('table', { name: '第1次纸带位置表', exact: true })).toContainText('0.35');
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument; expect(saved.measurementSnapshots).toHaveLength(3); expect(JSON.parse(saved.measurementSnapshots![0]!.note).flippedX).toBe(true); expect(saved.measurementRecords).toHaveLength(18); const corrected = saved.measurementRecords.find(r => r.context!.pointLabel === '计数点2的位置')!; expect(corrected.value).toBe(.07); expect(corrected.context!.originalRawInput).toBe('6'); expect(saved.measurementSnapshots![0]!.equipment.find(i => i.id === 'cart')!.parameters.hangerMassKg).toBe(.02);
  const csv = await download(page, '导出小车速度 CSV'); expect(csv).toContain('原始位置输入/cm'); expect(csv).toContain('2.500');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.locator('[data-position-sheet]')).toHaveCount(3); await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-released', 'false'); await expect(page.getByLabel('第1次计数点2位置修订（cm）', { exact: true })).toHaveValue('7');
});

test('sequence gates and invalid or missing readings remain explicit with undo and ruler zoom', async ({ page }, info) => {
  test.setTimeout(90_000); await open(page); await page.getByRole('button', { name: '计时器电源开关', exact: true }).click(); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'false'); await produce(page); await positions(page);
  await page.getByLabel('计数点1位置（cm）', { exact: true }).fill(''); await page.getByLabel('选择器材', { exact: true }).selectOption('ruler'); await page.getByLabel('转角（°）', { exact: true }).fill('90'); await expect(page.getByRole('table', { name: '本次纸带位置记录表', exact: true }).getByRole('button', { name: '查看点1的速度计算', exact: true })).toHaveText('—'); await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('水平正向尺');
  await page.getByLabel('转角（°）', { exact: true }).fill('0'); await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(1); const table = page.getByRole('table', { name: '第1次纸带位置表', exact: true }); await expect(table.getByRole('button', { name: '查看点0的速度计算', exact: true })).toHaveCount(0); await expect(table.getByRole('button', { name: '查看点6的速度计算', exact: true })).toHaveCount(0); await expect(table).toContainText('端点不计算');
  await page.getByRole('button', { name: /^撤销/ }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(0); await page.getByRole('button', { name: /^重做/ }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(1);
  await page.getByLabel('第1次计数点1位置修订（cm）', { exact: true }).fill('-3'); await page.getByLabel('第1次计数点1位置修订（cm）', { exact: true }).press('Tab'); await expect(table.getByRole('button', { name: '查看点2的速度计算', exact: true })).toHaveText('—');
  await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click(); await page.getByTestId('scene-board').screenshot({ path: info.outputPath('cart-position-ruler.png') });
});

for (const [device, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]] as const) test(`${device} native touch installs the paper, releases the cart and reads the existing ruler`, async ({ browser }, info) => {
  test.setTimeout(90_000); const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true }), page = await context.newPage();
  try { await open(page); await produce(page, true); const flip = page.getByRole('button', { name: '左右翻转纸带', exact: true }); await flip.tap(); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-paper-flipped', 'false'); await flip.tap(); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-paper-flipped', 'true'); await positions(page); await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).tap(); await expect(page.locator('[data-position-sheet]')).toHaveCount(1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.getByRole('table', { name: '第1次纸带位置表', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`cart-position-${device}.png`) }); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '放大纸带读尺', exact: true }).tap(); await page.getByTestId('scene-board').screenshot({ path: info.outputPath(`cart-position-${device}-marks.png`) }); } finally { await context.close(); }
});

test('numbered columns highlight the matching paper points and clicking the paper can choose a new origin', async ({ page }, info) => {
  test.setTimeout(90_000); await open(page); const { zero } = await produce(page); await positions(page);
  const table = page.getByRole('table', { name: '本次纸带位置记录表', exact: true }); await table.getByRole('button', { name: '查看点2的速度计算', exact: true }).click(); await expect(page.getByTestId('cart-position-formula')).toContainText('0.4 m/s'); await expect(page.getByTestId('cart-position-marks')).toHaveAttribute('data-selected', '2');
  await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click(); await expect(page.locator('[data-cart-count="1"]')).toHaveAttribute('data-highlighted', 'true'); await expect(page.locator('[data-cart-count="3"]')).toHaveAttribute('data-highlighted', 'true'); await page.getByTestId('scene-board').screenshot({ path: info.outputPath('cart-position-neighbors.png') });
  await page.getByRole('button', { name: '在纸带上选起点0', exact: true }).click(); const dotBox = (await page.locator(`[data-ticker-dot="${zero + 10}"] circle`).first().boundingBox())!; await page.mouse.click(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2); await expect(page.getByTestId('cart-position-marks')).toHaveAttribute('data-zero', String(zero + 10)); await expect(page.getByLabel('计数点1位置（cm）', { exact: true })).toHaveValue('');
});

test('flipped paper follows the ruler direction, preserves the focused dot and survives dragging, keyboard toggles and source export', async ({ page }, info) => {
  test.setTimeout(90_000); await open(page); await expect(page.getByRole('button', { name: '左右翻转纸带', exact: true })).toHaveCount(0); const { zero } = await produce(page); await positions(page);
  await page.getByRole('table', { name: '本次纸带位置记录表', exact: true }).getByRole('button', { name: '2', exact: true }).click(); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click();
  const dot = async (index: number) => { const b = (await page.locator(`[data-ticker-dot="${index}"] circle`).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  expect((await dot(zero + 15)).x).toBeGreaterThan((await dot(zero + 5)).x);
  const focus = await dot(zero + 10), flip = page.getByRole('button', { name: '左右翻转纸带', exact: true }); await flip.click(); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-paper-flipped', 'false'); expect((await dot(zero + 10)).x).toBeCloseTo(focus.x, 5); expect((await dot(zero + 15)).x).toBeLessThan((await dot(zero + 5)).x);
  await flip.focus(); await flip.press('Enter'); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-paper-flipped', 'true'); expect((await dot(zero + 10)).x).toBeCloseTo(focus.x, 5);
  const apparatus = page.getByTestId('ticker-apparatus'), xM = Number(await apparatus.getAttribute('data-paper-x-m')); await drag(page, { x: focus.x, y: focus.y - 12 }, { x: focus.x + 16, y: focus.y - 12 }, false, 6, 5); await expect(apparatus).toHaveAttribute('data-paper-flipped', 'true'); expect(Number(await apparatus.getAttribute('data-paper-x-m'))).toBeCloseTo(xM + .002, 6);
  const start = await dot(zero + 10), anchor = Number(await apparatus.getAttribute('data-paper-x-m')); await page.mouse.move(start.x, start.y - 12); await page.mouse.down(); await page.mouse.move(start.x + 24, start.y - 12); await page.keyboard.press('Escape'); await page.mouse.up(); expect(Number(await apparatus.getAttribute('data-paper-x-m'))).toBeCloseTo(anchor, 6); await expect(apparatus).toHaveAttribute('data-paper-flipped', 'true');
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('cart-paper-flipped-ruler.png') });
  await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(1); const saved = JSON.parse(await download(page, '导出')) as SceneDocument; expect(JSON.parse(saved.measurementSnapshots![0]!.note).flippedX).toBe(true); await expect(page.getByRole('table', { name: '第1次纸带位置表', exact: true })).toContainText('0.4');
});

test('positions zero through six need no auxiliary point when zero is aligned to the ruler and yield only five interior speeds', async ({ page }, info) => {
  test.setTimeout(90_000); await open(page); const { zero } = await produce(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
  const dotBox = (await page.locator(`[data-ticker-dot="${zero}"] circle`).first().boundingBox())!, dotX = dotBox.x + dotBox.width / 2;
  const ruler = await page.getByTestId('ticker-ruler').evaluate(el => { const m = (el as SVGGraphicsElement).getScreenCTM()!; return { x: m.e, y: m.f, scale: m.a }; });
  await drag(page, { x: ruler.x + .05 * ruler.scale, y: ruler.y + 38 }, { x: dotX + .05 * ruler.scale, y: ruler.y + 38 }, false, 8, 5);
  await expect(page.getByTestId('cart-velocity-ruler-status')).toContainText('尺已就位'); await expect(page.getByLabel('辅助点位置（cm）', { exact: true })).toHaveCount(0); await expect(page.locator('[data-cart-count="-1"]')).toHaveCount(0);
  for (const [n, value] of [[1,'.80'],[2,'2.03'],[3,'3.69'],[4,'5.78'],[5,'8.29'],[6,'11.22']] as const) await page.getByLabel(`计数点${n}位置（cm）`, { exact: true }).fill(value);
  const draft = page.getByRole('table', { name: '本次纸带位置记录表', exact: true }); await expect(draft.getByRole('button', { name: '查看点1的速度计算', exact: true })).toHaveText('0.1015'); await expect(draft.getByRole('button', { name: '查看点5的速度计算', exact: true })).toHaveText('0.272'); await expect(draft.getByRole('button', { name: /查看点[06]的速度计算/ })).toHaveCount(0);
  await page.getByRole('button', { name: '保存这条纸带的位置表', exact: true }).click(); await expect(page.locator('[data-position-sheet]')).toHaveCount(1); const summary = page.getByRole('table', { name: '小车三次实验速度时间表', exact: true }); await expect(summary.getByRole('columnheader', { name: '0', exact: true })).toHaveCount(0); await summary.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('cart-interior-summary.png') });
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument; expect(saved.measurementRecords).toHaveLength(6); expect(JSON.parse(saved.measurementSnapshots![0]!.note).aux).toBe(false); expect(saved.measurementSnapshots![0]!.modelVersion).toBe('mechanical.cart-positions.v2');
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('cart-velocity-chart').locator('circle')).toHaveCount(5);
});

test('power and clamp interlocks apply to car-driven paper and early switch-off does not stop the car', async ({ page }, info) => {
  await open(page); await page.getByRole('button', { name: '查看计时器安装区', exact: true }).click();
  const apparatus = page.getByTestId('ticker-apparatus'), clamp = page.getByRole('button', { name: '固定计时器夹具', exact: true }).locator('rect').first();
  const machine = await page.locator('[data-equipment-id="ticker"] .equipment-body').evaluate(el => { const m = (el as SVGGraphicsElement).getScreenCTM()!; return { x: m.e, y: m.f, ppm: m.a }; });
  await clamp.click(); await drag(page, await center(page, '[data-testid="ticker-paper"] > rect'), machine, false, 5, 5); await expect(apparatus).toHaveAttribute('data-installed', 'false');
  await clamp.click(); await page.getByTestId('ticker-paper').focus(); await page.getByTestId('ticker-paper').press('Enter'); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await clamp.click(); await page.getByRole('button', { name: '计时器电源开关', exact: true }).click(); await expect(apparatus).toHaveAttribute('data-powered', 'false');
  await drag(page, await center(page, '[data-testid="ticker-pull-grip"] > rect'), { x: machine.x + .24 * machine.ppm, y: machine.y }, false, 5, 5); await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-attached', 'true');
  await page.getByRole('button', { name: '计时器电源开关', exact: true }).click(); await clamp.click(); await expect(apparatus).toHaveAttribute('data-clamp-closed', 'true');
  await page.getByRole('button', { name: '放开小车', exact: true }).locator('rect').click(); await page.waitForTimeout(200); await page.getByRole('button', { name: '计时器电源开关', exact: true }).click();
  const before = Number(await apparatus.getAttribute('data-displacement-m')), time = await apparatus.getAttribute('data-time-s');
  await clamp.click(); await expect(apparatus).toHaveAttribute('data-clamp-closed', 'true'); await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-moving', 'true');
  await expect(page.getByTestId('cart-velocity-apparatus')).toHaveAttribute('data-moving', 'false'); expect(Number(await apparatus.getAttribute('data-displacement-m'))).toBeGreaterThan(before); await expect(apparatus).toHaveAttribute('data-time-s', time!);
  const from = await center(page, '[data-testid="ticker-paper"] > rect'); await drag(page, from, { x: from.x, y: from.y + 30 }, false, 5, 5); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await page.getByTestId('scene-board').screenshot({ path: info.outputPath('cart-velocity-stopped.png') });
});
