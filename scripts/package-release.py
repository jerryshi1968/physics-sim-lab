"""Create deterministic local-review source and offline archives from reviewed inputs."""
import hashlib
import json
import posixpath
from pathlib import Path
import re
import runpy
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
if VERSION != '0.1.0-rc.1':
    raise RuntimeError('This packager is gated by frozen task-15 evidence for 0.1.0-rc.1; prepare new release evidence before packaging a later version.')
OUT = ROOT / 'artifacts' / ('release-' + VERSION)


def sha(data):
    return hashlib.sha256(data).hexdigest().upper()


def inputs():
    for name in ['LICENSE', 'NOTICE', 'LICENSING.md']:
        data = (ROOT / name).read_bytes()
        if (ROOT / 'public' / name).read_bytes() != data or (ROOT / 'dist' / name).read_bytes() != data:
            raise RuntimeError('Stale licensing copy; rebuild: ' + name)
    result = runpy.run_path(str(ROOT / 'scripts/release-audit.py'))['audit']()
    for channel in ['edge', 'chrome']:
        report = json.loads((ROOT / f'docs/acceptance/m7-task15-{channel}.json').read_text(encoding='utf-8-sig'))
        stats = report['stats']
        if stats['expected'] < 86 or any(stats[key] for key in ['unexpected', 'skipped', 'flaky']):
            raise RuntimeError('Incomplete browser checks: ' + channel)
    tap = (ROOT / 'docs/acceptance/m7-task15-tests.tap').read_text(encoding='utf-8')
    passed = re.search(r'(?:ℹ|#)\s+pass\s+(\d+)', tap)
    if not passed or int(passed.group(1)) < 302 or not re.search(r'(?:ℹ|#)\s+fail\s+0\b', tap):
        raise RuntimeError('Incomplete core/model checks')
    return result


def source_files():
    names = {'README.md', 'CONTRIBUTING.md', 'LICENSE', 'NOTICE', 'LICENSING.md', 'package.json', 'package-lock.json', '.gitignore', 'index.html', 'eslint.config.mjs', 'vite.config.ts', 'playwright.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.tools.json'}
    for folder in ['src', 'tests', 'scripts', 'public']:
        names.update(file.relative_to(ROOT).as_posix() for file in (ROOT / folder).rglob('*') if file.is_file() and '__pycache__' not in file.parts and file.suffix in {'.ts', '.tsx', '.mjs', '.py', '.css', '.json', '.html', '.md', '.txt'} | {''})
    for file in (ROOT / 'docs').rglob('*.md'):
        relative = file.relative_to(ROOT).as_posix()
        if relative in {'docs/PROGRESS.md', 'docs/implementation-plan.md'} or relative.startswith('docs/history/'):
            continue
        if relative.startswith('docs/acceptance/') and file.name not in {'TEACHER-TRIAL.md', 'BASELINE.md'}:
            continue
        names.add(relative)
    return {name: (ROOT / name).read_bytes() for name in sorted(names)}


def readable_docs(files):
    changes = {}
    for name, data in list(files.items()):
        if not name.endswith('.md'):
            continue
        original = data.decode('utf-8-sig')

        def replace(match):
            href = match.group(3)
            if re.match(r'^(?:https?:|mailto:|#|/)', href):
                return match.group(0)
            path = href.split('#')[0]
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), path))
            if not path or target in files:
                return match.group(0)
            return f'{match.group(2)}（未随候选包分发的本机历史/生成文件：{path}）'

        text = re.sub(r'(!?)\[([^\]]*)\]\(([^)\s]+)\)', replace, original)
        if text != original:
            text = '> 候选包文档整理：未收录的本机历史链接改为路径说明，未制作替代验收数据；公式正文和代码文件不因打包改写。\n\n' + text
            files[name] = text.encode('utf-8')
            changes[name] = {'originalSha256': sha(data), 'packagedSha256': sha(files[name]), 'reason': 'Replace links to intentionally omitted local evidence with explicit path descriptions.'}
    return changes


def check_files(files):
    for name, data in files.items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name or name.startswith(('.env', 'node_modules/', '.npm-cache/', 'test-results/')):
            raise RuntimeError('Unsafe package path: ' + name)
        if name.endswith(('.md', '.ts', '.tsx', '.mjs', '.py', '.css', '.txt', '.json', '.html')):
            text = data.decode('utf-8-sig')
            if re.search(r'(?i)[A-Z]:[\\/]Users[\\/]|sandbox\.\{[0-9a-f-]{20,}', text):
                raise RuntimeError('Local environment path must not be published: ' + name)


def archive(kind, files, modifications):
    check_files(files)
    prefix = f'cn-physics-lab-{VERSION}-{kind}'
    manifest = {'version': VERSION, 'author': 'jerryshi1968', 'license': 'Apache-2.0', 'status': 'local-review-candidate-not-published', 'kind': kind, 'gates': {'secondTeacher': 'pending', 'textbookMappings': 'pending_teacher_review', 'physicalDevices': 'pending'}, 'documentationTransforms': modifications, 'files': [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(files.items())], 'manifestSelfHash': 'Excluded to avoid a circular digest.'}
    package_files = {**files, 'BUILD-MANIFEST.json': (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')}
    target = OUT / (prefix + '.zip')
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=False) as stream:
        for name, data in sorted(package_files.items()):
            info = zipfile.ZipInfo(prefix + '/' + name, date_time=(2026, 11, 5, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            stream.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(target) as stream:
        if stream.testzip() is not None:
            raise RuntimeError('Archive CRC failure')
    return {'path': target.relative_to(ROOT).as_posix(), 'sha256': sha(target.read_bytes()), 'bytes': target.stat().st_size, 'manifest': manifest}


def main():
    audited = inputs()
    OUT.mkdir(parents=True, exist_ok=True)
    source = source_files()
    modifications = readable_docs(source)
    static = {file.relative_to(ROOT).as_posix(): file.read_bytes() for file in (ROOT / 'dist').rglob('*') if file.is_file()}
    for name in ['LICENSE', 'NOTICE', 'LICENSING.md', 'scripts/serve-dist.mjs']:
        static[name] = (ROOT / name).read_bytes()
    static['README.md'] = (ROOT / 'docs/releases/OFFLINE-README.md').read_bytes()
    for file in (ROOT / 'docs/releases').glob('*.md'):
        static[file.relative_to(ROOT).as_posix()] = file.read_bytes()
    candidates = [archive('source', source, modifications), archive('offline', static, {})]
    summary = {'version': VERSION, 'author': 'jerryshi1968', 'runtimeCount': audited['runtimeCount'], 'emittedHelperProviders': audited['emittedHelperProviders'], 'localOnly': True, 'excluded': ['node_modules', 'npm caches', 'raw acceptance logs/screenshots/baseline archives', 'local AGENTS instructions', 'internal implementation plan/progress', 'previous artifacts', 'environment files and credentials'], 'archives': candidates}
    (OUT / 'RELEASE-CONTENTS.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (OUT / 'SHA256SUMS.txt').write_text(''.join(item['sha256'] + '  ' + Path(item['path']).name + '\n' for item in candidates), encoding='utf-8')
    print(json.dumps({'version': VERSION, 'archives': [{'path': x['path'], 'bytes': x['bytes'], 'files': len(x['manifest']['files']), 'sha256': x['sha256']} for x in candidates]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
