# 独立直流 MNA（M2 / 任务 05）

当前扩展版本为 dc-mna.v2，新增灯泡迭代、电表显示及浏览器调度，详见[任务 06 模型](lamps-and-meters.md)。以下保留任务 05 线性基础与历史范围。

任务 05 模型版本：dc-mna.v1。日期：2026-11-04。范围为线性、准静态直流网络，不含灯泡迭代、AC/RLC 瞬态、保护动作、仪表显示或测量记录采样。原 M0 [电学小样](electrical.md)保留不变，独立基准不调用本求解器生成。

## 入口与真实连接图

纯核心位于 src/core/electrical，默认器材适配器位于 src/equipment/electrical/dcAdapters.ts，均不依赖 React/DOM。

```ts
import { createElectricalRegistry } from '../../src/equipment/electrical/definitions.ts';
import { createDcModelAdapters } from '../../src/equipment/electrical/dcAdapters.ts';
import { compileDcScene, solveDcScene } from '../../src/core/electrical/compile.ts';
import { solveDcNetlist } from '../../src/core/electrical/solve.ts';

const registry = createElectricalRegistry();
const adapters = createDcModelAdapters();
const compiled = compileDcScene(sceneDocument, registry, adapters);
const result = solveDcScene(sceneDocument, registry, adapters);
const standalone = solveDcNetlist({
  terminals: ['p', 'n'],
  branches: [
    { id: 'E', kind: 'voltage-source', from: 'p', to: 'n', voltageV: 3, resistanceOhm: 0 },
    { id: 'R', kind: 'resistor', from: 'p', to: 'n', resistanceOhm: 10 },
  ],
});
```

代码示例从 docs/models 所在层级展示导入路径；可直接运行的完整示例为 `node scripts/dc-mna-demo.mjs`。SceneDocument 先执行原有完整校验，再按注册表中的 modelAdapterId 找适配函数。旧定义的 `.uncompiled.v1` 标识保留以兼容现有文档，由新映射解析；不改用户器材、端口、保存格式或实验 ID。

默认支持已注册电源、电阻、开关、历史 junction。实例端口以 equipmentId/portId 对组成真实端子键，连接根据 from/to 建支路；标题、experimentId、器材绘图坐标/转角、视口、曲线和颜色不决定接法。非电学或未知 adapter、无效参数/端口、未知连接种类明确失败，不跳过器材。

一端或两端自由的导线保留为 open 支路及独立虚拟自由端，输出零电流和 OPEN_CONNECTION，不能合并两个器材端子。这只描述工作台端口的接线状态，不提供对悬空导线内部电势的测量模型。没有端口连接的几何交叉不导通。

默认 SceneDocument 适配只承诺 ideal 配置；apparatus 目前返回 UNCONFIGURED_APPARATUS_MODE，不能把没有显式内阻的场景冒充器材模式。有限电源/导线/接触/仪表电阻已由独立 netlist API 支持；正式仪表定义、器材模式参数 UI 和调度属于任务 06 后续接入。

## 元件、方向与单位

每个支路具有唯一 id、from、to。端子电压 V=Vfrom−Vto（V），电流 I 正向 from→to（A），端口功率 P=V·I（W）采用被动符号约定。电源正常供电时 I、P 为负；输出电流为 −I。内部始终保留双精度，不先按仪器分辨率取整。

| kind | 必填物理参数 | 约定 |
| --- | --- | --- |
| resistor | resistanceOhm>0，有限 | I=V/R |
| wire | resistanceOhm≥0，有限 | 0 时并查集合并，正值显式加载 |
| switch | closed，resistanceOhm≥0 | 断开时 I=0，闭合零阻合并；正值为显式接触电阻 |
| voltage-source | voltageV 有限，可带符号；resistanceOhm≥0 | V−R·I=E，R=0 为理想源 |
| current-meter | resistanceOhm≥0 | 0 时保留零伏电压源及未知电流，不并入导线；正值为电流表加载 |
| voltage-probe | inputResistanceOhm=null 或有限正值 | null 为不加载的理想测量，正值等同输入电阻 |
| open | 无 | 显式开口，I=0，不参与分量连通 |

成功返回 `{ok:true, solution, diagnostics}`，solution 包括 modelVersion、分量参考、每个合并节点的端子、支路电压/电流/功率和残差。voltage-source 另含 internalLossW=R·I² 与 emfPowerW=E·I；端口功率是含内耗后的整体源端口功率，能量校验不能再把内耗重复加到端口功率和中。

并查集合并的理想线/开关没有单独求支路电流，返回 currentA=null、currentStatus=not-observable、measurementUsable=false，功率为 0；不能显示假零电流。电流表必须使用独立 current-meter 支路才能得到电流。电压测量是否可用取 voltage-probe 的 measurementUsable/voltageStatus，其余支路的 measurementUsable 表示电流可用；消费者同时检查对应物理量状态，不能把未知值当 0。

## 分量、参考与异常

1. 对零阻 wire 和闭合零阻 switch 合并端子；重复导线/线环标记 REDUNDANT_IDEAL_LINK，不制造假电阻。
2. 正阻支路、电压源、电流测量支路和有限输入电阻建立电气连通分量；开关断开、open 和理想电压探针不连通分量。
3. 各分量分别选择数值参考，优先取按 ID 排序第一个源的负端，否则取最小端子节点。只定义电势零点，不向学生网络添加接地线。
4. 节点 voltageV 只相对本分量参考，不能跨分量直接相减。跨浮置分量理想探针的 voltageV=null、measurementUsable=false，诊断 UNDEFINED_VOLTAGE；其他已确定电流/电压仍保留。普通开路的两端若仍通过其他元件属于同一分量，其电压可确定，例如开关断开两端可为 3 V。
5. 对理想电压约束图检查环路：非零电源两端被理想线合并为 IDEAL_SOURCE_SHORT；一致冗余约束为 REDUNDANT_IDEAL_SOURCE 或 ZERO_RESISTANCE_LOOP，不一致为 INCONSISTENT_VOLTAGE_CONSTRAINT。即使某些节点电压可确定，源环电流不唯一时仍拒绝整个正常解。

失败返回 `{ok:false, measurementUsable:false, diagnostics}`，不带 solution，不返回部分读数、Infinity 或 NaN；每次重新计算，没有旧值缓存。电压约束环一致性阈值为 1e-12 V + 1e-10×相关电压最大绝对值；合并节点上的非零理想电源严格拒绝，包括很小的非零电动势。

有限内阻短路仍有有限解：E=3 V、r=0.5 Ω，I=-6 A、端口电压 0、内耗 18 W、理想源电动势功率 -18 W。它不自动代表仪器超量程/保护跳闸，这些是下一阶段的模型与显示状态。

## MNA 与数值实现

对每个分量构造 `A·x=b`，未知量为非参考节点电压和电压型支路电流。电阻电导 g=1/R 在对角加 g、两节点间交叉项减 g；源支路对 KCL 的 from/to 电流系数为 +1/-1，其约束行为 Vfrom−Vto−R·I=E。理想电流表 E=0、R=0，有限内阻源在自身电流对角为 -R。

上述 MNA 矩阵分块和电导/电压源盖章规则的理论核对依据为 [Qucs 官方技术文档](https://qucs.github.io/tech/node14.html)。本项目自行实现拓扑、盖章、主元消元和诊断，没有复制 Qucs、CircuitJS1 或其他项目源码/素材，不采用显式求逆，也不添加 gmin 或隐藏微小电阻。

矩阵先行、列均衡缩放，再做部分主元高斯消元；回代后还原变量尺度。均衡后的主元绝对值为 0 时 SINGULAR_MATRIX，小于 1e-12 时 ILL_CONDITIONED_MATRIX；非有限系数、中间/最终越界返回 NUMERIC_RANGE，不伪造有限解。原矩阵保持，重新计算相对后向残差 `|Arow·x−brow| / (Σ|Aij·xj|+|bi|)`，零分母取绝对误差，超过 1e-8 失败。

输入结构限制 1800 个端子（新增四柱变阻器后覆盖 200 个四端器材与 500 根双自由端导线）、2000 条支路，每个分量最多 256 个未知量，超出限额在电压约束路径诊断和矩阵分配前返回 NETWORK_TOO_LARGE；多个小分量独立求解。不承诺任意病态、大规模或极端量级网络均达到基准精度；可疑病态/溢出会拒绝，后续大规模性能需另测。

## 残差和独立预期值

小型、尺度适当的线性网络按方案第 11.2 节：`|actual−expected|≤1e-9+1e-6·|expected|`，各量使用自身 SI 单位。归一化残差不得超过 1e-6：

- 节点 KCL：绝对电流不平衡 / max(1e-9 A，节点关联可解支路电流绝对值和)，在合并后的节点上检查，参考点也检查。
- 支路本构/KVL：`|V−R·I−E| / max(1e-9 V, |V|+|R·I|+|E|)`；非源 E=0，开口和无独立电流的理想合并线不作电阻式盖章。节点电压差天然满足回路求和；桥式测试另独立检查回路电压和。
- 端口功率平衡：`|ΣP| / max(1e-9 W, Σ|P|)`；所有分量共同检查。

这里 A/V/W 各自有独立参考尺度，不用一个无单位 epsilon 混用所有物理量。还输出 kclA、powerBalanceW 及线性残差，便于复核，不等同仪器误差或学生读数。

| 独立手算输入 | 预期结果 |
| --- | --- |
| 3 V，10 Ω+20 Ω 串联 | I=0.1 A，U1=1 V，U2=2 V，源输出 0.3 W |
| 3 V，10 Ω∥20 Ω | I1=0.3 A，I2=0.15 A，源输出 0.45 A，均 3 V |
| 3 V 源内阻 0.5 Ω、负载 9.5 Ω | I=0.3 A，端电压 2.85 V，内耗 0.045 W |
| 3 V 源内阻 0.5 Ω、理想短接 | 短路 6 A，端口 0 V，内耗 18 W |
| 10 V，10 Ω 串联 10 Ω，探针输入 10 Ω 并在后者 | 输入并联后为 5 Ω，探针 10/3 V、1/3 A；理想探针为 5 V、0 A |
| 10 V 桥：pa/an/pb/ab 各 10 Ω，bn=20 Ω | 由 3Va−Vb=10、−Va+2.5Vb=10，Va=70/13 V、Vb=80/13 V；ab 电流 -1/13 A，源输出 11/13 A |

预期值直接写在测试中，不通过调用本实现生成。测试还覆盖 12 V 平衡桥、双源吸收功率、反接、零电压、无源孤岛、浮置测量、开路、短路、源环、电流支路零阻环、冗余线、输入异常、矩阵大小/主元、有限范围大小电阻及布局不变量。

## 任务 06 接入边界

linear.ts 导出 createLinearSystem、stampAffineConductance、stampVoltageBranch、solveLinearSystem。局部线性化支路可写为 `I≈G·V+I0`，stampAffineConductance 接收电导 S 和偏置电流 A（from→to），按 KCL 写入系统；已用独立 3 V、0.1 S、0.1 A 偏置的测试验证源电流 -0.4 A。

下一任务需在此边界实现灯泡本构与导数、阻尼 Newton、迭代上限、全非线性残差及失败禁用采样；不能只用线性后向残差判定非线性收敛。当前未知 lamp kind/adapter 会失败，不用恒阻替代灯泡。仪表量程/分辨率/指针、revision/runId/sequence 回包保护另在任务 06，实现前浏览器不展示假电流。

实际验证和产物见[任务 05 验收](../acceptance/M2-TASK05.md)。
