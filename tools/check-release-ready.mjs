#!/usr/bin/env node
/**
 * Yayın öncesi tutarlılık denetimi.
 *
 * Yayın geri alınamaz: npm'e çıkan bir sürüm silinemez, yalnızca deprecate
 * edilebilir. Bu yüzden etiket ile paket sürümlerinin uyuşmadığı ya da bir
 * paketin hâlâ `private` olduğu gibi hataları yayından ÖNCE yakalıyoruz.
 *
 *   node tools/check-release-ready.mjs [beklenen-sürüm]
 *
 * Sürüm verilmezse yalnızca paketler arası tutarlılık kontrol edilir.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const PACKAGES = ['core', 'data', 'asteroids', 'geo', 'mcp'];
const expected = process.argv[2];

/** Bir ağaçtaki en yeni mtime, özyinelemeli. Yoksa 0. */
function newestMtime(relative) {
  const root = join(ROOT, relative);
  if (!existsSync(root)) return 0;
  let newest = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else newest = Math.max(newest, statSync(path).mtimeMs);
    }
  };
  const stat = statSync(root);
  if (stat.isDirectory()) walk(root); else newest = stat.mtimeMs;
  return newest;
}

const problems = [];
const notes = [];

console.log('\n=== Yayın hazırlık denetimi ===\n');

const versions = new Map();

for (const name of PACKAGES) {
  const dir = join(ROOT, 'packages', name);
  const pkgPath = join(dir, 'package.json');

  if (!existsSync(pkgPath)) {
    problems.push(`packages/${name}/package.json yok`);
    continue;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  versions.set(pkg.name, pkg.version);

  const flags = [];

  if (pkg.private) {
    problems.push(`${pkg.name} hâlâ "private": true — yayınlanmaz`);
    flags.push('PRIVATE');
  }
  if (expected && pkg.version !== expected) {
    problems.push(`${pkg.name} sürümü ${pkg.version}, etiket ise ${expected}`);
  }
  if (pkg.version.includes('-dev')) {
    problems.push(`${pkg.name} sürümü hâlâ geliştirme etiketi taşıyor: ${pkg.version}`);
  }
  if (pkg.license !== 'AGPL-3.0-or-later') {
    problems.push(`${pkg.name} lisansı beklenenden farklı: ${pkg.license}`);
  }
  for (const file of ['LICENSE', 'NOTICE', 'README.md']) {
    if (!existsSync(join(dir, file))) {
      problems.push(`${pkg.name} içinde ${file} eksik`);
    }
  }
  if (!pkg.publishConfig?.provenance) {
    notes.push(`${pkg.name}: publishConfig.provenance kapalı`);
  }

  console.log(`  ${pkg.name.padEnd(30)} ${pkg.version.padEnd(14)} ${flags.join(' ')}`);
}

// Tüm paketler aynı sürümde olmalı: veri paketleri çekirdek sürümüne
// atıf yapıyor ve ayrışırlarsa hangi ikilinin uyumlu olduğu belirsizleşir.
const distinct = new Set(versions.values());
if (distinct.size > 1) {
  problems.push(`Paket sürümleri ayrışmış: ${[...versions].map(([n, v]) => `${n}@${v}`).join(', ')}`);
}

/*
 * 1) PAKETLER ARASI BAĞIMLILIK SÜRÜMÜ.
 *
 * Yukarıdaki döngü dört paketin `version` ALANINI denetliyor; MCP'nin
 * `dependencies["@kuntay/swisseph"]` değeri ise AYRI bir string ve hiçbir
 * kontrolden geçmiyordu. Dört version'ı 0.1.0 yapıp bu satırı unutmak
 * mümkündü: betik geçer, npm publish MCP'yi asla var olmayacak bir sürüme
 * bağlı olarak yayınlar ve npm yayını geri alınamaz. Ölçüldü — paketlenip
 * kurulunca `npm error 404 '@kuntay/swisseph@0.1.0-dev' could not be found`.
 */
console.log('\n  Paketler arası bağımlılıklar:');
for (const name of PACKAGES) {
  const pkgPath = join(ROOT, 'packages', name, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
      // Yalnızca bu monorepo'nun kendi paketleri.
      if (!versions.has(dep)) continue;

      const bare = String(range).replace(/^[\^~>=<\s]+/, '');
      const target = expected ?? versions.get(dep);
      const ok = bare === target;
      console.log(`    ${ok ? '✓' : '✗'} ${pkg.name} → ${dep} "${range}"`);
      if (!ok) {
        problems.push(
          `${pkg.name} ${field}.${dep} = "${range}" ama yayınlanacak sürüm ${target}`);
      }
    }
  }
}

/*
 * 2) BAYAT ARTEFAKT.
 *
 * Belgelenmiş güvence "check:release bayat artefaktı engelliyor" diyordu ama
 * betik yalnızca existsSync() çağırıyordu — mtime karşılaştırması hiç yoktu.
 * Tuzak 14 tam olarak bayat dist/ üzerine, yani vaat edilen kontrol gerçekte
 * mevcut değildi.
 */
console.log('\n  Tazelik (kaynak vs derlenmiş):');
const freshness = [
  ['packages/core/src', 'packages/core/dist', 'npm run build:ts'],
  ['packages/geo/src', 'packages/geo/dist', 'npm run build:ts'],
  ['packages/mcp/src', 'packages/mcp/dist', 'npm run build:ts'],
  ['vendor/swisseph', 'packages/core/wasm', 'npm run build:wasm'],
];
for (const [src, out, fix] of freshness) {
  const srcTime = newestMtime(src);
  const outTime = newestMtime(out);
  if (outTime === 0) continue;             // yokluğu artefakt kontrolü bildiriyor
  const ok = srcTime <= outTime;
  console.log(`    ${ok ? '✓' : '✗'} ${out.padEnd(24)} ${ok ? 'güncel' : 'BAYAT'}`);
  if (!ok) {
    const hours = ((srcTime - outTime) / 3_600_000).toFixed(1);
    problems.push(`${out} bayat — ${src} ${hours} saat daha yeni. Çalıştırın: ${fix}`);
  }
}

// Yayınlanacak artefaktlar gerçekten var mı?
console.log('\n  Artefaktlar:');
const artifacts = [
  ['packages/core/wasm/swisseph.wasm', 'WASM ikili'],
  ['packages/core/wasm/swisseph.mjs', 'Emscripten glue'],
  ['packages/core/dist/index.js', 'TypeScript çıktısı'],
  ['packages/core/dist/index.d.ts', 'Tip bildirimleri'],
  ['packages/data/manifest.json', 'Veri manifesti'],
  ['packages/asteroids/manifest.json', 'Asteroid manifesti'],
  ['packages/geo/dist/index.js', 'geo paketi çıktısı'],
  ['packages/geo/manifest.json', 'geo manifesti'],
  ['packages/mcp/dist/index.js', 'MCP sunucusu'],
];
for (const [path, label] of artifacts) {
  const ok = existsSync(join(ROOT, path));
  console.log(`    ${ok ? '✓' : '✗'} ${label.padEnd(22)} ${path}`);
  if (!ok) problems.push(`Artefakt eksik: ${path}`);
}

// Veri paketleri gerçekten dolu mu — boş bir paket yayınlamak kolay bir hata.
for (const [name, manifestPath] of [
  ['data', 'packages/data/manifest.json'],
  ['asteroids', 'packages/asteroids/manifest.json'],
]) {
  const full = join(ROOT, manifestPath);
  if (!existsSync(full)) continue;
  const manifest = JSON.parse(readFileSync(full, 'utf8'));
  const entries = manifest.files ?? manifest.asteroids ?? [];
  if (entries.length === 0) {
    problems.push(`${name} paketi manifesti boş`);
  } else {
    console.log(`    ✓ ${name} paketi: ${entries.length} dosya, ` +
                `${(manifest.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  }
}

/*
 * 3) MANİFEST SHA256'LARI DİSKTEKİ DOSYALARA KARŞI.
 *
 * Manifest'e yazılan hash kendine gönderme yapıyordu: "indirdiğim şeyin hash'i
 * bu" — "indirdiğim şey doğru dosya" değil. Karşılaştırılacak hiçbir şey yoktu;
 * check-data-package.mjs'te sha256 geçen tek satır yok, bu betik de yalnızca
 * entries.length ve totalBytes okuyordu.
 *
 * Burada manifest'i diskteki GERÇEK byte'lara karşı yeniden hesaplıyoruz. Bu,
 * hash'in doğru dosyaya ait olduğunu kanıtlamıyor (onu build sırasındaki
 * tools/asteroid-hashes.json karşılaştırması yapıyor) ama yayın anında kırpık,
 * bozuk ya da manifest'le uyuşmayan bir dosyayı yakalıyor — iki kontrol
 * birlikte zinciri kapatıyor.
 */
console.log('\n  Manifest bütünlüğü (sha256, diske karşı):');
for (const [name, manifestPath, dataDir] of [
  ['data', 'packages/data/manifest.json', 'packages/data/ephe'],
  ['asteroids', 'packages/asteroids/manifest.json', 'packages/asteroids/ephe'],
]) {
  const full = join(ROOT, manifestPath);
  if (!existsSync(full)) continue;

  const manifest = JSON.parse(readFileSync(full, 'utf8'));
  const entries = manifest.files ?? manifest.asteroids ?? [];
  const dir = join(ROOT, dataDir);

  if (!existsSync(dir)) {
    // Veri dizini repoda tutulmuyor (379 MB). Yayın CI'da yapılıyor ve orada
    // dizin VAR; yerelde yokluğu bir hata değil, ama sessiz de kalmamalı.
    console.log(`    ⚠ ${name}: ${dataDir} yok — hash doğrulaması atlandı`);
    if (process.env.CI) {
      problems.push(`${dataDir} yok — CI'da manifest hash'leri doğrulanamaz`);
    }
    continue;
  }

  const mismatched = [];
  let verified = 0;
  for (const entry of entries) {
    const fileName = entry.file ?? entry.name;
    if (!fileName || !entry.sha256) continue;
    const path = join(dir, fileName);
    if (!existsSync(path)) { mismatched.push(`${fileName}: dosya yok`); continue; }

    const bytes = readFileSync(path);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== entry.sha256) {
      mismatched.push(`${fileName}: sha256 uyuşmuyor`);
    } else if (entry.bytes !== undefined && entry.bytes !== bytes.length) {
      mismatched.push(`${fileName}: boyut ${bytes.length}, manifest ${entry.bytes}`);
    } else {
      verified++;
    }
  }

  console.log(`    ${mismatched.length ? '✗' : '✓'} ${name}: ` +
              `${verified}/${entries.length} dosya doğrulandı`);
  for (const m of mismatched) {
    problems.push(`${name} manifest bütünlüğü — ${m}`);
  }
}

console.log('\n' + '='.repeat(62));
if (notes.length) {
  console.log('Notlar:');
  for (const note of notes) console.log(`  · ${note}`);
  console.log('');
}
if (problems.length) {
  console.log(`YAYINA HAZIR DEĞİL — ${problems.length} sorun:\n`);
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  console.log('');
  process.exitCode = 1;
} else {
  console.log('Yayına hazır.');
  console.log(`  Sürüm: ${[...distinct][0]}`);
  console.log('');
}
