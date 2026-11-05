# SVG 工作台、坐标与连接图（M1 / 任务 03）

M2 已接入[独立 MNA 与场景编译 API](dc-mna.md)、[灯泡/仪表与自动更新](lamps-and-meters.md)，原端点/几何约定保持；以下初版任务范围保留作历史记录。

任务 04 已接入命令历史与保存加载，详见[当前说明](history-and-persistence.md)。拖动预览/松手提交边界保持，视口写入保存但不占编辑历史；旧文中的“尚无历史/保存”属于任务 03 历史范围。

用户后续要求已覆盖本页初版的显式结点 UI 约定：当前为实物风格器材、导线工具和可开口线头，格式版本为 2；以[实物与独立导线决策](../decisions/0005-m1-physical-apparatus-and-loose-wires.md)及[修订验收](../acceptance/M1-REALISTIC-WIRES.md)为准。下面的初版坐标公式、端点 ID 和几何/电气分离原则仍适用。

## 器材定义与边界

2026-11-05 即时属性修订：电学、光学与力学器材共用即时编辑器，合法数值、键盘/原生微调箭头和复选框立即提交到原命令历史；装配下拉设置也即时生效，不再有“应用属性”或装配应用按钮。输入节点与焦点不随 revision 重建；空白、未输完、非有限值或不满足参数组合约束的草稿不覆盖最后有效值，失焦或 Esc 恢复。输入框中的文本撤销保留浏览器行为，画布/工具栏撤销操作场景历史。每次有效值变化是一条命令，拖拽仍按松手一次提交，学生记录仍需主动采集/保存。

选中框在所有实物、导线和端子之后绘制，按当前姿态/缩放保留 7 CSS px 外边距与固定线宽，覆盖单选和 Shift 多选；框不接收指针事件，避免遮挡拖动、接线或开关/滑片操作。见[实际验收](../acceptance/M5-LIVE-PROPERTIES.md)。


当前选择/删除补充：普通点击替换选择，Shift 点击器材增选或取消，Shift+Enter/Space 可走键盘路径；按 Delete 或属性区删除按钮删除单件/多件，选中的器材均显示边框，属性区显示多选数量。Shift 点击开关刀柄仅改变选择，不开合开关。输入框、选择框、可编辑文本及打开的文档对话框不触发器材 Delete 快捷键。

删除器材会保留相连导线，用删除前姿态（含旋转/翻转）计算的端口世界坐标替换成自由线头；保留 ID、弯曲点和未删除器材上的端子。两端器材同时删除时，两端都转为自由位置。批量删除只增加一次 revision/历史，撤销恢复完整接线；已有测量记录引用的器材仍按既有规则拒绝删除，批量操作整体失败。选择仅为会话状态，多选用于批量删除，拖动仍按单件处理。详见[修订验收](../acceptance/M2-SELECTION-DELETE.md)。

| type / 定义版本 | 默认参数与 SI 约束 | 端口 ID | 局部坐标（m） |
| --- | --- | --- | --- |
| electrical.power-supply / 1 | voltageV=3，有限且 ≥0 | positive / negative | (-0.075,0) / (0.075,0) |
| electrical.resistor / 1 | resistanceOhm=10，有限且 >0 | a / b | (-0.075,0) / (0.075,0) |
| electrical.switch / 1 | closed=false，布尔值 | a / b | (-0.075,0) / (0.075,0) |
| electrical.junction / 1 | 无标量参数 | node | (0,0) |

定义来自正式工厂 createElectricalRegistry；局部长度只用于示意布局，不决定电阻、电压或电气拓扑。器材 SVG 为原创图形，无外部素材。开关画面按 closed 表示断开/闭合，但尚不求电流；电源、电阻不产生预制读数。

## 坐标公式与独立基准

局部端口为 (lx,ly)，器材位置 (x0,y0)，转角 θ 为 rad，正向逆时针。世界端口：

```text
x = x0 + lx·cosθ − ly·sinθ
y = y0 + lx·sinθ + ly·cosθ
```

画布大小 W、H（CSS px），视口中心 cx、cy（m），比例 s（px/m）：

```text
screenX = W/2 + (x−cx)·s
screenY = H/2 − (y−cy)·s
worldX = cx + (screenX−W/2)/s
worldY = cy − (screenY−H/2)/s
```

实现入口为 worldToScreen、screenToWorld、localToWorld、endpointWorld 与 wireWorldPoints。浏览器将 client 坐标按实际 SVG 矩形换到 viewBox 尺寸，平板/滚动后不依赖页面绝对位置。ResizeObserver 更新画布尺寸；端口和导线共用同一转换。

独立测试常量：800×600 画布、中心 (0,0)、500 px/m 时，世界 (0.1,0.2) 应映到 (450,200) px；(0.075,0) 局部端口随器材移到 (1,2)、旋转 90° 后应在 (1,2.075) m。源器材移到 (-0.1,0.2)、旋转 90°，其 positive 端应为 (-0.1,0.125) m。核心几何比较绝对误差 ≤1e-12，按各输出的 m/px 单位分别检查。

缩放保留锚点下的世界位置，s 限制为 100～2400 px/m；平移 dx、dy px 时 cx'=cx−dx/s、cy'=cy+dy/s。viewport 更新不修改器材参数、连接端点或装置 revision；CSS 像素、设备像素比与物理米不混用。

## 编辑与手势

core/workbench/edit.ts 提供 addEquipment、updateEquipment、connectEndpoints、updateWireRoute、removeEquipment、removeConnection；合法候选文档只提交一次 revision，失败返回 Diagnostic 且不暴露半成品文档。调用前文档应已通过结构校验，文件解析/迁移在任务 04 处理。

器材和折点拖动只有视图预览，pointerup 才更新文档，pointercancel/Escape 恢复原位置。属性输入不丢失原参数：阻值 0 等无效值显示原因，重新选择该器材仍得到原来的有效值。触摸/笔用 pointerup 激活并去重兼容 click；键盘 Enter/Space 和 HTML 控件可走同一核心编辑入口。没有“拖动一下就换算为力/电流”的逻辑。

## 连接图与不变量

端点标识由 JSON.stringify([equipmentId,portId]) 构造，避免含冒号的 ID 拼接冲突。wiringNodes 只合并 wire 明确声明的端点；不从颜色、像素距离、折点或交叉猜测接线，也不计算元件内部支路或 MNA。

闭合回路基准从空白文档加入电源、10 Ω 电阻和 closed=true 开关，接线为：电源 positive ↔ 电阻 a；电阻 b ↔ 开关 a；开关 b ↔ 电源 negative。独立检查得到三个外部电气结点、三条导线、正确开关状态和空测量记录，尚无电流数值。

测试将不同线路折点放在同一 (0,0)，结点数量不变；在该位置单独放 junction 仍不接线。只有真正连到其 node 端口时才合并相应端点；一个 node 可接多根线。重复导线不增加电气结点，移动、旋转、缩放、改色和折线路径均不改 from/to。导线颜色目前是所有线路共用的视图样式，不写入场景或假装已经持久化。

## 验证与限制

2026-11-04 导线前景修订：线身及阴影/高光在器材实物之后绘制，接线柱图案再覆盖在线端上方，弯曲点和自由/选中线头继续在前景。线身命中区域扣除接线柱及开关/滑片操作区域；扣除区域先按矩形并集合并，避免低缩放时重叠区域反而恢复命中。旋转/翻转后的操作区域跟随坐标变换，预览及缩放时同步更新。此改动仅调整绘制/命中顺序，不改接线图、物理模型、历史或保存格式。实际回归见[验收记录](../acceptance/M3-WIRE-LAYER.md)。

运行 npm test（85 项），其中新增 tests/core/workbench.test.mjs 的 11 项；浏览器入口为 npm run test:e2e（9 项，先 build）。实际命令、截图和问题修复见[任务 03 验收记录](../acceptance/M1-TASK03.md)。

任务 03 不包含物理求解、测量采样、自动安全接线、存储、撤销/重做、双指捏合或真实平板硬件验收。低倍率端口命中区为避免重叠会缩小，可使用右侧接线按钮替代。保存重载、单手势历史事务和导入防护将在任务 04 实现；本任务不宣称整个 M1 通过。
