import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
const status = (page: Page) => page.getByTestId('spring-status');
const group = (page: Page, id: string) => page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"]`);
async function exported(page: Page): Promise<SceneDocument> { const pending=page.waitForEvent('download'); await page.getByRole('button',{name:'导出',exact:true}).click(); return JSON.parse(await readFile((await (await pending).path())!,'utf8')) as SceneDocument; }
async function open(page: Page, empty=false) { await page.goto('/'); await expect(page.getByRole('button',{name:'保存',exact:true})).toBeEnabled(); await openFamily(page, '弹簧弹力实验'); if(empty) await page.getByLabel('空白搭建弹簧弹力与形变量实验',{exact:true}).check(); await page.getByRole('button',{name: '进入实验',exact:true}).click(); await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click(); }
async function properties(page: Page,id: string,fields: Record<string,string>) { await page.getByLabel('选择器材',{exact:true}).selectOption(id); for(const [label,value] of Object.entries(fields)) await page.getByLabel(label,{exact:true}).fill(value); }
async function capture(page: Page,m: number,delta: number,phase='加载') { await page.getByRole('tab',{name:'记录表',exact:true}).click(); await page.getByLabel('弹簧测量阶段',{exact:true}).selectOption(phase); for(const [label,value] of Object.entries({'弹簧上端读数（m）':'.04','弹簧下端读数（m）':String(.14+delta),'无载原长 L0（m）':'.1','钩码质量读数（kg，不含盘）':String(m)})) await page.getByLabel(label,{exact:true}).fill(value); await page.getByRole('button',{name:'保存弹簧读尺记录',exact:true}).click(); }
async function drag(page: Page,from: ReturnType<typeof group>,to: ReturnType<typeof group>,cancel=false) { const a=(await from.boundingBox())!,b=(await to.boundingBox())!; await page.mouse.move(a.x+a.width/2,a.y+3); await page.mouse.down(); await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:7}); await expect(page.getByRole('button',{name:'保存弹簧读尺记录',exact:true})).toBeDisabled(); if(cancel) await page.keyboard.press('Escape'); await page.mouse.up(); }

test('five real loading points and unloaded reread form one senior spring experiment with same-record fit, CSV, JSON and saved reload',async({page},info)=>{
  test.setTimeout(120_000); const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message)); await page.setViewportSize({width:1920,height:1080}); await open(page);
  await expect(status(page)).toHaveText('静态平衡，可自行读尺'); await expect(page.getByTestId('spring-theory')).toHaveCount(0); await expect(page.getByLabel('无载原长 L0（m）',{exact:true})).toBeEmpty();
  await capture(page,0,0,'原长测量');
  for(const [m,delta,length] of [[.025,.0125,.1125],[.05,.025,.125],[.075,.0375,.1375],[.1,.05,.15]]) {
    await properties(page,'weight',{'钩码总质量（kg）':String(m)}); await page.getByLabel('挂接弹簧',{exact:true}).selectOption('spring');
    expect(Number(await group(page,'spring').locator('[data-spring-length-m]').getAttribute('data-spring-length-m'))).toBeCloseTo(length!,9);
    expect(Number(await page.locator('[data-spring-ruler-mark="bottom"]').getAttribute('data-position-m'))).toBeCloseTo(.14+delta!,9); await capture(page,m!,delta!);
  }
  await page.getByLabel('选择器材',{exact:true}).selectOption('weight'); await page.getByLabel('挂接弹簧',{exact:true}).selectOption(''); await capture(page,0,0,'卸载复测');
  const scene=await exported(page); expect(scene.measurementRecords).toHaveLength(42); expect(scene.curriculumRef!.stage).toBe('senior'); expect(scene.curriculumRef!.textbookMappings[0]!.status).toBe('pending_teacher_review'); expect(scene.measurementSnapshots!.at(-1)!.note).toContain('卸载复测');
  await page.getByRole('tab',{name:'图线',exact:true}).click(); const fit=page.getByTestId('spring-fit'); expect(Number(await fit.getAttribute('data-slope'))).toBeCloseTo(20,6); await expect(fit).toContainText('6 个有效点 / 5 个不同形变量'); await expect(page.getByTestId('measurement-chart').locator('circle[data-record-id]')).toHaveCount(6); await page.getByRole('button',{name:'展开记录区',exact:true}).click(); await fit.scrollIntoViewIfNeeded(); await page.screenshot({path:info.outputPath('spring-five-point-fit.png'),fullPage:true});
  await page.getByRole('tab',{name:'记录表',exact:true}).click(); const pending=page.waitForEvent('download'); await page.getByRole('button',{name:'导出 CSV',exact:true}).click(); const csv=await readFile((await (await pending).path())!,'utf8'); expect(csv).toContain('形变量'); expect(csv).toContain('卸载复测');
  await page.getByRole('button',{name:'保存',exact:true}).click(); await page.reload(); expect((await exported(page)).measurementRecords).toEqual(scene.measurementRecords); await page.getByRole('tab',{name:'图线',exact:true}).click(); expect(Number(await page.getByTestId('spring-fit').getAttribute('data-slope'))).toBeCloseTo(20,6);
  const file=page.getByLabel('导入实验 JSON',{exact:true}); await file.setInputFiles({name:'spring-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))}); await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click(); expect((await exported(page)).measurementSnapshots).toEqual(scene.measurementSnapshots); expect(errors).toEqual([]);
});

test('blank apparatus mounts and drag-loads, cancels without committing, chains a second weight and preserves children on parent deletion',async({page},info)=>{
  test.setTimeout(120_000); await page.setViewportSize({width:1920,height:1080}); await open(page,true); const ids:Record<string,string>={},library=page.getByRole('region',{name:'器材库',exact:true});
  for(const [type,key] of [['mechanical.support','support'],['mechanical.spring','spring'],['mechanical.weights','weight'],['mechanical.ruler','ruler']]) { await library.locator(`[data-library-type="${type}"]`).click(); await library.getByRole('button',{name:'在视口中心放置',exact:true}).click(); ids[key!]=(await exported(page)).equipment.at(-1)!.id; }
  await properties(page,ids.support!,{'位置 x（m）':'-.08','位置 y（m）':'.02','支架高度（m）':'.43'}); await properties(page,ids.spring!,{'位置 x（m）':'0','位置 y（m）':'.45'}); await page.getByLabel('弹簧安装支架',{exact:true}).selectOption(ids.support!);
  await properties(page,ids.ruler!,{'位置 x（m）':'.08','位置 y（m）':'.49','转角（°）':'-90','刻度尺长度（m）':'.4'}); await properties(page,ids.weight!,{'位置 x（m）':'-.23','位置 y（m）':'.28','钩码总质量（kg）':'.025'});
  const before=await exported(page); await drag(page,group(page,ids.weight!).locator('[data-weight-grip]'),group(page,ids.spring!).locator('[data-spring-bottom]'),true); expect(await exported(page)).toEqual(before);
  await drag(page,group(page,ids.weight!).locator('[data-weight-grip]'),group(page,ids.spring!).locator('[data-spring-bottom]')); const hung=await exported(page); expect(hung.equipment.find(item=>item.id===ids.weight)!.parameters.springId).toBe(ids.spring); expect(hung.revision).toBe(before.revision+1);
  await library.locator('[data-library-type="mechanical.weights"]').click(); await library.getByRole('button',{name:'在视口中心放置',exact:true}).click(); const child=(await exported(page)).equipment.at(-1)!.id; await properties(page,child,{'位置 x（m）':'-.23','位置 y（m）':'.17','钩码总质量（kg）':'.025'});
  await drag(page,group(page,child).locator('[data-weight-grip]'),group(page,ids.weight!).locator('[data-weight-bottom]')); const chained=await exported(page); expect(chained.equipment.find(item=>item.id===child)!.parameters.parentWeightId).toBe(ids.weight); expect(Number(await group(page,ids.spring!).locator('[data-spring-length-m]').getAttribute('data-spring-length-m'))).toBeCloseTo(.125,9);
  await page.getByLabel('选择器材',{exact:true}).selectOption(ids.weight!); const childY=await group(page,child).getAttribute('data-y-m'); await page.getByRole('button',{name:'删除器材',exact:true}).click(); const detached=await exported(page); expect(detached.equipment.find(item=>item.id===child)!.parameters.parentWeightId).toBe(''); expect(await group(page,child).getAttribute('data-y-m')).toBe(childY); await page.getByRole('button',{name:'撤销',exact:true}).click(); expect((await exported(page)).equipment).toEqual(chained.equipment);
  await page.locator('.inspector').evaluate(element=>{element.scrollTop=0;}); await page.screenshot({path:info.outputPath('spring-serial-weights.png'),fullPage:true});
});

test('range boundaries, tray mass, loaded original-length rejection and actual ruler zero/orientation never retain normal unavailable readings',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080}); await open(page); await page.getByLabel('选择器材',{exact:true}).selectOption('weight'); await page.getByLabel('挂接弹簧',{exact:true}).selectOption('spring'); await properties(page,'weight',{'钩码总质量（kg）':'.12'}); await expect(status(page)).toContainText('静态平衡');
  await properties(page,'weight',{'钩码总质量（kg）':'.13'}); await expect(status(page)).toContainText('超过额定载荷'); await expect(page.locator('[data-spring-length-m]')).toHaveCount(0); await expect(page.getByRole('button',{name:'保存弹簧读尺记录',exact:true})).toBeDisabled();
  await properties(page,'spring',{'额定载荷（N）':'2'}); await expect(status(page)).toContainText('超过线性范围'); await properties(page,'spring',{'最大线性伸长（m）':'.07','挂载盘质量（kg）':'.01'}); await expect(status(page)).toContainText('静态平衡');
  await page.getByLabel('显示弹簧模型值与理论（可关闭）',{exact:true}).check(); await expect(page.getByTestId('spring-theory')).toContainText('1.4 N');
  await capture(page,.13,.07,'原长测量'); await expect(page.getByRole('alert')).toContainText('测原长须先取下全部钩码'); expect((await exported(page)).measurementRecords).toHaveLength(0);
  await properties(page,'ruler',{'位置 y（m）':'.51'}); expect(Number(await page.locator('[data-spring-ruler-mark="top"]').getAttribute('data-position-m'))).toBeCloseTo(.06,9); expect(Number(await page.locator('[data-spring-ruler-mark="bottom"]').getAttribute('data-position-m'))).toBeCloseTo(.23,9);
  await properties(page,'ruler',{'转角（°）':'0'}); await expect(page.getByRole('button',{name:'保存弹簧读尺记录',exact:true})).toBeDisabled(); await properties(page,'ruler',{'转角（°）':'-90'});
  await page.getByLabel('选择器材',{exact:true}).selectOption('spring'); await page.getByLabel('弹簧安装支架',{exact:true}).selectOption(''); await expect(status(page)).toContainText('安装到支架'); await expect(page.getByTestId('spring-theory')).toHaveCount(0); await page.screenshot({path:info.outputPath('spring-unavailable.png'),fullPage:true});
});

test('saving original length prepares loading and subsequent readings append without replacing earlier data',async({page},info)=>{
  await page.setViewportSize({width:1920,height:945}); await open(page);
  await capture(page,0,0,'原长测量');
  const original=await exported(page);
  expect(original.measurementRecords).toHaveLength(7);
  await expect(page.getByLabel('弹簧测量阶段',{exact:true})).toHaveValue('加载');
  for(const [mass,bottom] of [['.025','.1525'],['.05','.165']]) {
    await properties(page,'weight',{'钩码总质量（kg）':mass!});
    await page.getByLabel('挂接弹簧',{exact:true}).selectOption('spring');
    await page.getByLabel('弹簧下端读数（m）',{exact:true}).fill(bottom!);
    await page.getByLabel('钩码质量读数（kg，不含盘）',{exact:true}).fill(mass!);
    await page.getByRole('button',{name:'保存弹簧读尺记录',exact:true}).click();
    await expect(page.locator('.live-notice')).toContainText('已新增 1 组弹簧读尺记录（7 行）');
  }
  const scene=await exported(page);
  expect(scene.measurementRecords).toHaveLength(21);
  expect(scene.measurementSnapshots).toHaveLength(3);
  expect(scene.measurementRecords.slice(0,7)).toEqual(original.measurementRecords);
  expect(scene.measurementSnapshots!.slice(0,1)).toEqual(original.measurementSnapshots);
  expect(scene.measurementRecords.filter(item=>item.context?.pointLabel==='弹力').map(item=>item.value)).toEqual([0,.25,.5]);
  expect(JSON.parse(scene.measurementSnapshots![0]!.note).phase).toBe('原长测量');
  expect(scene.measurementSnapshots!.slice(1).map(item=>JSON.parse(item.note).phase)).toEqual(['加载','加载']);
  await expect(page.locator('tr[data-measurement-id]')).toHaveCount(21);
  await page.getByRole('button',{name:'保存',exact:true}).click(); await page.reload();
  expect((await exported(page)).measurementRecords).toEqual(scene.measurementRecords);
  await page.getByRole('button',{name:'保存弹簧读尺记录',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('spring-appended-records.png'),fullPage:true});
});

test.describe('touch spring experiment',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('loaded original-length save explains the failure beside the button and retains earlier data until phase correction',async({page},info)=>{
    await open(page); await capture(page,0,0,'原长测量');
    const original=await exported(page);
    await page.getByLabel('选择器材',{exact:true}).selectOption('weight');
    await page.getByLabel('挂接弹簧',{exact:true}).selectOption('spring');
    await capture(page,.025,.0125,'原长测量');
    await expect(page.getByRole('alert')).toContainText('记录当前载荷请将“测量阶段”改为“加载”或“卸载复测”');
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.locator('.live-notice')).toContainText('未保存弹簧读尺记录');
    await expect(page.getByLabel('弹簧测量阶段',{exact:true})).toHaveValue('原长测量');
    await expect(page.getByLabel('弹簧下端读数（m）',{exact:true})).toHaveValue(String(.14+.0125));
    await page.screenshot({path:info.outputPath('spring-save-phase-error-touch.png'),fullPage:true});
    expect((await exported(page)).measurementRecords).toEqual(original.measurementRecords);
    await page.getByLabel('弹簧测量阶段',{exact:true}).selectOption('加载');
    await page.getByRole('button',{name:'保存弹簧读尺记录',exact:true}).tap();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.live-notice')).toContainText('已新增 1 组弹簧读尺记录（7 行）');
    const scene=await exported(page);
    expect(scene.measurementRecords).toHaveLength(14);
    expect(scene.measurementSnapshots).toHaveLength(2);
    expect(scene.measurementRecords.slice(0,7)).toEqual(original.measurementRecords);
  });
  test('touch cancels and attaches a real weight, immediate mass editing and manual reading stay usable without overflow',async({page},info)=>{
    await open(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); const before=await exported(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
    const session=await page.context().newCDPSession(page);
    for(const cancel of [true,false]) { const a=(await group(page,'weight').locator('[data-weight-grip]').boundingBox())!,b=(await group(page,'spring').locator('[data-spring-bottom]').boundingBox())!; await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+3,id:1}]}); await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]}); await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]}); if(cancel) {expect(await exported(page)).toEqual(before); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();} }
    await session.detach(); expect((await exported(page)).equipment.find(item=>item.id==='weight')!.parameters.springId).toBe('spring'); await properties(page,'weight',{'钩码总质量（kg）':'.05'}); await expect(page.getByLabel('钩码总质量（kg）',{exact:true})).toBeFocused();
    await capture(page,.05,.025); expect((await exported(page)).measurementRecords).toHaveLength(7); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({path:info.outputPath('spring-touch.png'),fullPage:true});
  });
});
