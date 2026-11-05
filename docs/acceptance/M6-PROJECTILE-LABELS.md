# M6 / 平抛缩放文字修订

日期：2026-11-05。按用户截图修复二维标尺名称、单位说明和发射器名称放大后相互重叠的问题；未实施任务 14。

只修改 SceneBoard.tsx 中两行平抛专用名称位置：标尺名称按器材缩放后的文字高度留出上方间隔，发射器名称放到实物左侧并右对齐，避开横/竖零刻度。未改文字内容、字号、刻度、物理、装配、运行时钟、记录或存储，没有新依赖/素材；原注释和其余代码原文保持。[两行差异](m6-projectile-labels-diff.txt)、[完整性](m6-projectile-labels-integrity.json)。

实际检查：

- 最终生产构建（含三份 TS 类型检查）与 lint 均退出 0。[构建](m6-projectile-labels-build.txt)、[lint](m6-projectile-labels-lint.txt)、[构建哈希](m6-projectile-labels-build-manifest.json)。主包约 705.56 kB，原 500 kB 提示保留。
- 最终平抛原有 5 项 Edge 浏览器流程全部通过，0 失败/跳过/重试，15.3 秒；覆盖装球/取消、冻结/重发、计时与落地、记录/图/导出重载及软件触摸。[输出](m6-projectile-labels-e2e.txt)、[JSON](m6-projectile-labels-e2e.json)。本次纯显示定位修订未重跑全量 297 项单元/模型或 84 项全量浏览器，不以此前结果冒充本次运行。
- 在真实 Edge 157.0.4341.36 中使用滚轮、缩放按钮及平移，检查 1920/1366/390 px 窗口、17%～400% 缩放共 54 次文字边界；标尺名称与单位说明最小间距 15 px，发射器名称与所有标尺文字无交叉。[实际边界数据](m6-projectile-labels-layout.json)。截图已目视检查：[桌面 45%](m6-projectile-labels-1920-45.png)、[1366 px / 45%](m6-projectile-labels-1366-45.png)。放大时超出画布的内容仍按视口裁切，可平移查看。
- 首次间距修正的 5 项流程通过，但边界专项发现 303% 下仅剩约 5.04 px，小于 6 px 检查门槛；增加世界坐标间距后，在最终构建重跑专项及全部五个流程。[首轮间距结果](m6-projectile-labels-layout-first.json)、[首轮流程](m6-projectile-labels-e2e-first.json)。

原方案、AGENTS.md、package.json 与唯一锁文件均保持；教材、课堂、实体触屏和其他浏览器未新增核验。本次仅处理任务 13 的显示反馈，下一阶段仍为任务 14。
