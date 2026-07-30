#!/usr/bin/env node
/**
 * @kuntay/swisseph-data paketini doldurur.
 *
 * Kaynak .se1 dosyalarını packages/data/ephe/ altına kopyalar ve bir
 * manifest üretir: boyutlar, SHA-256 özetleri, kapsanan yıl aralıkları.
 *
 * Manifest neden gerekli: tarayıcı yükleyicisi indirdiği dosyanın bütünlüğünü
 * doğrulayabilsin ve hangi aralığın gerçekten pakette olduğunu bilebilsin.
 * Dosyaların kendisi repoda tutulmuyor (gitignore) — paket CI'da yayına
 * hazırlanıyor.
 *
 *   node tools/build-data-package.mjs
 *
 * Kaynak: SWISSEPH_EPHE_PATH ya da ../swiss/ephe
 */

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA_PKG = join(ROOT, 'packages', 'data');
const OUT_DIR = join(DATA_PKG, 'ephe');

/**
 * Paket içeriği — Faz 0'da deneyle doğrulandı, 2.05 MB.
 *
 * 1800-2399 CE, modern astrolojinin ihtiyaç duyduğu her şey. Daha geniş
 * aralık isteyen kendi dosyalarını MemoryEphemeris ya da NodeFsEphemeris
 * ile bağlayabilir; buraya koymak paketi gereksiz şişirirdi.
 */
const CONTENTS = [
  { file: 'sepl_18.se1', kind: 'planets', fromYear: 1800, toYear: 2399 },
  { file: 'semo_18.se1', kind: 'moon', fromYear: 1800, toYear: 2399 },
  { file: 'seas_18.se1', kind: 'asteroids', fromYear: 1800, toYear: 2399 },
  { file: 'sefstars.txt', kind: 'fixedStars' },
  { file: 'seorbel.txt', kind: 'fictitiousBodies' },
];

if (!existsSync(EPHE_DIR)) {
  console.error(`\nKaynak dizin yok: ${EPHE_DIR}`);
  console.error('SWISSEPH_EPHE_PATH ile .se1 dosyalarının yerini gösterin.\n');
  process.exit(1);
}

// Eski içerikle karışmasın: paket her seferinde sıfırdan kuruluyor.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const entries = [];
let missing = 0;
let totalBytes = 0;

for (const item of CONTENTS) {
  const src = join(EPHE_DIR, item.file);
  if (!existsSync(src)) {
    console.error(`  EKSİK  ${item.file}`);
    missing++;
    continue;
  }

  copyFileSync(src, join(OUT_DIR, item.file));

  const bytes = readFileSync(src);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  totalBytes += bytes.length;

  entries.push({ ...item, bytes: bytes.length, sha256 });
  console.log(
    `  ${item.file.padEnd(14)} ${String(Math.round(bytes.length / 1024)).padStart(5)} KB  ` +
    `${sha256.slice(0, 16)}…`,
  );
}

if (missing > 0) {
  console.error(`\n${missing} dosya bulunamadı, paket eksik olurdu. Durduruluyor.\n`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(DATA_PKG, 'package.json'), 'utf8'));

const manifest = {
  package: pkg.name,
  version: pkg.version,
  swissEphemerisVersion: '2.10.03',
  /** Veri dosyalarının türetildiği JPL efemerisi. */
  jplEphemeris: 'DE441',
  generatedAt: new Date().toISOString().slice(0, 10),
  totalBytes,
  /** Paketin gerçekten kapsadığı yıl aralığı (astronomik numaralandırma). */
  coverage: { fromYear: 1800, toYear: 2399 },
  files: entries,
};

writeFileSync(join(DATA_PKG, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n  ${'TOPLAM'.padEnd(14)} ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`\nYazıldı: packages/data/ephe/ (${entries.length} dosya) + manifest.json`);
console.log(`Kapsam : ${manifest.coverage.fromYear}-${manifest.coverage.toYear} CE`);
