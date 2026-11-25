import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '高中物理实验', exact: true }).click(); await selectCatalogOption(page, 'tape-speed');
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
  const click = async (name: string) => { const button = page.getByRole('button', { name, exact: true }), target = name === '固定计时器夹具' ? button.locator('rect') : button; if (touch) await target.tap(); else await target.click(); };
  await click('查看纸带全景');
  await drag(page, await center(page, '[data-testid="ticker-paper"] > rect'), await center(page, '[data-equipment-id="ticker"] .equipment-body'), touch, 6, 5);
  const apparatus = page.getByTestId('ticker-apparatus'); await expect(apparatus).toHaveAttribute('data-installed', 'true');
  await click('固定计时器夹具'); await click('计时器电源开关'); await expect(apparatus).toHaveAttribute('data-powered', 'true');
  const ppm = await page.locator('[data-equipment-id="ticker"] .equipment-body').evaluate(element => Math.abs((element as SVGGraphicsElement).getScreenCTM()!.a));
  const grip = await center(page, '[data-testid="ticker-pull-grip"] > rect'); await drag(page, grip, { x: grip.x + .30 * ppm, y: grip.y }, touch, 24, 28);
  await click('计时器电源开关'); await click('固定计时器夹具');
  const paper = await center(page, '[data-testid="ticker-paper"] > rect'), x = Number(await apparatus.getAttribute('data-paper-x-m')), y = Number(await apparatus.getAttribute('data-paper-y-m'));
  await drag(page, paper, { x: paper.x + (.42 - x) * ppm, y: paper.y + (-.11 - y) * -ppm }, touch, 10, 10); await expect(apparatus).toHaveAttribute('data-taken', 'true');
  const ruler = await page.getByTestId('ticker-ruler').evaluate(element => { const m = (element as SVGGraphicsElement).getScreenCTM()!; return { x: m.e + .05 * m.a, y: m.f + 38 }; });
  const rulerY = Number(await page.locator('[data-equipment-id="ruler"]').getAttribute('data-y-m')); await drag(page, ruler, { x: ruler.x, y: ruler.y + (-.11 - rulerY) * -ppm }, touch, 8, 8);
  const positions = await page.locator('[data-ticker-dot]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-dot-displacement-m'))));
  const zero = positions.findIndex((_, i) => i > 0 && i + 13 < positions.length && positions.slice(i, i + 13).every((value, j) => value - positions[i + j - 1]! > 1e-8)); expect(zero).toBeGreaterThan(0);
  await page.getByLabel('测速参考起点0', { exact: true }).selectOption(String(zero)); await expect(page.getByTestId('ticker-ruler-status')).toContainText('已摆到尺旁');
  return { zero, positions };
}
async function readings(page: Page, a: string, b: string) { await page.getByLabel('测速起点位置xA（m）', { exact: true }).fill(a); await page.getByLabel('测速终点位置xB（m）', { exact: true }).fill(b); }

test('manual counted positions produce average and approximate instantaneous speeds, corrections, charts and persistent sources', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 950 }); await open(page);
  await expect(page.getByRole('heading', { name: '测量纸带的平均速度和瞬时速度', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('table', { name: '纸带平均速度和瞬时速度记录表', exact: true })).toContainText('空表');
  const { zero, positions } = await produce(page);
  await expect(page.getByLabel('测速起点位置xA（m）', { exact: true })).toHaveValue(''); await expect(page.getByTestId('tape-speed-calculation')).toContainText('平均速度=—');
  await readings(page, '0', '0.0200'); await expect(page.getByTestId('tape-speed-calculation')).toContainText('Δt=0.1 s；平均速度=0.2');
  await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(1); await expect(page.locator('[data-measurement-id]')).toHaveCount(2);
  await page.getByLabel('测速相邻计数点', { exact: true }).selectOption('1'); await readings(page, '.020', '.045'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click();
  await page.getByLabel('纸带测速方法', { exact: true }).selectOption('instant'); await expect(page.getByTestId('tape-speed-window')).toContainText('区间不对称');
  await readings(page, '0', '.015'); await expect(page.getByTestId('tape-speed-calculation')).toContainText('Δt=0.06 s；瞬时速度近似值=0.25'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click();
  await page.getByRole('button', { name: '围绕E缩短区间', exact: true }).click(); await expect(page.getByTestId('tape-speed-window')).toContainText('区间关于E对称'); await expect(page.getByLabel('测速起点位置xA（m）', { exact: true })).toHaveValue('');
  await readings(page, '0', '.010'); await expect(page.getByTestId('tape-speed-error')).toContainText('±0.025 m/s'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(4);
  await page.locator('[data-measurement-id]').nth(1).getByRole('button', { name: '修改抄表', exact: true }).click(); await page.getByLabel('修订抄表值', { exact: true }).fill('.025'); await page.getByRole('button', { name: '确认修订', exact: true }).click();
  await expect(page.locator('[data-speed-sample]').first()).toContainText('0.25');
  await page.getByRole('table', { name: '纸带平均速度和瞬时速度记录表', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('tape-speed-records-desktop.png') });
  const csv = await download(page, '导出纸带速度 CSV'); expect(csv).toContain('瞬时速度近似值'); expect(csv).toContain('0.0200');
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument; expect(saved.experimentId).toBe('H-MECH-06'); expect(saved.measurementRecords).toHaveLength(8); expect(saved.measurementRecords[1]!.context!.originalRawInput).toBe('0.0200'); expect(saved.measurementRecords[1]!.context!.physicalValue).toBeCloseTo(positions[zero + 5]! - positions[zero]!, 8);
  const meta = JSON.parse(saved.measurementSnapshots![3]!.note); expect(meta.e).toBe(zero + 1); expect(meta.b - meta.a).toBe(2); expect(meta.paper[0]).toBeCloseTo(.42, 6);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('measurement-chart')).toBeVisible();
  await page.getByLabel('图线类型', { exact: true }).selectOption('tape-instant-v-t'); await expect(page.getByTestId('measurement-chart')).toBeVisible(); await page.getByLabel('比较同一E点的不同取样区间', { exact: true }).check(); await expect(page.getByTestId('measurement-chart')).toBeVisible();
  await page.getByRole('tab', { name: '记录表', exact: true }).click(); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.getByRole('button', { name: '放大纸带读尺', exact: true }).click(); await page.getByTestId('scene-board').screenshot({ path: info.outputPath('tape-speed-target-ruler.png') });
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(page.locator('[data-speed-sample]')).toHaveCount(4); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-powered', 'false'); await expect(page.getByTestId('ticker-apparatus')).toHaveAttribute('data-installed', 'false');
  const reloaded = JSON.parse(await download(page, '导出')) as SceneDocument;
  expect(reloaded.equipment).toEqual(saved.equipment); expect(reloaded.measurementRecords).toEqual(saved.measurementRecords); expect(reloaded.measurementSnapshots).toEqual(saved.measurementSnapshots); expect(reloaded.viewport!.pixelsPerM).toBe(8000);
});

test('60 Hz, blank or reversed readings, invalid ruler and undo remain explicit without fabricated speeds', async ({ page }) => {
  test.setTimeout(90_000); await open(page); await page.getByLabel('选择器材', { exact: true }).selectOption('ticker'); await page.getByLabel(/打点频率/).fill('60'); await produce(page);
  await page.getByLabel('纸带测速方法', { exact: true }).selectOption('instant'); await expect(page.getByTestId('tape-speed-calculation')).toContainText('Δt=0.05');
  await readings(page, '', '.02'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(1); await expect(page.locator('[data-speed-sample]').first()).toContainText('缺失／异常');
  await readings(page, '.03', '.02'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(2); await expect(page.locator('[data-speed-sample]').last()).toContainText('缺失／异常');
  await page.getByRole('button', { name: /^撤销/ }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(1); await page.getByRole('button', { name: /^重做/ }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(2);
  await readings(page, '0', '.02'); await page.getByLabel('选择器材', { exact: true }).selectOption('ruler'); await page.getByLabel('转角（°）', { exact: true }).fill('90'); await expect(page.getByTestId('tape-speed-calculation')).toContainText('近似值=—');
  await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('水平正向刻度尺'); await expect(page.locator('[data-speed-sample]')).toHaveCount(2);
  await page.getByLabel('转角（°）', { exact: true }).fill('0'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(3);
  const saved = JSON.parse(await download(page, '导出')) as SceneDocument; await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'paper-speed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); await expect(page.locator('[data-speed-sample]')).toHaveCount(3);
});

for (const [device, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]] as const) test(`${device} native touch reuses the apparatus and saves an independently read average speed`, async ({ browser }, info) => {
  test.setTimeout(90_000); const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }), page = await context.newPage();
  try {
    await open(page); await produce(page, true); await readings(page, '0', '.02'); await page.getByRole('button', { name: '保存本次速度测量', exact: true }).tap(); await expect(page.locator('[data-speed-sample]')).toHaveCount(1); await expect(page.locator('[data-speed-sample]')).toContainText('0.2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.getByRole('table', { name: '纸带平均速度和瞬时速度记录表', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`tape-speed-${device}-records.png`) }); await page.getByRole('tab', { name: '图线', exact: true }).tap(); await expect(page.getByTestId('measurement-chart')).toBeVisible(); await page.screenshot({ path: info.outputPath(`tape-speed-${device}.png`) });
  } finally { await context.close(); }
});
