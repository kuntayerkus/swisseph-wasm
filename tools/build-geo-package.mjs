#!/usr/bin/env node
/**
 * Coğrafi veri paketini üretir: şehirler + IANA saat dilimleri.
 *
 * Kaynak: GeoNames `cities15000.zip` (nüfusu 15.000+ olan ~25.000 şehir,
 * enlem/boylam/ülke/IANA saat dilimi) ve `countryInfo.txt` (ISO2 → ülke
 * adı). İkisi de CC-BY 4.0 — atıf paket NOTICE'ında ve manifest'te.
 *
 * Veri KAYNAKTAN okunur, elle yazılmaz: bu dosya yalnızca indirir,
 * doğrular, sıkıştırır ve kolonları daraltır. Üretilen `cities.tsv`
 * paketle birlikte commit'lenir; yeniden üretmek bu betiği koşmaktır.
 *
 *   node tools/build-geo-package.mjs
 *
 * Önce SWISSEPH_EPHE_PATH (veya ../swiss/ephe) dizininde
 * cities15000.zip arar; yoksa indirir ve önbelleğe yazar.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { createReporter, EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const GEO_DIR = join(ROOT, 'packages', 'geo');
const OUT_TSV = join(GEO_DIR, 'cities.tsv');
const OUT_MANIFEST = join(GEO_DIR, 'manifest.json');

const CITY_SOURCE = 'https://download.geonames.org/export/dump/cities15000.zip';
const COUNTRY_SOURCE = 'https://download.geonames.org/export/dump/countryInfo.txt';
const LICENSE = 'CC-BY 4.0 — https://www.geonames.org (veri GeoNames\'den türetilmiştir)';

const r = createReporter('Coğrafi veri paketi üretimi');

// --- 1) Kaynak dosyalar ---------------------------------------------------

async function fetchText(url, minBytes) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < minBytes) {
    throw new Error(`${url} beklenmedik kadar küçük (${buffer.byteLength} bayt)`);
  }
  return buffer;
}

function cached(name) {
  return join(EPHE_DIR, name);
}

async function obtain(name, url, minBytes, fetcher) {
  const local = cached(name);
  if (existsSync(local)) {
    const buffer = readFileSync(local);
    if (buffer.byteLength >= minBytes) {
      r.check(`${name} önbellekten`, true, `${(buffer.byteLength / 1048576).toFixed(2)} MB`);
      return buffer;
    }
  }
  r.section(`${name} indiriliyor`);
  const buffer = await fetcher(url, minBytes);
  try {
    mkdirSync(EPHE_DIR, { recursive: true });
    writeFileSync(local, buffer);
  } catch { /* salt okunur dizin — sorun değil */ }
  r.check(`${name} indirildi`, true, `${(buffer.byteLength / 1048576).toFixed(2)} MB`);
  return buffer;
}

/**
 * Asgari ZIP okuyucu: yerel dosya başlıklarını gezer, DEFLATE girdilerini
 * inflateRawSync ile açar. cities15000.zip tek dosyalık bir arşivdir;
 * yine de genel yazıldı — bayrak bit 3 (veri tanımlayıcısı) desteklenir.
 */
function unzipSingle(buffer, expectedName) {
  let offset = 0;
  while (offset + 30 <= buffer.byteLength) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break; // imza
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    let compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    let dataStart = offset + 30 + nameLen + extraLen;

    if ((flags & 0x08) && compSize === 0) {
      // Boyutlar veri tanımlayıcısında: imzayı ileri doğru ara.
      const sig = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
      const idx = buffer.indexOf(sig, dataStart);
      if (idx < 0) throw new Error(`${name}: veri tanımlayıcısı bulunamadı`);
      compSize = buffer.readUInt32LE(idx + 8);
    }

    const data = buffer.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;

    if (name === expectedName) {
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${name}: desteklenmeyen sıkıştırma yöntemi ${method}`);
    }
  }
  throw new Error(`${expectedName} arşivde bulunamadı`);
}

// --- 2) Ülkeler: ISO2 -> ad ------------------------------------------------

const countryBuffer = await obtain('countryInfo.txt', COUNTRY_SOURCE, 3_000, fetchText);
const countryNames = new Map();
for (const line of countryBuffer.toString('utf8').split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue;
  const f = line.split('\t');
  if (f.length > 4 && f[0].length === 2) countryNames.set(f[0], f[4]);
}
r.check('ülke adları çözüldü', countryNames.size >= 240, `${countryNames.size} ülke`);

// --- 3) Şehirler -----------------------------------------------------------

const zipBuffer = await obtain('cities15000.zip', CITY_SOURCE, 2_000_000, fetchText);
const tsv = unzipSingle(zipBuffer, 'cities15000.txt').toString('utf8');

/*
 * GeoNames kolonları: 0 geonameid, 1 ad, 2 ascii ad, 3 alternatif adlar,
 * 4 enlem, 5 boylam, 6-7 özellik, 8 ülke kodu, ..., 14 nüfus,
 * 17 saat dilimi (IANA), 18 değişiklik tarihi.
 */
const rows = [];
let skipped = 0;
for (const line of tsv.split('\n')) {
  if (!line.trim()) continue;
  const f = line.split('\t');
  if (f.length < 18) { skipped++; continue; }
  const latitude = Number(f[4]);
  const longitude = Number(f[5]);
  const population = Number(f[14] || 0);
  const timezone = f[17];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    || !timezone) {
    skipped++;
    continue;
  }
  rows.push({
    name: f[1],
    asciiName: f[2] || f[1],
    latitude,
    longitude,
    countryCode: f[8],
    country: countryNames.get(f[8]) ?? f[8],
    timezone,
    population: Number.isFinite(population) ? population : 0,
  });
}

r.check('şehir satırları ayrıştırıldı', rows.length >= 20_000,
  `${rows.length} şehir (${skipped} satır atlandı)`);

// Nüfusa göre sırala: arama sonuçlarında büyük şehirler önde dursun.
rows.sort((a, b) => b.population - a.population);

const header = '# swisseph-wasm geo — kaynak: GeoNames cities15000 (CC-BY 4.0)';
const body = rows.map((c) =>
  [c.name, c.asciiName, c.latitude, c.longitude, c.countryCode, c.country, c.timezone, c.population]
    .join('\t'),
).join('\n');
mkdirSync(GEO_DIR, { recursive: true });
writeFileSync(OUT_TSV, `${header}\n${body}\n`);

const sha256 = createHash('sha256').update(readFileSync(OUT_TSV)).digest('hex');
const manifest = {
  file: 'cities.tsv',
  sha256,
  rows: rows.length,
  columns: ['name', 'asciiName', 'latitude', 'longitude', 'countryCode', 'country', 'timezone', 'population'],
  source: CITY_SOURCE,
  countrySource: COUNTRY_SOURCE,
  license: LICENSE,
  generatedAt: new Date().toISOString().slice(0, 10),
  note: 'Üretilmiş dosya — elle düzenlemeyin: node tools/build-geo-package.mjs',
};
writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

r.check('cities.tsv yazıldı', true,
  `${(readFileSync(OUT_TSV).byteLength / 1048576).toFixed(2)} MB, sha256 ${sha256.slice(0, 12)}…`);
r.check('manifest yazıldı', true, `${rows.length} satır`);
r.finish('Coğrafi veri paketi hazır.');
