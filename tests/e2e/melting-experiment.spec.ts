import { test,expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectCatalogOption, importLegacyBlank } from './catalog-helpers.ts';
async function open(page:Page,blank=false){await page.goto('/');if(blank){await importLegacyBlank(page,'melting-blank');return;}await page.getByRole('button',{name:'初中物理实验',exact:true}).click();await selectCatalogOption(page,'melting');await page.getByRole('button',{name:'进入实验',exact:true}).click();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();}
async function exported(page:Page){const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();return JSON.parse(await readFile((await(await event).path())!,'utf8'));}
async function heat(page:Page){await page.getByRole('button',{name:'开始水浴加热',exact:true}).click();await page.getByRole('button',{name:'暂停熔化实验',exact:true}).click();}
async function step(page:Page,n=1){for(let i=0;i<n;i++)await page.getByRole('button',{name:'单步熔化实验',exact:true}).click();}
async function properties(page:Page,id:string,values:Record<string,string>){await page.getByLabel('选择器材',{exact:true}).selectOption(id);for(const[label,value]of Object.entries(values))await page.getByLabel(label,{exact:true}).fill(value);}
test('six shared physical apparatus and live sample controls; incompatible library tools disabled',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1366,height:900});await open(page);
  await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：20 ℃');const scene=await exported(page);expect(scene.equipment).toHaveLength(6);expect(scene.experimentId).toBe('J-THERM-02');
  const board=page.getByTestId('scene-board');await expect(board.locator('[data-melting-tube]')).toHaveCount(1);await expect(board.getByTestId('thermal-thermometer')).toHaveAttribute('data-valid','true');await expect(page.getByRole('button',{name:'应用属性',exact:true})).toHaveCount(0);
  await page.getByLabel('样品质量（g）',{exact:true}).fill('15');expect((await exported(page)).equipment.find((i:{id:string})=>i.id==='tube').parameters.massKg).toBe(.015);
  await page.getByLabel('试管样品',{exact:true}).selectOption('wax');await expect(board.locator('[data-melting-tube]')).toHaveAttribute('data-material','wax');
  const library=page.getByRole('region',{name:'器材库',exact:true});await library.getByRole('tab',{name:'力学',exact:true}).click();await expect(library.locator('[data-library-type="mechanical.force-meter"]')).toBeDisabled();await expect(page.getByRole('dialog')).toHaveCount(0);await library.getByRole('tab',{name:'热学',exact:true}).click();
  await page.screenshot({path:info.outputPath('melting-desktop.png'),fullPage:true});expect(errors).toEqual([]);
});
test('hypo platform consumes heat, zeroing preserves temperature and wax retains separate comparison data',async({page},info)=>{
  await open(page);await heat(page);await step(page,6);await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：48 ℃');
  const before=await page.getByTestId('melting-clock').getAttribute('data-time-s');await page.getByRole('button',{name:'记录计时归零',exact:true}).click();await expect(page.getByTestId('melting-clock')).toHaveAttribute('data-time-s',before!);await expect(page.getByTestId('melting-clock')).toHaveAttribute('data-record-s','0');await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：48 ℃');
  await page.getByRole('button',{name:'采集样品温度和记录时间',exact:true}).click();await step(page);await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：48 ℃');await page.getByRole('button',{name:'采集样品温度和记录时间',exact:true}).click();
  await step(page,10);await expect(page.getByTestId('scene-board').locator('[data-melting-tube]')).toHaveAttribute('data-fraction','1');
  await page.getByLabel('试管样品',{exact:true}).selectOption('wax');await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：20 ℃');await expect(page.getByTestId('melting-clock')).toHaveAttribute('data-time-s','0');await heat(page);await step(page,7);await page.getByRole('button',{name:'采集样品温度和记录时间',exact:true}).click();
  const scene=await exported(page);expect(scene.measurementSnapshots).toHaveLength(3);expect(scene.measurementSnapshots[0].equipment.find((i:{id:string})=>i.id==='tube').parameters.material).toBe('hypo');expect(scene.measurementSnapshots[2].equipment.find((i:{id:string})=>i.id==='tube').parameters.material).toBe('wax');
  await page.getByRole('tab',{name:'图线',exact:true}).click();await expect(page.getByTestId('melting-result')).toHaveCount(3);const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出熔化记录 CSV',exact:true}).click();const csv=await readFile((await(await event).path())!,'utf8');expect(csv).toContain('海波');expect(csv).toContain('石蜡');expect(csv).toContain('时间(min)');await page.screenshot({path:info.outputPath('melting-comparison.png'),fullPage:true});
});
test('sample probe rejects water-only readings, live power retains state and initial edits reset',async({page})=>{
  await open(page);await heat(page);await step(page,3);const before=await page.getByTestId('melting-reading').textContent();await properties(page,'heater',{'加热功率（W）':'0'});await expect(page.getByTestId('melting-reading')).toHaveText(before!);
  await properties(page,'thermometer',{'位置 x（m）':'-.02'});await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：—');await expect(page.getByRole('button',{name:'采集样品温度和记录时间',exact:true})).toBeDisabled();await properties(page,'thermometer',{'位置 x（m）':'.02'});await expect(page.getByTestId('melting-reading')).toHaveText(before!);
  await page.getByLabel('样品初温（℃）',{exact:true}).fill('35');await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：35 ℃');await expect(page.getByTestId('melting-clock')).toHaveAttribute('data-time-s','0');await properties(page,'tube',{'位置 y（m）':'.2'});await expect(page.locator('.melting-controls')).toContainText('请把试管样品段浸没');
});
test('manual minute/Celsius correction, save and reload preserve records but restart process',async({page})=>{
  await open(page);await page.getByLabel('记录时间（min）',{exact:true}).fill('1.5');await page.getByLabel('样品温度（℃）',{exact:true}).fill('42');await page.getByLabel('样品物态与观察',{exact:true}).fill('仍有颗粒');await page.getByRole('button',{name:'保存熔化抄表',exact:true}).click();
  const row=page.locator('tr').filter({has:page.getByRole('cell',{name:'时间',exact:true})});await row.getByRole('button',{name:'修改抄表',exact:true}).click();await row.getByLabel('修订抄表值',{exact:true}).fill('2');await row.getByRole('button',{name:'确认修订',exact:true}).click();let scene=await exported(page);expect(scene.measurementRecords.find((r:{quantity:string})=>r.quantity==='time').value).toBe(120);
  await heat(page);await step(page,3);await page.getByRole('button',{name:'保存',exact:true}).click();await page.reload();await page.getByRole('button',{name:'加载',exact:true}).click();await page.getByRole('button',{name:/^加载实验：探究固体熔化/}).click();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：20 ℃');scene=await exported(page);expect(scene.measurementSnapshots).toHaveLength(1);expect(scene.measurementRecords).toHaveLength(2);
});
test('blank workbench assembles existing bath equipment and new tube without switching experiment',async({page})=>{
  await open(page,true);const poses:Record<string,[string,string]>={'mechanical.density-beaker':['0','0'],'thermal.heater':['0','-.02'],'thermal.thermometer':['.02','.28'],'mechanical.projectile-timer':['.3','.13'],'thermal.melting-tube':['.02','.015']};
  for(const[type,[x,y]]of Object.entries(poses)){await page.locator(`[data-library-type="${type}"]`).click();await page.getByRole('button',{name:'在视口中心放置',exact:true}).click();const scene=await exported(page);await properties(page,scene.equipment.at(-1).id,{'位置 x（m）':x,'位置 y（m）':y});}
  await page.getByLabel('水浴初始水量（mL）',{exact:true}).fill('200');await expect(page.getByRole('button',{name:'开始水浴加热',exact:true})).toBeEnabled();await expect(page.getByTestId('melting-reading')).toHaveText('样品温度计：20 ℃');expect((await exported(page)).experimentId).toBe('J-THERM-02');
});
