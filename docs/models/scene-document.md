# 场景文档与核心模型说明（M1 / 任务 02）

任务 07 在格式 2 中增加可选 measurementSnapshots、测量 context/correctedAt，旧格式 2 原样读取，格式 1 严格拒绝这些新字段；测量引用、采样标签/配置和历史器材/连接均校验，详见[测量契约](measurements-and-export.md)。

任务 04 已实现格式 1→2 的严格迁移、5 MiB JSON 防护、IndexedDB 与命令历史，见[当前契约](history-and-persistence.md)；本文后续“待任务 04”内容保留为早期模型范围，不再表示当前未实现。文档整体校验现也拒绝同一端口自连。

任务 03 已在此结构上增加正式电学器材注册表与编辑/连接交互，见[工作台说明](workbench.md)；本文的空器材库描述保留为任务 02 历史范围，默认 EquipmentRegistry 类自身仍为空。

任务 03 用户修订现将 schemaVersion 更新为 2，Connection 的 from/to 可空并分别要求对应 freeFromWorldM/freeToWorldM；未接好的线头不能产生有效电气连接。最新契约及 v1 迁移边界见[修订决策](../decisions/0005-m1-physical-apparatus-and-loose-wires.md)，本文后续的版本 1 描述保留为历史记录。

场景、器材、连接和诊断定义位于 src/core，运行时 Zod schema 与 TS 推导类型同源。核心没有 React/DOM 依赖；物理小样继续位于 src/physics/samples，不根据实验 ID 或画面位置输出答案。

| 入口 | 职责 |
| --- | --- |
| `core/scene/schema.ts` | SceneDocument、SimulationConfig、MeasurementRecord、课程映射的严格 schema 和类型 |
| `core/scene/create.ts` | 由调用者提供 documentId、ISO 时间，创建无器材/连接/记录的合法空文档 |
| `core/scene/validate.ts` | 结构校验 + 注册表能力/版本/参数 + 连接/测量引用检查 |
| `core/equipment/schema.ts` | EquipmentDefinition/Instance、PortDefinition、Pose2D、有限标量 |
| `core/equipment/registry.ts` | 版本化定义和参数 schema 注册，默认参数检查，读取时防外部修改 |
| `core/connections/schema.ts` | Endpoint、Connection、世界坐标路线与连接类型 |
| `core/diagnostics/diagnostic.ts` | 严重度、器材 ID、messageKey、measurementUsable 与错误路径 |
| `core/units/units.ts` | 带单位 Quantity、量纲识别、同量纲转换与 toSI |

## 纯核心调用示例

```typescript
import { EquipmentRegistry } from './src/core/equipment/registry.ts';
import { createEmptyScene } from './src/core/scene/create.ts';
import { validateSceneDocument } from './src/core/scene/validate.ts';
import { toSI } from './src/core/units/units.ts';

const registry = new EquipmentRegistry();
const scene = createEmptyScene('scene.example', '2026-11-03T08:00:00.000Z');
const validation = validateSceneDocument(scene, registry);
const length = toSI({ value: 10, unit: 'cm' });
// validation.ok 为 true；length 为 { value: 0.1, unit: 'm' }。
```

此示例使用固定输入，便于在 Node 中独立运行，不依赖 UUID、浏览器时钟或 DOM。UI 才负责提供实际 ID 与时间。正式器材库当前为空；注册测试定义的完整例子见 tests/core/fixtures.mjs，不当作正式电阻实现。

## 成功、失败和不变量

`validateSceneDocument(unknown, registry)` 成功为 `{ ok: true, document }`，document 是结构解析后的独立副本；失败为 `{ ok: false, diagnostics }`，每条包含稳定 code、路径、受影响器材和 measurementUsable=false，不返回部分文档。错误码包括 SCHEMA_INVALID、DUPLICATE_ID、UNKNOWN_EQUIPMENT_VERSION、INVALID_EQUIPMENT_PARAMETERS、UNSUPPORTED_CONNECTION_KIND、DANGLING_ENDPOINT、UNKNOWN_PORT、INCOMPATIBLE_PORT、DANGLING_MEASUREMENT 和 FUTURE_MEASUREMENT_REVISION。

未知 schemaVersion/未知字段、NaN/Infinity、重复 ID、负/字符串器材参数和无效连接不会被忽略或自动修复。顶层暂以 200 器材、500 连接、10000 条记录为结构上限，导入前的 5 MiB 字节限额与安全解析流程仍在任务 04。当前 schema 不接受动态运行状态，重载从初态重跑的存储功能尚未实现。

参数 schema 的解析结果必须与输入逐键、逐标量一致，拒绝类型强制转换、静默丢键和自动修正；不同器材可在一个注册表中拥有独立参数约束。注册表读出副本不会改变原定义、端口或默认值。

手工文本与数值分存；SI 单位必须匹配测量量纲；量程 max>min、分辨率>0；无效状态不可携带正常值，non-steady 数值可保留标签。模型配置是快照，非动态引用。这里建立结构基础，尚无采样、数据表编辑或图线；历史设备删除后的记录追溯留到任务 07 完整实现。

## 单位基准

10 cm=0.1 m，25 g=0.025 kg，120 ms=0.12 s，300 mA=0.3 A，2 kΩ=2000 Ω，180°=π rad；单元测试以这些独立常量检查，绝对误差 ≤1e-12（按目标单位）。负数和零允许按量纲换算，具体器材的正值约束由参数 schema 负责。m 与 N 互换、未知单位、非有限值或运算溢出抛出明确 RangeError，不能用屏幕像素冒充米。

## 验证与阶段边界

运行 `npm run typecheck`、`npm run lint`、`npm test`。新增核心测试覆盖合法/非法文档、深拷贝、版本、参数不自动转换、端口与能力、手工原文/状态/量纲、课程待核验及 SI 换算；原有 49 项物理基准保持独立。实际结果见[任务 02 验收记录](../acceptance/M1-TASK02.md)。

空工作台可通过 `npm run dev` 查看。本任务不具备拖放、接线、命令历史、文件导入导出、测量采样或完整求解；这些边界与后续扩展点见[决策记录](../decisions/0003-m1-scene-and-workbench.md)。
