import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createFrictionExperiment } from '../../src/experiments/friction.ts';
import { createOpticalExperiment } from '../../src/experiments/optical-bench.ts';
import type { SceneDocument } from '../../src/core/scene/schema.ts';

async function replace(page: Page, scene: SceneDocument) {
  await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'lifecycle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  await expect(page.locator('h1')).toHaveText(scene.title);
}
async function atRest(page: Page, scene: SceneDocument) {
  await expect(page.getByRole('button', { name: '开始牵引', exact: true })).toBeVisible();
  await expect(page.getByTestId('friction-reading')).toContainText('尚未开始');
  const block = scene.equipment.find(item => item.id === 'block')!;
  expect(Number(await page.getByTestId('scene-board').locator('[data-equipment-id="block"]').getAttribute('data-x-m'))).toBeCloseTo(block.pose.xM, 8);
}
test('reimporting a running friction document and revisiting it after another experiment prepare an idle initial state', async ({ page }) => {
  const scene = createFrictionExperiment('m7-friction-same', '2026-11-05T00:00:00.000Z');
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled(); await replace(page, scene);
  await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect(page.getByTestId('friction-status')).toContainText('稳态');
  await replace(page, scene); await atRest(page, scene);
  await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect(page.getByTestId('friction-status')).toContainText('稳态');
  await replace(page, createOpticalExperiment('m7-optical-other', scene.provenance.createdAt)); await replace(page, scene); await atRest(page, scene);
  await page.getByRole('button', { name: '单步牵引', exact: true }).click(); await expect(page.getByRole('button', { name: '开始牵引', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重置牵引', exact: true }).click(); await atRest(page, scene);
});
test('changing physical initial conditions while running and undoing them cannot revive an earlier friction timer', async ({ page }) => {
  const scene = createFrictionExperiment('m7-friction-undo', '2026-11-05T00:00:00.000Z');
  await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled(); await replace(page, scene);
  await page.getByRole('button', { name: '开始牵引', exact: true }).click(); await expect(page.getByTestId('friction-status')).toContainText('稳态');
  await page.getByLabel('选择器材', { exact: true }).selectOption('block'); await page.getByLabel('木块质量（kg）', { exact: true }).fill('1'); await atRest(page, scene);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await atRest(page, scene);
  await page.getByRole('button', { name: '重做', exact: true }).click(); await atRest(page, scene);
});
