import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { POWER, LAMP, SWITCH, AMMETER, VOLTMETER, RESISTOR, RHEOSTAT } from '../../src/equipment/electrical/definitions.ts';

async function ready(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
}
async function preview(page: Page, start: string) {
  await openFamily(page, '灯泡串并联实验');
  await page.locator(`input[name="experiment-catalog-choice"][value="${start === 'blank' ? 'electrical-blank' : start}"]`).check();
  await page.getByRole('button', { name: '进入实验', exact: true }).click();
  await expect(page.getByRole('heading', { name: '实验起点预览', exact: true })).toBeVisible();
}
async function start(page: Page, choice: string) {
  await preview(page, choice); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function downloaded(page: Page, button: string) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: button, exact: true }).click();
  return readFile((await (await event).path())!, 'utf8');
}
async function exported(page: Page): Promise<SceneDocument> { return JSON.parse(await downloaded(page, '导出')) as SceneDocument; }
async function place(page: Page, type: string, xM: number, yM: number) {
  const card = page.locator(`[data-library-type="${type}"]`); await card.scrollIntoViewIfNeeded(); await card.click();
  const board = page.getByTestId('scene-board'), bounds = (await board.boundingBox())!;
  await board.click({ position: { x: bounds.width / 2 + xM * 600, y: bounds.height / 2 - yM * 600 } });
  const id = (await board.locator(`[data-equipment-type="${type}"]`).last().getAttribute('data-equipment-id'))!;
  return { id, item: board.locator(`[data-equipment-id="${id}"]`) };
}
async function properties(page: Page, id: string, values: Record<string, string | boolean>) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  for (const [label, value] of Object.entries(values)) {
    if (typeof value === 'boolean') await page.getByLabel(label, { exact: true }).setChecked(value);
    else await page.getByLabel(label, { exact: true }).fill(value);
  }
  
}
async function guideDoesNotEdit(page: Page) {
  const before = await exported(page), guide = page.getByTestId('lamp-circuit-guide');
  await guide.locator(':scope > summary').click();
  for (const name of ['步骤建议', '空白测量安排', '提示 1：先查接线与状态', '提示 2：安排对照测量', '提示 3：用关系检查记录']) await guide.getByText(name, { exact: true }).click();
  expect(await exported(page)).toEqual(before);
  await guide.locator(':scope > summary').click();
}

test('electrical equipment icons paint in the narrow workbench', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const type of [POWER, RESISTOR, SWITCH, LAMP, RHEOSTAT, AMMETER, VOLTMETER]) {
    const icon = page.locator(`[data-library-type="${type}"] svg`);
    const screenshot = await icon.screenshot({ scale: 'css' });
    const paintedPixels = await page.evaluate(async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! < 190 && data[i + 1]! < 190 && data[i + 2]! < 190) count++;
      }
      return count;
    }, `data:image/png;base64,${screenshot.toString('base64')}`);
    expect(paintedPixels, type).toBeGreaterThan(8);
  }
});

test('blank drags leave the voltmeter in place and pan mode moves only the view', async ({ page, context, browserName }) => {
  await ready(page);
  await start(page, 'series-same');
  const board = page.getByTestId('scene-board');
  const meter = board.locator('[data-equipment-id="V"]');
  const body = meter.locator('.equipment-body');
  const shell = meter.locator('[data-meter-dial] > rect').first();
  const pan = page.getByRole('button', { name: '平移', exact: true });
  const revision = Number(await board.getAttribute('data-revision'));
  const xM = (await meter.getAttribute('data-x-m'))!;
  const yM = (await meter.getAttribute('data-y-m'))!;
  const session = browserName === 'chromium' ? await context.newCDPSession(page) : null;
  const drag = async (x: number, y: number, dx: number, dy: number) => {
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 4 });
      await page.mouse.up();
    }
  };
  const dragFromBlank = async () => {
    await board.scrollIntoViewIfNeeded();
    const bounds = (await board.boundingBox())!;
    const point = { x: bounds.x + 20, y: bounds.y + 20 };
    expect(await board.evaluate((element, { x, y }) => document.elementFromPoint(x, y) === element, point)).toBe(true);
    await drag(point.x, point.y, 24, 18);
  };
  const dragFromMeter = async () => {
    await shell.scrollIntoViewIfNeeded();
    const bounds = (await shell.boundingBox())!;
    await drag(bounds.x + bounds.width / 2, bounds.y + bounds.height * .25, 24, -18);
  };

  const initialTransform = (await body.getAttribute('transform'))!;
  await dragFromBlank();
  await expect(body).toHaveAttribute('transform', initialTransform);
  await expect(board).toHaveAttribute('data-revision', String(revision));
  if (session) {
    const terminal = meter.locator('[data-port-id="low"] .port-hit');
    const bounds = (await terminal.boundingBox())!;
    await drag(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 28, -25);
    await expect(terminal.locator('..')).toHaveAttribute('aria-pressed', 'false');
    await expect(board).toHaveAttribute('data-revision', String(revision));
  }
  await pan.click();
  await dragFromBlank();
  await expect(body).not.toHaveAttribute('transform', initialTransform);
  const pannedTransform = (await body.getAttribute('transform'))!;
  await dragFromMeter();
  await expect(body).not.toHaveAttribute('transform', pannedTransform);
  await expect(meter).toHaveAttribute('data-x-m', xM);
  await expect(meter).toHaveAttribute('data-y-m', yM);
  await expect(board).toHaveAttribute('data-revision', String(revision));
  await expect(board.locator('[data-wire-id]')).toHaveCount(7);

  await pan.click();
  await dragFromMeter();
  await expect(meter).not.toHaveAttribute('data-x-m', xM);
  await expect(board).toHaveAttribute('data-revision', String(revision + 1));
  await expect(board.locator('[data-wire-id]')).toHaveCount(7);
});

test('experiment chooser previews and cancels without replacing work; four editable open templates solve real same/different lamp circuits', async ({ page }, testInfo) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 }); await ready(page);
  await place(page, POWER, 0, 0); const original = await exported(page);
  await preview(page, 'series-same'); await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(original);
  const documentIds = new Set<string>();
  for (const [choice, sourceV, current] of [['series-same', 6, .3], ['series-different', 9, .3], ['parallel-same', 3, .6], ['parallel-different', 3, .5]] as const) {
    await start(page, choice); const initial = await exported(page); documentIds.add(initial.documentId);
    expect(initial.experimentId).toBe('J-ELEC-01'); expect(initial.provenance.origin).toBe('template');
    expect(initial.equipment.find(item => item.id === 'E')!.parameters.voltageV).toBe(sourceV); expect(initial.measurementRecords).toEqual([]);
    await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0 A');
    await page.getByRole('button', { name: '合上开关', exact: true }).click();
    await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText(`${current} A`);
    await expect(page.locator('[data-meter-reading="V"] strong')).toHaveText(`${sourceV} V`);
    await guideDoesNotEdit(page);
  }
  expect(documentIds.size).toBe(4);
  await properties(page, 'E', { '电源电压（V）': '0' }); await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0 A');
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.5 A');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload();
  await expect(page.getByTestId('lamp-circuit-guide')).toBeVisible(); await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.5 A');
  await page.getByTestId('lamp-circuit-guide').locator(':scope > summary').click();
  await page.screenshot({ path: testInfo.outputPath('lamp-experiment-template-guide.png'), fullPage: true });
});

for (const parallel of [false, true]) test(parallel ? 'parallel from formal blank: real assembly, same/different lamps, six-point records, CSV/JSON and reload' : 'series from formal blank: real assembly, same/different lamps, six-point records, CSV/JSON and reload', async ({ page }, testInfo) => {
  test.setTimeout(120_000); await page.setViewportSize({ width: 1920, height: 1080 }); await ready(page); await start(page, 'blank');
  const empty = await exported(page); expect(empty.equipment).toEqual([]); expect(empty.connections).toEqual([]); expect(empty.measurementRecords).toEqual([]);
  const devices: Record<string, { id: string; item: Locator }> = {};
  const layout = [[POWER, 'E', -.4, .16], [LAMP, 'L1', -.02, .16], [LAMP, 'L2', .36, .16], [SWITCH, 'S', -.4, -.02],
    [AMMETER, 'A0', -.4, -.15], [AMMETER, 'A1', -.2, -.15], [AMMETER, 'A2', 0, -.15],
    [VOLTMETER, 'V0', .2, -.15], [VOLTMETER, 'V1', .4, -.15], [VOLTMETER, 'V2', .58, .16]] as const;
  for (const [type, key, x, y] of layout) devices[key] = await place(page, type, x, y);
  await properties(page, devices.E!.id, { '电源电压（V）': parallel ? '3' : '6' });
  const pairs = parallel ? [
    ['E', 'positive', 'S', 'a'], ['S', 'b', 'A0', 'high'], ['A0', 'common', 'A1', 'low'], ['A0', 'common', 'A2', 'low'],
    ['A1', 'common', 'L1', 'a'], ['A2', 'common', 'L2', 'a'], ['L1', 'b', 'E', 'negative'], ['L2', 'b', 'E', 'negative'],
  ] : [
    ['E', 'positive', 'A0', 'low'], ['A0', 'common', 'L1', 'a'], ['L1', 'b', 'A1', 'low'], ['A1', 'common', 'L2', 'a'],
    ['L2', 'b', 'A2', 'low'], ['A2', 'common', 'S', 'a'], ['S', 'b', 'E', 'negative'],
  ];
  pairs.push(['V0', 'high', 'E', 'positive'], ['V0', 'common', 'E', 'negative'], ['V1', 'low', 'L1', 'a'], ['V1', 'common', 'L1', 'b'], ['V2', 'high', 'L2', 'a'], ['V2', 'common', 'L2', 'b']);
  for (const [a, ap, b, bp] of pairs) { await page.getByLabel('选择器材', { exact: true }).selectOption(devices[a!]!.id); await devices[a!]!.item.locator(`[data-port-id="${ap}"]`).click(); await devices[b!]!.item.locator(`[data-port-id="${bp}"]`).click(); }
  await properties(page, devices.S!.id, { '闭合开关': true });
  await expect(page.locator(`[data-meter-reading="${devices.A0!.id}"] strong`)).toHaveText(parallel ? '0.6 A' : '0.3 A');
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await page.getByLabel('组别或接法', { exact: true }).fill(parallel ? '并联相同灯泡' : '串联相同灯泡');
  await page.getByLabel('本组备注', { exact: true }).fill('第1组：先记录，再更换灯泡对照');
  for (const [key, label, point] of [['A0', '电流表 5', 'I总'], ['A1', '电流表 6', 'I₁'], ['A2', '电流表 7', 'I₂'], ['V0', '电压表 8', 'U总'], ['V1', '电压表 9', 'U₁'], ['V2', '电压表 10', 'U₂']]) {
    expect(devices[key!]!.id).toBeTruthy(); await page.getByLabel(`${label}测点名称`, { exact: true }).fill(point!);
  }
  await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(6);
  const first = await exported(page); expect(first.measurementRecords.map(record => record.value)).toEqual(parallel ? [.6, .3, .3, 3, 3, 3] : [.3, .3, .3, 6, 3, 3]);
  await properties(page, devices.S!.id, { '闭合开关': false });
  await properties(page, devices.L2!.id, parallel ? { '额定电流（A）': '.2' } : { '额定电压（V）': '6', '冷态电阻（Ω）': '4' });
  if (!parallel) await properties(page, devices.E!.id, { '电源电压（V）': '9' });
  await properties(page, devices.S!.id, { '闭合开关': true });
  await expect(page.locator(`[data-meter-reading="${devices.A0!.id}"] strong`)).toHaveText(parallel ? '0.5 A' : '0.3 A');
  const brightness = async (key: string) => Number(await devices[key]!.item.locator('[data-lamp-brightness]').getAttribute('data-lamp-brightness'));
  if (parallel) expect(await brightness('L2')).toBeLessThan(await brightness('L1')); else expect(await brightness('L2')).toBeGreaterThan(await brightness('L1'));
  await page.getByRole('button', { name: '展开测点与抄表', exact: true }).click();
  await page.getByLabel('组别或接法', { exact: true }).fill(parallel ? '并联不同灯泡' : '串联不同灯泡');
  await page.getByLabel('本组备注', { exact: true }).fill(parallel ? '观察：两支路电流不同，电压相同' : '观察：各处电流相同，两灯电压不同');
  await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); await expect(page.locator('[data-measurement-id]')).toHaveCount(12);
  const recorded = await exported(page); expect(recorded.measurementRecords.slice(0, 6)).toEqual(first.measurementRecords);
  expect(recorded.measurementRecords.slice(6).map(record => record.value)).toEqual(parallel ? [.5, .3, .2, 3, 3, 3] : [.3, .3, .3, 9, 3, 6]);
  expect(recorded.measurementSnapshots![0]).toEqual(first.measurementSnapshots![0]);
  const csv = await downloaded(page, '导出 CSV'); expect(csv).toContain('I总'); expect(csv).toContain('U₂'); expect(csv).toContain('观察：');
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(6);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  expect((await exported(page)).measurementRecords).toEqual(recorded.measurementRecords);
  await expect(page.getByTestId('lamp-circuit-guide')).toBeVisible();
  const backup = await downloaded(page, '导出'); await page.getByRole('button', { name: '新建实验', exact: true }).click();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '闭环实验.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  const restored = await exported(page); expect(restored.equipment).toEqual(recorded.equipment); expect(restored.connections).toEqual(recorded.connections);
  expect(restored.measurementRecords).toEqual(recorded.measurementRecords); expect(restored.measurementSnapshots).toEqual(recorded.measurementSnapshots);
  expect(restored.curriculumRef!.textbookMappings[0]!.status).toBe('pending_teacher_review');
  await expect(page.locator(`[data-meter-reading="${devices.A0!.id}"] strong`)).toHaveText(parallel ? '0.5 A' : '0.3 A');
  await page.getByRole('button', { name: '展开记录区', exact: true }).click(); await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath(parallel ? 'lamp-experiment-parallel.png' : 'lamp-experiment-series.png'), fullPage: true });
});

test.describe('touch experiment entry', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch chooses and edits a formal template; guidance and blank plan fit without page horizontal overflow', async ({ page }, testInfo) => {
    await ready(page); await start(page, 'parallel-different');
    await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0 A');
    await page.getByRole('button', { name: '合上开关', exact: true }).tap(); await expect(page.locator('[data-meter-reading="A"] strong')).toHaveText('0.5 A');
    const before = await exported(page), guide = page.getByTestId('lamp-circuit-guide');
    await guide.locator(':scope > summary').tap(); await guide.getByText('空白测量安排', { exact: true }).tap();
    const plan = guide.getByRole('region', { name: '空白测量安排，可横向滚动', exact: true });
    expect(await plan.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await guide.getByText('提示 1：先查接线与状态', { exact: true }).tap(); expect(await exported(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('lamp-experiment-touch-guide.png'), fullPage: true });
    await guide.getByRole('button', { name: '前往记录表', exact: true }).tap(); await expect(page.getByRole('tab', { name: '记录表', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('组别或接法', { exact: true })).toHaveValue('第1组');
  });
});
