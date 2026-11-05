# M0 / 任务 01 验收记录

日期：2026-11-03。结果：任务 01 数学小样验收通过；正式实验、教材与发布验收未执行。

## 环境与范围

目录：G:\physics-sim-lab；Windows、PowerShell 7.6.5；Node.js v24.14.1、npm 11.11.0、TypeScript 6.0.3。未将此开发环境认定为性能基准电脑，CPU、浏览器和触屏等仍见[待填基准表](BASELINE.md)。当前无 Git 仓库，不能给出提交 SHA。

物理实现是六类纯 TypeScript 小样；测试通过 Node 原生运行器直接导入这些模块，无 React、DOM、Worker 或外部物理引擎。测试的基准期望来自方案和独立手算常量，不由被测函数生成；代数残差、斜率和能量检查在测试侧独立计算。

## 实际命令与结果

| 命令 | 实际结果 |
| --- | --- |
| `npm view typescript@6.0.3 version license repository.url dist.integrity dist.tarball --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=15000 --cache .npm-cache --json` | 官方元数据取得 6.0.3、Apache-2.0、tarball 和 sha512；沙箱网络受限后使用获准网络执行 |
| `npm install --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=20000 --cache .npm-cache` | 退出码 0，新增 1 包，无生命周期脚本 |
| `npm ls --all` | 退出码 0，仅 typescript@6.0.3，无 npm 传递依赖 |
| `npm ci --offline --ignore-scripts --no-audit --no-fund --cache .npm-cache` | 退出码 0，按锁文件从本地缓存重装 1 包 |
| `npm run typecheck` | 退出码 0，tsc --noEmit 通过，见[原始输出](m0-task01-typecheck.txt) |
| `npm test` | 修复后退出码 0，49 项通过、0 失败、0 跳过 |
| `node --test --test-reporter=tap "tests/physics/*.test.mjs"` | 重装后退出码 0，49 项通过、0 失败、0 跳过，见[TAP 原始输出](m0-task01-tests.tap) |
| `npm run sample` | 退出码 0，输出实际计算的六域控制台示例 |
| `node scripts/physics-samples.mjs` | 退出码 0，保存为[原始 JSON](m0-task01-samples.json)并解析检查所有基准状态、焦点 null 和 0.5 s 落地 |

首次尝试系统默认镜像查询未得到结果；直接在沙箱查询官方源遇 EACCES。最终官方源查询/安装成功，未将失败尝试算作成功证据，未修改全局镜像配置。

收尾文件检查：排除 node_modules 与 .npm-cache 后共 45 个项目文件均通过严格 UTF-8 解码，57 个相对文档链接目标存在。原实施方案 SHA256 仍为 `D3FA15DF8A21C0128BC31D1DA6B7A8F346823F508FE4FAA77ACB7B3BE7D172AD`，AGENTS.md 仍为 `88A6B36512E4523A8DF946A8ECB2FB714B1C5CE36CBE7820FBE08AFE4671C31E`；两者字节未改动。唯一锁文件及 TypeScript 完整性、包内声明检查通过，未生成 M1 页面或配置。

## 测试覆盖与独立基准

| 测试文件（tests/physics/） | 数量 | 验证内容 |
| --- | --- | --- |
| electrical.test.mjs | 9 | 3 V 电阻串并联、6 V/3 V 灯泡配置、不同灯泡、非额定点、KCL/KVL/功率及三次关系、反向/零电压、非法参数、范围、不收敛 |
| optical.test.mjs | 8 | f=0.10 m 五类成像、焦点两侧、有限 JSON、非法输入、极端比值 |
| lever.test.mjs | 6 | ±0.20 N·m、支点反力、2 N 竖拉/4 N 斜拉/0.05 m 力臂、失衡、零力臂、方向、平移旋转及无支撑 |
| friction.test.mjs | 8 | 三组稳态、静摩擦需求匹配、阈值及突破、反向/制动、精确零速与近零速分类、无效参数 |
| spring.test.mjs | 9 | 五点伸长与总长、20 N/m 斜率、盘质量、卸载、线性与载荷边界、过渡/无支架/非法参数 |
| projectile.test.mjs | 9 | 三时刻位置/速度/能量、0.5 s 落地/1 m 射程、跨帧截断、初态冻结、零初速、地面平移、30/60 FPS 计划及非法输入 |

## 发现并修复的问题

首轮 47 项测试中 45 通过、2 失败：杠杆反力的 -0 在 JSON 往返时变成 0；平抛的分拆平方根计算使落地时间略大于 0.5 s。保留测试并修正反力求差与落地公式，另补发射初时刻和极端透镜比值测试，最终 49 项全部通过。未删除或跳过失败用例。

## 限制与下一阶段

没有完整电路拓扑求解、光屏离焦、摩擦积分/过零状态保持、Matter.js 适配、器材/文档模型、测量表、仪表 UI、保存加载或 Web 应用。30/60 FPS 检查仅是解析采样计划，不是实际渲染性能。无 lint、E2E 或 Web build 脚本，不声称这些检查通过。

正式原创代码许可、设备、教师与教材、课堂默认模式和首版 Worker 决策仍待落实。数学小样门槛已通过，M0 立项未决保留；下一任务为 02（M1 项目骨架与文档模型），不得将本记录视作六个正式实验的验收。
