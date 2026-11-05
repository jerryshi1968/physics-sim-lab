# 项目协作规则

[代码修改与重构核心规则]
1. 🚨 严格保持注释不被删除：在修改、重构或优化任何代码文件时，严禁删除、精简或修改代码中现有的任何中文或英文注释（包括形如 `// 1. 全局中间件配置` 的结构化序号注释、单行注释、块注释以及行尾注释）。
2. 注释迁移：如果因逻辑调整必须修改某一行代码，请务必将该行原有的行尾注释完整保留，并迁移到修改后的新代码之后或上方。
3. 保持原文：只做用户显式要求的逻辑修改，未变动部分的代码、空格、换行和格式必须保持 100% 原文不动，不要进行自作聪明的“代码美化”或“清理”。

在 Windows PowerShell 5.1 环境中读取文本文件时，必须显式使用 `Get-Content -Encoding UTF8`；不要仅因默认 `Get-Content` 输出乱码就判断文件编码有问题。
<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell (Windows)**: `& 'C:\Users\jerryshi68\AppData\Roaming\npm\codegraph.ps1' explore "<symbol names or question>"` prints the same output. If the sandbox denies access to the global npm script, retry with escalated execution and request reusable approval for this exact command prefix. Do not conclude that CodeGraph is unavailable merely because `Get-Command codegraph` fails.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## 实施与验收

1. 开始任务前读取 `docs/implementation-plan.md` 和 `docs/PROGRESS.md`，按第 15 章一次完成一个可验收任务，不顺带实施下一阶段。
2. 检查现有结构及用户修改，不覆盖用户工作；不为了通过测试删除失败用例，不生成假验收报告。
3. 每个任务交付最小必要改动；超出范围的问题记录为后续事项，除非它阻断当前任务。
4. 完成后更新 `docs/PROGRESS.md`，记录实际检查、限制、待核验事项和下一任务；阶段变更记入 `docs/CHANGELOG.md`。
5. 物理计算统一 SI，模型假设和独立预期值记录在 `docs/models/`；无效模型状态不输出正常读数。
6. 不复制未经核验授权的代码或素材。引入第三方内容前更新 `docs/THIRD_PARTY.md`，保留原声明。
7. 教材版次、章节、页码未经教师核验时保持 `pending_teacher_review`，不编造审阅人、日期或通过结论。
