import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createElectricalRegistry, POWER, LAMP, SWITCH, AMMETER, VOLTMETER } from '../../src/equipment/electrical/definitions.ts';
import { createEmptyScene } from '../../src/core/scene/create.ts';

const registry = createElectricalRegistry();
function circuit(parallel = false) {
  const scene = createEmptyScene('measurement.e2e', '2026-11-04T08:00:00.000Z');
  scene.title = parallel ? '并联多测点记录' : '串联多测点记录';
  scene.equipment = [[POWER, 'E', -.35, .12], [LAMP, 'L1', 0, .12], [LAMP, 'L2', .35, .12], [SWITCH, 'S', -.35, -.02],
    [AMMETER, 'A0', -.4, -.09], [AMMETER, 'A1', -.2, -.09], [AMMETER, 'A2', 0, -.09],
    [VOLTMETER, 'V0', .2, -.09], [VOLTMETER, 'V1', .4, -.09], [VOLTMETER, 'V2', .55, .12]].map(([type, id, x, y]) => ({
    id: String(id), type: String(type), definitionVersion: 1, parameters: registry.get(String(type), 1)!.defaultParameters,
    pose: { xM: Number(x), yM: Number(y), rotationRad: 0 },
  }));
  scene.equipment[0]!.parameters.voltageV = parallel ? 3 : 6; scene.equipment[3]!.parameters.closed = true;
  if (parallel) scene.equipment[2]!.parameters.ratedCurrentA = .2;
  const pairs = parallel ? [
    ['E', 'positive', 'S', 'a'], ['S', 'b', 'A0', 'low'], ['A0', 'common', 'A1', 'low'], ['A0', 'common', 'A2', 'low'],
    ['A1', 'common', 'L1', 'a'], ['A2', 'common', 'L2', 'a'], ['L1', 'b', 'E', 'negative'], ['L2', 'b', 'E', 'negative'],
  ] : [
    ['E', 'positive', 'A0', 'low'], ['A0', 'common', 'L1', 'a'], ['L1', 'b', 'A1', 'low'], ['A1', 'common', 'L2', 'a'],
    ['L2', 'b', 'A2', 'low'], ['A2', 'common', 'S', 'a'], ['S', 'b', 'E', 'negative'],
  ];
  pairs.push(['V0', 'high', 'E', 'positive'], ['V0', 'common', 'E', 'negative'], ['V1', 'low', 'L1', 'a'], ['V1', 'common', 'L1', 'b'], ['V2', 'low', 'L2', 'a'], ['V2', 'common', 'L2', 'b']);
  scene.connections = pairs.map(([a, ap, b, bp], index) => ({ id: `w${index}`, kind: 'wire', from: { equipmentId: a!, portId: ap! }, to: { equipmentId: b!, portId: bp! } }));
  return scene;
}
function label(id: string) {
  const scene = circuit(), index = scene.equipment.findIndex(item => item.id === id), item = scene.equipment[index]!;
  return `${registry.get(item.type, 1)!.label} ${index + 1}`;
}
async function open(page: Page, parallel = false) {
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '多测点.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(circuit(parallel))) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.locator('[data-meter-reading]')).toHaveCount(6);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
}
async function downloaded(page: Page, name: string) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await event).path())!, 'utf8');
}
async function readDocument(page: Page) { return JSON.parse(await downloaded(page, '导出')) as ReturnType<typeof createEmptyScene>; }
async function voltage(page: Page, value: string) {
  await page.getByLabel('选择器材', { exact: true }).selectOption('E');
  await page.getByLabel('电源电压（V）', { exact: true }).fill(value); 
}
async function capture(page: Page) { await page.getByRole('button', { name: '采集仪表示数', exact: true }).click(); }
const rows = (page: Page) => page.locator('[data-measurement-id]');
function parseCsv(text: string) {
  const output: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && char === '\r' && text[index + 1] === '\n') { row.push(cell); output.push(row); row = []; cell = ''; index++; }
    else cell += char;
  }
  return output;
}

test('series multi-point acquisition, table, current/voltage chart, CSV and reload use the same frozen snapshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  await page.getByLabel('组别或接法', { exact: true }).fill('串联第1组');
  for (const [id, point] of [['A0', 'I总'], ['A1', 'I1'], ['A2', 'I2'], ['V0', 'U总'], ['V1', 'U1'], ['V2', 'U2']]) await page.getByLabel(`${label(id!)}测点名称`, { exact: true }).fill(point!);
  await capture(page); await expect(rows(page)).toHaveCount(6);
  const first = await readDocument(page);
  expect(first.measurementRecords.map(record => record.value)).toEqual([.3, .3, .3, 6, 3, 3]);
  expect(first.measurementSnapshots).toHaveLength(1);
  expect(first.measurementRecords.every(record => record.context?.sampleId === first.measurementSnapshots![0]!.id)).toBe(true);
  await voltage(page, '0'); await expect(page.locator('[data-meter-reading="A0"] strong')).toHaveText('0 A');
  expect((await readDocument(page)).measurementRecords).toEqual(first.measurementRecords);
  await capture(page); await expect(rows(page)).toHaveCount(12);
  const all = await readDocument(page); expect(all.measurementRecords.slice(6).every(record => record.value === 0)).toBe(true);
  expect(all.measurementSnapshots![0]!.equipment[0]!.parameters.voltageV).toBe(6);
  await page.getByRole('tab', { name: '图线', exact: true }).click();
  await expect(page.locator('[data-record-id]')).toHaveCount(6);
  expect(await page.locator('[data-record-id]').evaluateAll(points => points.map(point => Number(point.getAttribute('data-value'))))).toEqual([.3, 0, .3, 0, .3, 0]);
  await page.getByLabel('图线类型', { exact: true }).selectOption('electrical-voltage');
  await expect(page.locator('[data-record-id]')).toHaveCount(6);
  expect(await page.locator('[data-record-id]').evaluateAll(points => points.map(point => Number(point.getAttribute('data-value'))))).toEqual([6, 0, 3, 0, 3, 0]);
  await page.getByRole('button', { name: '新建实验' }).focus();
  await page.screenshot({ path: testInfo.outputPath('measurement-voltage-chart.png'), fullPage: true });
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  await page.getByRole('button', { name: '展开测点与抄表', exact: true }).click();
  await expect(page.getByLabel('组别或接法', { exact: true })).toHaveValue('串联第1组');
  await expect(page.getByLabel(`${label('A0')}测点名称`, { exact: true })).toHaveValue('I总');
  const csv = parseCsv(await downloaded(page, '导出 CSV')), header = csv[0]!;
  expect(csv).toHaveLength(13); expect(csv.slice(1).map(row => Number(row[header.indexOf('记录值')]))).toEqual(all.measurementRecords.map(record => record.value));
  expect(JSON.parse(csv[1]![header.indexOf('连接快照')]!)).toEqual(first.measurementSnapshots![0]!.connections);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload(); await expect(rows(page)).toHaveCount(12);
  const restored = await readDocument(page); expect(restored.measurementRecords).toEqual(all.measurementRecords); expect(restored.measurementSnapshots).toEqual(all.measurementSnapshots);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('measurement-table-restored.png'), fullPage: true });
});

test('hand-copied estimates, missing values and explicit corrections never get overwritten by model truth', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await open(page);
  for (const id of ['A1', 'A2', 'V0', 'V2']) await page.getByLabel(`记录${label(id)}`, { exact: true }).uncheck();
  await page.getByLabel(`${label('A0')}抄表值（A）`, { exact: true }).fill(' 0.29 ');
  await expect(page.getByLabel(`${label('V1')}抄表值（V）`, { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '保存手工抄表', exact: true }).click(); await expect(rows(page)).toHaveCount(2);
  const first = await readDocument(page); expect(first.measurementRecords.map(record => record.value)).toEqual([.29, null]);
  await expect(rows(page).nth(1)).toContainText('缺失'); expect(first.measurementRecords[0]!.rawInput).toBe(' 0.29 ');
  await page.getByRole('button', { name: '展开测点与抄表', exact: true }).click();
  await page.getByLabel(`${label('A0')}抄表值（A）`, { exact: true }).fill('=1+1');
  await page.getByRole('button', { name: '保存手工抄表', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('有限十进制数字');
  await expect(rows(page)).toHaveCount(2);
  await rows(page).first().getByRole('button', { name: '修改抄表', exact: true }).click();
  await page.getByLabel('修订抄表值', { exact: true }).fill('0.31'); await page.getByRole('button', { name: '确认修订', exact: true }).click();
  await expect(rows(page).first()).toHaveAttribute('data-measurement-value', '0.31');
  const corrected = await readDocument(page); expect(corrected.measurementRecords[0]!.recordedAt).toBe(first.measurementRecords[0]!.recordedAt);
  expect(corrected.measurementRecords[0]!.context).toEqual(first.measurementRecords[0]!.context); expect(corrected.measurementSnapshots).toEqual(first.measurementSnapshots);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveAttribute('data-value', '0.31');
  await page.getByLabel('图线类型', { exact: true }).selectOption('electrical-voltage'); await expect(page.getByRole('region', { name: '实验记录与分析', exact: true }).getByRole('tabpanel')).toContainText('暂无可绘制的数据');
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  await rows(page).nth(1).getByRole('button', { name: '删除记录', exact: true }).click(); await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await expect(rows(page)).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('manual-and-missing-records.png'), fullPage: true });
});

test('over-range and model-failure samples stay blank, stale paused samples are blocked and corrupt snapshots cannot replace work', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  await voltage(page, '90'); await expect(page.locator('[data-meter-reading="A0"]')).toHaveAttribute('data-meter-status', 'over-range');
  await capture(page); await expect(rows(page)).toHaveCount(6);
  expect((await readDocument(page)).measurementRecords.every(record => record.value === null && record.measurementStatus === 'over-range')).toBe(true);
  await voltage(page, '1000'); await expect(page.getByRole('alert')).toContainText('灯泡超出电流模型范围');
  await capture(page); await expect(rows(page)).toHaveCount(12);
  const errors = await readDocument(page); expect(errors.measurementRecords.slice(6).every(record => record.value === null && record.measurementStatus === 'out-of-model')).toBe(true);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(0);
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const csv = parseCsv(await downloaded(page, '导出 CSV')), index = csv[0]!.indexOf('记录值'); expect(csv.slice(1).every(row => row[index] === '')).toBe(true);
  await voltage(page, '6'); await expect(page.locator('[data-meter-reading="A0"] strong')).toHaveText('0.3 A');
  await page.getByRole('button', { name: '暂停自动更新', exact: true }).click(); await voltage(page, '0');
  await expect(page.getByRole('button', { name: '采集仪表示数', exact: true })).toBeDisabled(); await expect(rows(page)).toHaveCount(12);
  await page.getByRole('button', { name: '恢复自动更新', exact: true }).click(); await expect(page.locator('[data-meter-reading="A0"] strong')).toHaveText('0 A');
  const before = await readDocument(page), invalid = structuredClone(before); invalid.measurementRecords[0]!.context!.sampleId = 'absent';
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: '损坏记录.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('alert')).toContainText('INVALID_MEASUREMENT_SNAPSHOT'); expect((await readDocument(page)).measurementRecords).toEqual(before.measurementRecords);
});

test('different parallel lamps record real branch currents and equal branch voltages; CSV neutralizes text formulas', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page, true);
  await page.getByLabel('组别或接法', { exact: true }).fill('=HYPERLINK("test")'); await page.getByLabel('本组备注', { exact: true }).fill('＠SUM(1)');
  await capture(page); await expect(rows(page)).toHaveCount(6);
  const recorded = await readDocument(page); expect(recorded.measurementRecords.map(record => record.value)).toEqual([.5, .3, .2, 3, 3, 3]);
  expect(recorded.measurementSnapshots![0]!.equipment.find(item => item.id === 'L2')!.parameters.ratedCurrentA).toBe(.2);
  const csv = parseCsv(await downloaded(page, '导出 CSV')), header = csv[0]!;
  expect(csv[1]![header.indexOf('组别或接法')]).toBe('\t=HYPERLINK("test")'); expect(csv[1]![header.indexOf('备注')]).toBe('\t＠SUM(1)');
  expect(recorded.measurementSnapshots![0]!.setupLabel).toBe('=HYPERLINK("test")');
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(3);
  expect(await page.locator('[data-record-id]').evaluateAll(points => points.map(point => Number(point.getAttribute('data-value'))))).toEqual([.5, .3, .2]);
});

test.describe('touch measurement and narrow table', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch acquisition and chart controls remain usable without page horizontal overflow', async ({ page }, testInfo) => {
    await open(page, true);
    await page.getByRole('button', { name: '采集仪表示数', exact: true }).tap(); await expect(rows(page)).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const table = page.getByRole('region', { name: '测量记录表，可横向滚动', exact: true });
    expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.getByRole('tab', { name: '图线', exact: true }).tap(); await expect(page.locator('[data-record-id]')).toHaveCount(3);
    expect(await page.locator('[data-testid="measurement-chart"] path').evaluateAll(paths => paths.every(path => !/NaN|Infinity/.test(path.getAttribute('d') ?? '')))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('measurement-touch-narrow.png'), fullPage: true });
  });
});
