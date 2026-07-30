#!/usr/bin/env node
/**
 * Altın referans korpusunu üretir.
 *
 * tools/golden/gen-golden.c'yi vendor'lanmış Swiss Ephemeris ile NATIVE
 * derler (gcc, x86-64 Linux, Docker içinde) ve çalıştırır. Çıktı, WASM
 * build'inin karşılaştırılacağı referans.
 *
 * Native derleme kasten farklı bir yol: aynı C kaynağı, farklı derleyici,
 * farklı libm, farklı hedef mimari. İkisi uyuşuyorsa WASM portu sayısal
 * olarak sağlamdır.
 *
 *   node tools/generate-golden.mjs
 *
 * .se1 dosyaları gerekir (SWISSEPH_EPHE_PATH ya da ../swiss/ephe).
 */

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const GOLDEN_DIR = join(HERE, 'golden');
const OUTPUT = join(GOLDEN_DIR, 'golden.tsv.gz');

const IMAGE = 'emscripten/emsdk:latest';   // gcc 13.3 de bu imajda

/** build-wasm.mjs'deki SWEOBJ listesiyle aynı olmalı. */
const SOURCES = [
  'swedate.c', 'swehouse.c', 'swejpl.c', 'swemmoon.c', 'swemplan.c',
  'sweph.c', 'swephlib.c', 'swecl.c', 'swehel.c',
];

if (!existsSync(EPHE_DIR)) {
  console.error(`\nEphemeris dizini yok: ${EPHE_DIR}`);
  console.error('SWISSEPH_EPHE_PATH ile .se1 dosyalarının yerini gösterin.\n');
  process.exit(1);
}

try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  console.error('\nDocker daemon çalışmıyor. Docker Desktop\'ı başlatın.\n');
  process.exit(1);
}

mkdirSync(GOLDEN_DIR, { recursive: true });

console.log('Native derleme (gcc)...');

// Proje kökü /src'e, efemeris dizini /ephe'ye bağlanıyor. Efemeris dizini
// swiss-npm dışında olduğu için ayrı mount gerekiyor.
const shell = [
  'set -e',
  'cd /src',
  `gcc -O2 -o /tmp/gen-golden tools/golden/gen-golden.c ` +
    SOURCES.map((f) => `vendor/swisseph/${f}`).join(' ') +
    ' -Ivendor/swisseph -lm',
  '/tmp/gen-golden /ephe/',
].join(' && ');

const started = Date.now();
const stdout = execFileSync('docker', [
  'run', '--rm',
  '-v', `${ROOT}:/src`,
  '-v', `${EPHE_DIR}:/ephe:ro`,
  IMAGE, 'bash', '-c', shell,
], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });

const seconds = ((Date.now() - started) / 1000).toFixed(1);

const text = stdout.toString('utf8');
const lines = text.split('\n').filter((l) => l.length > 0);
const dataLines = lines.filter((l) => !l.startsWith('#'));

// Satır türlerini say — korpusun beklenen şekilde olduğunu doğrula.
const counts = new Map();
for (const line of dataLines) {
  const kind = line.slice(0, line.indexOf('\t'));
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
}

writeFileSync(OUTPUT, gzipSync(Buffer.from(text, 'utf8'), { level: 9 }));

console.log(`\nÜretildi (${seconds}s):`);
for (const [kind, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(10)} ${String(n).padStart(7)} satır`);
}
console.log(`  ${'TOPLAM'.padEnd(10)} ${String(dataLines.length).padStart(7)} satır`);
console.log(`\n  ham    ${(Buffer.byteLength(text) / 1024 / 1024).toFixed(2)} MB`);
console.log(`  gzip   ${(statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`\nYazıldı: tools/golden/golden.tsv.gz`);
