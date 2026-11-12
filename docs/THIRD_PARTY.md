# 第三方授权台账

## 学段目录与自由搭建登记（2026-11-12）

学段目录数据、对话框 CSS/React 界面及兼容器材调度由本项目独立编写，适用 Apache-2.0 原创授权，署名 jerryshi1968。复用既有模型与器材，无新增第三方依赖、代码或素材。

## 电动势与内阻扩展登记（2026-11-11）

复用项目已有电源、电表、变阻器与直流 MNA。新增起点、接线识别、U–I 记录/拟合图线和说明为本项目原创，适用 Apache-2.0，署名 jerryshi1968。无新增第三方代码、素材或运行依赖。模型概念核对链接列在 `docs/models/emf-experiment.md`，未复制第三方正文或图形。

## 浮力扩展登记（2026-11-11）

带吊环圆柱体、溢水杯与烧杯的 SVG、浮力及排液模型和交互由本项目独立编写，使用 Apache-2.0 原创授权，署名 jerryshi1968。无新增第三方素材或依赖。

## 平面镜成像扩展登记（2026-11-09）

成像标记物、对照物、观察眼的 SVG 及观察窗、光路和读数功能由本项目独立编写，适用 Apache-2.0 原创授权，署名 jerryshi1968。沿用已有器材定义，无新第三方素材或依赖。

## 小车扩展登记（2026-11-09）

小车、轨道、光电门和打点计时器的 SVG、运动模型与交互为本项目独立编写，适用 Apache-2.0 原创授权，署名 jerryshi1968。未引入第三方素材或新依赖。

## 密度扩展登记（2026-11-09）

固体/液体密度模型、等臂天平、量筒/液面、砝码盒、固体与烧杯 SVG 及交互为本项目独立编写，适用维护者已有 Apache-2.0 原创授权，署名 jerryshi1968。无新第三方代码、图片、字体或教材素材，未更改依赖/锁文件及完整第三方声明；构建生成台账的日期刷新恢复为本次开始前原文，不宣称重新核验189个上游包。既有候选包不改写。

## 任务 16 扩展登记（2026-11-05）

J-OPT-01 的向量反射、射线—有限纸板裁剪、量角器/镜/光源/折板 SVG 和交互由本项目独立编写，适用已有原创 Apache-2.0 授权；未复制外部模型、图片、字体或教材素材。无新增依赖，189 个锁定第三方条目的版本、来源和完整性保持；仅根项目版本进入 0.2.0-dev.1。继续沿用完整第三方声明，不改写原 v0.1 候选 ZIP。

## 任务 15 引入前登记（2026-11-05）

### 本次实际核验结果

当前发行范围为五个业务运行时包及两个注入辅助代码的提供方。七份官方 npm 原包均通过锁定 sha512，并将实际安装的 1054 个普通文件逐字节比较，0 修改/缺失；完整上游许可均包含在 public/THIRD_PARTY_NOTICES.txt，构建原样复制到 dist。Vite 的 LICENSE.md 全文附带构建器内的额外许可声明，保留完整，不将其中全部包误列为浏览器依赖。全部 189 个锁条目版本/来源/完整性不变，候选只改变根版本与许可元数据；未安装的平台开发可选项不分发其代码，不作包内已核验承诺。

| 提供方 | 固定版本 | 分发角色 | 比对文件数 | 原始声明位置 |
| --- | --- | --- | --- | --- |
| matter-js | 0.20.0 | application-runtime | 38 | node_modules/matter-js/LICENSE |
| react | 19.3.1 | application-runtime | 27 | node_modules/react/LICENSE |
| react-dom | 19.3.1 | application-runtime | 43 | node_modules/react-dom/LICENSE |
| rolldown | 1.2.16 | emitted-build-helper-provider | 54 | node_modules/rolldown/LICENSE |
| scheduler | 0.28.0 | application-runtime | 15 | node_modules/scheduler/LICENSE |
| vite | 8.3.5 | emitted-build-helper-provider | 37 | node_modules/vite/LICENSE.md |
| zod | 4.6.7 | application-runtime | 840 | node_modules/zod/LICENSE |

对应来源 URL、完整性、完整声明 SHA256、实际文件比对见[本次审查 JSON](acceptance/m7-task15-audit.json)；189 项开发/运行依赖的原始作者、范围、来源与例外仍见[全表](third-party/DEPENDENCIES.md)。本次审查未修改上游包，无新第三方代码或素材；Vite/Rolldown 已有注入代码的声明是补齐的遗漏项。

产品 src/public 未发现外部图片、字体、音视频文件；实物为原创内联 SVG/CSS，用户需求截图不打包。源码包不收原始验收截图、环境/缓存、node_modules 或旧构建；许可证/署名和已知限制随候选包。源文件与包清单有哈希和敏感模式检查，但不宣称自动扫描能排除所有可能的权利争议。原创许可范围见[LICENSING.md](../LICENSING.md)，具体候选与未通过门槛见[发布说明](releases/v0.1.0-rc.1.md)。

维护者在当前对话确认：项目原创代码、文字和实物风格 SVG 均由其授权开源，采用 Apache-2.0，无其他人享有权利；后续明确指定署名 jerryshi1968。本次将引入 Apache License 2.0 官方完整许可原文至根 LICENSE，来源 https://www.apache.org/licenses/LICENSE-2.0.txt ，不改写原文，不使用 ASF 项目专属版权头，不宣称 ASF 背书。原创许可不覆盖第三方包/声明。现有运行时五个包继续按原 MIT 声明保留，本次不新增运行依赖或外部素材。实际哈希、包内文件比较与构建范围待本任务核对后补记。

构建审查补录（引入声明前）：已安装并锁定的 Vite 8.3.5 会向主包注入 modulepreload polyfill，Rolldown 1.2.16 注入 CommonJS/ESM 辅助函数；它们原已是开发依赖，本次不改变任何依赖版本。两者根许可为 MIT，署名分别为 VoidZero Inc. and Vite contributors、VoidZero Inc. & Contributors。将逐字保留 Vite LICENSE.md 全文（含其构建器内附带的第三方声明）和 Rolldown LICENSE；这不表示 Vite 的全部 Node 构建依赖进入浏览器。实际原包核对和源码范围见任务 15 审查结果。

任务 11 引入前登记（2026-11-04）：Matter.js 固定 0.20.0，MIT，权利人为 Liam Brummitt and contributors；官方标签 LICENSE 已核对，计划以未修改 npm 原包用于受限接触/形状适配，不将其摩擦系数作为教材 μ。类型包 @types/matter-js 固定 0.20.2，MIT，仅开发检查。来源使用 https://registry.npmjs.org/matter-js 与 https://registry.npmjs.org/@types/matter-js 及 https://github.com/liabru/matter-js/tree/0.20.0 。安装前核对元数据，安装后核对包内 LICENSE、锁定 sha512，完整声明随现有 licenses 流程进入 public/THIRD_PARTY_NOTICES.txt；未复制上游源码到自研物理模块。实际安装核对结果在本节后续补记。

更新日期：2026-11-04  
当前范围：任务 11 的 Matter.js 受限形状/接触适配、自研一维摩擦与既有 React/TS、MNA、光学、杠杆、测量和持久化；无新增第三方图像素材。以下各任务段落保留其当时历史范围。

任务 10 的杠杆力矩包装/约束适配、五类力学器材原生 SVG、空载调平/挂接、手工记录与验证为项目新写，复用原自研小样、React/Zod 与浏览器 API。力学独立尺沿用本项目光学尺图形/分度，光学原定义保持。没有外部代码、图片、包或声明变动，未引入 Matter.js；package.json / package-lock.json 保持。见[杠杆模型](models/lever-experiment.md)。

任务 09 的光具座/蜡烛/薄镜/光屏/尺原生 SVG、近轴传播与离焦、独立读尺及观察记录均为项目新写，复用既有 React/Zod 与文档机制。仅阅读 [Ray Optics 官网组件与视图说明](https://phydemo.app/ray-optics/)作为理想薄镜、尺、射线和反向延长线参考，未复制实现或素材、未拉取源码，不宣称已核验其逐文件授权。无新增依赖，package.json / package-lock.json 保持；见[光学模型](models/optical-bench.md)。

任务 08 的实验起点工厂、可编辑模板、指导文字、空白测点安排及 UI/验证为项目新写，复用既有器材、求解、测量和原生 dialog。无新增包、外部素材或复制内容，package.json / package-lock.json 不变；[实验流程说明](models/lamp-circuit-experiment.md)已登记。

用户追加的四柱滑动变阻器实物 SVG、四端模型、滑片交互和演示均为本项目新写；复用已有 React/Zod 和 MNA，无新增依赖、外部图片或第三方代码。package.json / package-lock.json 保持，见[模型说明](models/rheostat.md)。

任务 03 未增加依赖，package.json / package-lock.json 保持原样；器材 SVG/CSS 为本项目新写图形。既有 187 个锁定包、4 个运行时包声明继续按下表和明细维护。

本次用户修订的实物风格插图、金属接线柱、绝缘导线与曲线编辑仍为项目新写 SVG/CSS/TS，无新增第三方包或图片。用户截图仅作需求参考，未作为产品素材打包。

任务 04 复用既有 Zod、React 和原生 IndexedDB / File / Blob / dialog API，迁移、命令和文件校验为本项目新写代码；无新增包或素材，唯一锁文件保持。

任务 07 的记录快照、图线与 CSV 均自行编写，复用 React/Zod、原生 SVG/ResizeObserver/Blob，无新增包或图片。仅核对 [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) 的公式前导字符与引用防护说明，没有复制其实现或打包网页；不宣称不同表格软件及另存往返的通用安全保证。完整契约见[测量说明](models/measurements-and-export.md)。

任务 05 仅核对 [Qucs 官方 MNA 技术文档](https://qucs.github.io/tech/node14.html)中的公开电路方程和矩阵盖章理论；拓扑、线性代数、残差、适配器、测试均自行编写，未复制/移植 Qucs、CircuitJS1 或其他物理求解代码。没有新增依赖、下载素材或更改锁文件；理论参考不作为打包的第三方源码。实现与假设见[模型说明](models/dc-mna.md)。

任务 06 核对 [Qucs 直流 Newton 方程](https://qucs.github.io/tech/node16.html)与[收敛讨论](https://qucs.github.io/tech/node17.html)，仅参考公开理论，未复制实现。灯泡本构/阻尼迭代、仪表与翻转图形、Worker 协议均为本项目新写代码；复用现有 Zod/React 与浏览器原生 API，无新增包或素材，锁文件保持。细节见[灯泡与电表模型](models/lamps-and-meters.md)。

任务 02 安装前核对 npm 官方元数据：React / React DOM 19.3.1、Zod 4.6.7、Vite 8.3.5、@vitejs/plugin-react 6.2.1、ESLint 10.14.0、@eslint/js 10.0.1、typescript-eslint 8.72.1、globals 17.14.0、eslint-plugin-react-hooks 7.1.1、@types/react 与 @types/react-dom 19.3.0 均标示 MIT；@playwright/test 1.64.1 标示 Apache-2.0。@types/node 选择与本机主版本一致的 24.19.2，实际 package.json 标示 MIT。TypeScript 保持 6.0.3。

安装后依据锁文件与实际包生成[完整依赖明细](third-party/DEPENDENCIES.md)，逐项列出名称、版本、来源、完整性、日期、范围、声明位置、作者/版权线索、使用/修改方式与核验限制。187 个锁定包中部分为其他平台可选项，当前未安装者不声称已核对其包内声明；未能确认的权利人继续保留待核验。运行 `npm run licenses` 更新台账，实际使用的 4 个运行时包（React、React DOM、scheduler、Zod）完整声明保存在 [public/THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt)，随构建复制，不为项目原创代码重新授权。


任务 11 安装后核对：官方 registry 元数据与唯一锁文件均固定 matter-js@0.20.0、@types/matter-js@0.20.2，均为 MIT；实际 LICENSE 分别声明 Liam Brummitt and contributors、Microsoft Corporation，原文完整保留。安装禁用生命周期脚本，未修改上游包。新增 2 包后共 189 个锁定包、5 个运行时包声明，完整清单继续由 licenses 生成；Matter.js 无新增运行时传递依赖，未引入可选凹多边形插件。版本/sha512/许可证文件哈希见[实际依赖记录](acceptance/m5-task11-dependencies.json)，实际使用方式见[适配决策](decisions/0014-m5-friction-matter-adapter.md)。

## 实际引入与发行清单

系统安装的 Node.js、npm、PowerShell 是本次检查及测试工具，不作为已打包分发的项目依赖。以下工具安装前已核对 npm 官方源元数据与上游许可证，安装后核对实际包内声明；不以研究参考代替授权审核。

| 名称 | 来源 URL | 版本/提交 SHA | 引入日期 | 文件/目录范围 | 许可证与权利人 | 引用/复制/修改/嵌入方式 | 保留的声明位置 | 修改说明 | 依赖及素材的例外 | 核验人 | 核验结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Matter.js | https://registry.npmjs.org/matter-js/-/matter-js-0.20.0.tgz | 0.20.0（固定，sha512 见锁文件） | 2026-11-04 | node_modules/matter-js；摩擦适配器 import；Vite 主包 | MIT；Liam Brummitt and contributors | npm 未修改原包，形状/接触静态表示；不采用其摩擦/轨迹作为教学模型 | node_modules/matter-js/LICENSE；public/THIRD_PARTY_NOTICES.txt；dist/THIRD_PARTY_NOTICES.txt | 未修改上游 | 不使用可选凹多边形插件，无外部素材 | Codex（工具核对） | 官方元数据、锁定完整性与实际版本/许可已核对；发行仍待维护者审查 |
| @types/matter-js | https://registry.npmjs.org/@types/matter-js/-/matter-js-0.20.2.tgz | 0.20.2（固定，sha512 见锁文件） | 2026-11-04 | node_modules/@types/matter-js，开发类型检查 | MIT；Microsoft Corporation（LICENSE 原文） | npm 类型声明；不复制到物理实现，不进入运行时 | node_modules/@types/matter-js/LICENSE；依赖明细 | 未修改上游 | 仅开发工具 | Codex（工具核对） | 官方元数据、实际版本和包内许可已核对 |
| TypeScript | https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz | 6.0.3（固定版本；完整性见 package-lock.json） | 2026-11-03 | node_modules/typescript；package.json、package-lock.json 中的开发依赖 | Apache-2.0；Microsoft Corporation（package.json 与 lib/typescript.js 文件头已核对） | npm 开发工具安装，仅用于类型检查；不复制其实现到物理模块 | node_modules/typescript/LICENSE.txt、node_modules/typescript/ThirdPartyNoticeText.txt（均存在并保留） | 不修改上游包 | 包内声明列出 DefinitelyTyped、Unicode、DOM/WHATWG、Web Background Synchronization、WebGL 等，保留完整 ThirdPartyNoticeText.txt；无 npm 传递依赖或项目运行时依赖 | Codex（工具核对） | 官方元数据、锁文件完整性、实际包版本及声明已核对；仅用于本地开发，发布产物审查尚未进行 |

锁定完整性：`sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==`。上游来源：[TypeScript](https://github.com/microsoft/TypeScript)；npm 安装未运行生命周期脚本。任务 01 时 `npm ls --all` 实测仅有 `typescript@6.0.3`，该包无 dependencies 字段；任务 02 完整依赖见新增明细。node_modules 不纳入源码，重新安装时保留上游原包声明。

## 研究参考（未引入）

下列仅从[实施方案第 3 章](implementation-plan.md#3-开源参考与许可证策略)登记研究方向。本任务未拉取源码、锁定版本、复核许可证或进行本地构建；不把方案记载当作本次授权核验结果。

| 名称与来源 | 研究方向 | 当前处理 |
| --- | --- | --- |
| [Ray Optics Simulation](https://github.com/ricktu288/ray-optics) | 透镜、光线与器件模型 | 未引入；复用前核验版本、文件和素材 |
| [CircuitJS1](https://github.com/pfalstad/circuitjs1) | 电路拓扑和求解思路 | 未引入；首版独立实现求解器 |
| [PhET](https://phet.colorado.edu/zh_CN/) | 教学探究与器材交互 | 未引入；不默认打包成品、源码或素材 |
| [myPhysicsLab](https://github.com/myphysicslab/myphysicslab) | 数值模型与测试方法 | 未引入 |
| [AtlasPhysics](https://github.com/Saadbarch/AtlasPhysics) | 拖放器材和整体交互 | 未引入 |
| [ScienceLab 3D](https://github.com/rudra496/sciencelab3d) | 后续视觉参考 | 未引入；不扩大首版二维范围 |
| [XIVIX Physics Virtual Lab](https://github.com/XIVIX-Official/physics-virtual-lab) | 页面和图表组织 | 未引入 |
| [Physics 101](https://github.com/wadekarg/physics_101) | 主题与探索活动组织 | 未引入 |
| [OpenLyceum OpticsLab](https://github.com/OpenLyceum/OpticsLab) | 光学自由搭建交互 | 未引入；首版不默认合入代码 |

## 维护规则

引入前锁定具体版本/提交，核对文件头、子目录、依赖和素材的例外，登记完整字段及实际保留声明的位置。仅阅读的项目留在研究参考；真正复制、修改、嵌入或随构建分发的内容进入实际清单。发布时还需核对构建产物；当前保留实际运行时声明，不编造根目录 NOTICE、权利人或整体发行授权通过结论。

2026-11-12 H-MECH-04 单摆：新增计算、交互和 SVG 为 jerryshi1968 授权的原创内容，无第三方程序、素材或依赖引入。仅参考 OpenStax University Physics 15.4 与 NIST DLMF 22.19 的物理/数学公式，链接见模型说明，未摘录原文或复制实现。
