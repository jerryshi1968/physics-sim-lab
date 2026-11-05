# 0002：无 UI 小样的最小工具链与边界

日期：2026-11-03。范围：M0 / 任务 01；补充[立项基线](0001-m0-project-baseline.md)，不改变原方案或任务 00 的历史证据。

## 已落实

沿用 Node.js v24.14.1、npm 11.11.0，固定唯一开发依赖 TypeScript 6.0.3，生成 npm lockfileVersion 3 的 package-lock.json。查询 npm 官方源版本、许可、tarball 和 integrity 后安装，禁用生命周期脚本。系统默认 npm 镜像未用于锁定下载；本项目锁文件的 resolved 指向 registry.npmjs.org，未改全局 npm 配置。

使用 Node 24 内置类型擦除直接运行仅含可擦除语法的 .ts 纯函数，测试和控制台驱动使用 .mjs 与 node:test / node:assert，无需 tsx、Vitest、@types/node、React 或物理引擎。tsconfig 的 lib 仅 ES2023，不引入 DOM；开启严格检查和 erasableSyntaxOnly。Node 不进行类型检查，必须另跑 `npm run typecheck`；测试 .mjs 不属于 TypeScript 检查范围。

仅提供 typecheck、test、sample 脚本。尚无 lint、test:e2e、build 或 dev，任务 02 再建立应用所需脚本。原创新模块仅放入 src/physics/samples，便于后续按领域整合，尚不承诺正式场景或求解器 API。

`npm ci --offline --ignore-scripts --no-audit --no-fund --cache .npm-cache` 已使用本地缓存重装成功；随后类型检查与 49 个测试通过，证明锁文件可用于独立重装。首次获取依赖仍需网络，不能把本机缓存成功写成首次离线安装保证。Node 运行模型/测试不需要 node_modules；类型检查需要安装 TypeScript。

## 明确的数学小样边界

- 电学只计算指定的串并联组；灯泡用单调方程二分求根，不提前实现完整 MNA、连接图或调度。
- 光学只做薄透镜分类与数值，不替代光屏离焦和实际读尺。
- 杠杆只做给定点/分力与理想支点的静力矩，方向由向量给出。
- 摩擦只做一维瞬时代数分类，精确零速表示外部已确认静止，不宣称积分过零无抖动或 Matter.js 已适配。
- 弹簧只做有效范围内静态平衡，范围/载荷与支撑/过渡状态均显式配置。
- 平抛保存发射初态并解析采样，按事件时间截断落地，不提前实现计时器 UI、暂停调度或碰撞。

## 未决项与 M0 门槛

六实验卡、课程映射待核验字段、授权台账和独立可运行数值基准已具备，M0 的数学小样门槛通过。立项未决项仍明确保留：正式原创代码许可、实际基准电脑、具体教师与教材、课堂默认理想/器材模式及首版 Worker 是否启用。本任务只确认小样理想、无随机误差、直接函数调用，不把这些默认当作整个首版的最终决定。后续任务可按方案推进可逆实现，不宣称教师或发布验收通过。
