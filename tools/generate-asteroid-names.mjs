#!/usr/bin/env node
/**
 * Genişletilmiş asteroid ad tablolarını üretir.
 *
 * Adlar KAYNAKTAN okunur — elle yazılmaz. Kaynak, Astrodienst'in resmi
 * `seasnam.txt` dosyası (numara + ad, tüm numaralı asteroidler). Elle
 * yazılan bir ad tablosu, sabit yıldız kürasyonunda yaşananın aynısını
 * üretirdi (Betelgeuse kadiri 0.42 yerine 0.50): sessiz, fark edilmez hata.
 *
 * Kürasyon kararı burada: ilk 100 numaralı asteroid (tarihsel ana kuşak
 * kümesi, tamamı adlandırılmış, en sık istenen kademe) + paket paket
 * yayınlanan 16 küratörlü cisim. Sayılar burada, adlar kaynakta.
 *
 *   node tools/generate-asteroid-names.mjs
 *
 * seasnam.txt önce SWISSEPH_EPHE_PATH (veya ../swiss/ephe) dizininde
 * aranır; yoksa aynadan indirilir ve önbelleğe yazılır.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'packages', 'core', 'src', 'generated', 'asteroid-names.ts');

const MIRROR = 'https://ephe.scryr.io/ephe';
const FALLBACK = 'https://raw.githubusercontent.com/aloistr/swisseph/master/ephe';
const CANONICAL_SOURCE = 'https://github.com/aloistr/swisseph (Astrodienst)';
const NAME_FILE = 'seasnam.txt';

/**
 * Kürasyon: ilk 100 numaralı asteroid.
 *
 * Neden ilk 100: tamamı 19. yüzyılda keşfedilmiş ve adlandırılmış tarihsel
 * ana kuşak cisimleri; astroloji yazılımlarının "genişletilmiş" kademeleri
 * bu kümeyle başlar. Kademeyi büyütmek bu listeyi genişletmek demek —
 * tablo üretimi kendiliğinden izler.
 */
const FIRST_N = 100;

/** tools/build-asteroid-package.mjs ile birebir aynı 16 cisim. */
const CURATED = [5, 10, 16, 433, 1181, 7066, 10199, 20000, 28978,
  50000, 90377, 90482, 136108, 136199, 136472, 225088];

async function fetchNames() {
  const local = join(EPHE_DIR, NAME_FILE);
  if (existsSync(local)) {
    console.log(`Kaynak: ${local}`);
    return readFileSync(local, 'utf8');
  }

  for (const base of [MIRROR, FALLBACK]) {
    const url = `${base}/${NAME_FILE}`;
    console.log(`İndiriliyor: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length < 1_000_000) {
        throw new Error(`beklenmedik kadar küçük (${text.length} bayt)`);
      }
      // Önbelleğe al — sonraki koşular ağa değmesin.
      try {
        mkdirSync(EPHE_DIR, { recursive: true });
        writeFileSync(local, text);
        console.log(`Önbelleğe yazıldı: ${local}`);
      } catch { /* salt okunur dizin — sorun değil */ }
      return text;
    } catch (error) {
      console.log(`  başarısız: ${error.message}`);
    }
  }
  throw new Error(
    `${NAME_FILE} ne ${EPHE_DIR} dizininde bulundu ne de indirilebildi.`);
}

/** seasnam.txt: `000001  Ceres` — sıfır dolgulu altı hane, boşluk, ad. */
function parse(text) {
  const names = new Map();
  for (const line of text.split('\n')) {
    const m = /^(\d{6})\s{1,4}(\S.*)$/.exec(line.trim());
    if (!m) continue;
    const number = Number(m[1]);
    const name = m[2].trim();
    if (number > 0 && name) names.set(number, name);
  }
  return names;
}

const wanted = new Set([
  ...Array.from({ length: FIRST_N }, (_, i) => i + 1),
  ...CURATED,
]);

const names = parse(await fetchNames());
const missing = [...wanted].filter((n) => !names.has(n));
if (missing.length) {
  throw new Error(`Kaynakta eksik ad var: ${missing.join(', ')}`);
}

const entries = [...wanted]
  .sort((a, b) => a - b)
  .map((n) => ({ number: n, name: names.get(n) }));

const generatedAt = new Date().toISOString().slice(0, 10);
const body = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: seasnam.txt (Astrodienst'in numaralı asteroid ad listesi)
 * Kanonik kaynak: ${CANONICAL_SOURCE}
 * Üreten: tools/generate-asteroid-names.mjs (${generatedAt})
 *
 * Adlar kaynaktan okundu, elle yazılmadı. Kürasyon kararı üreteçte:
 * ilk ${FIRST_N} numaralı asteroid + yayınlanan 16 küratörlü cisim.
 *
 * Yeniden üretmek için: node tools/generate-asteroid-names.mjs
 */
/* eslint-disable */

/** Numarası ve resmi adı bilinen bir asteroid. */
export interface NamedAsteroid {
  /** Küçük gezegen numarası — \`asteroidBody()\` ve \`asteroidFile()\` bunu alır. */
  number: number;
  /** MPC resmi adı, kaynaktan. */
  name: string;
}

/**
 * Genişletilmiş kademe: ilk ${FIRST_N} numaralı asteroid + 16 küratörlü cisim.
 *
 * Numaraya göre sıralı. Dosyaları pakete dahil DEĞİLDİR — seçici yükleme
 * için \`loadAsteroids()\` kullanılır.
 */
export const EXTENDED_ASTEROIDS: readonly NamedAsteroid[] = [
${entries.map((e) => `  { number: ${e.number}, name: ${JSON.stringify(e.name)} },`).join('\n')}
];

/** Numaradan ada; bilinmeyen numarada \`undefined\`. */
export const extendedAsteroidName = (number: number): string | undefined =>
  EXTENDED_ASTEROIDS.find((a) => a.number === number)?.name;
`;

writeFileSync(OUT, body);
console.log(`\nYazıldı: ${OUT}`);
console.log(`  ${entries.length} asteroid (ilk ${FIRST_N} + ${CURATED.length} küratörlü, kesişim düşülmüş)`);
console.log(`  örnek: ${entries.slice(0, 3).map((e) => `${e.number} ${e.name}`).join(', ')} ... ` +
  `${entries.slice(-2).map((e) => `${e.number} ${e.name}`).join(', ')}`);
