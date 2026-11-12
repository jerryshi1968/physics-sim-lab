import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function open(page: Page, empty = false) {
  page.setDefaultTimeout(15_000);
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await openFamily(page, '杠杆平衡实验');
  if (empty) await page.getByRole('radio', { name: '空白搭建杠杆平衡实验', exact: true }).check();
  await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function properties(page: Page, id: string, fields: Record<string, string>) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  for (const [name, value] of Object.entries(fields)) await page.getByLabel(name, { exact: true }).fill(value);
  
}
async function attach(page: Page, id: string, hook: string, target = 'lever') {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id); await page.getByLabel('挂接杠杆', { exact: true }).selectOption(target);
  if (target) await page.getByLabel('挂点编号', { exact: true }).selectOption(hook);
  
}
async function zero(page: Page) {
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).click();
  await page.getByRole('button', { name: '确认空载调平', exact: true }).click();
}
async function download(page: Page, name = '导出') {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click(); return readFile((await (await pending).path())!, 'utf8');
}
async function exported(page: Page): Promise<SceneDocument> { return JSON.parse(await download(page)) as SceneDocument; }
const status = (page: Page) => page.getByTestId('lever-status');

test('mechanical category is always available with a physical independent ruler and cancellable formal experiment entry', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 }); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  const library = page.getByRole('region', { name: '器材库', exact: true }), before = await exported(page);
  await library.getByRole('tab', { name: '电学', exact: true }).focus(); await page.keyboard.press('End'); await expect(library.getByRole('tab', { name: '力学', exact: true })).toBeFocused();
  await expect(library.locator('[data-library-type]')).toHaveCount(27); expect(await exported(page)).toEqual(before);
  await library.locator('[data-library-type="mechanical.ruler"]').click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await expect(page.getByTestId('scene-board').locator('[data-equipment-type="mechanical.ruler"] [data-appearance="physical"]')).toHaveCount(1);
  const placed = await exported(page); expect(placed.equipment[0]!.parameters).toEqual({ lengthM: 1 }); await expect(status(page)).toContainText('请放置杠杆');
  await openFamily(page, '杠杆平衡实验'); await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(placed);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mechanical-library.png'), fullPage: true });
});

test('three groups from real hook attachments compare masses, vertical and inclined pull; snapshots, graph, CSV and reload stay consistent', async ({ page }, info) => {
  test.setTimeout(120_000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page); await expect(status(page)).toContainText('空载调平'); await expect(page.locator('[data-lever-forces]')).toHaveCount(0);
  await zero(page); await properties(page, 'right', { '钩码总质量（kg）': '.2' }); await attach(page, 'left', '-4'); await attach(page, 'right', '2');
  await expect(status(page)).toHaveText('当前力矩平衡'); await expect(page.getByRole('button', { name: '确认空载调平', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  async function record(group: string, second: string, force: string, arm: string) {
    await page.getByLabel('组别', { exact: true }).fill(group);
    for (const [id, f, d, turn] of [['left', '1.01', '.2', 'ccw'], [second, force, arm, 'cw']]) {
      const label = id === 'left' ? '钩码 3' : id === 'right' ? '钩码 4' : '弹簧测力计 5';
      await page.getByLabel(`${label} 力（N）`, { exact: true }).fill(f!); await page.getByLabel(`${label} 力臂（m）`, { exact: true }).fill(d!); await page.getByLabel(`${label} 力矩方向`, { exact: true }).selectOption(turn!);
    }
    await page.getByLabel('观察平衡状态', { exact: true }).selectOption('平衡'); await page.getByRole('button', { name: '保存力与力臂记录', exact: true }).click();
  }
  await record('钩码组', 'right', '2', '.1'); const first = await exported(page); expect(first.measurementRecords).toHaveLength(6); expect(first.measurementRecords[2]!.value).toBeCloseTo(.202, 9);
  await attach(page, 'right', '2', ''); await properties(page, 'meter', { '施加拉力（N）': '2' }); await attach(page, 'meter', '2');
  await expect(status(page)).toHaveText('当前力矩平衡'); await expect(page.locator('[data-force-reading="meter"]')).toContainText('2 N'); await record('竖拉组', 'meter', '2', '.1');
  await properties(page, 'meter', { '施加拉力（N）': '4', '拉力方向（右为0，上为90）（°）': '-30' }); await expect(status(page)).toHaveText('当前力矩平衡'); await expect(page.locator('[data-force-reading="meter"]')).toContainText('4 N');
  await record('斜拉组', 'meter', '4', '.05'); const recorded = await exported(page); expect(recorded.measurementRecords).toHaveLength(18); expect(recorded.measurementRecords.slice(0, 6)).toEqual(first.measurementRecords);
  expect(recorded.measurementSnapshots).toHaveLength(3); expect(recorded.measurementSnapshots![2]!.equipment.find(item => item.id === 'meter')!.parameters.directionDeg).toBe(-30);
  await page.getByLabel('显示力、作用线与理论（可关闭）', { exact: true }).check(); await expect(page.getByTestId('lever-theory')).toContainText('4 N，力臂 0.05 m');
  expect(await exported(page)).toEqual(recorded); await page.getByLabel('显示力、作用线与理论（可关闭）', { exact: true }).uncheck();
  const csv = await download(page, '导出 CSV'); expect(csv).toContain('力矩'); expect(csv).toContain('directionDeg'); expect(csv).not.toMatch(/NaN|Infinity/);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.locator('[data-record-id]')).toHaveCount(6);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload();
  const restored = await exported(page); expect(restored).toEqual(recorded); await expect(status(page)).toHaveText('当前力矩平衡'); await expect(page.getByRole('tab', { name: '力学', exact: true })).toHaveAttribute('aria-selected', 'true');
  const backup = await download(page); await page.getByRole('button', { name: '新建实验', exact: true }).click(); await page.getByLabel('导入实验 JSON').setInputFiles({ name: '杠杆.json', mimeType: 'application/json', buffer: Buffer.from(backup) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); expect(await exported(page)).toEqual(recorded);
  await page.getByLabel('显示力、作用线与理论（可关闭）', { exact: true }).check(); await page.getByRole('tab', { name: '图线', exact: true }).click(); await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); expect(errors).toEqual([]); await page.screenshot({ path: info.outputPath('lever-inclined-records.png'), fullPage: true });
});

test('drag snaps to actual hooks once, cancel and undo preserve load references; wrong-side moments, zero arm, overrange and invalid support remain explicit', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 }); await open(page); await zero(page);
  const board = page.getByTestId('scene-board'), weight = board.locator('[data-equipment-id="left"] [data-mechanical-type="mechanical.weights"]'), target = board.locator('[data-equipment-id="lever"] [data-lever-hook="-4"] circle');
  const box = (await weight.boundingBox())!, hook = (await target.boundingBox())!, from = { x: box.x + box.width / 2, y: box.y + 3 }, to = { x: hook.x + hook.width / 2, y: hook.y + hook.height / 2 };
  const before = await exported(page); await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(board).toHaveAttribute('data-revision', String(before.revision)); await expect(page.getByRole('button', { name: '保存力与力臂记录', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.mouse.up(); expect(await exported(page)).toEqual(before);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  const attached = await exported(page); expect(attached.revision).toBe(before.revision + 1); expect(attached.equipment.find(item => item.id === 'left')!.parameters.leverId).toBe('lever'); expect(attached.equipment.find(item => item.id === 'left')!.parameters.hookIndex).toBe(-4);
  await expect(status(page)).toContainText('逆时针'); await page.getByRole('button', { name: '撤销', exact: true }).click(); expect((await exported(page)).equipment).toEqual(before.equipment); await page.getByRole('button', { name: '重做', exact: true }).click();
  await attach(page, 'right', '-2'); await expect(status(page)).toContainText('逆时针'); await attach(page, 'right', '2', '');
  await attach(page, 'meter', '0'); await properties(page, 'meter', { '施加拉力（N）': '2' }); await expect(page.locator('[data-force-reading="meter"]')).toContainText('零力臂');
  await attach(page, 'meter', '2'); await properties(page, 'meter', { '施加拉力（N）': '6' }); await expect(page.locator('[data-force-reading="meter"]')).toContainText('超量程');
  await properties(page, 'lever', { '支点挂点编号': '1' }); await expect(status(page)).toContainText('尚未确认空载调平');
  await page.getByLabel('选择器材', { exact: true }).selectOption('lever'); await page.getByLabel('安装支架', { exact: true }).selectOption('');  await expect(status(page)).toContainText('没有有效支架');
  await page.screenshot({ path: info.outputPath('lever-invalid-support.png'), fullPage: true });
});

test.describe('touch lever assembly', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('touch places all five mechanical types from blank, mounts and levels a real lever without horizontal page overflow', async ({ page }, info) => {
    test.setTimeout(90_000); await open(page, true); const library = page.getByRole('region', { name: '器材库', exact: true }), board = page.getByTestId('scene-board');
    for (const type of ['mechanical.support', 'mechanical.lever', 'mechanical.weights', 'mechanical.force-meter', 'mechanical.ruler']) { await library.locator(`[data-library-type="${type}"]`).tap(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).tap(); }
    const doc = await exported(page), lever = doc.equipment.find(item => item.type === 'mechanical.lever')!, support = doc.equipment.find(item => item.type === 'mechanical.support')!;
    await page.getByLabel('选择器材', { exact: true }).selectOption(lever.id); await page.getByLabel('安装支架', { exact: true }).selectOption(support.id); 
    await zero(page); await expect(status(page)).toHaveText('当前力矩平衡');
    const weight = doc.equipment.find(item => item.type === 'mechanical.weights')!; await attach(page, weight.id, '-2', lever.id); await expect(status(page)).toContainText('逆时针');
    const selected = board.locator(`[data-equipment-id="${weight.id}"] [data-mechanical-type="mechanical.weights"]`); await selected.scrollIntoViewIfNeeded(); const bounds = (await selected.boundingBox())!, x = bounds.x + bounds.width / 2, y = bounds.y + 3;
    const before = await exported(page), session = await page.context().newCDPSession(page); await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 25, y: y + 25, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); expect(await exported(page)).toEqual(before); await session.detach();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('lever-touch.png'), fullPage: true });
  });
});
