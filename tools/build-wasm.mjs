#!/usr/bin/env node
/**
 * Swiss Ephemeris C kaynaklarını WebAssembly'ye derler.
 *
 * Toolchain'i kendi seçer: PATH'te emcc varsa onu, yoksa Docker'daki
 * emscripten/emsdk imajını. CI ile yerel geliştirme aynı imajı kullanır.
 *
 *   node tools/build-wasm.mjs             tek build, tam API (varsayılan)
 *   node tools/build-wasm.mjs --compare   ölçüm için çekirdek varyantı da derle
 *
 * Faz 0 ölçümü tek build kararını verdi: 106 fonksiyonu 12'ye indirmek
 * sadece 53 KB brotli kazandırıyor (%23), iki paket bakımına değmiyor.
 */

import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants as zlib } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');
const VENDOR = join(ROOT, 'vendor', 'swisseph');
const CORE = join(ROOT, 'packages', 'core');

/** emcc çıktısı. TypeScript dist/'e derlendiği için ayrı tutuluyor —
 *  aynı dizini paylaşsalar tsc temizliği wasm'ı silerdi. */
const WASM_DIR = join(CORE, 'wasm');
/** Yalnızca --compare ölçümü. Yayınlanmaz, gitignore'da. */
const MEASURE_DIR = join(CORE, '.measure');

const EMSDK_IMAGE = 'emscripten/emsdk:latest';

/** vendor/swisseph/Makefile'daki SWEOBJ ile birebir aynı.
 *  main() içeren dosyalar (swetest, swemini, swevents, obama) dışarıda —
 *  kütüphane derliyoruz, program değil. */
const SOURCES = [
  'swedate.c', 'swehouse.c', 'swejpl.c', 'swemmoon.c', 'swemplan.c',
  'sweph.c', 'swephlib.c', 'swecl.c', 'swehel.c',
];

/** Sadece --compare ölçümü için. Üretim build'i tam API kullanır. */
const MINIMAL_EXPORTS = [
  'swe_calc', 'swe_calc_ut', 'swe_close', 'swe_deltat_ex', 'swe_get_planet_name',
  'swe_houses_ex2', 'swe_julday', 'swe_revjul', 'swe_set_ephe_path',
  'swe_set_sid_mode', 'swe_set_topo', 'swe_version',
];

/**
 * swephexp.h'yi parse edip dışa açılan tüm swe_* fonksiyonlarını çıkarır.
 * Elle liste tutmuyoruz: upstream sürüm yükseltmesinde export listesi
 * kendiliğinden güncellensin, sessizce eksik kalmasın.
 */
export function readExportsFromHeader() {
  const header = readFileSync(join(VENDOR, 'swephexp.h'), 'utf8');
  const names = new Set();
  for (const line of header.split('\n')) {
    const m = /^ext_def\s*\([^)]*\)\s*(swe_\w+)/.exec(line);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}

function detectToolchain() {
  try {
    const v = execSync('emcc --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { kind: 'native', version: v.split('\n')[0].trim() };
  } catch { /* PATH'te yok, Docker'a düş */ }

  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'Ne PATH\'te emcc var ne de Docker daemon çalışıyor.\n\n' +
      '  Seçenek 1 — Docker Desktop\'ı başlat (imaj otomatik iner)\n' +
      '  Seçenek 2 — emsdk kur:\n' +
      '      git clone https://github.com/emscripten-core/emsdk\n' +
      '      cd emsdk && ./emsdk install latest && ./emsdk activate latest'
    );
  }

  const v = execSync(`docker run --rm ${EMSDK_IMAGE} emcc --version`, { encoding: 'utf8' });
  return { kind: 'docker', version: v.split('\n')[0].trim() };
}

function runEmcc(toolchain, args) {
  if (toolchain.kind === 'native') {
    execFileSync('emcc', args, { cwd: ROOT, stdio: 'inherit' });
    return;
  }
  // Proje kökünü /src'e bağla; konteyner içinde de aynı göreli yollar geçerli.
  execFileSync('docker', [
    'run', '--rm', '-v', `${ROOT}:/src`, '-w', '/src',
    EMSDK_IMAGE, 'emcc', ...args,
  ], { stdio: 'inherit' });
}

function buildVariant(toolchain, variant, exports) {
  // Üretim build'i packages/core/wasm/, ölçüm varyantı .measure/ altına.
  const relOut = variant === 'full' ? 'packages/core/wasm' : `packages/core/.measure/${variant}`;
  const outDir = variant === 'full' ? WASM_DIR : join(MEASURE_DIR, variant);
  mkdirSync(outDir, { recursive: true });

  // C sembolleri emcc'ye alt çizgi önekiyle bildirilir.
  const exported = [...exports.map((n) => `_${n}`), '_malloc', '_free'];

  const args = [
    ...SOURCES.map((f) => `vendor/swisseph/${f}`),
    '-O3',
    '-o', `${relOut}/swisseph.mjs`,

    '--no-entry',                      // kütüphane, main() yok

    // Fabrika fonksiyonu: her çağrı ayrı bir WASM instance üretir.
    // createSwissEph() izolasyonu bunun üstüne kuruluyor — Swiss Ephemeris
    // tüm durumunu tek bir global swed struct'ında tuttuğu için, sunucuda
    // eşzamanlı isteklerin birbirine sızmaması ancak böyle garanti edilir.
    '-sMODULARIZE=1',
    '-sEXPORT_ES6=1',
    '-sEXPORT_NAME=createSwissEphModule',

    '-sENVIRONMENT=web,worker,node',
    '-sALLOW_MEMORY_GROWTH=1',

    // .se1 dosyaları için gerekli. sweph.c'deki tüm dosya erişimi
    // swi_fopen() üzerinden geçtiğinden Emscripten FS'i şeffaf karşılıyor.
    '-sFILESYSTEM=1',

    // NODEFS: Node'da gerçek bir dizini doğrudan bağlamayı sağlar.
    // Önemli, çünkü izolasyon için örnek başına ayrı WASM instance
    // kullanıyoruz — MEMFS'e kopyalasaydık her örnek 2 MB'ı yeniden
    // taşırdı. NODEFS ile aynı dizin kopyasız paylaşılıyor.
    '-lnodefs.js',

    `-sEXPORTED_FUNCTIONS=${JSON.stringify(exported)}`,
    `-sEXPORTED_RUNTIME_METHODS=${JSON.stringify([
      'ccall', 'cwrap', 'getValue', 'setValue', 'NODEFS',
      'UTF8ToString', 'stringToUTF8', 'lengthBytesUTF8', 'FS',
    ])}`,

    // Üst düzey API'yi elle yazıyoruz; glue kendi kendine büyümesin.
    '-sINCOMING_MODULE_JS_API=[]',
  ];

  const started = Date.now();
  runEmcc(toolchain, args);

  return {
    variant,
    // Repo-göreli yol yazıyoruz, mutlak değil: sizes.json --compare çıktısıyla
    // elle paylaşılabiliyor ve mutlak yol derleyenin ev dizinini sızdırırdı
    // (C:\Users\<ad>\...). Göreli yol aynı bilgiyi taşıyor.
    outDir: relOut,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
    exportCount: exports.length,
    sizes: measure(outDir),
  };
}

/**
 * Yalnızca YAYINLANAN artefaktları ölçer.
 *
 * Dizindeki her dosyayı saymak cazip ama yanlış: sizes.json da aynı dizine
 * yazıldığından ikinci build'de kendini ölçmeye başlıyor ve raporlanan
 * toplam build geçmişine bağlı hale geliyor (624 KB temiz, 625 KB tekrar).
 * README'deki boyut iddiası buna dayandığı için deterministik olmalı.
 */
const SHIPPED_ARTIFACTS = ['swisseph.mjs', 'swisseph.wasm'];

function measure(outDir) {
  return readdirSync(outDir).sort()
    .filter((n) => SHIPPED_ARTIFACTS.includes(n))
    .filter((n) => statSync(join(outDir, n)).isFile())
    .map((name) => {
      const buf = readFileSync(join(outDir, name));
      return {
        name,
        raw: buf.length,
        gzip: gzipSync(buf, { level: 9 }).length,
        brotli: brotliCompressSync(buf, {
          params: { [zlib.BROTLI_PARAM_QUALITY]: 11 },
        }).length,
      };
    });
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6) + ' KB';

function report(builds) {
  const lines = [];
  const say = (s = '') => { lines.push(s); console.log(s); };

  say();
  say('='.repeat(64));
  say('  Swiss Ephemeris 2.10.03 -> WebAssembly');
  say('='.repeat(64));

  for (const b of builds) {
    say();
    say(`### ${b.variant}  (${b.exportCount} fonksiyon, ${b.seconds}s)`);
    say();
    say('  dosya                      ham       gzip     brotli');
    say('  ' + '-'.repeat(52));
    b.total = { raw: 0, gzip: 0, brotli: 0 };
    for (const r of b.sizes) {
      say(`  ${r.name.padEnd(20)} ${kb(r.raw)} ${kb(r.gzip)} ${kb(r.brotli)}`);
      b.total.raw += r.raw; b.total.gzip += r.gzip; b.total.brotli += r.brotli;
    }
    say('  ' + '-'.repeat(52));
    say(`  ${'TOPLAM'.padEnd(20)} ${kb(b.total.raw)} ${kb(b.total.gzip)} ${kb(b.total.brotli)}`);
  }

  if (builds.length === 2) {
    const full = builds.find((b) => b.variant === 'full');
    const min = builds.find((b) => b.variant === 'minimal');
    const saved = full.total.brotli - min.total.brotli;
    say();
    say(`  Ölü kod elemesi: ${(saved / 1024).toFixed(0)} KB brotli ` +
        `(%${((saved / full.total.brotli) * 100).toFixed(0)})`);
  }

  say();
  mkdirSync(WASM_DIR, { recursive: true });
  writeFileSync(join(WASM_DIR, 'sizes.json'), JSON.stringify(builds, null, 2));
  say(`Ham veri: packages/core/wasm/sizes.json`);
}

// --- main ---------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1].endsWith('build-wasm.mjs')) {
  const compare = process.argv.includes('--compare');
  const allExports = readExportsFromHeader();

  console.log(`swephexp.h'den ${allExports.length} export okundu.`);
  const toolchain = detectToolchain();
  console.log(`Toolchain: ${toolchain.kind} — ${toolchain.version}\n`);

  const plan = [['full', allExports]];
  if (compare) plan.push(['minimal', MINIMAL_EXPORTS]);

  const builds = [];
  for (const [variant, exports] of plan) {
    console.log(`--- ${variant} (${exports.length} fonksiyon) ---`);
    builds.push(buildVariant(toolchain, variant, exports));
  }

  report(builds);
}
