import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import http from 'node:http';
import { createStaticServer } from '../../scripts/serve-dist.mjs';

async function fixture(run) {
  const folder = await mkdtemp(join(tmpdir(), 'physics-http-')), root = join(folder, 'dist');
  await mkdir(root); await writeFile(join(root, 'index.html'), '<title>离线实验</title>'); await writeFile(join(root, 'app.js'), 'export const offline = true;'); await writeFile(join(folder, 'secret.txt'), 'outside fixture');
  const server = await createStaticServer(root); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method }, res => { const chunks = []; res.on('data', part => chunks.push(part)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() })); }); req.on('error', reject); req.end();
  });
  try { await run({ request, folder, root }); } finally {
    await new Promise(resolve => server.close(resolve));
    const target = resolve(folder), withinTemp = relative(resolve(tmpdir()), target);
    assert.ok(withinTemp && !withinTemp.startsWith('..') && !isAbsolute(withinTemp) && basename(target).startsWith('physics-http-'));
    await rm(target, { recursive: true, force: true });
  }
}

test('offline HTTP serves real local HTML and JS with MIME, HEAD and no stale cache', () => fixture(async ({ request }) => {
  const home = await request('/'); assert.equal(home.status, 200); assert.match(home.body, /离线实验/); assert.match(home.headers['content-type'], /text\/html/); assert.equal(home.headers['cache-control'], 'no-store');
  const script = await request('/app.js?version=1'); assert.equal(script.status, 200); assert.match(script.headers['content-type'], /javascript/); assert.equal(script.body, 'export const offline = true;');
  const head = await request('/app.js', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(Number(head.headers['content-length']), Buffer.byteLength(script.body));
}));
test('offline HTTP rejects writes and missing paths without returning the application as JavaScript', () => fixture(async ({ request }) => {
  assert.equal((await request('/app.js', 'POST')).status, 405); const missing = await request('/missing.js'); assert.equal(missing.status, 404); assert.doesNotMatch(missing.body, /离线实验/); assert.equal((await request('/folder/')).status, 404);
}));
test('offline HTTP rejects encoded traversal, malformed escapes, backslashes and null bytes', () => fixture(async ({ request }) => {
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt']) { const res = await request(path); assert.equal(res.status, 403); assert.doesNotMatch(res.body, /outside fixture/); }
  for (const path of ['/bad%zz', '/%00', '/..%5csecret.txt']) assert.equal((await request(path)).status, 400);
}));
test('offline HTTP cannot follow a directory junction or symlink outside the static root', () => fixture(async ({ request, root, folder }) => {
  const outside = join(folder, 'outside'); await mkdir(outside); await writeFile(join(outside, 'hidden.txt'), 'external fixture'); await symlink(outside, join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const res = await request('/link/hidden.txt'); assert.equal(res.status, 403); assert.doesNotMatch(res.body, /external fixture/);
}));
test('offline HTTP startup rejects a file as its document root', () => fixture(async ({ root }) => { await assert.rejects(createStaticServer(join(root, 'app.js')), /STATIC_ROOT_NOT_DIRECTORY/); }));
