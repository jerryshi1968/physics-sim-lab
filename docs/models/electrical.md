# 电阻与灯泡串并联小样

实现：`src/physics/samples/electrical.ts`。接口：`solveResistors(topology, voltageV, resistancesOhm)`、`solveLamps(topology, voltageV, lamps, maxIterations=128)`。拓扑仅接受 series / parallel，由调用者明确指定，尚不读取器材连接图，不是 MNA。

## 符号、公式与假设

U 为电源电压（V，可正负），I 为从电源正参考方向流向负载的电流（A），R 为正电阻（Ω），P=UI（W）。所有支路统一参考方向，反向电源得到反向电流，负载耗散功率非负。假设理想直流源、无导线电阻、无仪表加载。

串联由 KCL 得到各负载电流相同，KVL 给出 U=ΣUi，故 I=U/ΣRi。并联各支路 Ui=U，Ii=U/Ri，总电流 I=ΣIi。电源输出功率等于负载功率之和。

灯泡采用 U=Rcold·I+a·I³（准静态经验模型），由额定点得 a=(Ur-Rcold·Ir)/Ir³，单位 V/A³。`LampSpec` 显式给出 `ratedVoltageV`、`ratedCurrentA`、`coldResistanceOhm`、`maxCurrentA`；要求 Ur/Ir/Rcold>0、a≥0、maxCurrentA≥Ir，且均为有限数。maxCurrentA 是本小样人为配置的模型边界，不是测得的熔断电流。

由于 dU/dI=Rcold+3aI²>0，串联可先相加 Rcold 与 a，再对唯一电流求根；并联对各支路分别求根。以 [0,maxCurrentA] 二分，再恢复电源符号；串联上界取各灯允许电流的最小值。电压残差达到 `1e-12 V + 1e-12×|U|` 时结束，迭代数要求为 1～1024 的整数，默认 128。这个受限求根不代替后续一般网络的阻尼 Newton/MNA。

## 独立基准与容差

以下输入与预期值来自方案第 8.2 节及代数手算，测试直接写入常量，不调用求解器生成预期值。灯泡演示均配置 maxCurrentA=0.6 A。

| 输入 | 手算预期 |
| --- | --- |
| 3 V；10 Ω、20 Ω 串联 | R总=30 Ω；I=0.1 A；U1=1 V、U2=2 V；P总=0.3 W |
| 同两电阻并联于 3 V | I1=0.3 A、I2=0.15 A、总电流 0.45 A；支路各 3 V |
| 两灯各 Ur=3 V、Ir=0.3 A、Rcold=2 Ω | a=(3-0.6)/0.027=800/9 V/A³ |
| 上述两灯串联于 6 V | I=0.3 A，各灯 3 V、0.9 W |
| 上述两灯并联于 3 V | 支路各 0.3 A，I总=0.6 A，各灯 0.9 W |
| 第二灯改为 Ur=1 V、Ir=0.3 A、Rcold=1 Ω，串联于 4 V | 第二灯 a=700/27 V/A³；I=0.3 A，电压分别 3 V 和 1 V |
| 第二灯改为 Ur=3 V、Ir=0.15 A、Rcold=10 Ω，并联于 3 V | 第二灯 a=4000/9 V/A³；电流分别 0.3 A、0.15 A，总电流 0.45 A |

内部电压/电流基准容差为 `1e-9 + 1e-6×|expected|`，分别以 V/A 为单位。测试独立代入上述明确系数检查灯泡关系，而不复用生产代码中的系数函数；另用 1.7 V 的不同灯泡网络验证非额定点。KCL、KVL、非线性及功率归一化残差均 ≤1e-6：

- 电流分母 `max(1 A, |总电流|+Σ|支路电流|)`；零电流仍检查绝对差。
- 电压分母 `max(1 V, |电源电压|+Σ|支路电压|)`；单元件关系分母 `max(1 V, |Ui|, |Rcold·Ii+a·Ii³|)`。
- 功率分母 `max(1 W, |电源功率|+Σ|支路功率|)`。

## 无效状态与范围

空负载、未知拓扑、非正电阻、非法灯泡参数、非有限输入分别返回参数诊断。电流边界内不存在根时为 `LAMP_MODEL_RANGE`，迭代未达标为 `NON_CONVERGENCE`；运算非有限为 `NUMERIC_RANGE`，都不返回正常读数。电阻零值不隐式替换为小电阻。零电压与反向电源是有效基准。

本任务不实现开关/导线图、浮置/冗余源诊断、电表量程、发光 UI、真实热惯性或烧毁，不能据此宣称完整电路验收通过。

## 实际验证

`node --test tests/physics/electrical.test.mjs` 对应 9 项测试；整体运行与证据见[任务 01 验收记录](../acceptance/M0-TASK01.md)。
