# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: weight-chain.spec.ts >> occupied lever hooks are disabled and refuse mouse drops while explicit lower-hook attachment and release remain available
- Location: tests\e2e\weight-chain.spec.ts:46:1

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator:  getByLabel('挂点编号').locator('option[value="2"]')
Expected: disabled
Received: enabled
Timeout:  5000ms

Call log:
  - Expect "toBeDisabled" getByLabel('挂点编号').locator('option[value="2"]') with timeout 5000ms
  - waiting for getByLabel('挂点编号').locator('option[value="2"]')
    13 × locator resolved to <option disabled value="2">2（已挂钩码）</option>
       - unexpected value "enabled"

```

```yaml
- link "跳至实验工作台":
  - /url: "#workbench"
- banner: 中学物理实验室 观察 · 测量 · 探索 实验工作台 本地实验
- heading "探究杠杆平衡条件" [level=1]
- button "修改实验名称": 修改名称
- paragraph: 杠杆 · 自主探究/尚未保存
- button "灯泡串并联实验"
- button "凸透镜成像实验"
- button "杠杆平衡实验"
- button "保存"
- button "加载"
- button "导入"
- button "导出"
- button "新建实验"
- main:
  - region "器材库":
    - heading "器材库" [level=2]
    - text: "5"
    - tablist "器材分类":
      - tab "电学"
      - tab "光学"
      - tab "力学" [selected]
    - paragraph: 选择后点击放置，也可直接拖入。
    - tabpanel "力学":
      - button "杠杆 实验器材"
      - button "支架 实验器材"
      - button "钩码 实验器材"
      - button "弹簧测力计 实验器材"
      - button "独立刻度尺 实验器材"
    - text: 调平与挂接
    - paragraph: 先空载调平，再挂码或接测力计。 拖到挂点松手，或在属性区挂接。独立尺可摆放读数。
  - region "实验区域":
    - heading "实验区域" [level=2]
    - text: 7 件器材 · 杠杆实验
    - button "缩小": −
    - text: 150%
    - button "放大": ＋
    - button "平移"
    - button "复位视图"
    - button "撤销": ↶
    - button "重做" [disabled]: ↷
    - group "实验画布":
      - button "选择支架 1"
      - text: 支架 1
      - button "选择杠杆 2": "-6 -5 -4 -3 -2 -1 0 1 2 3 4 5 6"
      - text: 杠杆 2
      - button "选择钩码 3"
      - text: 0.1 kg 钩码 3
      - button "选择钩码 4"
      - text: 0.1 kg 钩码 4
      - button "选择弹簧测力计 5": 0 2.5 5 N
      - text: 弹簧测力计 5
      - button "选择独立刻度尺 6": 0 5 10 15 20 25 30 35 40 45 50 55 60 65 70 75 80 85 90 95 100 独立尺 · cm（细格 1 mm，放大读尺）
      - text: 独立刻度尺 6
      - button "选择钩码 7"
      - text: 0.1 kg 钩码 7
    - text: 失衡：左端下沉（转动趋势示意）。虚线为原位置，倾斜角不用于读尺。 杠杆静力矩 · 先空载调平再挂载 长度单位 m
  - complementary "属性与诊断":
    - heading "属性与诊断" [level=2]
    - region "杠杆观察与诊断":
      - heading "杠杆平衡观察" [level=3]
      - paragraph: 不平衡：有逆时针转动趋势（状态示意）
      - paragraph: g=10 N/kg；测量时忽略已调平杆与螺母自重。计算原位置为水平，当前画布显示下沉趋势；2 件钩码/测力计尚未挂接。
      - group "空载调节两端平衡螺母":
        - text: 空载调节两端平衡螺母 左端平衡螺母：伸出 24 mm
        - slider "左端平衡螺母" [disabled]: "24"
        - button "左端平衡螺母向内调 1 mm" [disabled]: 向内 −
        - button "左端平衡螺母向外调 1 mm" [disabled]: 向外 ＋
        - text: 右端平衡螺母：伸出 20 mm
        - slider "右端平衡螺母" [disabled]: "20"
        - button "右端平衡螺母向内调 1 mm" [disabled]: 向内 −
        - button "右端平衡螺母向外调 1 mm" [disabled]: 向外 ＋
        - paragraph: 拖动滑条、用方向键或每次调 1 mm；空载时观察哪端下沉。调至水平后再确认，挂载期间请先卸载。
      - button "确认空载调平" [disabled]
      - paragraph: 重新调平前请先解除钩码和测力计挂接。
      - paragraph: 画布已用倾斜示意左端下沉；虚线及受力辅助对应计算初态，不把示意角度作为测量值。
      - checkbox "显示力、作用线与理论（可关闭）"
      - text: 显示力、作用线与理论（可关闭）
      - group: 实验步骤与范围
    - region "器材挂接":
      - heading "器材挂接" [level=3]
      - text: 挂接杠杆
      - combobox "挂接杠杆":
        - option "不挂接"
        - option "杠杆 2" [selected]
      - text: 串接到钩码
      - combobox "串接到钩码":
        - option "不串接（使用杠杆挂点）" [selected]
        - option "钩码 3 下挂钩"
        - option "钩码 4 下挂钩"
      - text: 挂点编号
      - combobox "挂点编号":
        - option "-6"
        - option "-5"
        - option "-4（已挂钩码）" [disabled]
        - option "-3"
        - option "-2"
        - option "-1"
        - option "0" [selected]
        - option "1"
        - option "2（已挂钩码）" [disabled]
        - option "3"
        - option "4"
        - option "5"
        - option "6"
      - button "应用挂接 / 解除"
      - paragraph: 也可拖到支架顶端或杠杆挂点附近，松手挂接；拖离后解除。钩码可拖到另一个钩码的下挂钩串接；每个挂点只能直接挂一个钩码，增加钩码请串接下挂钩。拖动上级会带动下级。
    - text: 选择器材
    - combobox "选择器材":
      - option "请选择"
      - option "支架 1"
      - option "杠杆 2"
      - option "钩码 3"
      - option "钩码 4"
      - option "弹簧测力计 5"
      - option "独立刻度尺 6"
      - option "钩码 7" [selected]
    - heading "钩码 7" [level=3]
    - text: 位置 x（m）
    - spinbutton "位置 x（m）": "0"
    - text: 位置 y（m）
    - spinbutton "位置 y（m）": "0.18"
    - text: 钩码总质量（kg）
    - spinbutton "钩码总质量（kg）": "0.1"
    - button "应用属性"
    - button "删除器材"
    - heading "操作诊断" [level=3]
    - paragraph: 拖到挂点或在挂接区选择支架/杠杆；改变支点或自重后重新空载调平。
  - region "实验记录与分析":
    - tablist "记录面板":
      - tab "记录表" [selected]
      - tab "图线"
      - tab "模型说明"
    - text: 0 条记录
    - button "展开记录区"
    - tabpanel "记录表":
      - heading "杠杆测量与记录" [level=3]
      - paragraph: 独立尺可摆放、缩放读数；力臂是到作用线的垂直距离，斜拉不能直接填沿杆距离。力/力臂手工填写，选力矩方向后由本组输入相乘计算力矩；留空记缺失，不填理论答案。挂点、方向、自重、平衡状态与器材快照随组保存。
      - text: 组别
      - textbox "组别": 第1组
      - group "钩码 3 · 挂点 -4":
        - text: 钩码 3 · 挂点 -4 力（N）
        - textbox "钩码 3 力（N）"
        - text: 力臂（m）
        - textbox "钩码 3 力臂（m）"
        - text: 力矩方向
        - combobox "钩码 3 力矩方向":
          - option "未判定" [selected]
          - option "逆时针（正）"
          - option "顺时针（负）"
      - group "钩码 4 · 挂点 2":
        - text: 钩码 4 · 挂点 2 力（N）
        - textbox "钩码 4 力（N）"
        - text: 力臂（m）
        - textbox "钩码 4 力臂（m）"
        - text: 力矩方向
        - combobox "钩码 4 力矩方向":
          - option "未判定" [selected]
          - option "逆时针（正）"
          - option "顺时针（负）"
      - text: 观察平衡状态
      - combobox "观察平衡状态":
        - option "未判定" [selected]
        - option "平衡"
        - option "不平衡"
      - text: 本组备注
      - textbox "本组备注"
      - button "保存力与力臂记录"
      - heading "测量与记录" [level=3]
      - button "导出 CSV" [disabled]
      - heading "还没有测量记录" [level=3]
      - paragraph: 完成搭建并测量后，在这里整理实验数据。
- contentinfo: 本地保存仅限当前浏览器；重载从实验初态重新运行。 初中 · 高中物理
- status: 已导出实验初态与记录；重新导入后从初态运行。
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import type { Page } from '@playwright/test';
  3  | import type { SceneDocument } from '../../src/core/scene/schema.ts';
  4  | import { readFile } from 'node:fs/promises';
  5  | 
  6  | async function exported(page: Page): Promise<SceneDocument> {
  7  |   const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SceneDocument;
  8  | }
  9  | async function attach(page: Page, id: string, hook: string) {
  10 |   await page.getByLabel('选择器材', { exact: true }).selectOption(id); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await page.getByLabel('挂点编号', { exact: true }).selectOption(hook); await page.getByRole('button', { name: '应用挂接 / 解除', exact: true }).click();
  11 | }
  12 | async function setup(page: Page) {
  13 |   page.setDefaultTimeout(15_000); await page.goto('/'); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  14 |   await page.getByRole('button', { name: '杠杆平衡实验', exact: true }).click(); await page.getByRole('button', { name: '预览杠杆实验', exact: true }).click(); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click();
  15 |   for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '左端平衡螺母向外调 1 mm', exact: true }).click();
  16 |   await page.getByRole('button', { name: '确认空载调平', exact: true }).click(); await attach(page, 'left', '-4'); await attach(page, 'right', '2');
  17 |   const library = page.getByRole('region', { name: '器材库', exact: true }); await library.locator('[data-library-type="mechanical.weights"]').click(); await library.getByRole('button', { name: '在视口中心放置', exact: true }).click();
  18 |   const source = await exported(page); return source.equipment.find(item => !['support', 'lever', 'left', 'right', 'meter', 'ruler'].includes(item.id))!.id;
  19 | }
  20 | const group = (page: Page, id: string) => page.getByTestId('scene-board').locator(`[data-equipment-id="${id}"]`);
  21 | async function pose(page: Page, id: string) {
  22 |   return { x: Number(await group(page, id).getAttribute('data-x-m')), y: Number(await group(page, id).getAttribute('data-y-m')) };
  23 | }
  24 | async function drag(page: Page, id: string, toId: string) {
  25 |   const grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, bottom = (await group(page, toId).locator('[data-weight-bottom]').boundingBox())!;
  26 |   await page.mouse.move(grip.x + grip.width / 2, grip.y + 3); await page.mouse.down(); await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2, { steps: 6 }); await page.mouse.up();
  27 | }
  28 | 
  29 | test('mouse chains weights on lower hooks, restores balance, follows parent moves and preserves children when deleting a parent', async ({ page }, info) => {
  30 |   await page.setViewportSize({ width: 1920, height: 1080 }); const id = await setup(page);
  31 |   await expect(page.getByTestId('lever-trend-banner')).toContainText('左端下沉'); await drag(page, id, 'right');
  32 |   expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right'); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  33 |   let parent = await pose(page, 'right'), child = await pose(page, id); expect(child.x).toBeCloseTo(parent.x, 9); expect(parent.y - child.y).toBeCloseTo(.064, 9);
  34 |   const parentBody = (await group(page, 'right').locator('[data-mechanical-type]').boundingBox())!, childBody = (await group(page, id).locator('[data-mechanical-type]').boundingBox())!;
  35 |   expect(childBody.y).toBeGreaterThan(parentBody.y + parentBody.height - 18);
  36 |   await page.locator('.inspector').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: info.outputPath('serial-weights-balanced.png'), fullPage: true });
  37 |   await attach(page, 'right', '3'); parent = await pose(page, 'right'); child = await pose(page, id); expect(child.x).toBeCloseTo(parent.x, 9); expect(parent.y - child.y).toBeCloseTo(.064, 9); await expect(page.getByTestId('lever-trend-banner')).toContainText('右端下沉');
  38 |   await page.getByLabel('选择器材', { exact: true }).selectOption(id); await expect(page.getByLabel('串接到钩码', { exact: true })).toHaveValue('right');
  39 |   await page.getByLabel('选择器材', { exact: true }).selectOption('right'); await expect(page.getByLabel('串接到钩码').locator(`option[value="${id}"]`)).toHaveCount(0);
  40 |   const before = await exported(page); await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); expect((await exported(page)).equipment).toEqual(before.equipment);
  41 |   await page.getByLabel('选择器材', { exact: true }).selectOption('right'); child = await pose(page, id); await page.getByRole('button', { name: '删除器材', exact: true }).click();
  42 |   await expect(group(page, 'right')).toHaveCount(0); expect(await pose(page, id)).toEqual(child); expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('');
  43 |   await page.getByRole('button', { name: '撤销', exact: true }).click(); expect((await exported(page)).equipment).toEqual(before.equipment); await page.getByRole('button', { name: '重做', exact: true }).click(); await expect(group(page, 'right')).toHaveCount(0);
  44 | });
  45 | 
  46 | test('occupied lever hooks are disabled and refuse mouse drops while explicit lower-hook attachment and release remain available', async ({ page }) => {
> 47 |   const id = await setup(page); await page.getByLabel('挂接杠杆', { exact: true }).selectOption('lever'); await expect(page.getByLabel('挂点编号').locator('option[value="2"]')).toBeDisabled();
     |                                                                                                                                                                          ^ Error: expect(locator).toBeDisabled() failed
  48 |   const before = await exported(page), grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, occupied = (await group(page, 'right').locator('[data-weight-grip]').boundingBox())!;
  49 |   await page.mouse.move(grip.x + grip.width / 2, grip.y + 3); await page.mouse.down(); await page.mouse.move(occupied.x + occupied.width / 2, occupied.y + 3, { steps: 5 }); await page.mouse.up();
  50 |   expect(await exported(page)).toEqual(before); await expect(page.getByRole('status')).toContainText('该挂点已有钩码');
  51 |   await page.getByLabel('串接到钩码', { exact: true }).selectOption('right'); await page.getByRole('button', { name: '应用挂接 / 解除', exact: true }).click(); expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right');
  52 |   await page.getByLabel('串接到钩码', { exact: true }).selectOption('left'); await page.getByRole('button', { name: '应用挂接 / 解除', exact: true }).click();
  53 |   expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('left');
  54 |   await page.getByLabel('串接到钩码', { exact: true }).selectOption(''); await page.getByRole('button', { name: '应用挂接 / 解除', exact: true }).click();
  55 |   const parameters = (await exported(page)).equipment.find(item => item.id === id)!.parameters; expect(parameters.parentWeightId).toBe(''); expect(parameters.leverId).toBe('');
  56 | });
  57 | 
  58 | test.describe('touch weight chains', () => {
  59 |   test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  60 |   test('native touch cancels without changing references then hangs a new weight below the existing one', async ({ page }, info) => {
  61 |     const id = await setup(page); await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
  62 |     const grip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, bottom = (await group(page, 'right').locator('[data-weight-bottom]').boundingBox())!;
  63 |     const x = grip.x + grip.width / 2, y = grip.y + 3, tx = bottom.x + bottom.width / 2, ty = bottom.y + bottom.height / 2, before = await exported(page);
  64 |     await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); const session = await page.context().newCDPSession(page);
  65 |     await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty, id: 1 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); expect(await exported(page)).toEqual(before);
  66 |     await page.getByTestId('scene-board').scrollIntoViewIfNeeded();
  67 |     const freshGrip = (await group(page, id).locator('[data-weight-grip]').boundingBox())!, freshBottom = (await group(page, 'right').locator('[data-weight-bottom]').boundingBox())!;
  68 |     await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: freshGrip.x + freshGrip.width / 2, y: freshGrip.y + 3, id: 2 }] });
  69 |     await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: freshBottom.x + freshBottom.width / 2, y: freshBottom.y + freshBottom.height / 2, id: 2 }] }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
  70 |     expect((await exported(page)).equipment.find(item => item.id === id)!.parameters.parentWeightId).toBe('right'); await expect(page.getByTestId('lever-status')).toHaveText('当前力矩平衡');
  71 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.getByTestId('scene-board').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('serial-weights-touch.png'), fullPage: true });
  72 |   });
  73 | });
  74 | 
```