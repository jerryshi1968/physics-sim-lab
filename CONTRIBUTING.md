# 贡献指南

当前工作区为 0.2.0-dev.1；冻结候选 v0.1.0-rc.1 不含任务 16 扩展。项目原创代码、文字和 SVG/CSS 使用 Apache-2.0，署名 jerryshi1968。提交前确认有权按该许可贡献；第三方内容保留原许可并先登记 docs/THIRD_PARTY.md，不复制未经核验的代码、图片、字体或教材扫描。

## 本地检查

使用 Node 24（实测 24.14.1）和 npm 11.11.0。在源码目录执行：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Chrome 使用 channel=chrome。首次安装需要联网或完整 npm 缓存；E2E 使用已构建的 dist 和独立 4173 端口。不要在测试时另占 4173，或在浏览器回归过程中重建 dist。Windows 的目录联接安全用例需允许在测试专用临时目录创建联接；受限沙箱的 EPERM 不代表允许删除用例或跳过校验。

保持所有已有中文/英文注释原文，包括序号、行尾和块注释；逻辑移动时完整迁移。只改当前问题，无关空格、换行和格式保持原样。物理统一 SI，假设、范围、坐标、符号和独立预期写入 docs/models；无效状态不得沿用正常读数。先检查已有用户工作，不用删除失败用例换取通过。

## 增加或修改器材

1. 在对应 equipment 领域中注册类型、定义版本、严格参数 schema、默认值与端口。不要在 UI 内另建一份物理参数或坐标定义。
2. 明确模型适配器、坐标/翻转、接线或挂接、范围/超限状态；复用同一 SVG 工作台、即时属性、预览取消和原子历史。
3. 仪表区分物理真值、按分度显示和学生录入，注明量程、分度、有限阻抗与异常。图与拟合读取记录，不把理论值填入学生表。
4. 覆盖有独立预期的模型检查和必要交互回归。新材质/代码先登记准确版本、来源、引入范围、修改与声明文件。

## 增加或修改实验

使用独立实验 ID、学段、问题、器材清单、空白搭建、操作建议、空记录表、可关闭提示/理论、控制变量和模型限制。只有新流程时复用现有器材/求解器，不复制另一套工作台。首批六项必须保持四个初中、两个高中完整回归。

教材版次、册次、章节、页码及 reviewedBy/reviewedAt 必须来自实际核验；未知时为空并保持 pending_teacher_review。不能以一次工程测试或另一学段通过替代两学段教师试用。不得默认收集学生身份数据或加入联网追踪。

## 报告与交付

描述具体触发、之前/之后行为、复现步骤、独立预期、实际检查、影响和限制。保留失败证据，更新 PROGRESS/CHANGELOG 和相应模型；不要编造通过、教师或授权记录。工作区若有 CodeGraph 索引先用它定位，否则不自动创建索引。

源码候选包以所附清单为准，省略本机指令、缓存和原始验收历史。生成包与 node_modules 不作为源码提交。发布前可执行 `python scripts/release-audit.py` 和 `python scripts/package-release.py`（实测 Python 3.13.12，无第三方 Python 包）；缺少锁定原包时只在明确允许联网后使用 `release-audit.py --fetch`。这些是维护者审核工具，教学电脑运行静态包不需要 Python/npm。

源码仓库为 [jerryshi1968/physics-sim-lab](https://github.com/jerryshi1968/physics-sim-lab)，主分支为 main。项目源码同步至用户指定仓库；版本标签、GitHub Release 和网页部署另按维护者实际授权执行。本机候选 ZIP、缓存和历史压缩备份不随 Git 上传。

维护者出包工具读取本机的任务 15 新验收文件；这些原始日志不会跟随源码包。复核时需先实际执行上面的检查，并将 npm test 的 UTF-8 输出保存到 docs/acceptance/m7-task15-tests.tap，将两浏览器各自的 test-results/results.json 分别复制为 docs/acceptance/m7-task15-edge.json 和 m7-task15-chrome.json，再运行审查/打包。不得复制旧结果冒充新验证。教学使用只运行静态 HTTP，不涉及这些维护者文件。

任务 16 起工作区为开发版：旧 package-release.py 只允许 0.1.0-rc.1，当前会明确拒绝出包，防止用旧日志给新实验背书。未来版本需要单独准备对应版本的完整验证和打包门槛；不要修改版本号绕过该检查。
