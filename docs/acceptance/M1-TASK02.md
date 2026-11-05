# M1 / 任务 02 验收记录

日期：2026-11-03。结论：任务 02 的工程骨架与文档模型验收通过；整个 M1 仍需任务 03、04 的搭建、保存、重载与继续编辑。

## 实际交付

React/TS/Vite 中文空工作台，包含器材库、实验区域、属性/诊断、记录/图线/模型说明；新建空文档和面板键盘切换可用。未实现的保存/导入/导出/撤销/重做禁用，未提供假器材、示数或数据。正式器材注册表为空，测试用电阻仅存在于 tests/core。

SceneDocument、EquipmentDefinition/Instance、Pose2D、PortDefinition、Endpoint、Connection、Diagnostic 及运行时严格校验已实现。Zod schema 推导类型，核心不依赖 React/DOM；SI 单位集中转换。结构与引用检查拒绝未知字段、非有限数值、重复 ID、未知器材版本、非法参数/端口/能力和无证据的教材 verified 状态，不静默丢弃或修复参数。

## 环境与依赖

使用实际可用的 LAB-01 开发电脑：Intel Core i5-12450H、16,850,874,368 字节内存、Windows NT 10.0.26340.0、PowerShell 7.6.5、Node.js v24.14.1、npm 11.11.0。浏览器实际为本机 Edge 157.0.4341.36（Playwright channel=msedge，项目名 chromium 表示 Chromium 引擎系列），不是下载的 Playwright Chromium；Chrome 已安装但本任务未测试。详见[基准表](BASELINE.md)。

直接运行依赖：React / React DOM 19.3.1、Zod 4.6.7。直接开发依赖：TypeScript 6.0.3、Vite 8.3.5、@vitejs/plugin-react 6.2.1、ESLint 10.14.0、@eslint/js 10.0.1、typescript-eslint 8.72.1、eslint-plugin-react-hooks 7.1.1、globals 17.14.0、@playwright/test 1.64.1、@types/node 24.19.2、@types/react / @types/react-dom 19.3.0。完整锁定版本和许可见[187 项依赖台账](../third-party/DEPENDENCIES.md)。

## 实际检查与证据

| 检查/命令 | 实际结果与证据 |
| --- | --- |
| 官方 npm 元数据与安装 | 固定版本、license、engines/peerDependencies 已核对；禁用生命周期脚本，沿用唯一 npm 锁文件，未改全局镜像 |
| `npm ci --offline --ignore-scripts --no-audit --no-fund --cache .npm-cache` | 停止开发服务后按锁文件从本地缓存重装 162 包，退出码 0；首次获取仍需网络 |
| `npm run typecheck` | 退出码 0，纯核心/物理、React、工具/E2E 三份配置通过，见[输出](m1-task02-typecheck.txt) |
| `npm run lint` | 退出码 0，0 错误、0 警告，未运行自动修复/格式化，见[输出](m1-task02-lint.txt) |
| `npm test` | 退出码 0，74 通过、0 失败、0 跳过；49 项原物理基准 + 25 项核心测试 |
| 同一测试入口的 TAP 运行 | `node --test --test-reporter=tap "tests/physics/*.test.mjs" "tests/core/*.test.mjs"`，74/74 通过，见[TAP 原始证据](m1-task02-tests.tap) |
| `npm run build` | 退出码 0，Vite 生产构建成功，见[构建输出](m1-task02-build.txt)和[文件/大小/SHA256 清单](m1-task02-build-manifest.json) |
| `npm run licenses`（build 自动执行） | 187 个锁定包登记；4 个实际运行时包完整声明保留；public 与 dist 的 THIRD_PARTY_NOTICES.txt SHA256 相同 |
| `npm run dev` | Vite 开发服务成功启动于 127.0.0.1:5173，Invoke-WebRequest 得到 HTTP 200，曾打开本地预览；检查后已停止所启动服务 |
| `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e` | 重装/最终构建后退出码 0，4 项通过，见[命令输出](m1-task02-e2e.txt)与[原始 JSON](m1-task02-e2e.json)；预览服务正常回收 |

核心测试覆盖空/非空合法文档、输入/默认值拷贝、未知字段/版本、ID 唯一性、器材参数、注册定义隔离、端口与连接能力、测量原文/状态/单位/引用、课程待核验字段和 SI 换算。另验证带转换或丢字段的参数 schema 不得隐藏改写输入。原 49 个物理用例及源码保留，无用例跳过或删除。

收尾检查通过：原方案、AGENTS.md、原有 7 个物理源码与 7 个物理测试/辅助文件共 16 个文件 SHA256 与任务开始一致，原代码、注释及格式未改动。排除依赖、缓存、构建与临时测试输出后，80 个文本文件均为有效 UTF-8，89 个相对 Markdown 链接目标存在；构建清单、74/74 TAP 和 4/4 E2E 报告一致。未初始化 Git/CodeGraph，也未建立远端发布配置。

## 浏览器与截图

| 用例 | 实际验证 |
| --- | --- |
| 1366×768 | 四区与空态可见，无横向溢出；保存禁用，0 器材/连接/记录；无 pageerror 或外部资源请求 |
| 1920×1080 | 同上，桌面布局正常 |
| 键盘与新建 | 记录面板左右箭头/End 切换与焦点正确；新建后回到记录表、空场景与状态提示 |
| 390×844 | 主操作可见、无横向溢出，模型说明可切换；只是窄视口布局，不是真实触屏验收 |

桌面与窄屏截图均已人工目视检查：

- [1366×768 工作台](m1-task02-desktop.png)
- [1920×1080 工作台](m1-task02-large.png)
- [窄屏完整布局](m1-task02-narrow.png)

## 发现与修正

首次类型检查发现 E2E 浏览器 evaluate 回调需要 DOM 类型，已仅在工具/E2E 配置加入，纯 core 配置仍无 DOM。lint 发现面板索引多余初始赋值，已修正，未关闭规则。

首次 E2E 的 4 个页面用例通过，但 Windows 沙箱无法正常回收其预览子进程；结束本任务启动的服务器后退出，随后在允许正常管理自建进程的执行环境重跑成功并自动清理。未将卡住时的半程输出当作完成证据。

首次锁文件重装在开发服务仍运行时遇原生模块占用 EPERM，停止本任务预览后重装成功；最终 typecheck、lint、74 项测试、构建与 E2E 均基于成功重装后的环境。没有删除失败测试、绕过检查或改动上游包。

## 限制与下一任务

目前没有实际器材/连接交互、命令历史、导入导出/IndexedDB、完整求解器、仪表与测量图表。截图中的器材示意是空态插图，不是场景器材。文件字节级限制、安全解析/替换/迁移留到任务 04，数据采样和历史器材快照留到任务 07。

未执行 50 器材场景性能、5 分钟 FPS/P95、真实平板触屏、Chrome、离线断网或教师试用；无外部请求检查只适用于本次空工作台。正式原创许可、具体教师/教材、课堂默认模式与首版 Worker 决策仍待落实。下一项为任务 03：SVG 工作台器材放置与端口连接，不提前产生假电流或亮灯。
