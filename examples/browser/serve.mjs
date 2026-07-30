#!/usr/bin/env node
/**
 * Tarayıcı demosu için küçük statik sunucu.
 *
 * Gerekli çünkü ESM ve WebAssembly `file://` üzerinden yüklenmiyor —
 * tarayıcı her ikisi için de HTTP kaynağı istiyor.
 *
 * İki yolu servis eder:
 *   /            demo + derlenmiş paket (repo kökünden)
 *   /ephe/...    veri paketi (FetchEphemeris'in indirdiği dosyalar)
 *
 *   node examples/browser/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const EPHE = join(ROOT, 'packages', 'data', 'ephe');
const ASTEROIDS = join(ROOT, 'packages', 'asteroids', 'ephe');

const PORT = Number(process.argv[2] ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.se1': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * İstek yolunu bir taban dizine güvenli biçimde çözer.
 * Dizin dışına çıkan yollar (../) reddedilir.
 */
function safeResolve(base, requestPath) {
  const clean = normalize(decodeURIComponent(requestPath)).replace(/^([/\\])+/, '');
  const full = resolve(base, clean);
  return full === base || full.startsWith(base + sep) ? full : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let path = url.pathname;

  if (path === '/' || path === '') path = '/examples/browser/index.html';

  // Efemeris dosyaları iki pakette; ikisine de bakıyoruz.
  let file = null;
  if (path.startsWith('/ephe/')) {
    const name = path.slice('/ephe/'.length);
    for (const base of [EPHE, ASTEROIDS]) {
      const candidate = safeResolve(base, name);
      if (candidate && existsSync(candidate)) { file = candidate; break; }
    }
  } else {
    const candidate = safeResolve(ROOT, path);
    if (candidate && existsSync(candidate) && statSync(candidate).isFile()) {
      file = candidate;
    }
  }

  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Bulunamadı: ${path}\n`);
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Demo:  http://127.0.0.1:${PORT}/`);
  console.log(`  Kök :  ${ROOT}`);
  console.log(`  Ephe:  ${existsSync(EPHE) ? EPHE : 'YOK — npm run build:data'}\n`);
});
