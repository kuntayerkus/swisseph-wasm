#!/usr/bin/env node
/**
 * Açıları Swiss Ephemeris'ten BAĞIMSIZ olarak doğrular.
 *
 * Altın korpus, WASM build'inin native Swiss Ephemeris ile aynı sayıları
 * verdiğini kanıtlıyor — ama ikisi de aynı kodsa ortak bir hata görünmezdi.
 * Burada Tepe Noktası ve Yükselen'i küresel astronominin standart
 * formülleriyle sıfırdan hesaplayıp karşılaştırıyoruz.
 *
 *   RAMC = yerel yıldız zamanı (derece)
 *   MC   : tan(MC) = tan(RAMC) / cos(ε)
 *   ASC  : cot(ASC) = −(tan(φ)·sin(ε) + sin(RAMC)·cos(ε)) / cos(RAMC)
 *
 * Bir uyuşmazlık, kütüphanenin açı hesabında ya da bizim onu çağırış
 * biçimimizde (enlem/boylam sırası, UT/ET karışıklığı) sorun demektir.
 */

import { createReporter } from './_harness.mjs';

const { createSwissEph, Body } = await import('../packages/core/dist/index.js');

const DEG = Math.PI / 180;
const norm = (d) => ((d % 360) + 360) % 360;

/**
 * Greenwich ortalama yıldız zamanı, derece.
 * IAU 1982 serisi (Meeus, Astronomical Algorithms, bölüm 12).
 */
function gmstDegrees(jdUt) {
  const T = (jdUt - 2451545.0) / 36525.0;
  return norm(
    280.46061837
    + 360.98564736629 * (jdUt - 2451545.0)
    + 0.000387933 * T * T
    - (T * T * T) / 38710000.0,
  );
}

/** Ekliptiğin ortalama eğikliği, derece (IAU 1980). */
function meanObliquity(jdUt) {
  const T = (jdUt - 2451545.0) / 36525.0;
  return 23.439291111
    - 0.0130041667 * T
    - 1.638889e-7 * T * T
    + 5.036111e-7 * T * T * T;
}

/** Tepe Noktası: ekliptiğin meridyeni kestiği nokta. */
function midheaven(ramc, obliquity) {
  const mc = Math.atan2(
    Math.sin(ramc * DEG),
    Math.cos(ramc * DEG) * Math.cos(obliquity * DEG),
  ) / DEG;
  return norm(mc);
}

/** Yükselen: ekliptiğin doğu ufkunu kestiği nokta. */
function ascendant(ramc, obliquity, latitude) {
  const e = obliquity * DEG;
  const phi = latitude * DEG;
  const r = ramc * DEG;
  // atan2 biçimi, kotanjant formülünün çeyrek belirsizliğini ortadan kaldırır.
  const asc = Math.atan2(
    Math.cos(r),
    -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e)),
  ) / DEG;
  return norm(asc);
}

const swe = await createSwissEph();
const r = createReporter('Açıların bağımsız doğrulaması');

const PLACES = [
  ['Ankara', 39.93, 32.86],
  ['Londra', 51.51, -0.13],
  ['New York', 40.71, -74.01],
  ['Sidney', -33.87, 151.21],
  ['Ekvator/Greenwich', 0.0, 0.0],
  ['Tokyo', 35.68, 139.69],
  ['Buenos Aires', -34.60, -58.38],
];
const MOMENTS = [
  [1990, 5, 15, 14.5], [2000, 1, 1, 0], [2024, 6, 21, 6],
  [2026, 2, 8, 18.25], [1975, 11, 3, 9.75],
];

r.section('Tepe Noktası ve Yükselen — kütüphane vs klasik formül');

let worstMc = 0, worstMcWhere = '', worstAsc = 0, worstAscWhere = '', compared = 0;

for (const [place, lat, lon] of PLACES) {
  for (const [y, m, d, hour] of MOMENTS) {
    const jd = swe.julianDay(y, m, d, hour);
    const houses = swe.houses(jd, lat, lon);

    // Gerçek eğiklik ve gerçek yıldız zamanı için nütasyonu ekliyoruz:
    // Swiss Ephemeris açıları GERÇEK (apparent) değerlerle hesaplıyor.
    const nut = swe.calc(jd, -1 /* SE_ECL_NUT */);
    const trueObliquity = nut.latitude;          // xx[1] = gerçek eğiklik
    const nutationInLongitude = nut.distance;    // xx[2] = boylamda nütasyon

    const ramc = norm(
      gmstDegrees(jd)
      + nutationInLongitude * Math.cos(trueObliquity * DEG)   // denklemin eşitliği
      + lon,
    );

    const mcRef = midheaven(ramc, trueObliquity);
    const ascRef = ascendant(ramc, trueObliquity, lat);

    const diff = (a, b) => {
      let x = Math.abs(a - b);
      return x > 180 ? 360 - x : x;
    };

    const mcDiff = diff(houses.midheaven, mcRef);
    const ascDiff = diff(houses.ascendant, ascRef);
    compared++;

    if (mcDiff > worstMc) { worstMc = mcDiff; worstMcWhere = `${place} ${y}-${m}-${d}`; }
    if (ascDiff > worstAsc) { worstAsc = ascDiff; worstAscWhere = `${place} ${y}-${m}-${d}`; }
  }
}

/*
 * Eşik 0.01° = 36 yay-saniyesi.
 *
 * Referans formüller ORTALAMA yıldız zamanına ve basit bir nütasyon
 * düzeltmesine dayanıyor; Swiss Ephemeris tam IAU serilerini kullanıyor.
 * Kalan fark bu modelleme farkından geliyor, hesap hatasından değil.
 * Bir sıra hatası (enlem/boylam takası, işaret hatası, UT/ET karışıklığı)
 * DERECELER mertebesinde sapma verirdi ve bu eşiği kolayca aşardı.
 */
const LIMIT = 0.01;

r.check(`${compared} an × yer karşılaştırıldı`, compared >= 30, `${compared}`);
r.check('Tepe Noktası klasik formülle uyuşuyor', worstMc < LIMIT,
  `en büyük fark ${worstMc.toFixed(5)}° = ${(worstMc * 3600).toFixed(1)}″  (${worstMcWhere})`);
r.check('Yükselen klasik formülle uyuşuyor', worstAsc < LIMIT,
  `en büyük fark ${worstAsc.toFixed(5)}° = ${(worstAsc * 3600).toFixed(1)}″  (${worstAscWhere})`);

r.section('Enlem/boylam sırası doğru mu');
{
  // Sıra takas edilirse sonuç dramatik biçimde değişmeli. Değişmiyorsa
  // testin kendisi bir şey ölçmüyor demektir.
  const jd = swe.julianDay(1990, 5, 15, 14.5);
  const correct = swe.houses(jd, 39.93, 32.86);
  const swapped = swe.houses(jd, 32.86, 39.93);
  let d = Math.abs(correct.ascendant - swapped.ascendant);
  if (d > 180) d = 360 - d;
  r.check('enlem/boylam takası belirgin fark yaratıyor', d > 1,
    `${d.toFixed(2)}° — sıra anlamlı, testler gerçekten bir şey ölçüyor`);
}

r.section('Bilinen ilişkiler');
{
  const jd = swe.julianDay(1990, 5, 15, 14.5);
  const h = swe.houses(jd, 39.93, 32.86);

  // Placidus'ta 1. ev = Yükselen, 10. ev = Tepe Noktası (tanım gereği).
  r.check('1. ev = Yükselen', Math.abs(h.cusps[0] - h.ascendant) < 1e-9);
  r.check('10. ev = Tepe Noktası', Math.abs(h.cusps[9] - h.midheaven) < 1e-9);

  // Karşıt evler tam 180° ayrık olmalı.
  let worstOpposition = 0;
  for (let i = 0; i < 6; i++) {
    const opposite = norm(h.cusps[i] + 180);
    let d = Math.abs(opposite - h.cusps[i + 6]);
    if (d > 180) d = 360 - d;
    worstOpposition = Math.max(worstOpposition, d);
  }
  r.check('karşıt evler tam 180° ayrık', worstOpposition < 1e-9,
    `en büyük sapma ${(worstOpposition * 3600).toExponential(1)}″`);

  // Ev başlangıçları burç yönünde artmalı.
  let monotonic = true;
  for (let i = 0; i < 11; i++) {
    if (norm(h.cusps[i + 1] - h.cusps[i]) > 180) monotonic = false;
  }
  r.check('ev başlangıçları burç yönünde sıralı', monotonic);
}

swe.dispose();
r.finish('Açılar bağımsız formüllerle doğrulandı.');
