import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption } from './catalog-helpers.ts';
async function open(page: Page, blank = false) {
  await page.goto('/'); await page.getByRole('button', {name:'初中物理实验',exact:true}).click();
  await selectCatalogOption(page,blank ? 'thermal-blank' : 'boiling');
  await page.getByRole('button',{name:'进入实验',exact:true}).click(); await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();
}
async function exported(page: Page) {
  const event=page.waitForEvent('download'); await page.getByRole('button',{name:'导出',exact:true}).click();
  return JSON.parse(await readFile((await (await event).path())!,'utf8'));
}
async function properties(page: Page,id:string,values:Record<string,string>) {
  await page.getByLabel('选择器材',{exact:true}).selectOption(id);
  for(const [label,value] of Object.entries(values)) await page.getByLabel(label,{exact:true}).fill(value);
}
async function heatPaused(page:Page) { await page.getByRole('button',{name:'开始加热',exact:true}).click(); await page.getByRole('button',{name:'暂停计时',exact:true}).click(); }
async function plateau(page:Page) { await heatPaused(page); await page.getByLabel('热学单步间隔（s）',{exact:true}).fill('300'); await page.getByRole('button',{name:'单步热学',exact:true}).click(); await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：100 ℃'); }

test('junior thermal catalogue, five physical apparatus, disabled incompatible tools and direct selection',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1366,height:900}); await open(page);
  const library=page.getByRole('region',{name:'器材库',exact:true});
  await expect(library.getByRole('tab')).toHaveText(['电学','光学','力学','热学']);
  await expect(library.getByRole('tab',{name:'热学',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(library.locator('[data-library-type]')).toHaveCount(5);
  await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：20 ℃');
  const scene=await exported(page);expect(scene.experimentId).toBe('J-THERM-01');expect(scene.equipment).toHaveLength(5);
  for(const [id,shape] of [['beaker','[data-testid="thermal-beaker"] path'],['heater','[data-testid="thermal-heater"] rect'],['thermometer','[data-testid="thermal-thermometer"] rect'],['timer','.equipment-body > g > rect']] as const) { await page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"] ${shape}`).first().click(); await expect(page.getByLabel('选择器材',{exact:true})).toHaveValue(id); }
  await library.getByRole('tab',{name:'力学',exact:true}).click();await expect(library.locator('[data-library-type="mechanical.force-meter"]')).toBeDisabled(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await library.getByRole('tab',{name:'热学',exact:true}).click();
  await page.screenshot({path:info.outputPath('thermal-desktop.png'),fullPage:true});expect(errors).toEqual([]);
});
test('heating plateau, visible boiling, latent water loss, heater-off cooling and pause',async({page},info)=>{
  await open(page); await plateau(page);
  await expect(page.getByTestId('scene-board').getByTestId('thermal-beaker')).toHaveAttribute('data-boiling','true');
  await page.getByRole('button',{name:'采集当前水温和时间',exact:true}).click();
  await page.getByRole('button',{name:'单步热学',exact:true}).click();
  await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：100 ℃');
  await page.getByRole('button',{name:'采集当前水温和时间',exact:true}).click();
  const scene=await exported(page);const snapshots=scene.measurementSnapshots.map((s:{note:string})=>JSON.parse(s.note));expect(snapshots[1].massKg).toBeLessThan(snapshots[0].massKg);expect(snapshots[0].temperatureK).toBe(373.15);expect(scene.measurementRecords).toHaveLength(4);
  await page.getByRole('button',{name:'停止加热',exact:true}).click();await page.getByRole('button',{name:'暂停计时',exact:true}).click();await page.getByRole('button',{name:'单步热学',exact:true}).click();
  await expect(page.getByTestId('scene-board').getByTestId('thermal-beaker')).toHaveAttribute('data-boiling','false');await expect(page.getByTestId('thermal-reading')).not.toHaveText('温度计：100 ℃');
  const status=await page.getByTestId('thermal-status').textContent(); await page.waitForTimeout(250);expect(await page.getByTestId('thermal-status').textContent()).toBe(status);
  await page.getByRole('tab',{name:'图线',exact:true}).click();await expect(page.getByTestId('thermal-result')).toHaveCount(2);await expect(page.getByRole('img',{name:'水温与时间图线',exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出温度—时间 CSV',exact:true}).click();expect(await readFile((await (await download).path())!,'utf8')).toContain('100');
  await page.screenshot({path:info.outputPath('thermal-chart.png'),fullPage:true});
});
test('live power changes retain current temperature, initial water changes reset, invalid draft stays unapplied',async({page})=>{
  await open(page);await heatPaused(page);await page.getByRole('button',{name:'单步热学',exact:true}).click();
  const before=await page.getByTestId('thermal-reading').textContent();
  await properties(page,'heater',{'加热功率（W）':'0'});await expect(page.getByTestId('thermal-reading')).toHaveText(before!);
  await page.getByLabel('热学单步间隔（s）',{exact:true}).fill('300');await page.getByRole('button',{name:'单步热学',exact:true}).click();await expect(page.getByTestId('thermal-reading')).not.toHaveText(before!);
  await page.getByLabel('初始水量（mL）',{exact:true}).fill('100');await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：20 ℃');await expect(page.getByTestId('thermal-status')).toContainText('时间 0.0 s');
  await page.getByLabel('初始水量（mL）',{exact:true}).fill('999');await page.getByTestId('thermal-status').click();await expect(page.getByLabel('初始水量（mL）',{exact:true})).toHaveValue('100');
});
test('thermometer must be immersed, heater must contact cup; dragging and Delete preserve records',async({page})=>{
  await open(page);await plateau(page);await page.getByRole('button',{name:'采集当前水温和时间',exact:true}).click();
  const glass=page.getByTestId('scene-board').getByTestId('thermal-thermometer').locator('rect'),box=(await glass.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2,{steps:6});await page.mouse.up();await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：—');await properties(page,'thermometer',{'位置 x（m）':'.02'});
  await properties(page,'thermometer',{'位置 y（m）':'.6'});await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：—');await expect(page.getByRole('button',{name:'采集当前水温和时间',exact:true})).toBeDisabled();
  await properties(page,'thermometer',{'位置 y（m）':'.28'});await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：100 ℃');
  await properties(page,'heater',{'位置 x（m）':'.3'});await expect(page.locator('.thermal-controls')).toContainText('将烧杯底部放在加热装置');await page.getByRole('button',{name:'单步热学',exact:true}).click();await expect(page.getByTestId('thermal-reading')).not.toHaveText('温度计：100 ℃');
  await page.getByRole('button',{name:'删除器材',exact:true}).click();const scene=await exported(page);expect(scene.equipment.some((i:{id:string})=>i.id==='heater')).toBe(false);expect(scene.measurementRecords).toHaveLength(2);
});
test('manual °C record correction, CSV and reload keep snapshots and restart from initial state',async({page})=>{
  await open(page);await plateau(page);
  await page.getByLabel('时间 t（s）',{exact:true}).fill('300');await page.getByLabel('水温 T（℃）',{exact:true}).fill('98');await page.getByRole('button',{name:'保存热学抄表',exact:true}).click();
  const row=page.locator('tr').filter({has:page.getByRole('cell',{name:'温度',exact:true})});await row.getByRole('button',{name:'修改抄表',exact:true}).click();await row.getByLabel('修订抄表值',{exact:true}).fill('99');await row.getByRole('button',{name:'确认修订',exact:true}).click();
  let scene=await exported(page);expect(scene.measurementRecords.find((r:{quantity:string})=>r.quantity==='temperature').value).toBe(372.15);
  await page.getByRole('button',{name:'保存',exact:true}).click();await page.reload();await page.getByRole('button',{name:'加载',exact:true}).click();await page.getByRole('button',{name:/^加载实验：探究水的沸腾/}).click();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();
  await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：20 ℃');await expect(page.getByTestId('thermal-status')).toContainText('已暂停');scene=await exported(page);expect(scene.measurementRecords).toHaveLength(2);expect(scene.measurementSnapshots).toHaveLength(1);
});
test('blank thermal workbench can be assembled from shared library apparatus',async({page})=>{
  await open(page,true);const types=['mechanical.density-beaker','thermal.heater','thermal.thermometer','mechanical.projectile-timer'];
  for(const type of types){await page.locator(`[data-library-type="${type}"]`).click();await page.getByRole('button',{name:'在视口中心放置',exact:true}).click();const scene=await exported(page),id=scene.equipment.at(-1).id;await properties(page,id,{'位置 x（m）':type.includes('thermometer')?'.02':type.includes('timer')?'.3':'0','位置 y（m）':type.includes('heater')?'-.02':type.includes('thermometer')?'.25':type.includes('timer')?'.13':'0'});}
  await page.getByLabel('初始水量（mL）',{exact:true}).fill('200');await expect(page.getByRole('button',{name:'开始加热',exact:true})).toBeEnabled();await expect(page.getByTestId('thermal-reading')).toHaveText('温度计：20 ℃');
});
