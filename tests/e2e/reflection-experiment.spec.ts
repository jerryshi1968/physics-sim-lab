import { openFamily } from './catalog-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { SceneDocument } from '../../src/core/scene/schema.ts';
import { reflectionTypes, PAPER, EMITTER } from '../../src/equipment/reflection/definitions.ts';

async function ready(page:Page,empty=false){
  await page.goto('/');await expect(page.getByRole('button',{name:'保存',exact:true})).toBeEnabled();
  await openFamily(page, '光的反射定律实验');
  if(empty)await page.getByRole('radio',{name:'空白搭建光学实验',exact:true}).check();
  await page.getByRole('button',{name: '进入实验',exact:true}).click();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();
}
async function download(page:Page,name='导出'){
  const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return readFile((await(await pending).path())!,'utf8');
}
const exported=async(page:Page)=>JSON.parse(await download(page))as SceneDocument;
const status=(page:Page)=>page.getByTestId('reflection-status');
const reflected=(page:Page)=>page.getByTestId('scene-board').locator('[data-paper-ray="reflected"][data-paper-side="right"]');
const property=async(page:Page,id:string,name:string,value:string)=>{await page.getByLabel('选择器材',{exact:true}).selectOption(id);await page.getByLabel(name,{exact:true}).fill(value);};

test('reflection three-angle readings, folded evidence, student chart and CSV/JSON/save are one document',async({page},info)=>{
  test.setTimeout(120_000);await page.setViewportSize({width:1920,height:1080});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const original=window.Worker;(window as Window&{reflectionWorkers?:number}).reflectionWorkers=0;window.Worker=class extends original{constructor(url:string|URL,options?:WorkerOptions){super(url,options);const counter=window as Window&{reflectionWorkers?:number};counter.reflectionWorkers=(counter.reflectionWorkers??0)+1;}};});
  await ready(page);await expect(page.locator('[data-library-type]')).toHaveCount(13);await expect(reflected(page)).toHaveCount(1);await expect(page.getByTestId('reflection-theory')).toHaveCount(0);
  await expect(page.getByTestId('scene-board').locator('[data-optical-rays]')).toHaveCount(0);await expect(page.locator('[data-screen-projection]')).toHaveCount(0);
  await page.getByRole('button',{name:'展开记录区',exact:true}).click();
  let first:SceneDocument|null=null;
  for(const [index,deg]of [30,45,60].entries()){
    await page.getByLabel('光源圆周方位角（°）',{exact:true}).fill(String(deg+90));
    await page.getByLabel('入射角估读（°）',{exact:true}).fill(String(deg));await page.getByLabel('反射角估读（°）',{exact:true}).fill(String(deg+1));
    await page.getByLabel('右纸板连续光迹观察',{exact:true}).selectOption('能看到');await page.getByRole('button',{name:'保存反射记录',exact:true}).click();
    await expect(page.locator('[data-measurement-id]')).toHaveCount((index+1)*3);if(index===0)first=await exported(page);
  }
  const three=await exported(page);expect(three.measurementRecords.slice(0,3)).toEqual(first!.measurementRecords);expect(three.measurementRecords[1]!.value).toBeCloseTo(31*Math.PI/180,9);expect(three.measurementRecords[1]!.context!.physicalValue).toBeCloseTo(Math.PI/6,9);
  const overlaps=await page.getByTestId('scene-board').locator('.equipment-caption').evaluateAll(nodes=>{
    const boxes=nodes.map(node=>({name:node.textContent,box:node.getBoundingClientRect()})),pairs:string[]=[];
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a]!,y=boxes[b]!;if(x.box.left<y.box.right&&x.box.right>y.box.left&&x.box.top<y.box.bottom&&x.box.bottom>y.box.top)pairs.push(`${x.name}/${y.name}`);}return pairs;
  });expect(overlaps).toEqual([]);
  await page.getByRole('tab',{name:'图线',exact:true}).click();await expect(page.locator('[data-record-id]')).toHaveCount(3);await expect(page.getByLabel('图线类型',{exact:true})).toHaveValue('reflection-r-i');
  await expect(page.getByTestId('measurement-chart')).toContainText('i（°）');await expect(page.locator('[data-record-id]').first()).toHaveAttribute('data-value','31');
  await page.screenshot({path:info.outputPath('reflection-three-angles.png'),fullPage:true});
  await page.getByRole('tab',{name:'记录表',exact:true}).click();await page.getByRole('button',{name:'折起纸板 45°',exact:true}).click();await expect(reflected(page)).toHaveCount(0);await expect(status(page)).toContainText('光仍沿原空间方向');
  await page.getByLabel('右纸板连续光迹观察',{exact:true}).selectOption('不能看到');await page.getByRole('button',{name:'保存反射记录',exact:true}).click();
  const folded=await exported(page);expect(folded.measurementRecords[10]!.value).toBeNull();expect(folded.measurementRecords[10]!.measurementStatus).toBe('out-of-model');expect(folded.measurementRecords[11]!.value).toBe(0);expect(JSON.parse(folded.measurementSnapshots![3]!.note).foldRad).toBeCloseTo(Math.PI/4);
  const csv=await download(page,'导出 CSV');expect(csv).toContain('31°');expect(csv).toContain('"°",30');expect(csv).toContain('不能看到');expect(csv).not.toMatch(/NaN|Infinity/);
  await page.getByLabel('显示空间光路与理论（可关闭）',{exact:true}).check();await expect(page.getByTestId('reflection-theory')).toContainText('模型入射角 60°');
  await page.locator('.inspector').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:info.outputPath('reflection-folded.png'),fullPage:true});
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByTestId('save-state')).toHaveText('已保存');await page.reload();
  expect(await exported(page)).toEqual(folded);await expect(reflected(page)).toHaveCount(0);await expect(page.getByTestId('reflection-theory')).toHaveCount(0);
  await page.getByLabel('导入实验 JSON').setInputFiles({name:'反射.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(three))});await page.getByRole('button',{name:'确认替换当前实验',exact:true}).click();expect(await exported(page)).toEqual(three);await expect(reflected(page)).toHaveCount(1);
  expect(await page.evaluate(()=>(window as Window&{reflectionWorkers?:number}).reflectionWorkers)).toBe(0);expect(errors).toEqual([]);
});

test('native blank assembly, independent calibration, immediate attributes and old optics are isolated',async({page},info)=>{
  test.setTimeout(90_000);await page.setViewportSize({width:1920,height:1080});await ready(page,true);
  const board=page.getByTestId('scene-board'),ids:Record<string,string>={};
  for(const type of reflectionTypes){
    await page.locator(`[data-library-type="${type}"]`).click();await page.getByRole('button',{name:'在视口中心放置',exact:true}).click();ids[type]=(await board.locator(`[data-equipment-type="${type}"]`).getAttribute('data-equipment-id'))!;
  }
  await property(page,ids['optical.plane-mirror']!,'位置 y（m）','0');
  await property(page,ids[EMITTER]!,'位置 x（m）','-.24');await property(page,ids[EMITTER]!,'位置 y（m）',String(.24*Math.sqrt(3)));await property(page,ids[EMITTER]!,'转角（°）','-60');
  await expect(status(page)).toContainText('未校准');for(const name of ['将纸板折轴对齐法线','将量角器对齐入射点','将法线标记对齐镜面'])await page.getByRole('button',{name,exact:true}).click();
  await expect(status(page)).toContainText('有连续反射光迹');await expect(reflected(page)).toHaveCount(1);
  const aligned=await exported(page);await property(page,ids['optical.protractor']!,'位置 x（m）','.02');await expect(status(page)).toContainText('未校准');
  await page.getByRole('button',{name:'将量角器对齐入射点',exact:true}).click();await expect(status(page)).toContainText('有连续反射光迹');
  expect((await exported(page)).equipment.find(e=>e.type===EMITTER)!.pose).toEqual(aligned.equipment.find(e=>e.type===EMITTER)!.pose);
  const orbit=page.getByLabel('光源圆周方位角（°）',{exact:true}),beforeDraft=await exported(page);
  await orbit.fill('0');await expect(orbit).toHaveAttribute('aria-invalid','true');expect(await exported(page)).toEqual(beforeDraft);await orbit.press('Escape');await expect(orbit).toHaveValue('120');
  await orbit.fill('');await orbit.pressSequentially('135');await expect(orbit).toHaveValue('135');await expect(status(page)).toContainText('有连续反射光迹');await page.getByRole('heading',{name:'反射与共面观察',exact:true}).click();await expect(orbit).toHaveValue('135');
  await orbit.fill('');await orbit.pressSequentially('120');await expect(orbit).toHaveValue('120');
  await property(page,ids['optical.protractor']!,'量角器半径（m）','.05');await expect(status(page)).toContainText('有连续反射光迹');
  const scale=await board.locator('[data-equipment-type="optical.protractor"] [data-reflection-type] text').first().getAttribute('font-size');expect(Number(scale)).toBeCloseTo(.019*.05/.36,9);
  await property(page,ids['optical.protractor']!,'量角器半径（m）','.36');
  const source=board.locator(`[data-equipment-id="${ids[EMITTER]}"] [data-reflection-type] rect`).first(),sourceBox=(await source.boundingBox())!,x=sourceBox.x+sourceBox.width/2,y=sourceBox.y+sourceBox.height/2,preMove=await exported(page);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y,{steps:6});await expect(status(page)).toContainText('预览中');await expect(board).toHaveAttribute('data-revision',String(preMove.revision));await page.keyboard.press('Escape');await page.mouse.up();expect(await exported(page)).toEqual(preMove);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y,{steps:6});await page.mouse.up();await expect(status(page)).toContainText('未校准');await expect(board).toHaveAttribute('data-revision',String(preMove.revision+1));await page.getByRole('button',{name:/^撤销/}).click();await expect(status(page)).toContainText('有连续反射光迹');
  await page.getByLabel('选择器材',{exact:true}).selectOption(ids[EMITTER]!);await page.getByLabel('打开光源',{exact:true}).uncheck();await expect(status(page)).toContainText('光源已关闭');await expect(reflected(page)).toHaveCount(0);await page.getByLabel('打开光源',{exact:true}).check();await expect(reflected(page)).toHaveCount(1);
  await expect(page.locator('[data-library-type="optical.convex-lens"]')).toBeDisabled();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(board.locator('[data-equipment-id]')).toHaveCount(5);
  await page.getByLabel('选择器材',{exact:true}).selectOption(ids[PAPER]!);await page.getByRole('button',{name:'删除器材',exact:true}).click();await expect(board.locator('[data-equipment-id]')).toHaveCount(4);await expect(status(page)).toContainText('各放置一件');
  await page.getByRole('button',{name:/^撤销/}).click();await expect(board.locator('[data-equipment-id]')).toHaveCount(5);await expect(reflected(page)).toHaveCount(1);await page.screenshot({path:info.outputPath('reflection-blank-assembled.png'),fullPage:true});
});

test('fold preview cancels, releases one history entry, and normal incidence is a real counterexample',async({page},info)=>{
  test.setTimeout(90_000);await page.setViewportSize({width:1920,height:1080});await ready(page);
  const range=page.getByLabel('右纸板折角（°）',{exact:true});await range.scrollIntoViewIfNeeded();const box=(await range.boundingBox())!,before=await exported(page),board=page.getByTestId('scene-board');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height/2,{steps:8});await expect(reflected(page)).toHaveCount(0);await expect(board).toHaveAttribute('data-revision',String(before.revision));await expect(page.getByRole('button',{name:'保存反射记录',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await page.mouse.up();await expect(reflected(page)).toHaveCount(1);expect(await exported(page)).toEqual(before);
  await range.scrollIntoViewIfNeeded();const next=(await range.boundingBox())!;await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();await page.mouse.move(next.x+next.width*.8,next.y+next.height/2,{steps:8});await page.mouse.up();await expect(board).toHaveAttribute('data-revision',String(before.revision+1));
  await page.getByRole('button',{name:/^撤销/}).click();expect(await exported(page)).toEqual({...before,revision:before.revision+2,provenance:{...before.provenance,updatedAt:expect.any(String)}});
  await page.getByLabel('光源圆周方位角（°）',{exact:true}).fill('90');await page.getByRole('button',{name:'折起纸板 90°',exact:true}).click();await expect(status(page)).toContainText('不能证明共面');await expect(reflected(page)).toHaveCount(1);await expect(page.getByTestId('reflection-fold-view')).toHaveAttribute('data-evidence','hinge');
  await page.getByLabel('光源圆周方位角（°）',{exact:true}).fill('60');await expect(status(page)).toContainText('固定左板');await expect(reflected(page)).toHaveCount(0);await expect(board.locator('[data-paper-ray="reflected"][data-paper-side="left"]')).toHaveCount(1);
  await page.getByLabel('光源圆周方位角（°）',{exact:true}).fill('120');await expect(page.getByTestId('reflection-fold-view')).toHaveAttribute('data-evidence','off-sheet');
  await page.getByRole('button',{name:'展开纸板 0°',exact:true}).click();await range.focus();await page.keyboard.press('ArrowRight');await expect(range).toHaveValue('1');await expect(reflected(page)).toHaveCount(0);await page.screenshot({path:info.outputPath('reflection-keyboard-fold.png'),fullPage:true});
});

test.describe('reflection touch',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('touch places apparatus, folds receiving sheet, and keeps controls within narrow page',async({page},info)=>{
    test.setTimeout(90_000);await ready(page,true);const library=page.getByRole('region',{name:'器材库',exact:true});
    await library.locator(`[data-library-type="${PAPER}"]`).tap();await library.getByRole('button',{name:'在视口中心放置',exact:true}).tap();
    await expect(page.getByTestId('scene-board').locator('[data-equipment-type="optical.folding-paper"] [data-selected="true"]')).toHaveCount(1);
    await openFamily(page, '光的反射定律实验', true);await page.getByRole('button',{name: '进入实验',exact:true}).tap();await page.getByRole('button',{name:'确认替换当前实验',exact:true}).tap();
    const range=page.getByLabel('右纸板折角（°）',{exact:true});await range.scrollIntoViewIfNeeded();const box=(await range.boundingBox())!,client=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.82,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.getByTestId('reflection-fold-view')).toHaveAttribute('data-evidence','off-sheet');const folded=await exported(page);expect(Number(folded.equipment.find(e=>e.type===PAPER)!.parameters.foldRad)).toBeGreaterThan(.5);
    await page.getByRole('button',{name:'展开纸板 0°',exact:true}).tap();await expect(reflected(page)).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('reflection-touch.png'),fullPage:true});
  });
});


test('degree table and correction keep old SI records readable after saving and reloading',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080});await ready(page);
  await page.getByRole('button',{name:'展开记录区',exact:true}).click();
  await page.getByLabel('入射角估读（°）',{exact:true}).fill('30');await page.getByLabel('反射角估读（°）',{exact:true}).fill('30');
  await page.getByRole('button',{name:'保存反射记录',exact:true}).click();
  const row=page.locator('[data-measurement-id]').first();await expect(row).toHaveAttribute('data-measurement-value','30');await expect(row.locator('td').nth(5)).toHaveText('°');await expect(row).toContainText('0～90 / 1');
  await row.getByRole('button',{name:'修改抄表',exact:true}).click();const correction=row.getByLabel('修订抄表值（°）',{exact:true});await expect(correction).toHaveValue('30');await correction.fill('32.5');await row.getByRole('button',{name:'确认修订',exact:true}).click();
  await expect(row).toHaveAttribute('data-measurement-value','32.5');await expect(page.getByRole('table',{name:'反射角度记录（度）',exact:true})).toContainText('32.5°');
  const csv=await download(page,'导出 CSV');expect(csv).toContain('"°",32.5,"30°","32.5"');
  const saved=await exported(page);expect(saved.measurementRecords[0]!.value).toBeCloseTo(32.5*Math.PI/180,9);
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByTestId('save-state')).toHaveText('已保存');await page.reload();
  await page.getByRole('button',{name:'展开记录区',exact:true}).click();await expect(page.locator('[data-measurement-id]').first()).toHaveAttribute('data-measurement-value','32.5');expect(await exported(page)).toEqual(saved);
  await page.locator('[data-measurement-id]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('reflection-degree-records.png'),fullPage:true});
});
