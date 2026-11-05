# M7 / 任务 15 实际验收

日期：2026-11-05。范围：开源许可、实际来源/构建审查、贡献/模型/六实验说明、v0.1.0-rc.1 本地候选包与真实验证。交付准备完成；未上传、打标签或远端发布，不把教师/实体设备待核验门槛改成通过。

## 授权与范围

维护者在本对话选择 Apache-2.0，确认项目原创代码、文字和实物风格 SVG 均由其授权且无其他人享有权利，并指定署名 **jerryshi1968**。已写根 LICENSE、NOTICE、LICENSING.md，package 版本为 0.1.0-rc.1、license=Apache-2.0、author=jerryshi1968，private=true 保留防止意外 npm 发布。锁文件只改顶层和根包元数据，189 项依赖内容完全保持。

LICENSE 为[Apache 官方原文](https://www.apache.org/licenses/LICENSE-2.0.txt)，11358 字节、SHA256=CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30；未套用 ASF 项目专属版权头，未改原文，不为第三方重新授权。[实际取得记录](m7-task15-license-source.json)、[范围](../../LICENSING.md)、[决策 0018](../decisions/0018-m7-candidate-license-and-release.md)。

## 实际来源与构建审查

五个业务运行时包之外，产物前部实际含 Vite modulepreload 兼容代码、Rolldown CommonJS/ESM 辅助函数。已补齐这两个已有构建工具的完整许可；不新增依赖、不改物理/工作台代码。Vite 的 98 kB LICENSE.md 含构建器附带的其他声明，全文保留，不把其中每个包都误列为浏览器实际依赖。

| 提供方 | 固定版本 | 与官方锁定原包比较的文件数 | 分发角色 |
| --- | --- | --- | --- |
| matter-js | 0.20.0 | 38 | application-runtime |
| react | 19.3.1 | 27 | application-runtime |
| react-dom | 19.3.1 | 43 | application-runtime |
| rolldown | 1.2.16 | 54 | emitted-build-helper-provider |
| scheduler | 0.28.0 | 15 | application-runtime |
| vite | 8.3.5 | 37 | emitted-build-helper-provider |
| zod | 4.6.7 | 840 | application-runtime |

七个 npm 原包全部核对锁定 SHA512，1054 个普通文件与安装内容逐字节相同，0 修改/缺失。Matter.js 本地缓存没有原包，重新从锁定的官方 registry URL 取得并先验 SHA512；其余使用完整性匹配的 npm 内容缓存。所有完整许可逐字包含于 public/THIRD_PARTY_NOTICES.txt，构建原样复制，旧五包声明保留。[审查 JSON](m7-task15-audit.json)、[完整台账](../THIRD_PARTY.md)、[189 项依赖](../third-party/DEPENDENCIES.md)。

src/public 未发现外部图片、字体、音视频文件，实物为原创内联 SVG/CSS；用户需求截图未入产品。源码、测试和工具中凭据模式扫描无命中；源码候选只收审查清单，不带本机 AGENTS/路径、环境文件、缓存、node_modules、原始测试日志/截图、内部进度/方案或旧构建。此为有限模式检查与实际来源核对，不宣称能自动排除所有可能的秘密或权利争议。

## 新交付与内容整理

- [CONTRIBUTING.md](../../CONTRIBUTING.md)：器材定义/schema/端口、实际模型/分度/采样、实验 ID/学段/空白搭建、教材 pending、注释保护、实际验证与维护者出包流程。
- [六实验演示](../releases/DEMO-GUIDE.md)、[模型摘要](../releases/MODEL-SUMMARY.md)、[已知限制](../releases/KNOWN-LIMITATIONS.md)、[发布说明](../releases/v0.1.0-rc.1.md)、[公开验证摘要](../releases/VALIDATION.md)；详细模型和原独立预期保持。
- [源码 ZIP](../../artifacts/release-0.1.0-rc.1/cn-physics-lab-0.1.0-rc.1-source.zip)、[离线 ZIP](../../artifacts/release-0.1.0-rc.1/cn-physics-lab-0.1.0-rc.1-offline.zip)、[SHA256SUMS](../../artifacts/release-0.1.0-rc.1/SHA256SUMS.txt)、[内容清单](../../artifacts/release-0.1.0-rc.1/RELEASE-CONTENTS.json)。

源码 ZIP 保持全部程序/测试字节，省略不应分发的本机历史；模型等文档仅将指向省略文件的历史链接改为明确路径说明，清单同时保留原文/包内文档 SHA256。没有生成假图片/报告占位，也没有改本机原模型文档来掩盖历史。包内 BUILD-MANIFEST 不哈希自身以避免循环。打包器固定 ZIP 元数据、校验 CRC 与每文件哈希；最终实际包数与重现结果见[候选包核对](m7-task15-package-check.json)。

离线包预装 Node 后，在解压目录运行 `node scripts/serve-dist.mjs`，打开 http://127.0.0.1:8080/；无需 npm、Python 或 node_modules，不能双击 HTML。源码出包维护者工具另用 Python 3.13.12 标准库，不新增 Python 依赖。

## 实际新运行的检查

| 检查 | 结果及证据 |
| --- | --- |
| 核心/物理 | 302/302，0 失败/跳过。[TAP](m7-task15-tests.tap) |
| 三份类型 + 生产构建 | 退出 0；221 模块，JS 705.65 kB，原 500 kB 提示保留。[输出](m7-task15-build.txt) |
| lint / Python 工具语法 | 退出 0；新增打包工具实际执行。[lint](m7-task15-lint.txt) |
| Edge 全量 | 86/86，0 失败/跳过/重试；安装版 158.0.4370.1，约 3.6 分钟。[JSON](m7-task15-edge.json)、[输出](m7-task15-edge.txt) |
| Chrome 全量 | 86/86，0 失败/跳过/重试；安装版 153.0.8010.48，约 3.5 分钟。[JSON](m7-task15-chrome.json)、[输出](m7-task15-chrome.txt) |
| 来源与完整声明 | 1054 个官方原包文件匹配，五业务包+两辅助代码提供方；0 外部产品媒体。[结果](m7-task15-audit.json) |
| 源码独立解压安装 | `npm ci --ignore-scripts --prefer-offline` 安装 164 个当前平台包，锁文件未重解，未运行生命周期脚本。[输出](m7-task15-source-install.txt) |
| 源码独立重建与测试 | 302/302 再次通过；重建全部 8 文件与主工作区逐字节一致。[TAP](m7-task15-source-tests.tap)、[构建](m7-task15-source-build.txt)、[比较](m7-task15-source-rebuild.json) |
| 静态 ZIP 自身 CLI | 解压目录没有 node_modules；纯 Node 本机 HTTP 的 8 个资源均 200 且 SHA256 正确，含 Worker 与完整声明。[结果](m7-task15-offline-cli.json) |
| 静态 ZIP 两浏览器 | Edge/Chrome 各 18 项六实验/视口、键盘/保存重载与独立软件触摸入口通过；禁缓存、阻断全部非 loopback 请求。[摘要](m7-task15-offline-summary.json)、[Edge](m7-task15-offline/m7-task14-smoke-msedge.json)、[Chrome](m7-task15-offline/m7-task14-smoke-chrome.json) |

业务 JS/Worker/CSS 和上一阶段相同，本轮两浏览器仍实际重跑；后来补充的声明只增加静态文本，最终包另做完整资源校验。源码首次解压后的应用源码和测试与最终包相同；后续仅整理交付说明/审核工具和文档，包清单分别核对，不用不一致的 UI 构建替代最终产物。

## 11.6 逐项门槛

| 计划项 | 实际状态 |
| --- | --- |
| 六项从空白工作台完成 | 真实完整回归通过，包含原生放置/接线/挂接；不是不可编辑动画 |
| 四初中、两高中与原清单一致 | 六 ID/模板/模型/操作均覆盖；未漏弹簧、平抛 |
| 灯泡、力臂斜拉、弹簧原长/范围、平抛尺/时钟/落地 | 模型与流程检查通过；实际边界继续公开 |
| 模板同接口、数值/异常/持久化/端到端 | 工程通过，旧快照/保护保留 |
| 无假数据/隐藏纠正、不沿用异常旧读数 | 独立预期、缺失/超限/学生值与真值分离；示例不是学生实测 |
| 教材主题与具体教材 | 待逐项教师审阅，pending_teacher_review 和空审阅字段保持 |
| 至少两名教师及两学段 | 当前一名自述兼教两学段的总体反馈；第二位和逐条结论仍待补，不宣称已邀请 |
| 教师反馈阻断项 | 未收到具体教师问题；M7 工程发现的摩擦状态问题已修复并回归，不虚构教师通过 |
| 保存/导入/导出/历史/错误恢复 | 工程通过，当前浏览器/地址源隔离及不续跑边界已说明 |
| 性能/触屏/投屏/离线真实记录 | 既有本机 317.86 s 长测保留；本轮重测两浏览器、指定视口/布局缩放、软件触摸和解压离线；实体设备/多小时仍待补 |
| 原创/第三方许可及声明 | 用户已明确授权 Apache-2.0 / jerryshi1968，实际分发七提供方原包和声明核对；未分发未安装可选开发包代码 |
| README 启动/构建/部署/模型/贡献 | 已完善，候选有独立离线说明与六实验指南 |
| 无个人数据/密钥/未授权教材 | 允许清单不含学生数据、本机路径/环境、教材扫描；敏感模式检查无命中，未夸大扫描能力 |

## 完整性、限制与下一步

本轮不修改 src、既有测试、物理公式或模型参数，不新增依赖。根包/锁文件仅候选元数据改变；原锁条目、原方案与 AGENTS.md 保持。脚本改动只为完整声明随构建、复用检查时隔离输出和候选审查/打包；原有全部代码注释保留。精确文件数、原注释与产物哈希见[完整性](m7-task15-integrity.json)、[注释检查](m7-task15-comments.json)。

当前是可审核本地候选，不是课堂/正式发布全部通过。仍需第二位教师、逐项教材、实体触屏/投影及维护者对候选包的人工审核；已记录已知限制，未修饰旧堆增长或 500 kB 提示。是否上传、建仓库、打标签或发布远端须按用户实际授权另行处理；本次未执行，未进入任务 16。
