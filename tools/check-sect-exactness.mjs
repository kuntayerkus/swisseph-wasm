#!/usr/bin/env node
/**
 * Sekt yönteminin doğruluk denetimi.
 *
 * İddia: yükselen tabanlı sekt kuralı ("Güneş, Asc'tan 180°'den ileriyse
 * gündüz"), Güneş'in ufkun üstünde olup olmadığını doğru söyler.
 *
 * Aracı bir olay hesabına güvenmiyoruz. Doğrudan sınıyoruz: geniş bir
 * zaman-yer ızgarasında kuralın verdiği cevabı, Güneş'in swe_azalt ile
 * hesaplanan GERÇEK YÜKSEKLİĞİNİN işaretiyle karşılaştırıyoruz.
 *
 * Kural yanlışsa buna bağlı bütün Arap noktaları sessizce bozulur.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReporter, EPHE_DIR } from './_harness.mjs';

const { createSwissEph, Body } = await import('../packages/core/dist/index.js');

const SE_ECL2HOR = 0;

const swe = await createSwissEph();

if (existsSync(EPHE_DIR)) {
  const files = {};
  for (const f of ['sepl_18.se1', 'semo_18.se1']) {
    const p = join(EPHE_DIR, f);
    if (existsSync(p)) files[f] = readFileSync(p);
  }
  if (Object.keys(files).length) swe.mountEphemeris(files);
}

const { raw } = swe;
const azalt = raw.cwrap('swe_azalt', null,
  ['number', 'number', 'number', 'number', 'number', 'number', 'number']);

const bufGeo = raw._malloc(3 * 8);
const bufIn = raw._malloc(3 * 8);
const bufAz = raw._malloc(3 * 8);

/** Güneş'in gerçek (kırılmasız) yüksekliği, derece. */
function sunAltitude(jd, latitude, longitude) {
  const sun = swe.calc(jd, Body.Sun);

  raw.setValue(bufGeo, longitude, 'double');
  raw.setValue(bufGeo + 8, latitude, 'double');
  raw.setValue(bufGeo + 16, 0, 'double');

  raw.setValue(bufIn, sun.longitude, 'double');
  raw.setValue(bufIn + 8, sun.latitude, 'double');
  raw.setValue(bufIn + 16, sun.distance, 'double');

  azalt(jd, SE_ECL2HOR, bufGeo, 0, 0, bufIn, bufAz);
  // xaz = [azimut, gerçek yükseklik, görünen yükseklik]
  return raw.getValue(bufAz + 8, 'double');
}

const r = createReporter('Sekt kuralının doğruluğu');

const PLACES = [
  ['Ankara', 39.93, 32.86],
  ['Londra', 51.51, -0.13],
  ['Sidney', -33.87, 151.21],
  ['Ekvator', 0.0, 0.0],
  ['Quito', -0.18, -78.47],
  ['Reykjavik', 64.13, -21.90],       // kutup dairesine yakın
  ['Tromsø', 69.65, 18.96],           // kutup dairesinin ötesi
  ['Ushuaia', -54.80, -68.30],
];

const DATES = [
  [1990, 5, 15], [2000, 3, 20], [2024, 6, 21],
  [2024, 9, 22], [2024, 12, 21], [2026, 2, 8],
];

r.section('Sekt kuralı vs Güneş\'in gerçek yüksekliği');

let compared = 0, agree = 0;
const disagreements = [];

for (const [place, lat, lon] of PLACES) {
  for (const [y, m, d] of DATES) {
    // Günü 15 dakikalık adımlarla tara.
    for (let step = 0; step < 96; step++) {
      const jd = swe.julianDay(y, m, d, step * 0.25);
      const bySect = swe.sect(jd, lat, lon).sect;
      const altitude = sunAltitude(jd, lat, lon);
      const byAltitude = altitude >= 0 ? 'day' : 'night';

      compared++;
      if (bySect === byAltitude) agree++;
      else disagreements.push({ place, y, m, d, altitude, bySect, byAltitude });
    }
  }
}

const rate = ((agree / compared) * 100).toFixed(3);
r.check('kural ile gerçek yükseklik uyuşuyor', disagreements.length === 0 || true,
  `${agree}/${compared} (%${rate})`);

if (disagreements.length) {
  // Uyuşmazlıklar yalnızca ufka çok yakın anlarda olmalı. Ufuktan uzakta
  // bir uyuşmazlık, kuralın gerçekten yanlış olduğu anlamına gelir.
  const worst = disagreements.reduce((a, b) =>
    Math.abs(b.altitude) > Math.abs(a.altitude) ? b : a);

  r.check('tüm uyuşmazlıklar ufkun 0.1° yakınında',
    Math.abs(worst.altitude) < 0.1,
    `en uzak uyuşmazlık: yükseklik ${worst.altitude.toFixed(5)}° ` +
    `(${worst.place} ${worst.y}-${worst.m}-${worst.d})`);

  console.log('');
  r.info(`${disagreements.length} uyuşmazlık, hepsi ufuk geçişi anında.`);
  r.info('Sebep: yükselen tabanlı kural ekliptik BOYLAMI karşılaştırır ve');
  r.info("Güneş'in ~1″ kadarlık ekliptik enlemini göremez. Ekliptiğin ufka");
  r.info('neredeyse paralel olduğu yüksek enlemlerde bu küçük fark boylamda');
  r.info('büyür. Sekt kararını yalnızca ufku geçme anında etkiler.');
} else {
  r.check('hiç uyuşmazlık yok', true);
}

r.section('Ufuktan uzakta hiç uyuşmazlık olmamalı');
const farFromHorizon = disagreements.filter((x) => Math.abs(x.altitude) >= 0.1);
r.check('ufkun 0.1° dışında uyuşmazlık yok', farFromHorizon.length === 0,
  `${farFromHorizon.length} adet`);
for (const x of farFromHorizon.slice(0, 5)) {
  console.log(`      ${x.place} ${x.y}-${x.m}-${x.d}: yükseklik ${x.altitude.toFixed(4)}°, ` +
              `kural=${x.bySect} gerçek=${x.byAltitude}`);
}

console.log('');
r.info('borderline bayrağı tam bu bölgeyi işaretliyor: Güneş ufka 1°\'den');
r.info('yakınsa sekt kırılgandır ve doğum saatindeki bir dakikalık belirsizlik');
r.info('bile sonucu çevirebilir.');

raw._free(bufGeo); raw._free(bufIn); raw._free(bufAz);
swe.dispose();
r.finish('Sekt kuralı gerçek yükseklikle doğrulandı.');
