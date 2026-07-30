#!/usr/bin/env node
/**
 * Popüler asteroidlerin efemeris dosyalarını indirir ve paketler.
 *
 * Kaynak: Phillip McCabe'in sağladığı HTTP aynası (readme.md:102).
 * Upstream'in diğer adresi Dropbox klasörü — elle indirilir, betikle
 * çekilemez, dolayısıyla CI'da kullanılamaz. Ayna aynı dosyaları düz HTTP
 * üzerinden verdiği için paket yeniden üretilebilir kalıyor.
 *
 * KISA dosyalar indiriliyor (1500-2100 CE). Uzun dosyalar 3000 BCE-2999 CE
 * kapsıyor ama yaklaşık 10 kat büyük (Eros: 92 KB -> 914 KB) ve astrolojik
 * kullanımın tamamı kısa aralıkta.
 *
 *   node tools/build-asteroid-package.mjs
 *   node tools/build-asteroid-package.mjs --long    uzun dosyaları indir
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PKG_DIR = join(ROOT, 'packages', 'asteroids');
const OUT_DIR = join(PKG_DIR, 'ephe');

/*
 * İNDİRME aynası.
 *
 * Upstream asteroid dosyaları yalnızca Dropbox'ta ve bu gönüllü HTTP aynasında
 * bulunuyor; Dropbox betikle çekilemediği için ayna kullanılıyor.
 *
 * Bu adres BİLEREK yalnızca burada, build betiğinin içinde duruyor.
 * manifest.json'a yazılmıyor — yayınlanan manifest npm'e çıkıyor ve
 * jsDelivr'dan servis ediliyor, yani gönüllü aynanın adresi herkesin
 * görebileceği bir yerde "resmî kaynak" gibi durur ve iyi niyetli bir
 * kullanıcının oraya gitmesi için davetiye olurdu. Manifest'te veri gerçekten
 * NEREDEN geliyorsa o yazılı: upstream'in kanonik deposu.
 */
const MIRROR = 'https://ephe.scryr.io/ephe';

/** Verinin kanonik kaynağı — manifest'te ilan edilen adres. */
const CANONICAL_SOURCE = 'https://github.com/aloistr/swisseph (Astrodienst)';

/**
 * Beklenen sha256'lar. Boş değilse indirilen her dosya buna karşı doğrulanır.
 *
 * Manifest'e hash yazmak tek başına hiçbir şey doğrulamıyordu: kaydedilen
 * hash "indirdiğim şeyin hash'i bu" diyor, "indirdiğim şey DOĞRU dosya"
 * demiyor — kendine gönderme yapıyor. Dosyalar gönüllü bir aynadan HTTP
 * üzerinden geliyor; ayna bozuk, kırpık ya da değiştirilmiş bir .se1 verirse
 * hash kaydedilir, manifest dolu görünür, check:release geçer ve paket
 * yayınlanır. Sayısal kesinlik bu projenin tek değer önermesi.
 *
 * İlk çalıştırmada dosya yoksa hash'ler ÜRETİLİR ve bir sonraki çalıştırmadan
 * itibaren zorunlu hale gelir. `--rewrite-hashes` ile bilinçli olarak
 * güncellenebilir (upstream veri sürümü değiştiğinde).
 */
const HASH_FILE = join(HERE, 'asteroid-hashes.json');

const long = process.argv.includes('--long');
const rewriteHashes = process.argv.includes('--rewrite-hashes');

const { Asteroid, BUILT_IN_ASTEROIDS, asteroidFile, ASTEROID_NAMES } =
  await import('../packages/core/dist/ephemeris/asteroids.js');

const wanted = Object.values(Asteroid)
  .filter((n) => !BUILT_IN_ASTEROIDS.has(n))
  .sort((a, b) => a - b);

/*
 * Beklenen hash'leri yükle. Dosya, hash'lerin ait olduğu `fileKind`'ı da
 * taşıyor: kısa ve uzun dosyalar farklı byte'lar, dolayısıyla kısa dosyaların
 * hash'ini uzun dosyalara karşı doğrulamak anlamsız bir başarısızlık üretirdi.
 */
let expectedHashes = {};
let hashesKind = null;
if (existsSync(HASH_FILE)) {
  const stored = JSON.parse(readFileSync(HASH_FILE, 'utf8'));
  hashesKind = stored.fileKind ?? null;
  expectedHashes = stored.sha256 ?? {};
}
const verifying = !rewriteHashes
  && Object.keys(expectedHashes).length > 0
  && hashesKind === (long ? 'long' : 'short');

console.log(`İndirme aynası : ${MIRROR}`);
console.log(`Kanonik kaynak : ${CANONICAL_SOURCE}`);
console.log(`Hash doğrulama : ${
  verifying ? `AÇIK (${Object.keys(expectedHashes).length} beklenen hash)`
  : rewriteHashes ? 'YENİDEN YAZILIYOR (--rewrite-hashes)'
  : hashesKind && hashesKind !== (long ? 'long' : 'short')
    ? `ATLANDI — kayıtlı hash'ler '${hashesKind}' dosyalara ait`
    : 'ATLANDI — henüz beklenen hash yok, bu çalıştırmada üretilecek'}`);
console.log(`${wanted.length} asteroid, ${long ? 'UZUN' : 'kısa'} dosyalar\n`);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const entries = [];
const failed = [];
let totalBytes = 0;

for (const number of wanted) {
  const spec = asteroidFile(number, { long });
  const name = ASTEROID_NAMES[number] ?? String(number);
  const url = `${MIRROR}/${spec.path}`;

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    failed.push({ number, name, reason: String(error.message) });
    console.log(`  ✗ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} ağ hatası`);
    continue;
  }

  if (!response.ok) {
    failed.push({ number, name, reason: `HTTP ${response.status}` });
    console.log(`  ✗ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} HTTP ${response.status}`);
    continue;
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  // Ayna 404 yerine HTML hata sayfası dönerse sessizce bozuk dosya
  // paketlerdik. .se1 dosyaları "SE" ile başlayan bir başlık taşıyor.
  if (bytes.length < 1024 || bytes[0] !== 0x53 /* 'S' */) {
    failed.push({ number, name, reason: '.se1 başlığı yok, muhtemelen hata sayfası' });
    console.log(`  ✗ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} geçersiz içerik`);
    continue;
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  /*
   * Beklenen hash'e karşı doğrula. Uyuşmazsa PATLA — bozuk ya da değiştirilmiş
   * bir .se1'i paketlemek, hiç paketlememekten çok daha kötü: sessizce yanlış
   * konumlar üretir ve hiçbir şey bozuk görünmez.
   */
  if (verifying) {
    const expected = expectedHashes[spec.fileName];
    if (!expected) {
      failed.push({
        number, name,
        reason: `beklenen hash listesinde yok — ${HASH_FILE} bayat olabilir`,
      });
      console.log(`  ✗ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} beklenmeyen dosya`);
      continue;
    }
    if (expected !== sha256) {
      failed.push({
        number, name,
        reason: `sha256 UYUŞMUYOR\n      beklenen: ${expected}\n      gelen    : ${sha256}`,
      });
      console.log(`  ✗ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} HASH UYUŞMUYOR`);
      continue;
    }
  }

  // Alt dizinsiz, düz yerleşim: sweph.c:2204-2222'deki geri düşme zinciri
  // astN/ önekini atıp ana dizine de baktığı için gerekmiyor (deneyle
  // doğrulandı).
  writeFileSync(join(OUT_DIR, spec.fileName), bytes);
  totalBytes += bytes.length;

  entries.push({
    number, name,
    file: spec.fileName,
    bytes: bytes.length,
    sha256,
  });

  console.log(
    `  ✓ ${name.padEnd(10)} ${spec.fileName.padEnd(14)} ` +
    `${String(Math.round(bytes.length / 1024)).padStart(4)} KB` +
    `${verifying ? '  hash ✓' : ''}`);
}

if (failed.length) {
  console.error(`\n${failed.length} dosya indirilemedi ya da doğrulanamadı:`);
  for (const f of failed) console.error(`  ${f.name} (${f.number}): ${f.reason}`);
  console.error('\nEksik ya da doğrulanamayan paket yayınlanmamalı. Durduruluyor.\n');
  process.exit(1);
}

/*
 * Beklenen hash'leri yaz (ilk çalıştırma ya da --rewrite-hashes).
 *
 * Bir sonraki çalıştırmadan itibaren doğrulama zorunlu hale gelir. Dosya
 * commit'lenmeli: sabitlenmemiş bir hash listesi hiçbir şey doğrulamaz.
 */
if (!verifying) {
  const sha256 = {};
  for (const e of entries) sha256[e.file] = e.sha256;
  writeFileSync(HASH_FILE, JSON.stringify({
    _comment:
      'Asteroid .se1 dosyalarının beklenen sha256\'ları. build-asteroid-package.mjs ' +
      'indirdiği her dosyayı buna karşı doğrular ve uyuşmazsa durur. Gönüllü bir ' +
      'aynadan HTTP ile indiriyoruz; bu liste olmadan bozuk ya da değiştirilmiş bir ' +
      'dosya sessizce paketlenirdi. COMMIT EDİLMELİ. Upstream veri sürümü ' +
      'değişirse: npm run build:asteroids -- --rewrite-hashes',
    fileKind: long ? 'long' : 'short',
    swissEphemerisVersion: '2.10.03',
    generatedAt: new Date().toISOString().slice(0, 10),
    sha256,
  }, null, 2) + '\n');
  console.log(`\nBeklenen hash'ler yazıldı: tools/asteroid-hashes.json (${entries.length} dosya)`);
  console.log('  COMMIT EDİN — bundan sonraki her build buna karşı doğrulanacak.');
}

const manifest = {
  package: '@kuntay/swisseph-asteroids',
  swissEphemerisVersion: '2.10.03',
  jplEphemeris: 'DE441',
  // Kanonik kaynak; indirme aynası bilerek burada ilan EDİLMİYOR (bkz. MIRROR).
  source: CANONICAL_SOURCE,
  generatedAt: new Date().toISOString().slice(0, 10),
  /** Kısa dosyalar 1500-2100 CE, uzun dosyalar 3000 BCE-2999 CE kapsar. */
  coverage: long ? { fromYear: -2999, toYear: 2999 } : { fromYear: 1500, toYear: 2100 },
  fileKind: long ? 'long' : 'short',
  totalBytes,
  asteroids: entries,
};

writeFileSync(join(PKG_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n  ${'TOPLAM'.padEnd(12)} ${(totalBytes / 1024).toFixed(0)} KB ` +
            `(${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`\nYazıldı: packages/asteroids/ephe/ (${entries.length} dosya) + manifest.json`);
console.log(`Kapsam : ${manifest.coverage.fromYear}-${manifest.coverage.toYear} CE`);
