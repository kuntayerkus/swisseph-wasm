#!/usr/bin/env node
/**
 * Kürasyon yıldız tablosunu sefstars.txt'ten üretir.
 *
 * Elle yazılmış metadata sessiz hata üretiyor: mevcut listede Betelgeuse'un
 * kadiri 0.50 yazıyordu, katalogda 0.42. Adlandırma ve kadir katalogdan
 * gelmeli — sabitlerde uyguladığımız ilkenin aynısı.
 *
 * Gruplandırmalar YALNIZCA kaynaklandırılabilir olanlar:
 *   royal     — Pers geleneğinin dört Bekçisi
 *   behenian  — Agrippa'nın 15 ortaçağ yıldızı
 *   bright    — kadir < 2.0, katalogdan nesnel olarak seçilir
 *
 * "Tıbbi", "psikolojik", "karmik" gibi gruplar KASTEN yok: bunların
 * kaynaklandırılabilir bir yıldız ataması bulunmuyor ve uydurmak, projenin
 * geri kalanındaki doğrulama ilkesine aykırı olurdu.
 *
 *   node tools/generate-stars.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'packages', 'core', 'src', 'generated', 'stars.ts');

const CATALOGUE = join(EPHE_DIR, 'sefstars.txt');
if (!existsSync(CATALOGUE)) {
  console.error(`\nsefstars.txt bulunamadı: ${CATALOGUE}`);
  console.error('SWISSEPH_EPHE_PATH ayarlayın.\n');
  process.exit(1);
}

/*
 * Pers geleneğinin dört Bekçisi.
 *
 * `meaning` metinleri İNGİLİZCE: üretilmiş tabloya girip oradan public API'ye
 * (CuratedStar.meaning) ve MCP çıktısına geçiyorlar, yani yorum değil DIŞARI
 * ÇIKAN VERİ. Buradaki dili değiştirmek yayınlanan paketin dilini değiştirir.
 * Türkçe bıraksaydık, yeniden üretimde geri gelirdi.
 */
const ROYAL = [
  ['Aldebaran', 'Watcher of the East — the eye of the Bull'],
  ['Regulus', 'Watcher of the North — the heart of the Lion'],
  ['Antares', 'Watcher of the West — the heart of the Scorpion'],
  ['Fomalhaut', 'Watcher of the South — the mouth of the Southern Fish'],
];

/** Agrippa, De Occulta Philosophia — 15 Behenian yıldızı. */
const BEHENIAN = [
  'Algol', 'Alcyone', 'Aldebaran', 'Capella', 'Sirius', 'Procyon',
  'Regulus', 'Alkaid', 'Algorab', 'Spica', 'Arcturus', 'Alphecca',
  'Antares', 'Vega', 'Deneb Algedi',
];

/** Astrolojik yazında sık geçen diğer yıldızlar. */
const NOTABLE = [
  'Acrux', 'Alnilam', 'Altair', 'Achernar', 'Bellatrix', 'Betelgeuse',
  'Canopus', 'Castor', 'Deneb', 'Denebola', 'Diadem', 'Facies',
  'Hamal', 'Menkar', 'Mirfak', 'Mirach', 'Polaris', 'Pollux',
  'Rigel', 'Schedar', 'Scheat', 'Sadalmelik', 'Sadalsuud', 'Toliman',
  'Vindemiatrix', 'Zosma', 'Zubenelgenubi', 'Zubeneshamali', 'Unukalhai',
  'Alphard', 'Alnitak', 'Alhena', 'Markab', 'Alpheratz', 'Algenib',
];

/** Kadiri bu değerden parlak yıldızlar 'bright' grubuna girer. */
const BRIGHT_LIMIT = 2.0;

// --- katalog ayrıştırma --------------------------------------------------

/**
 * sefstars.txt satır biçimi (dosya başlığında belgelenmiş):
 *   geleneksel ad, nomenklatür, ekinoks, RA sa, dk, sn,
 *   dek der, dk, sn, öz hareket RA, öz hareket dek,
 *   radyal hız, paralaks, kadir, DM bölgesi, DM numarası
 */
const records = new Map();       // geleneksel ad (küçük harf) -> kayıt
const byDesignation = new Map(); // nomenklatür -> kayıt

for (const line of readFileSync(CATALOGUE, 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const parts = line.split(',');
  if (parts.length < 14) continue;

  const traditional = parts[0].trim();
  const designation = parts[1].trim();
  const magnitude = Number(parts[13]);
  if (!traditional || !designation || !Number.isFinite(magnitude)) continue;

  // '#' ile başlayan satırlar katalogda yorumlanmış kayıtlar.
  if (traditional.startsWith('#')) continue;

  // Kadir tam 0 olan 15 kayıt yıldız değil, referans noktası: galaktik
  // kutup, galaktik ekvator, sıfır noktaları. Katalog bunlara kadir
  // vermediği için alan 0 kalıyor — parlaklık sıralamasına sokulmamalılar.
  if (magnitude === 0) continue;

  const record = { traditional, designation, magnitude };
  // Aynı ad birden çok kez geçebiliyor; ilkini tutuyoruz.
  const key = traditional.toLowerCase().replace(/\s+/g, '');
  if (!records.has(key)) records.set(key, record);
  if (!byDesignation.has(designation)) byDesignation.set(designation, record);
}

console.log(`sefstars.txt: ${records.size} benzersiz geleneksel ad okundu.`);

function lookup(name) {
  return records.get(name.toLowerCase().replace(/\s+/g, ''));
}

// --- gruplandırma --------------------------------------------------------

const missing = [];
const stars = new Map();   // designation -> { ...record, groups, meaning }

function add(name, group, meaning) {
  const record = lookup(name);
  if (!record) { missing.push(`${name} (${group})`); return; }

  const existing = stars.get(record.designation);
  if (existing) {
    if (!existing.groups.includes(group)) existing.groups.push(group);
    if (meaning && !existing.meaning) existing.meaning = meaning;
    return;
  }
  stars.set(record.designation, { ...record, groups: [group], meaning });
}

for (const [name, meaning] of ROYAL) add(name, 'royal', meaning);
for (const name of BEHENIAN) add(name, 'behenian');
for (const name of NOTABLE) add(name, 'notable');

// 'bright' grubu katalogdan nesnel olarak: elle liste yok.
for (const record of byDesignation.values()) {
  if (record.magnitude >= BRIGHT_LIMIT) continue;
  const existing = stars.get(record.designation);
  if (existing) existing.groups.push('bright');
  else stars.set(record.designation, { ...record, groups: ['bright'] });
}

if (missing.length) {
  console.error(`\nKatalogda bulunamayan ${missing.length} ad:`);
  for (const name of missing) console.error(`  ${name}`);
  console.error('\nUydurma ad yayınlanmamalı. Durduruluyor.\n');
  process.exit(1);
}

const sorted = [...stars.values()].sort((a, b) => a.magnitude - b.magnitude);
const counts = {};
for (const star of sorted) {
  for (const group of star.groups) counts[group] = (counts[group] ?? 0) + 1;
}

// --- çıktı ---------------------------------------------------------------

const esc = (s) => JSON.stringify(s);

const body = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: sefstars.txt (Swiss Ephemeris sabit yıldız kataloğu)
 * Üreten: tools/generate-stars.mjs
 *
 * Adlandırma ve kadirler katalogdan okunuyor; elle yazılsalardı sessizce
 * yanlış olabilirlerdi (ilk elle yazımda Betelgeuse'un kadiri 0.42 yerine
 * 0.50 girilmişti).
 *
 * Yeniden üretmek için: node tools/generate-stars.mjs
 */
/* eslint-disable */

/** Bir yıldızın ait olduğu kürasyon grubu. */
export type StarGroup = 'royal' | 'behenian' | 'notable' | 'bright';

export interface CuratedStar {
  /** Katalogdaki geleneksel ad. */
  name: string;
  /**
   * Bayer/Flamsteed adlandırması, ör. "alTau".
   * Aramada bunu kullanın: katalog bazı yıldızları aynı adın farklı
   * yazımlarıyla iki kez içeriyor ve hangisinin döneceği platforma göre
   * değişebiliyor. byDesignation() bu belirsizliği kaldırır.
   */
  designation: string;
  /** Görünen kadir (V), katalogdan. */
  magnitude: number;
  /** Ait olduğu kürasyon grupları. */
  groups: StarGroup[];
  /** Geleneksel anlam — yalnızca kaynaklandırılabilir olanlarda. */
  meaning?: string;
}

/** Kürasyonlu yıldızların tamamı, kadire göre sıralı (parlaktan sönüğe). */
export const CURATED_STARS: readonly CuratedStar[] = [
${sorted.map((s) =>
  `  { name: ${esc(s.traditional)}, designation: ${esc(s.designation)}, ` +
  `magnitude: ${s.magnitude}, groups: [${s.groups.map(esc).join(', ')}]` +
  (s.meaning ? `, meaning: ${esc(s.meaning)}` : '') + ' },',
).join('\n')}
];

/** Grup başına yıldız sayısı — tanılama ve belgeler için. */
export const STAR_GROUP_COUNTS: Readonly<Record<StarGroup, number>> = {
  royal: ${counts.royal ?? 0},
  behenian: ${counts.behenian ?? 0},
  notable: ${counts.notable ?? 0},
  bright: ${counts.bright ?? 0},
};

/** 'bright' grubunun kadir sınırı. */
export const BRIGHT_MAGNITUDE_LIMIT = ${BRIGHT_LIMIT};
`;

writeFileSync(OUT, body);

console.log(`\nGruplar:`);
for (const [group, n] of Object.entries(counts)) {
  console.log(`  ${group.padEnd(10)} ${String(n).padStart(4)} yıldız`);
}
console.log(`\n  ${'TOPLAM'.padEnd(10)} ${String(sorted.length).padStart(4)} benzersiz yıldız`);
console.log(`\nYazıldı: packages/core/src/generated/stars.ts`);
