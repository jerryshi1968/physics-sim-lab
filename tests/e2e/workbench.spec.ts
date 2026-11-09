import { test, expect } from '@playwright/test';

for (const width of [1366, 1920]) {
  test(`empty workbench fits a ${width}px classroom display`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith('http://127.0.0.1:4173/')) externalRequests.push(request.url());
    });
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await page.goto('/');
    await expect(page).toHaveTitle('中学物理仿真实验室');
    await expect(page.getByRole('heading', { name: '未命名实验' })).toBeVisible();
    for (const name of ['器材库', '实验区域', '属性与诊断']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('0 件器材 · 0 根导线')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await expect(page.getByRole('region', { name: '实验记录与分析', exact: true }).getByRole('tabpanel')).toContainText('还没有测量记录');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`workbench-${width}.png`), fullPage: true });
  });
}

test('record tabs work with keyboard and creating a blank document resets the view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '记录表', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '图线', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: '实验记录与分析', exact: true }).getByRole('tabpanel')).toContainText('暂无可绘制的数据');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '模型说明', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: '实验记录与分析', exact: true }).getByRole('tabpanel')).toContainText('当前未加载领域模型');
  await page.getByRole('button', { name: '新建实验' }).click();
  await expect(page.getByRole('tab', { name: '记录表', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status')).toHaveText('已建立新的空白实验。');
  await expect(page.getByText('0 件器材 · 0 根导线')).toBeVisible();
});

test('minimizing records gives the bench more space and preserves the active tab', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 720 });
  await page.goto('/');
  const records = page.getByRole('region', { name: '实验记录与分析' });
  const chartTab = records.getByRole('tab', { name: '图线', exact: true });
  await chartTab.click();
  const board = page.getByTestId('scene-board');
  const before = (await board.boundingBox())!.height;
  await records.getByRole('button', { name: '最小化记录区', exact: true }).click();
  await expect(records.getByRole('heading', { name: '实验记录' })).toBeVisible();
  await expect(records.getByRole('tabpanel')).toBeHidden();
  expect((await board.boundingBox())!.height).toBeGreaterThan(before + 100);
  await records.getByRole('button', { name: '恢复记录区', exact: true }).click();
  await expect(chartTab).toHaveAttribute('aria-selected', 'true');
  await expect(records.getByRole('tabpanel')).toBeVisible();
  expect((await board.boundingBox())!.height).toBe(before);
});

test('operation notices expire and a repeated notice restarts the timer', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const create = page.getByRole('button', { name: '新建实验' });
  const notice = page.locator('.live-notice');
  await create.click();
  await expect(notice).toHaveText('已建立新的空白实验。');
  await page.clock.fastForward(2400);
  await create.click();
  await page.clock.fastForward(800);
  await expect(notice).toBeVisible();
  await page.clock.fastForward(2400);
  await expect(notice).toBeHidden();
});

test('narrow viewport keeps primary controls visible without horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '新建实验' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '实验区域', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('tab', { name: '模型说明', exact: true }).click();
  await expect(page.getByRole('region', { name: '实验记录与分析', exact: true }).getByRole('tabpanel')).toContainText('物理计算使用 SI 单位');
  await page.screenshot({ path: testInfo.outputPath('workbench-narrow.png'), fullPage: true });
});
