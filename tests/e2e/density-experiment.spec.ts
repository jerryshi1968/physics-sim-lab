import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { BEAKER, densityTypes } from '../../src/equipment/density/definitions.ts';
async function open(page: Page, liquid=false, empty=false) {
 await page.goto('/');await expect(page.getByRole('button',{name:'保存',exact:true})).toBeEnabled();await page.getByRole('button',{name:'测量密度实验',exact:true}).click();
 if(liquid)await page.getByRole('radio',{name:'液体密度：倒出前后质量差法',exact:true}).check();if(empty)await page.getByLabel('从空白搭建密度实验',{exact:true}).check();
 await page.getByRole('button',{name:'预览密度实验',exact:true}).click();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();
}
async function download(page:Page,name='导出'){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return readFile((await(await pending).path())!,'utf8');}
const exported=async(page:Page)=>JSON.parse(await download(page)) as SceneDocument;
const group=(page:Page,id:string)=>page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"]`);
async function range(page:Page,name:string,tick:number){const input=page.getByLabel(name,{exact:true});await input.focus();await input.press('Home');const min=await input.getAttribute('aria-valuemin');const firstTick=min===null?Number(await input.getAttribute('min')):Math.round(Number(min)/.2);for(let i=firstTick;i<tick;i++)await input.press('ArrowRight');}
async function zero(page:Page){await range(page,'调零螺母',3);await expect(page.getByTestId('density-status')).toContainText('指针对准中央');}
async function weight(page:Page,index:number,g:number){await page.getByRole('button',{name:`砝码${index} ${g} g`,exact:true}).click();}
async function capture(page:Page,raw:string){await page.getByLabel(/^(天平手工读数（g）|液面手工读数（mL）)$/).fill(raw);await page.getByRole('button',{name:'保存本次密度读数',exact:true}).click();}
async function derive(page:Page){for(let i=1;i<=3;i++){const input=page.getByLabel(`密度来源${i}`,{exact:true});const value=await input.locator('option').nth(1).getAttribute('value');await input.selectOption(value!);}await page.getByRole('button',{name:'按所选读数计算密度',exact:true}).click();}
test('solid weighing, displacement, manual error, source correction, charts and persistent SI round trip',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1920,height:1080});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await expect(page.locator('[data-library-type]')).toHaveCount(24);await expect(page.getByTestId('density-theory')).toHaveCount(0);await zero(page);
 await page.getByLabel('待测固体位置',{exact:true}).selectOption('balance');await weight(page,2,50);await weight(page,7,2);await weight(page,9,1);await range(page,'游码位置（每格0.2 g）',5);await expect(page.getByTestId('density-status')).toContainText('指针对准中央');
 await page.getByRole('button',{name:'展开记录区',exact:true}).click();await capture(page,'53.8');await expect(page.locator('[data-measurement-id]')).toHaveCount(1);
 await page.getByLabel('待测固体位置',{exact:true}).selectOption('');await capture(page,'50');await page.getByLabel('待测固体位置',{exact:true}).selectOption('cylinder');expect(Number(await page.getByTestId('scene-board').locator('[data-liquid-fill]').getAttribute('data-volume-m3'))).toBeCloseTo(.00007,10);await capture(page,'70');await derive(page);
 await expect(page.locator('[data-measurement-id]')).toHaveCount(6);const saved=await exported(page);expect(saved.measurementRecords.at(-1)!.value).toBeCloseTo(2690);expect(saved.measurementRecords.at(-1)!.context!.physicalValue).toBeCloseTo(2700);expect(saved.measurementSnapshots!.at(-1)!.sourceSnapshotIds).toHaveLength(3);
 const csv=await download(page,'导出 CSV');expect(csv).toContain('"g/cm³",2.69');expect(csv).toContain('"mL",20');expect(csv).not.toMatch(/NaN|Infinity/);
 await page.getByRole('tab',{name:'图线',exact:true}).click();await expect(page.getByTestId('measurement-chart')).toContainText('质量（g）');await expect(page.locator('[data-record-id]')).toHaveCount(1);await page.screenshot({path:info.outputPath('density-solid-chart.png'),fullPage:true});
 await page.getByRole('tab',{name:'记录表',exact:true}).click();const first=page.locator('[data-measurement-id]').first();await first.getByRole('button',{name:'修改抄表',exact:true}).click();await first.getByLabel('修订抄表值',{exact:true}).fill('54');await first.getByRole('button',{name:'确认修订',exact:true}).click();expect((await exported(page)).measurementRecords.at(-1)!.value).toBeCloseTo(2690);await page.getByRole('button',{name:'按所选读数计算密度',exact:true}).click();await expect(page.locator('[data-measurement-id]')).toHaveCount(9);expect((await exported(page)).measurementRecords.at(-1)!.value).toBeCloseTo(2700);
 await first.getByRole('button',{name:'删除记录',exact:true}).click();const retained=await exported(page);expect(retained.measurementSnapshots).toHaveLength(5);await page.getByRole('button',{name:'保存',exact:true}).click();await page.reload();expect(await exported(page)).toEqual(retained);await expect(page.getByTestId('density-theory')).toHaveCount(0);await page.getByLabel('导入实验 JSON',{exact:true}).setInputFiles({name:'density.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();expect(await exported(page)).toEqual(saved);expect(errors).toEqual([]);

 const specimenChoice = page.getByLabel('更换待测固体', { exact: true });
 await expect(specimenChoice).toBeDisabled();
 await expect(specimenChoice).toHaveAccessibleDescription(/桌面自由放置/);
 await page.getByLabel('待测固体位置', { exact: true }).selectOption('');
 await expect(specimenChoice).toBeEnabled();
 for (const [code, massKg, volumeM3] of [['B', .065, .000025], ['C', .078, .000010]] as const) {
   await specimenChoice.selectOption(code);
   const changed = await exported(page);
   expect(changed.equipment.find(item => item.id === 'specimen')?.parameters).toMatchObject({ sampleCode: code, massKg, volumeM3 });
   expect(changed.measurementRecords).toEqual(saved.measurementRecords);
 }
});
test('bench rider scale aligns the left edge and supports the rider at 5 g', async ({ page }) => {
  await open(page);
  const scale = page.getByTestId('scene-board').locator('[data-balance-rider-scale]');
  const slider = page.getByLabel('游码位置（每格0.2 g）', { exact: true });
  await expect(page.locator('.inspector').getByRole('slider', { name: /调零螺母|游码/ })).toHaveCount(0);
  await expect(page.getByRole('img', { name: '天平游码刻度放大图' })).toHaveCount(0);
  for (const tick of [0, 3, 25]) {
    if (tick === 3) await range(page, '游码位置（每格0.2 g）', tick);
    if (tick === 25) await slider.press('End');
    const bounds = await scale.evaluate((element, index) => {
      const tickMark = element.querySelector<SVGPathElement>(`[data-balance-rider-tick="${index}"]`)!.getBBox();
      const rider = element.querySelector<SVGRectElement>('[data-balance-rider]')!.getBBox();
      const track = element.querySelector<SVGRectElement>('[data-balance-rider-track]')!.getBBox();
      return { tickX: tickMark.x, riderX: rider.x, riderRight: rider.x + rider.width, trackRight: track.x + track.width };
    }, tick);
    expect(bounds.riderX).toBeCloseTo(bounds.tickX, 7);
    expect(bounds.trackRight).toBeGreaterThan(bounds.riderRight);
  }
});

test('bench drags update the balance immediately and weights stack from the right pan', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, true);
  await page.getByRole('button', { name: '放大', exact: true }).click();
  const balance = group(page, 'balance');
  const screw = balance.getByRole('slider', { name: '调零螺母' });
  const rider = balance.getByRole('slider', { name: '游码位置（每格0.2 g）' });
  const revision = page.getByTestId('scene-board');
  const before = Number(await revision.getAttribute('data-revision'));
  const pixelsPerM = await balance.locator('.equipment-body').evaluate(element => (element as SVGGElement).getCTM()!.a);
  const startDrag = async (control: typeof screw, deltaM: number) => {
    const box = (await control.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const hit = await control.evaluate((element, { x, y }) => {
      const target = document.elementFromPoint(x, y);
      return element.contains(target) ? 'control' : { x, y, target: target?.outerHTML.slice(0, 300) };
    }, { x, y });
    expect(hit).toBe('control');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + deltaM * pixelsPerM, y, { steps: 6 });
  };
  await startDrag(screw, .0072);
  await expect(screw).toHaveAttribute('aria-valuenow', '0.6');
  await expect(page.getByTestId('density-status')).toContainText('指针对准中央');
  await expect(revision).toHaveAttribute('data-revision', String(before));
  await page.mouse.up();
  await expect(revision).toHaveAttribute('data-revision', String(before + 1));
  await startDrag(rider, .036);
  await expect(rider).toHaveAttribute('aria-valuenow', '1');
  await expect(screw).toBeDisabled();
  await page.mouse.up();
  await expect(revision).toHaveAttribute('data-revision', String(before + 2));
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(rider).toHaveAttribute('aria-valuenow', '0');

  const box = group(page, 'masses');
  const two = box.getByRole('button', { name: '砝码7 2 g' });
  const otherTwo = box.getByRole('button', { name: '砝码8 2 g' });
  await expect(page.locator('.inspector').getByRole('button', { name: /^砝码\d/ })).toHaveCount(0);
  await two.click();
  await expect(two).toHaveAttribute('aria-pressed', 'true');
  await expect(otherTwo).toHaveAttribute('aria-pressed', 'false');
  await otherTwo.press('Enter');
  await weight(page, 2, 50);
  await weight(page, 9, 1);
  await two.click();
  await expect(two).toHaveAttribute('aria-pressed', 'false');
  await expect(otherTwo).toHaveAttribute('aria-pressed', 'true');
  await expect(balance.locator('[data-balance-weight]')).toHaveText(['50', '2', '1']);
  const layout = () => balance.evaluate(element => {
    const pan = element.querySelector<SVGPathElement>('[data-balance-pan="right"]')!.getBBox();
    const weights = [...element.querySelectorAll<SVGRectElement>('[data-balance-weight] rect')].map(rect => rect.getBBox());
    return weights.map((weight, index) => {
      const previous = weights[index - 1];
      const startsStack = !previous || Math.abs(weight.x + weight.width / 2 - previous.x - previous.width / 2) > .001;
      return { bottom: weight.y + weight.height, support: startsStack ? pan.y : previous.y, startsStack };
    });
  });
  for (const { bottom, support } of await layout()) expect(bottom).toBeCloseTo(support, 7);
  await weight(page, 3, 20);
  await weight(page, 5, 10);
  await weight(page, 6, 5);
  const twoStacks = await layout();
  expect(twoStacks.filter(weight => weight.startsStack)).toHaveLength(2);
  for (const { bottom, support } of twoStacks) expect(bottom).toBeCloseTo(support, 7);
  await page.screenshot({ path: info.outputPath('density-bench-controls.png') });
});

test('custom solid mass uses the rider and survives save and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await zero(page);
  await page.getByLabel('待测固体位置', { exact: true }).selectOption('balance');
  await weight(page, 2, 50);
  await weight(page, 7, 2);
  await weight(page, 8, 2);
  const status = page.getByTestId('density-status');
  await expect(status).toContainText('指针对准中央');

  await page.getByText('设置固体质量', { exact: true }).click();
  const mass = page.getByLabel('固体质量（g）', { exact: true });
  await mass.fill('54.6');
  await expect(status).toContainText('左盘较重');
  await mass.fill('181');
  await expect(mass).toHaveAttribute('aria-invalid', 'true');
  await mass.press('Escape');
  await expect(mass).toHaveValue('54.6');

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(status).toContainText('指针对准中央');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(status).toContainText('左盘较重');
  await range(page, '游码位置（每格0.2 g）', 3);
  await expect(status).toContainText('指针对准中央');

  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await capture(page, '54.6');
  const scene = await exported(page);
  expect(scene.equipment.find(item => item.id === 'specimen')?.parameters).toMatchObject({ massKg: .0546, volumeM3: .000020 });
  expect(scene.measurementRecords[0]?.context?.instrumentDisplayValue).toBeCloseTo(.0546, 10);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('save-state')).toHaveText('已保存');
  await page.reload();
  expect(await exported(page)).toEqual(scene);
});

test('the balance works without a solid and switching the record method preserves the experiment', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await expect(group(page, 'beaker')).toHaveCount(0);
  await expect(page.getByLabel('烧杯位置', { exact: true })).toHaveCount(0);
  await zero(page);
  await page.getByLabel('待测固体位置', { exact: true }).selectOption('balance');
  await weight(page, 2, 50);
  await weight(page, 7, 2);
  await weight(page, 8, 2);
  await page.getByRole('button', { name: '展开记录区', exact: true }).click();
  await capture(page, '54');
  await page.getByRole('button', { name: '清空天平并游码归零', exact: true }).click();
  await page.getByLabel('选择器材', { exact: true }).selectOption('specimen');
  await page.getByRole('button', { name: '删除器材', exact: true }).click();

  const screw = page.getByLabel('调零螺母', { exact: true });
  const status = page.getByTestId('density-status');
  const pointer = page.getByTestId('scene-board').locator('[data-balance-pointer]');
  await expect(screw).toBeEnabled();
  const centered = await pointer.getAttribute('d');
  await range(page, '游码位置（每格0.2 g）', 5);
  await expect(status).toContainText('右盘较重');
  await expect(pointer).not.toHaveAttribute('d', centered!);
  await expect(screw).toBeDisabled();
  await page.getByLabel('游码位置（每格0.2 g）', { exact: true }).press('Home');
  await screw.press('ArrowLeft');
  await expect(status).toContainText('左盘较重');
  await screw.press('ArrowRight');
  await expect(status).toContainText('指针对准中央');

  await page.locator(`[data-library-type="${BEAKER}"]`).click();
  await page.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  await page.getByLabel('烧杯位置', { exact: true }).selectOption('balance');
  await weight(page, 1, 100);
  await weight(page, 5, 10);
  await expect(status).toContainText('指针对准中央');
  const before = await exported(page);
  const method = page.getByLabel('密度记录方法', { exact: true });
  await method.selectOption('liquid');
  await expect(page.getByLabel('本次读数阶段', { exact: true }).locator('option').first()).toContainText('倒出前');
  const after = await exported(page);
  expect(after.experimentId).toBe('J-MEAS-01-L');
  expect(after.documentId).toBe(before.documentId);
  expect(after.equipment).toEqual(before.equipment);
  expect(after.measurementRecords).toHaveLength(1);
  expect(after.measurementRecords).toEqual(before.measurementRecords);
  expect(after.measurementSnapshots).toEqual(before.measurementSnapshots);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(method).toHaveValue('solid');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(method).toHaveValue('liquid');
  await expect(status).toContainText('指针对准中央');
});

test('liquid difference method transfers 30 mL atomically and derives 1 g/cm3',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:1920,height:1080});await open(page,true);
 await expect(group(page, 'specimen')).toHaveCount(0);
 await expect(page.getByLabel('待测固体位置', { exact: true })).toHaveCount(0);
 await zero(page);await page.getByLabel('烧杯位置',{exact:true}).selectOption('balance');await weight(page,1,100);await weight(page,5,10);await page.getByRole('button',{name:'展开记录区',exact:true}).click();await capture(page,'110');
 const before=await exported(page);await page.getByRole('button',{name:'从烧杯倒入量筒',exact:true}).click();let after=await exported(page);expect(after.revision).toBe(before.revision+1);expect(Number(after.equipment.find(x=>x.id==='beaker')!.parameters.liquidM3)).toBeCloseTo(.00005);expect(Number(after.equipment.find(x=>x.id==='cylinder')!.parameters.liquidM3)).toBeCloseTo(.00003);await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await exported(page)).equipment).toEqual(before.equipment);await page.getByRole('button',{name:'重做',exact:true}).click();
 await weight(page,1,100);await weight(page,2,50);await weight(page,3,20);await expect(page.getByTestId('density-status')).toContainText('指针对准中央');await capture(page,'80');await capture(page,'30');await derive(page);after=await exported(page);expect(after.measurementRecords.at(-1)!.value).toBeCloseTo(1000);await expect(page.locator('[data-measurement-id]').last()).toHaveAttribute('data-measurement-value','1');await page.locator('.inspector').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:info.outputPath('density-liquid.png'),fullPage:true});
});
test('partial immersion, parallax, unbalanced mass and overflowing imports cannot yield normal readings',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await open(page);await page.getByRole('button',{name:'展开记录区',exact:true}).click();await capture(page,'54');await expect(page.locator('.density-records [role="alert"]')).toContainText('先空载调零');await expect(page.locator('[data-measurement-id]')).toHaveCount(0);await page.getByLabel('本次读数阶段',{exact:true}).selectOption('immersed');await page.getByLabel('待测固体位置',{exact:true}).selectOption('cylinder');await range(page,'提起固体（mm）',60);await capture(page,'60');await expect(page.locator('.density-records [role="alert"]')).toContainText('未完全浸没');await page.getByLabel('读液面视线',{exact:true}).selectOption('1');await expect(page.getByTestId('density-volume-status')).toContainText('视线未');await range(page,'提起固体（mm）',0);await page.getByLabel('读液面视线',{exact:true}).selectOption('0');const s=await exported(page);s.equipment.find(x=>x.id==='cylinder')!.parameters.liquidM3=.00009;await page.getByLabel('导入实验 JSON',{exact:true}).setInputFiles({name:'overflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();await expect(page.getByTestId('density-volume-status')).toContainText('溢出');
});
test('blank assembly, drag attachment, selection, parent deletion and cross experiment separation',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:1920,height:1080});await open(page,false,true);const ids:Record<string,string>={};
 for(const type of densityTypes){await page.locator(`[data-library-type="${type}"]`).click();await page.getByRole('button',{name:'在视口中心放置',exact:true}).click();const s=await exported(page),item=s.equipment.at(-1)!;ids[type]=item.id;const index=densityTypes.indexOf(type);await page.getByLabel('位置 x（m）',{exact:true}).fill(String([-.2,.35,-.48,-.1,.1][index]));await page.getByLabel('位置 y（m）',{exact:true}).fill(String([0,0,.03,-.14,.02][index]));}
 await zero(page);const specimen=ids[densityTypes[2]!]!,balance=ids[densityTypes[0]!]!;const from=await group(page,specimen).locator('.equipment-body').boundingBox(),to=await group(page,balance).locator('[data-balance-pan="left"]').boundingBox();await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height*.85);await page.mouse.down();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:12});await page.mouse.up();expect((await exported(page)).equipment.find(x=>x.id===specimen)!.parameters.targetId).toBe(balance);await expect(group(page,specimen).locator('.equipment-body')).toHaveAttribute('data-selected','true');const attached=await exported(page),beaker=ids[densityTypes[4]!]!,bb=(await group(page,beaker).locator('.equipment-body').boundingBox())!,pan=(await group(page,balance).locator('[data-balance-pan="left"]').boundingBox())!;await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height*.5);await page.mouse.down();await page.mouse.move(pan.x+pan.width/2,pan.y+pan.height/2,{steps:12});await page.mouse.up();await expect(page.locator('.live-notice')).toContainText('不能重叠');expect(await exported(page)).toEqual(attached);await page.getByRole('button',{name:'清空天平并游码归零',exact:true}).click();const cleared=await exported(page);expect(cleared.equipment.find(x=>x.id===specimen)!.parameters.targetId).toBe('');expect(cleared.equipment.find(x=>x.id===specimen)!.pose.xM).toBeLessThan(cleared.equipment.find(x=>x.id===balance)!.pose.xM-.25);await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await exported(page)).equipment).toEqual(attached.equipment);await page.getByLabel('选择器材',{exact:true}).selectOption(balance);await page.getByRole('button',{name:'删除器材',exact:true}).click();expect((await exported(page)).equipment.find(x=>x.id===specimen)!.parameters.targetId).toBe('');await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await exported(page)).equipment.find(x=>x.id===specimen)!.parameters.targetId).toBe(balance);
 const before=await exported(page);await page.locator('[data-library-type="mechanical.lever"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'取消',exact:true}).click();expect(await exported(page)).toEqual(before);await page.screenshot({path:info.outputPath('density-blank-assembly.png'),fullPage:true});
});
test('bench touch controls cancel preview, commit once, and toggle a weight',async({page,context},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:844});await open(page);
 const cdp = await context.newCDPSession(page);
 const weightSlot = group(page, 'masses').getByRole('button', { name: '砝码2 50 g' });
 await weightSlot.scrollIntoViewIfNeeded();
 const slot = (await weightSlot.boundingBox())!;
 for (const pressed of ['true', 'false']) {
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }] });
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
   await expect(weightSlot).toHaveAttribute('aria-pressed', pressed);
 }
 const before=await exported(page),input=page.getByRole('slider',{name:'调零螺母',exact:true});await input.scrollIntoViewIfNeeded();const box=(await input.boundingBox())!,y=box.y+box.height/2,x=box.x+box.width/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect(await exported(page)).toEqual(before);
 await input.scrollIntoViewIfNeeded();const b=(await input.boundingBox())!,yy=b.y+b.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:yy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2+12,y:yy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await exported(page);expect(after.revision).toBe(before.revision+1);await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await exported(page)).equipment).toEqual(before.equipment);const board=page.getByTestId('scene-board');await board.scrollIntoViewIfNeeded();const from=(await group(page,'specimen').locator('.equipment-body').boundingBox())!,to=(await group(page,'balance').locator('[data-balance-pan="left"]').boundingBox())!;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x+from.width/2,y:from.y+from.height*.85}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x+to.width/2,y:to.y+to.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect((await exported(page)).equipment.find(item=>item.id==='specimen')!.parameters.targetId).toBe('balance');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('density-touch.png'),fullPage:true});
});
