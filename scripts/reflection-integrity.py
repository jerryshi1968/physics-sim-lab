"""Check task-16 changes against the saved task-15 workspace, without changing it."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
sha = lambda data: hashlib.sha256(data).hexdigest().upper()
baseline = json.loads((ROOT / 'docs/acceptance/m8-task16-before.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(ROOT / 'docs/acceptance/m8-task16-before.zip') as archive:
    changed = []
    same = []
    comments = []
    newline_changes = []
    for row in baseline:
        name = row['path']
        old = archive.read(name)
        assert sha(old) == row['sha256'], name
        path = ROOT / name
        assert path.is_file(), name
        current = path.read_bytes()
        (same if sha(current) == row['sha256'] else changed).append(name)
        if name.endswith(('.ts', '.tsx', '.mjs')):
            comments.append({'path': name, 'before': old.decode('utf-8'), 'after': current.decode('utf-8')})
        if b'\r\n' not in old and b'\r\n' in current:
            newline_changes.append(name)
    old_lock = json.loads(archive.read('package-lock.json'))
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
    assert {k: v for k, v in old_lock['packages'].items() if k} == {k: v for k, v in lock['packages'].items() if k}

scan = r"""
import ts from 'typescript';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const comments=text=>{const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.JSX,text),result=[];for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan())if(kind===ts.SyntaxKind.SingleLineCommentTrivia||kind===ts.SyntaxKind.MultiLineCommentTrivia)result.push(scanner.getTokenText());return result;};
const rows=JSON.parse(raw),changed=rows.filter(row=>JSON.stringify(comments(row.before))!==JSON.stringify(comments(row.after))).map(row=>row.path);
process.stdout.write(JSON.stringify({filesChecked:rows.length,commentChanges:changed}));
"""
check = subprocess.run(['node', '--input-type=module', '-e', scan], input=json.dumps(comments), text=True, encoding='utf-8', capture_output=True, cwd=ROOT, check=True)
comment_report = json.loads(check.stdout)
assert not comment_report['commentChanges'], comment_report
assert not newline_changes, newline_changes
original = json.loads((ROOT / 'docs/acceptance/m7-task15-build-manifest.json').read_text(encoding='utf-8'))
worker = next(row for row in original if 'electrical.worker' in row['path'])
assert sha((ROOT / worker['path']).read_bytes()) == worker['sha256']
archives = []
for name, expected in [('source', 'A356AD49F598251182CED3C599DBC950BDBFBB782F9694D6A0C7A906F0F3F693'), ('offline', '713D875FD4A57B42883872256A6DCE5EB5447D5387E748C9A4B6B51EADDDF9EF')]:
    path = ROOT / f'artifacts/release-0.1.0-rc.1/cn-physics-lab-0.1.0-rc.1-{name}.zip'
    actual = sha(path.read_bytes())
    assert actual == expected, name
    archives.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': actual, 'unchanged': True})
manifest = [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in sorted((ROOT / 'dist').rglob('*')) if p.is_file()]
report = {'baselineFiles': len(baseline), 'unchangedFiles': len(same), 'changedFiles': changed, 'comments': comment_report, 'newlineChanges': newline_changes, 'lockedThirdPartyPackagesUnchanged': len(lock['packages']) - 1, 'electricalWorkerUnchanged': worker, 'frozenReleaseArchives': archives, 'build': manifest, 'ok': True}
target = ROOT / 'docs/acceptance/m8-task16-integrity.json'
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k not in ['build', 'frozenReleaseArchives']}, ensure_ascii=False, indent=2))
