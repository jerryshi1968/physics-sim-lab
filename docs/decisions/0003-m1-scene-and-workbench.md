# 0003：M1 工程骨架与场景文档契约

日期：2026-11-03。范围：任务 02；不实施器材拖放/接线、命令历史或文件导入导出。

## 工程与依赖

沿用 npm 11.11.0、Node.js v24.14.1 和唯一 package-lock.json，保持 TypeScript 6.0.3。React / React DOM 19.3.1、Vite 8.3.5 与 @vitejs/plugin-react 6.2.1 已按官方元数据核对 Node、peerDependencies 和实际构建兼容性。运行时校验唯一主规范为 Zod 4.6.7，不同时维护另一套 JSON Schema。

保留 Node 原生运行器及原有 49 项物理测试，新增直接导入 core 的测试；不为符合工具名重写成熟基准或额外引入 Vitest。浏览器使用 Playwright 1.64.1，ESLint 10.14.0 / typescript-eslint 8.72.1 / React Hooks 规则用于 lint；不启用自动格式化，不更改旧代码与注释。实际直接依赖、传递依赖与完整性见[授权明细](../third-party/DEPENDENCIES.md)。

核心 tsconfig 使用 lib=ES2023、types=[]，类型检查时无 DOM、React 或 Node 全局类型。app 配置单独加入 DOM 和 JSX；工具/E2E 配置加入 Node 与浏览器上下文所需类型。三份配置均纳入 typecheck；构建不会以 Vite 的语法转换替代类型检查。

UI 暂用 React 本地状态承载空文档和面板选择，不增加 Zustand。正式编辑命令层在任务 04 建立；届时再按实际共享状态需要决定状态管理方式。核心物理小样继续独立于 React/DOM，未改写原模块。

## 场景契约

SceneDocument schemaVersion=1，明确文档 ID、revision、标题、可空 experimentId、器材、连接、simulationConfig、measurementRecords、curriculumRef、provenance 与可选 viewport。未知字段严格拒绝，数值不做字符串转换，不补齐缺失字段，不替换参数。`createEmptyScene` 的理想模式、g=10 m/s²、dt=1/120 s、关闭随机误差只是可逆初始值，不是所有教学实验的最终默认。

校验分两层：SceneDocumentSchema 处理结构；validateSceneDocument 结合 EquipmentRegistry 检查跨集合 ID 唯一性、器材/定义版本/参数、端点/端口、已启用连接能力、端口类型与测量引用。成功返回独立数据副本，失败只返回不可采样的 Diagnostic，不携带部分有效文档。当前只接收已解析数据，不提供文件读取、JSON 字节大小检查、替换场景或迁移，这些留到任务 04。

注册表按 type+definitionVersion 索引，参数 schema 先注册、定义后注册；默认参数必须有效。对外读取返回深拷贝，端口在 TS 类型中为 readonly。即使参数 schema 本身带转换/默认或默认删除未知字段，只要解析结果与原参数有任何标量/键差异即拒绝，不隐藏修正。正式器材尚未注册；测试用 test.resistor 仅在 tests/core 中，不能出现在应用器材库。

连接类型预留 wire、rigid-mount、rope；默认只开启 wire 的模型能力，后两种尚未实现，验证时明确拒绝。wire 只接受 electrical-terminal，已启用的机械连接只接受 mechanical-anchor；光线交点不作为导线连接。此契约检查不求解电路，也不禁止重复导线后伪造一个新电路结果。

## 测量、教材与 SI

测量结构保留来源、原始手工文本、SI 值、设备 ID、量程/分辨率、时间、revision/runId/sequence、状态及配置快照；无效测量的 value=null，非稳态可保留带标签数值。当前校验要求测量引用本场景器材；任务 07 实现历史采样时需扩充器材/参数快照与历史引用策略，避免删除器材或改参数使旧记录失去依据，本任务不伪装已完成测量功能。

教材映射保留 pending_teacher_review、null 章节与审阅字段；verified 必须有版次、册次、章节、审阅人和日期，页码仍可空。字段校验只能检查证据结构，不能证明教师确实已审阅。

SI 单位模块集中处理长度、质量、时间、电流、电压、电阻、力、力矩、速度、加速度、角度和无量纲量；显示单位只在边界转换。同量纲才可换算，非有限输入/溢出拒绝；文档坐标为 m、角度为 rad，viewport 不改变物理参数。

## 工作台与未决项

本任务交付中文空工作台：器材库、实验区域、属性/诊断、记录/图线/模型说明。只启用新建空白实验与面板切换；未实现的保存、导入、导出、撤销/重做明确禁用。没有假器材、假电流或曲线。没有外部字体、CDN、账号、云存储或发布。

实际基准电脑已记录在[基准表](../acceptance/BASELINE.md)，本次只验证页面布局与构建，未测性能或真实触屏。正式原创许可、教师教材、课堂默认模式、首版 Worker 仍待落实；Worker 只在后续测量需要时启用，本任务无调度适配。下一项为任务 03，任务 04 完成保存/重载/继续编辑后再验收整个 M1。
