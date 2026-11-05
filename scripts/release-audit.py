"""Audit the local release inputs without changing installed packages."""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tarfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


def digest(data):
    return hashlib.sha256(data).hexdigest().upper()


def audit(fetch=False):
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    runtime = set()

    def dependency(name, parent=''):
        directory = ROOT / parent
        while True:
            location = (directory / 'node_modules' / name).relative_to(ROOT).as_posix()
            if location in lock['packages']:
                return location
            if directory == ROOT:
                raise RuntimeError('Unresolved dependency: ' + name)
            directory = directory.parent

    def visit(location):
        if location in runtime:
            return
        runtime.add(location)
        metadata = json.loads((ROOT / location / 'package.json').read_text(encoding='utf-8'))
        for name in metadata.get('dependencies', {}):
            visit(dependency(name, location))

    for name in package['dependencies']:
        visit(dependency(name))
    notices = (ROOT / 'public/THIRD_PARTY_NOTICES.txt').read_text(encoding='utf-8')
    helpers = {dependency('vite'), dependency('rolldown')}
    rows = []
    for location in sorted(runtime | helpers):
        entry = lock['packages'][location]
        metadata = json.loads((ROOT / location / 'package.json').read_text(encoding='utf-8'))
        if metadata['version'] != entry['version']:
            raise RuntimeError('Installed version mismatch: ' + location)
        algorithm, encoded = entry['integrity'].split('-', 1)
        if algorithm != 'sha512':
            raise RuntimeError('Unsupported integrity algorithm')
        hex_digest = base64.b64decode(encoded).hex()
        caches = [ROOT / '.npm-cache', Path.home() / 'AppData/Local/npm-cache', Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'npm-cache', Path.home() / '.npm']
        archives = [cache / '_cacache/content-v2/sha512' / hex_digest[:2] / hex_digest[2:4] / hex_digest[4:] for cache in caches]
        archives += [ROOT / 'docs/acceptance/m7-task15-upstream' / f"{metadata['name'].replace('/', '-')}-{entry['version']}.tgz", ROOT / 'artifacts/upstream-cache' / f"{metadata['name'].replace('/', '-')}-{entry['version']}.tgz"]
        archive = next((file for file in archives if file.is_file()), None)
        if archive is None:
            if not fetch:
                raise RuntimeError('Locked archive unavailable; install dependencies or explicitly use --fetch: ' + metadata['name'])
            url = urllib.parse.urlsplit(entry['resolved'])
            if url.scheme != 'https' or url.hostname != 'registry.npmjs.org':
                raise RuntimeError('Unexpected package source')
            data = urllib.request.urlopen(entry['resolved'], timeout=30).read()
            archive = archives[-1]
            archive.parent.mkdir(parents=True, exist_ok=True)
            archive.write_bytes(data)
        data = archive.read_bytes()
        if hashlib.sha512(data).digest() != base64.b64decode(encoded):
            raise RuntimeError('Locked archive integrity mismatch: ' + location)
        files = 0
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
            for member in tar:
                if not member.isfile():
                    continue
                if not member.name.startswith('package/'):
                    raise RuntimeError('Unexpected archive layout')
                name = member.name[len('package/'):]
                target = (ROOT / location / name).resolve()
                if not target.is_relative_to((ROOT / location).resolve()):
                    raise RuntimeError('Unsafe upstream path')
                content = tar.extractfile(member).read()
                if not target.is_file() or target.read_bytes() != content:
                    raise RuntimeError('Installed upstream file differs: ' + location + '/' + name)
                files += 1
        licenses = []
        for file in sorted((ROOT / location).iterdir()):
            if file.is_file() and re.match(r'(?i)^(licen[sc]e|copying|notice|thirdparty)', file.name):
                text = file.read_text(encoding='utf-8')
                if text not in notices:
                    raise RuntimeError('Full upstream notice not retained: ' + location + '/' + file.name)
                licenses.append({'path': location + '/' + file.name, 'sha256': digest(file.read_bytes())})
        if not licenses:
            raise RuntimeError('Missing runtime license')
        rows.append({'name': metadata['name'], 'version': entry['version'], 'source': entry['resolved'], 'integrity': entry['integrity'], 'license': metadata.get('license'), 'role': 'emitted-build-helper-provider' if location in helpers else 'application-runtime', 'filesCompared': files, 'modifiedFiles': 0, 'licenses': licenses})
    assets = [file.relative_to(ROOT).as_posix() for directory in ['src', 'public'] for file in (ROOT / directory).rglob('*') if file.is_file() and file.suffix.lower() in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.mp3', '.mp4'}]
    findings = []
    patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', r'\b(?:ghp_|github_pat_|AIza)[A-Za-z0-9_\-]{25,}', r'\bAKIA[0-9A-Z]{16}\b']
    for directory in ['src', 'tests', 'scripts', 'public']:
        for file in (ROOT / directory).rglob('*'):
            if not file.is_file() or file.suffix not in {'.ts', '.tsx', '.mjs', '.py', '.css', '.json', '.html', '.md', '.txt'}:
                continue
            text = file.read_text(encoding='utf-8')
            for pattern in patterns:
                if re.search(pattern, text):
                    findings.append({'path': file.relative_to(ROOT).as_posix(), 'kind': 'credential-pattern-review-required'})
    env_files = [file.name for file in ROOT.glob('.env*') if file.is_file()]
    report = {'version': package['version'], 'license': package.get('license'), 'author': 'jerryshi1968', 'lockedPackages': len(lock['packages']) - 1, 'runtimePackages': rows, 'runtimeCount': len(runtime), 'emittedHelperProviders': len(helpers), 'externalMediaOrFontsInProduct': assets, 'credentialPatternFindings': findings, 'environmentFilesExcluded': env_files, 'methodLimit': 'Heuristic scan plus locked-archive and complete-license comparisons; not a guarantee against every possible secret or rights claim.', 'ok': not findings and not assets and package.get('license') == 'Apache-2.0'}
    if not report['ok']:
        raise RuntimeError('Release inputs require review: ' + json.dumps(report, ensure_ascii=False))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true', help='Explicitly allow downloading missing archives from the locked official npm URLs')
    options = parser.parse_args()
    result = audit(options.fetch)
    target = ROOT / 'docs/acceptance/m7-task15-audit.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': result['ok'], 'runtimePackages': result['runtimeCount'], 'upstreamFilesCompared': sum(row['filesCompared'] for row in result['runtimePackages']), 'productExternalAssets': len(result['externalMediaOrFontsInProduct'])}))
