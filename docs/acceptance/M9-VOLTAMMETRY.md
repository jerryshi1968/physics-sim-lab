# M9 / J-ELEC-03 伏安法测量定值电阻验收记录

日期：2026-11-12。范围为实施文档 9.2 / 任务 16 的单项扩展；不是发布、课堂或实体设备验收。

## 交付范围

- 初中物理实验 → 电学实验 → 伏安法测量定值电阻；统一电学空白增加第四种记录模式，目录共 34 项（初中 22、高中 12）。
- 复用六种现有电学器材与导线，不引入依赖或第三方素材。定值电阻可隐藏数值、断开后换 A/B/C；电表固定理想模型，内阻只读 0 Ω / ∞。
- 两表大量程起步，按实际接线柱改接或用量程选择移动已有线头。禁止闭合时快捷改量程；多导线共用正端时保留逐条改接流程，不静默合并错误接线。
- 成对 U、I 冻结快照；计算 U/I、均值与偏差、半分度区间、至少三个不同电流点的 U–I 拟合，支持原始修订、删除、CSV/JSON、撤销与保存重载。
- 陈旧回复、错误拓扑、缺失、反偏、超量程及非正读数不输出正常 R。导入非理想表配置须显式恢复；一次恢复为一个批量属性命令，可一次撤销两表变更。

## 实际检查

| 检查 | 最终结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 核心、应用与工具/E2E 三份配置 |
| `npm run lint` | 通过 | 零错误、零警告 |
| `npm test` | 412/412 | 新增 8 项伏安法核心检查；独立预期值见模型文档 |
| Vite 生产构建 | 通过 | `node node_modules/vite/bin/vite.js build`；最终入口约 962.81 kB，gzip 299.81 kB；既有 >500 kB 提示仍存在 |
| 最终 Edge 回归 | 81/81 | 新实验 8 项、J-ELEC-02 7 项，目录、器材支持、电压表及首批六项（灯泡、透镜、杠杆、摩擦、弹簧、平抛）相关文件 |
| WebKit 移动配置 | 2/2 | iPhone 15 / iPad (gen 7) landscape；原生点按进入、换电阻、开关、直接改接小量程、采样，指针拖滑片，分析与页面无横向溢出；未发生 pageerror |
| 画面检查 | 已查看 | 最终 WebKit 手机和平板截图；器材、隐藏电阻、示数、图线、只读 ∞ 正常显示 |
| 注释与 diff | 通过 | TypeScript scanner 比较 15 个已修改源码/测试文件的既有注释，保持原文；`git diff --check` 通过 |

Edge 最终命令使用 `PLAYWRIGHT_CHANNEL=msedge`、2 workers，文件为 `voltammetry-experiment`、`ohm-experiment`、`experiment-catalog`、`equipment-support`、`lamp-experiment`、`emf-experiment`、`voltmeter-resistance`、`optical-bench`、`lever-experiment`、`friction-experiment`、`spring-experiment`、`projectile-experiment`。没有运行全部 E2E 目录；未声称其他专题或独立离线套件本次全部重测。

核心日志：`artifacts/voltammetry-final-core.log`。最终浏览器日志：`artifacts/voltammetry-release-edge.log`。WebKit 本地脚本 `node_modules/.cache/voltammetry-webkit-audit.mjs`，结果/截图 `artifacts/voltammetry-webkit-20261112/`。这些为忽略目录中的本地检查产物，不作为提交的源文件。

## 初次问题与修复

1. 最初可选电阻参数的 Zod 输出包含潜在 undefined，与 Scalar 参数约束不符；改为省略未设置的可选键，兼容旧电阻 JSON。类型检查通过。
2. 新核心用例曾误用 `travelHistory` 返回结构，产生一次测试失败；修正测试调用及返回值访问，没有删除断言。完整 412/412 通过。
3. 用户明确初中用理想电表后，去除新实验的加载分析，固定只读内阻，并对非理想导入增加明确恢复；恢复改为现有批量命令。最终浏览器用例验证恢复与一次撤销。
4. 初次 WebKit 原生点按小量程端超时，邻近已接线头的 18 px 透明命中圈遮挡。三柱电表现与四柱器材一样按缩放收紧线头命中圈；未使用 force 点击、未绕过原生点按。重新运行两种 WebKit 配置均通过；新增右侧量程选择，保留原导线及弯曲形状，移动配置的 Edge 用例也覆盖它。
5. E2E 设备配置解构曾触发未使用变量 lint 错误，改用项目已有设备展开写法，最终 ESLint 通过。

初次广泛 Edge 80/80、理想表阶段专项 18/18 通过后，最终线头命中与量程界面改动再次运行上述 81/81；这些次数存在重叠，不相加当作不同用例。

## 限制和后续

- 仍是纯前端教学模型，隐藏电阻参数保存在 JSON；没有防查看答案的考试隔离。
- 理想、恒温定值电阻；不涉及灯泡电阻或高中内外接法。分析不使用隐藏值作学生答案。
- 半分度区间仅是显式读数分辨率假设，不包含仪器准确度、视差或统计置信度；没有参考值时偏差相对本组均值，不冒称真实相对误差。
- WebKit / Edge 的设备配置模拟不能代替实体 iPhone、iPad、真实 Safari 或课堂使用；WebKit 连续滑片拖动采用指针，不冒称连续手指拖动。
- 教材版次、章节页码及签署仍为 `pending_teacher_review`；下一步教师检查实物对应、课堂读数与真实触屏设备，其他 9.2 扩展另选，不顺带实施。

[模型及独立预期值](../models/voltammetry-experiment.md) · [需求卡](../requirements/J-ELEC-03.md)
