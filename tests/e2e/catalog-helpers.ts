import type { Page } from '@playwright/test';
import { experimentChoices, schoolLabels, catalogDomainLabels } from '../../src/experiments/catalog.ts';

const defaults: Record<string, string> = {
  '灯泡串并联实验': 'electrical-blank', '光的反射定律实验': 'reflection', '平面镜成像实验': 'mirror-image', '凸透镜成像实验': 'lens',
  '杠杆平衡实验': 'lever', '浮力实验': 'buoyancy-factors', '滑动摩擦实验': 'friction', '弹簧弹力实验': 'spring',
  '平抛运动实验': 'projectile', '加速度与力、质量实验': 'cart', '测量密度实验': 'density-solid', '电动势与内阻实验': 'emf-inner',
};
export async function selectCatalogOption(page: Page, id: string, touch = false) {
  const choice = experimentChoices.find(item => item.id === id);
  if (!choice) throw new Error(`Unknown catalogue option: ${id}`);
  const dialog = page.getByRole('dialog', { name: schoolLabels[choice.stage], exact: true });
  const tab = dialog.getByRole('tab', { name: catalogDomainLabels[choice.domain], exact: true });
  if (touch) await tab.tap(); else await tab.click();
  const option = dialog.getByRole('radio', { name: choice.title, exact: true });
  if (touch) await option.tap(); else await option.check();
}
export async function openFamily(page: Page, family: string, touch = false) {
  const id = defaults[family], choice = experimentChoices.find(item => item.id === id);
  if (!choice) throw new Error(`Unknown experiment family: ${family}`);
  const button = page.getByRole('button', { name: schoolLabels[choice.stage], exact: true });
  if (touch) await button.tap(); else await button.click();
  await selectCatalogOption(page, choice.id, touch);
}
