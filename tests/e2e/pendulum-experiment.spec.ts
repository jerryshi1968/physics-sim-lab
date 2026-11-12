import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { createPendulumExperiment } from '../../src/experiments/pendulum.ts';

async function open(page: Page, id = 'pendulum') {
  await page.goto('/'); await page.getByRole('button', { name: '高中物理实验', exact: true }).click();
  await selectCatalogOption(page, id); await page.getByRole('button', { name: '进入实验', exact: true }).click();
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
}
async function exported(page: Page): Promise<SceneDocument> {
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click();
  return JSON.parse(await readFile((await (await wait).path())!, 'utf8'));
}
async function properties(page: Page, id: string, values: Record<string, string>) {
  await page.getByLabel('选择器材', { exact: true }).selectOption(id);
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
}
async function finish(page: Page) {
  await page.getByLabel('单摆播放速度', { exact: true }).selectOption('10');
  await page.getByRole('button', { name: '释放并计时', exact: true }).click();
  await expect(page.getByTestId('pendulum-clock')).toContainText('计时完成', { timeout: 15_000 });
}
test('senior catalogue, physical apparatus, length definition, direct bob dragging and immediate parameters', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await open(page);
  await expect(page.getByTestId('scene-board').locator('[data-pendulum-bob]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '释放并计时', exact: true })).toBeEnabled();
  await page.getByText('放大读尺（静止最低位置）', { exact: true }).click();
  await expect(page.locator('[data-pendulum-ruler-mark]')).toHaveCount(2);
  const initial = await exported(page); expect(initial.experimentId).toBe('H-MECH-04'); expect(initial.equipment).toHaveLength(4);
  const bob = page.getByTestId('scene-board').locator('[data-pendulum-bob]'), box = (await bob.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 15, { steps: 6 }); await page.mouse.up();
  expect(Number((await exported(page)).equipment.find(item => item.type === 'mechanical.pendulum')!.parameters.initialAngleDeg)).toBeGreaterThan(10);
  await expect(page.getByTestId('pendulum-clock').locator('..')).toContainText('摆角超过 5°');
  await properties(page, 'pendulum', { '释放摆角（相对竖直）（°）': '5', '摆线长度（悬点到球面）（m）': '.59' });
  await page.getByText('查看本装置模型值', { exact: true }).click(); await expect(page.locator('.pendulum-panel')).toContainText('摆长 L=0.6 m');
  await page.screenshot({ path: info.outputPath('pendulum-desktop.png'), fullPage: true });
  const before = await exported(page); await page.getByRole('button', { name: '高中物理实验', exact: true }).click(); await selectCatalogOption(page, 'pendulum-blank'); await page.getByRole('button', { name: '进入实验', exact: true }).click(); await page.getByRole('button', { name: '取消', exact: true }).click(); expect(await exported(page)).toEqual(before);
});
test('multi-cycle clock, raw records, correction, calculation CSV and saved reload do not auto-fill or resume', async ({ page }) => {
  await open(page); await finish(page);
  expect(Number(await page.getByTestId('pendulum-clock').getAttribute('data-time-s'))).toBe(28.384);
  await properties(page, 'ruler', { '位置 x（m）': '.04' }); await expect(page.getByTestId('pendulum-clock')).toContainText('计时完成');
  await expect(page.getByLabel('多周期时间 t（s）', { exact: true })).toHaveValue('');
  for (const [label, value] of [['悬点尺读数（m）', '0'], ['最低点球心尺读数（m）', '.5'], ['完整周期数 N（记录）', '20']]) await page.getByLabel(label!, { exact: true }).fill(value!);
  await page.getByRole('button', { name: '采集秒表示数', exact: true }).click(); await page.getByRole('button', { name: '保存本次单摆读数', exact: true }).click();
  const scene = await exported(page); expect(scene.measurementRecords).toHaveLength(4); expect(scene.measurementSnapshots).toHaveLength(1);
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('pendulum-result')).toContainText('小角有效'); await expect(page.getByTestId('pendulum-result')).toContainText('9.800371');
  await page.getByRole('tab', { name: '记录表', exact: true }).click();
  const timeRow = page.getByRole('row').filter({ hasText: '多周期时间t' }); await timeRow.getByRole('button', { name: '修改抄表', exact: true }).click();
  await timeRow.getByLabel('修订抄表值', { exact: true }).fill('30'); await timeRow.getByRole('button', { name: '确认修订', exact: true }).click();
  await page.getByRole('tab', { name: '图线', exact: true }).click(); await expect(page.getByTestId('pendulum-result')).toContainText('8.772982');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '导出单摆计算 CSV', exact: true }).click(); const csv = await readFile((await (await download).path())!, 'utf8'); expect(csv).toContain('小角公式g'); expect(csv).toContain('0.5');
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); await expect(page.getByTestId('pendulum-clock')).toContainText('0.000 s');
  expect((await exported(page)).measurementRecords).toHaveLength(4); await expect(page.getByRole('button', { name: '保存本次单摆读数', exact: true })).toBeDisabled();
});
test('controlled frames share one clock; pause, exact terminal event, parameter reset and undo never revive a run', async ({ page }) => {
  await page.addInitScript(() => {
    let serial = 0; const jobs = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = callback => { jobs.set(++serial, callback); return serial; }; window.cancelAnimationFrame = id => { jobs.delete(id); };
    Object.assign(window, { drivePendulumFrame: (ms: number) => { const callbacks = [...jobs.values()]; jobs.clear(); for (const callback of callbacks) callback(ms); }, pendingPendulumFrames: () => jobs.size });
  });
  const drive = (ms: number) => page.evaluate(value => (window as unknown as { drivePendulumFrame: (value: number) => void }).drivePendulumFrame(value), ms);
  const pending = () => page.evaluate(() => (window as unknown as { pendingPendulumFrames: () => number }).pendingPendulumFrames());
  await open(page); await page.getByRole('button', { name: '释放并计时', exact: true }).click(); await expect.poll(pending).toBeGreaterThan(0);
  await drive(0); for (let i = 1; i <= 9; i++) await drive(i * 1000 / 30);
  await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0.3');
  expect(Number(await page.getByTestId('scene-board').locator('[data-pendulum-angle-rad]').getAttribute('data-pendulum-angle-rad'))).toBeLessThan(.04);
  await page.getByRole('button', { name: '暂停单摆', exact: true }).click(); await expect.poll(pending).toBe(0); await drive(1000); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0.3');
  await page.getByRole('button', { name: '单步计时', exact: true }).click(); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0.4');
  await page.getByLabel('单摆播放速度').selectOption('10'); await page.getByRole('button', { name: '继续单摆', exact: true }).click(); await expect.poll(pending).toBeGreaterThan(0); await drive(2000); for (let i = 1; i <= 30; i++) await drive(2000 + i * 100);
  await expect(page.getByTestId('pendulum-clock')).toContainText('完整周期 20 / 20；计时完成'); await expect.poll(pending).toBe(0);
  await properties(page, 'pendulum', { '释放摆角（相对竖直）（°）': '30' }); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0');
  await page.getByRole('button', { name: /撤销/ }).click(); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0');
});
test('blank assembly is independent and unsupported apparatus stay disabled; removing timing or mounting blocks capture', async ({ page }) => {
  await open(page, 'pendulum-blank');
  await expect(page.getByRole('button', { name: '释放并计时', exact: true })).toBeDisabled();
  const library = page.getByRole('region', { name: '器材库', exact: true }); await expect(library.locator('[data-library-type="mechanical.pendulum"]')).toBeEnabled(); await expect(library.locator('[data-library-type="mechanical.spring"]')).toBeDisabled();
  const scene = createPendulumExperiment('missing-timer', '2026-11-12T00:00:00.000Z'); scene.equipment = scene.equipment.filter(item => item.id !== 'timer');
  await page.getByLabel('导入实验 JSON').setInputFiles({ name: 'pendulum.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.locator('.pendulum-panel')).toContainText('请添加计时器'); await expect(page.getByRole('button', { name: '释放并计时', exact: true })).toBeDisabled();
  await page.getByLabel('单摆连接支架', { exact: true }).selectOption(''); await expect(page.locator('.pendulum-panel')).toContainText('请将单摆连接到支架');
});
test('phone and tablet can touch the bob without moving apparatus from empty space', async ({ browser }, info) => {
  for (const name of ['iPhone 13', 'iPad (gen 7) landscape']) {
    const context = await browser.newContext({ ...devices[name] }); const page = await context.newPage(); await open(page);
    await page.getByTestId('scene-board').locator('[data-pendulum-bob]').tap(); await expect(page.getByLabel('选择器材', { exact: true })).toHaveValue('pendulum');
    const before = await exported(page), bob = page.getByTestId('scene-board').locator('[data-pendulum-bob]'), box = (await bob.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 35 * i / 6, y: y - 10 * i / 6 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const changed = await exported(page); expect(changed.equipment.find(item => item.id === 'pendulum')!.parameters.initialAngleDeg).not.toBe(before.equipment.find(item => item.id === 'pendulum')!.parameters.initialAngleDeg);
    const area = (await page.getByTestId('scene-board').boundingBox())!;
    for (const pan of [false, true]) {
      if (pan) await page.getByRole('button', { name: '平移', exact: true }).tap();
      const start = { x: area.x + area.width * .12, y: area.y + area.height * .2 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 20, y: start.y + 15 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect((await exported(page)).equipment).toEqual(changed.equipment);
    }
    await page.screenshot({ path: info.outputPath(`pendulum-${name.split(' ')[0]}.png`), fullPage: true }); await context.close();
  }
});


test('blank apparatus can be assembled from the library and timed without changing experiment', async ({ page }) => {
  await open(page, 'pendulum-blank');
  for (const type of ['mechanical.support', 'mechanical.pendulum', 'mechanical.ruler', 'mechanical.projectile-timer']) {
    await page.locator(`[data-library-type="${type}"]`).click();
    await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  }
  const scene = await exported(page), stand = scene.equipment.find(item => item.type === 'mechanical.support')!, bob = scene.equipment.find(item => item.type === 'mechanical.pendulum')!, ruler = scene.equipment.find(item => item.type === 'mechanical.ruler')!;
  await properties(page, stand.id, { '支架高度（m）': '.8', '位置 y（m）': '0' });
  await page.getByLabel('单摆连接支架', { exact: true }).selectOption(stand.id);
  await properties(page, ruler.id, { '转角（°）': '-90', '位置 y（m）': '.76' });
  await expect(page.getByRole('button', { name: '释放并计时', exact: true })).toBeEnabled();
  await finish(page); const result = await exported(page);
  expect(result.experimentId).toBe('H-MECH-04'); expect(result.equipment.find(item => item.id === bob.id)!.parameters.supportId).toBe(stand.id);
});

test('gravity defaults to 9.81, applies immediately, rejects invalid drafts and survives undo and reload', async ({ page }) => {
  await open(page);
  const gravity = page.getByLabel('重力加速度 g（m/s²）', { exact: true }); await expect(gravity).toHaveValue('9.81');
  await finish(page); await gravity.fill('2.4525'); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0');
  expect((await exported(page)).simulationConfig.gravityMPerS2).toBe(2.4525);
  await finish(page); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '56.767');
  await gravity.fill('0'); await expect(page.locator('.pendulum-panel')).toContainText('无效输入未应用'); await gravity.blur(); await expect(gravity).toHaveValue('2.4525');
  await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '56.767');
  await gravity.fill('9.81'); await gravity.press('ArrowUp'); await expect(gravity).toHaveValue('9.82');
  await page.getByRole('button', { name: /撤销/ }).click(); await expect(gravity).toHaveValue('9.81'); await expect(page.getByTestId('pendulum-clock')).toHaveAttribute('data-time-s', '0');
  await gravity.fill('3.71'); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByTestId('save-state')).toHaveText('已保存'); await page.reload(); await expect(gravity).toHaveValue('3.71');
  expect((await exported(page)).simulationConfig.gravityMPerS2).toBe(3.71);
});
