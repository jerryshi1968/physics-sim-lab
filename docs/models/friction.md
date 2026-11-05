# 水平一维静/滑摩擦小样

以下保留 M0 代数小样说明；任务 11 的事件积分、匀速/控力、Matter.js 适配与完整实验已见[正式模型](friction-experiment.md)。

实现：`src/physics/samples/friction.ts`。接口：`evaluateFriction(input)`；是给定瞬时状态的代数受力计算，不是时间积分器。x 正向为正速度和正拉力方向。

## 符号、假设与公式

输入 massKg=m（kg，>0）、gravityMPerS2=g（m/s²，>0）、staticCoefficient=μs、kineticCoefficient=μk（无量纲，μs≥μk≥0）、velocityMPerS=v（m/s）和 pullN=Fpull（N）。限水平拉力与无竖直加速度的水平接触面，故 N=mg；测力计对应真实 Fpull，不由鼠标拖速换算。

静止 v=0 且 |Fpull|≤μsN 时，Fs=-Fpull、a=0，状态 static；静摩擦只匹配需求，不总取最大值。超过阈值时开始滑动，方向按拉力；v≠0 时方向按速度，即使拉力已反向也不改变瞬时摩擦方向。滑动摩擦 `Fk=-sign(v)·μkN`，`a=(Fpull+Fk)/m`。

滑动净力在 `1e-9 N + 1e-9×max(|Fpull|,μkN)` 内标为 sliding-steady，否则 sliding-accelerating；始终输出实际净力与加速度，不把误差阈值内的小净力强行抹零。

## 手算基准与容差

| g（m/s²） | m（kg） | μk | N（N） | 正向匀速时摩擦力（N） | 牵引力（N） |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.5 | 0.2 | 5 | -1 | 1 |
| 10 | 1.0 | 0.2 | 10 | -2 | 2 |
| 10 | 0.5 | 0.4 | 5 | -2 | 2 |

以上由 N=mg、|Fk|=μkN 手算，测试直接断言常量，力的绝对误差 ≤1e-6 N。μs=0.5、m=0.5 kg 时静摩擦上限 2.5 N：静止拉 0.4 N 时摩擦 -0.4 N；拉 2.5 N 可保持静止；拉 2.6 N 时滑动摩擦为 -1 N、净力 1.6 N、加速度 3.2 m/s²。若 v>0 而拉力为 -1 N，摩擦仍为 -1 N，加速度 -4 m/s²。

## 状态边界与限制

本代数小样用精确 v=0 表达外部已确认的静止状态，非零的 1e-12 m/s 仍作滑动；避免任意速度 epsilon 掩盖运动，不宣称已解决动态过零抖动。任务 11 必须加入事件/步长与状态保持策略、步长收敛、稳定窗口和 Matter.js 一致性测试。本任务没有积分、过零自动停住、Matter.js、复杂接触、斜拉、表盘量程或面积 UI。接触面积不作为本受限公式的输入，后续保持质量/材料不变时才作对照。

非法质量/重力/系数、非有限输入为 `INVALID_FRICTION_PARAMETERS`；溢出为 `NUMERIC_RANGE`，不携带读数。非稳态结果明确标记状态，不能当作匀速摩擦测量。

## 实际验证

`node --test tests/physics/friction.test.mjs` 对应 8 项测试，覆盖三组稳态、静止匹配、阈值、反向、近零分类及非法输入。证据见[任务 01 验收记录](../acceptance/M0-TASK01.md)。
