import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function createStaticServer(directory) {
  const root = await realpath(resolve(directory));
  if (!(await stat(root)).isDirectory()) throw new Error('STATIC_ROOT_NOT_DIRECTORY');
  const inside = path => { const part = relative(root, path); return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part); };
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
  return createServer(async (request, response) => {
    const send = (code, message) => { response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(request.method === 'HEAD' ? undefined : message); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); send(405, 'Method not allowed'); return; }
    let path;
    try { path = decodeURIComponent((request.url ?? '/').split(/[?#]/)[0]); } catch { send(400, 'Invalid URL'); return; }
    if (!path.startsWith('/') || path.includes('\\') || path.includes('\0')) { send(400, 'Invalid path'); return; }
    const target = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!inside(target)) { send(403, 'Outside static root'); return; }
    try {
      const actual = await realpath(target);
      if (!inside(actual)) { send(403, 'Outside static root'); return; }
      const info = await stat(actual);
      if (!info.isFile()) { send(404, 'Not found'); return; }
      const data = request.method === 'HEAD' ? null : await readFile(actual);
      response.writeHead(200, { 'Content-Type': types[extname(actual).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(data);
    } catch (error) { send(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : error.code === 'EACCES' ? 403 : 500, 'Static file unavailable'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--root', '--port'].includes(args[i]) || !args[i + 1] || options[args[i]] !== undefined) throw new Error('Usage: node scripts/serve-dist.mjs [--root dist] [--port 8080]');
      options[args[i]] = args[i + 1];
    }
    const port = Number(options['--port'] ?? 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1..65535');
    const server = await createStaticServer(options['--root'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../dist'));
    server.on('error', error => { console.error(`Local HTTP failed: ${error.code ?? error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Physics lab: http://127.0.0.1:${port}/\nLocal files only; no npm or Internet needed. Ctrl+C stops the server.`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
