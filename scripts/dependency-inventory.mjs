import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const lock = readJSON('package-lock.json');
const manifest = readJSON('package.json');
const rows = [];
const runtimeNotices = [];
const visited = new Set();

function cell(value) {
  return String(value ?? '待核验').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
}

function packageName(location) {
  return location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

function inspect(location, entry) {
  const directory = path.join(root, location);
  const installed = fs.existsSync(path.join(directory, 'package.json'));
  const metadata = installed ? readJSON(`${location}/package.json`) : null;
  if (metadata && metadata.version !== entry.version) throw new Error(`Version mismatch: ${location}`);
  const noticeFiles = installed ? fs.readdirSync(directory).filter(name =>
    /^(licen[sc]e|copying|notice|thirdparty)/i.test(name) && fs.statSync(path.join(directory, name)).isFile()) : [];
  return { installed, metadata, noticeFiles, directory };
}

function resolveDependency(fromLocation, name) {
  let directory = path.join(root, fromLocation);
  while (directory.startsWith(root)) {
    const location = path.relative(root, path.join(directory, 'node_modules', name)).replaceAll('\\', '/');
    if (lock.packages[location]) return location;
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  throw new Error(`Unresolved runtime dependency: ${name}`);
}

function collectRuntime(location) {
  if (visited.has(location)) return;
  visited.add(location);
  const entry = lock.packages[location];
  const { installed, metadata, noticeFiles, directory } = inspect(location, entry);
  if (!installed || noticeFiles.length === 0) throw new Error(`Missing runtime license: ${location}`);
  const header = `${metadata.name}@${metadata.version}\nSource: ${entry.resolved}\nLicense: ${metadata.license}\n`;
  runtimeNotices.push(header + noticeFiles.map(file =>
    `\n--- ${file} ---\n${fs.readFileSync(path.join(directory, file), 'utf8')}`).join('\n'));
  for (const name of Object.keys(metadata.dependencies ?? {})) collectRuntime(resolveDependency(location, name));
}

for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!location) continue;
  const { installed, metadata, noticeFiles } = inspect(location, entry);
  const author = typeof metadata?.author === 'string' ? metadata.author : metadata?.author?.name;
  const copyright = noticeFiles.flatMap(file => {
    const text = fs.readFileSync(path.join(root, location, file), 'utf8');
    return text.split(/\r?\n/).filter(line => /^\s*(?:\*\s*)?Copyright\s*(?:\(c\)|©|[0-9])/i.test(line));
  }).slice(0, 2).join('; ');
  rows.push([packageName(location), entry.version, entry.resolved, entry.integrity,
    new Date().toISOString().slice(0, 10), location, metadata?.license ?? entry.license,
    copyright || author || '待核验（保留包内声明）', entry.dev ? '开发工具；npm 原包安装；未修改' : '运行时；Vite 打包；未修改',
    noticeFiles.map(file => `${location}/${file}`).join('; ') || '当前平台未安装或根目录无独立声明，待发行复核',
    entry.optional ? '平台可选包；只核对实际安装内容' : '未复制包实现到项目源码',
    installed ? 'Codex：实际版本/元数据/声明位置核对；版权不明处仍待核验' : 'Codex：仅锁文件记录，当前平台未安装，未核验包内声明'].map(cell).join(' | '));
}

for (const name of Object.keys(manifest.dependencies ?? {})) collectRuntime(resolveDependency('', name));
for (const name of ['vite', 'rolldown']) {
  const location = resolveDependency('', name);
  const { metadata, noticeFiles, directory } = inspect(location, lock.packages[location]);
  if (!metadata || !noticeFiles.length) throw new Error(`Missing emitted-helper notice: ${name}`);
  runtimeNotices.push(`${metadata.name}@${metadata.version}\nSource: ${lock.packages[location].resolved}\nRole: emitted modulepreload or CommonJS/ESM runtime helpers only; not all build dependencies.\n` +
    noticeFiles.map(file => `\n--- ${file} ---\n${fs.readFileSync(path.join(directory, file), 'utf8')}`).join('\n'));
}

fs.mkdirSync(path.join(root, 'docs/third-party'), { recursive: true });
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/third-party/DEPENDENCIES.md'),
  '# 依赖授权与完整性明细\n\n由 `npm run licenses` 根据唯一锁文件和实际安装包生成。版本、来源与完整性以 package-lock.json 为准；当前平台未安装的可选包仅登记锁文件，不宣称完成包内核验。每项保留上游声明，未修改上游包；权利人不能确认的字段保持待核验。此表是本地依赖盘点，后续发行仍须核对具体构建产物和素材。\n\n' +
  '| 名称 | 版本 | 来源 URL | sha512/完整性 | 核对日期 | 范围 | 许可证 | 权利人/作者（包内声明或元数据） | 使用方式与修改 | 声明位置 | 例外 | 核验结论 |\n' +
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n' +
  rows.map(row => `| ${row} |`).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'),
  'Third-party runtime notices\nOriginal upstream notices are retained below. This file does not license project-authored code.\n\n' +
  runtimeNotices.join('\n\n========================================\n\n') + '\n');
for (const file of ['LICENSE', 'NOTICE', 'LICENSING.md']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing project licensing file: ${file}`);
  fs.copyFileSync(path.join(root, file), path.join(root, 'public', file));
}
console.log(`Recorded ${rows.length} locked packages; retained complete notices for ${visited.size} runtime packages.`);
