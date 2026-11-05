# 中学物理实验室 v0.1.0-rc.1

Copyright 2026 jerryshi1968。原创代码、文字及 SVG/CSS：Apache-2.0；第三方包保留各自许可，完整声明见 LICENSE、NOTICE、LICENSING.md 和 dist/THIRD_PARTY_NOTICES.txt。

这是本地审核候选静态包，不是课堂/正式发行全部通过的声明。完整解压，并提前安装 Node.js（实测 24.14.1）。在解压目录运行：

```powershell
node scripts/serve-dist.mjs
```

用 Edge 或 Chrome 打开 http://127.0.0.1:8080/ 。终端保持运行，Ctrl+C 结束；端口占用可加 `--port 8081`，改用相应地址。无需 npm、node_modules、Python 或外网，不要双击 dist/index.html。服务器只监听本机，未安装 PWA。

首次进入可选六实验或从空白搭建。演示步骤见 docs/releases/DEMO-GUIDE.md，范围见 docs/releases/MODEL-SUMMARY.md，限制和验证见 docs/releases/KNOWN-LIMITATIONS.md 与 VALIDATION.md。

保存属于同一浏览器和地址源；从开发地址或其他电脑迁移前请导出 JSON，在本地址导入。文件不恢复动态续跑时刻；重要数据另留 JSON/CSV 备份。更新时更换整份 dist，不混装不同构建的哈希资源。

一名兼教两学段教师的总体反馈已记录；第二位教师、逐项教材和实体设备仍待核验。本候选包未上传远端。BUILD-MANIFEST.json 和随附 SHA256 清单供本地核对。
