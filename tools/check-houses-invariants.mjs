#!/usr/bin/env node
/**
 * Ev sistemleri değişmez denetimi — golden korpustan BAĞIMSIZ ikinci katman.
 *
 * Golden korpus "WASM native ile aynı sayıyı veriyor" der; bu betik ise
 * "o sayıların kendisi geometrik olarak tutarlı mı" diye sorar: her ev
 * sisteminin TANIMINDAN türeyen özellikler, bağımsız formüllerle sınanır.
 *
 *   node tools/check-houses-invariants.mjs
 *
 * Kapsam: 25 sistem × 12 yer (her iki yarımküre, tropikler, kutup dairesi
 * içi ve dışı) × 8 an. ASC/MC klasik küresel astronomi formülleriyle,
 * sistem tanımları kendi iç tutarlılıklarıyla denetlenir.
 */

import { createReporter } from './_harness.mjs';
import { createSwissEph } from '../packages/core/dist/index.js';

const r = createReporter('Ev sistemleri değişmez denetimi');
const DEG = Math.PI / 180;
const norm = (x) => ((x % 360) + 360) % 360;

const diff = (a, b) => {
  const x = Math.abs(norm(a) - norm(b));
  return x > 180 ? 360 - x : x;
};

/** Küresel astronomi: RAMC + eğiklik + enlemden Yükselen (klasik formül).
 * check-angles-independent.mjs ile birebir aynı, orada doğrulanmış hâli. */
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

/** Tepe Noktası: tan(MC) = tan(RAMC) / cos(e). */
function midheaven(ramc, obliquity) {
  const mc = Math.atan2(
    Math.sin(ramc * DEG),
    Math.cos(ramc * DEG) * Math.cos(obliquity * DEG),
  );
  return norm(mc / DEG);
}

const PLACES = [
  ['Ankara', 39.93, 32.86],
  ['Londra', 51.51, -0.13],
  ['Sidney', -33.87, 151.21],
  ['Quito (ekvator)', 0.0, -78.5],
  ['New York', 40.71, -74.01],
  ['Tokyo', 35.68, 139.69],
  ['Reykjavik', 64.15, -21.94],
  ['Kapstadt', -33.92, 18.42],
  ['Mumbai', 19.08, 72.88],
  ['Ushuaia', -54.8, -68.3],
  ['Tromsø', 69.65, 18.96],
  ['Singapur', 1.35, 103.82],
];

const MOMENTS = [
  [1990, 1, 15, 3.25], [1990, 5, 15, 11.5], [1990, 8, 2, 22.75],
  [1990, 11, 20, 6.5], [2010, 2, 28, 14.0], [2010, 6, 21, 0.25],
  [2010, 10, 5, 17.5], [1985, 3, 21, 8.25],
];

const swe = await createSwissEph();

// --- 1) ASC/MC klasik formülle — sistemden bağımsız ----------------------
r.section('1) Yükselen ve Tepe Noktası — klasik küresel astronomi');

/*
 * Kutup dairesi içinde (|enlem| >= 66°) Yükselen formülü gerçek bir
 * belirsizlik taşır: ekliptik ufku neredeyse teğet keser ve çeyrek seçimi
 * 180° atlayabilir. Bu bir hesap hatası değil, geometrinin kendisi —
 * İsviçrelilerin kutup bölgesi için ayrı 'polar ascendant' kavramı var.
 * Bu yüzden Yükselen karşılaştırması kutup dairesi dışında yapılır;
 * Tepe Noktası her enlemde iyi koşullanmıştır.
 */
let worstAsc = 0, worstMc = 0, whereAsc = '', whereMc = '', worstAscLat = 0, compared = 0;
const nut = new Map(); // jd -> { obliquity }

for (const [place, lat, lon] of PLACES) {
  for (const [y, m, d, hour] of MOMENTS) {
    const jd = swe.julianDay(y, m, d, hour);
    const h = swe.houses(jd, lat, lon);

    if (!nut.has(jd)) {
      const n = swe.calc(jd, -1 /* SE_ECL_NUT */);
      nut.set(jd, n.latitude); // gerçek eğiklik
    }
    const eps = nut.get(jd);

    if (Math.abs(lat) < 66) {
      const dA = diff(h.ascendant, ascendant(h.armc, eps, lat));
      compared++;
      if (dA > worstAsc) { worstAsc = dA; whereAsc = `${place} ${y}-${m}-${d}`; worstAscLat = Math.abs(lat); }
    }
    const dM = diff(h.midheaven, midheaven(h.armc, eps));
    if (dM > worstMc) { worstMc = dM; whereMc = `${place} ${y}-${m}-${d}`; }
  }
}

/*
 * Eşik enlemle genişler: klasik formülün kalan farkı bir modelleme farkıdır
 * (SE tam IAU serilerini kullanır) ve tan²(φ) ile büyür — ölçüldü: 40°'de
 * ~4″, 51.5°'de ~9″, 64°'te ~68″. check:angles'ın 0.01° eşiği 55°'ye kadar
 * korunur; kutup dairesine yaklaşırken 0.03°'a açılır. Bir sıra/işaret hatası
 * DERECELER verir, bu eşiğin iki katı bile değil.
 */
const ASC_LIMIT_LOW = 0.01;  // |enlem| < 55
const ASC_LIMIT_HIGH = 0.03; // 55 <= |enlem| < 66
const ascLimit = worstAscLat < 55 ? ASC_LIMIT_LOW : ASC_LIMIT_HIGH;

r.check('Yükselen karşıtırmaları yapıldı', compared >= 80, `${compared}`);
r.check('Yükselen klasik formülle uyuşuyor', worstAsc < ascLimit,
  `en büyük fark ${(worstAsc * 3600).toFixed(2)}″, eşik ${(ascLimit * 3600).toFixed(0)}″  (${whereAsc})`);
r.check('Tepe Noktası klasik formülle uyuşuyor', worstMc < 0.01,
  `en büyük fark ${(worstMc * 3600).toFixed(2)}″  (${whereMc})`);

// --- 2) Sistem tanımları --------------------------------------------------
r.section('2) Sistem tanımları — her sistemin kendi geometrisi');

const QUADRANT = ['P', 'K', 'C', 'O', 'R', 'B', 'T', 'U', 'Y', 'L', 'Q'];
const EQUAL_ASC = ['A', 'E'];
let checked = 0;
const problems = [];

for (const [place, lat, lon] of PLACES) {
  // Kutup dairesi dışı: tüm sistemler tanımlı. |lat| < 66 seçildi.
  if (Math.abs(lat) >= 66) continue;
  for (const [y, m, d, hour] of MOMENTS) {
    const jd = swe.julianDay(y, m, d, hour);
    const at = (label, cond, detail) => {
      checked++;
      if (!cond) problems.push(`${place} ${y}-${m}-${d} ${hour}h: ${label} — ${detail}`);
    };

    const asc = swe.houses(jd, lat, lon).ascendant;
    const mc = swe.houses(jd, lat, lon).midheaven;
    const ic = norm(mc + 180);

    // Dörtlü sistemler: köşeler ASC/MC'ye kilitli, karşıtlar 180°.
    // 'Y' (APC) köşelerde ASC/MC'ye kilitlidir ama karşıt uçları BAĞIMSIZ
    // tanımlanır — karşıtlık denetimi ona uygulanamaz (ampirik doğrulandı).
    for (const sys of QUADRANT) {
      const h = swe.houses(jd, lat, lon, sys);
      if (h.substituted) continue; // kutba yakın Porphyry'ye düşenler
      const c = h.cusps;
      at(`${sys} 1. ev = Yükselen`, diff(c[0], asc) < 1e-6, `cusp1=${c[0].toFixed(6)} asc=${asc.toFixed(6)}`);
      at(`${sys} 10. ev = Tepe Noktası`, diff(c[9], mc) < 1e-6, `cusp10=${c[9].toFixed(6)} mc=${mc.toFixed(6)}`);
      if (sys !== 'Y') {
        for (let i = 0; i < 6; i++) {
          at(`${sys} karşıt evler (${i + 1}/${i + 7})`, diff(c[i + 6], norm(c[i] + 180)) < 1e-6,
            `${c[i].toFixed(4)} + 180 vs ${c[i + 6].toFixed(4)}`);
        }
      }
    }

    // Eşit evler (Yükselen'den): cusp_i = ASC + 30(i-1).
    for (const sys of EQUAL_ASC) {
      const c = swe.houses(jd, lat, lon, sys).cusps;
      for (let i = 0; i < 12; i++) {
        at(`${sys} eşit adım ${i + 1}`, diff(c[i], norm(asc + 30 * i)) < 1e-9,
          `cusp=${c[i].toFixed(6)} beklenen=${norm(asc + 30 * i).toFixed(6)}`);
      }
    }

    // Eşit evler (Tepe'den): cusp10 = MC.
    {
      const c = swe.houses(jd, lat, lon, 'D').cusps;
      at('D 10. ev = Tepe Noktası', diff(c[9], mc) < 1e-9, `cusp10=${c[9].toFixed(6)}`);
      at('D eşit adımlar', diff(c[0], norm(mc - 270)) < 1e-9, `cusp1=${c[0].toFixed(6)}`);
    }

    // Vehlow: Yükselen 1. evin ORTASI.
    {
      const c = swe.houses(jd, lat, lon, 'V').cusps;
      at('V 1. ev başlangıcı = ASC-15', diff(c[0], norm(asc - 15)) < 1e-9, `cusp1=${c[0].toFixed(6)}`);
    }

    // Tam burç evleri: uçlar burç sınırlarında, 1. ev Yükselen'in burcu.
    {
      const c = swe.houses(jd, lat, lon, 'W').cusps;
      const signStart = Math.floor(asc / 30) * 30;
      at('W 1. ev = Yükselen burcunun başı', diff(c[0], signStart) < 1e-9,
        `cusp1=${c[0].toFixed(4)} burç başı=${signStart}`);
      for (let i = 0; i < 12; i++) {
        at(`W uç ${i + 1} burç sınırında`, Math.abs(c[i] % 30) < 1e-9 || Math.abs((c[i] % 30) - 30) < 1e-9,
          `cusp=${c[i].toFixed(6)}`);
      }
    }

    // 0° Koç'tan eşit: sabit.
    {
      const c = swe.houses(jd, lat, lon, 'N').cusps;
      for (let i = 0; i < 12; i++) {
        at('N uçlar 0°Koç\'tan 30 adım', diff(c[i], 30 * i) < 1e-9, `cusp=${c[i].toFixed(6)}`);
      }
    }

    // Porphyry: her kadran üçe bölünür.
    {
      const c = swe.houses(jd, lat, lon, 'O').cusps;
      const q1 = norm(ic - asc);           // 1. kadran genişliği (ASC -> IC)
      const q2 = norm(norm(asc + 180) - ic); // IC -> DSC
      at('O 2. ev ASC+kadran/3', diff(c[1], norm(asc + q1 / 3)) < 1e-6, `${c[1].toFixed(6)}`);
      at('O 3. ev ASC+2·kadran/3', diff(c[2], norm(asc + 2 * q1 / 3)) < 1e-6, `${c[2].toFixed(6)}`);
      at('O 11. ev MC+kadran/3', diff(c[10], norm(mc + q2 / 3)) < 1e-6, `${c[10].toFixed(6)}`);
    }

    // Morinus: 1. ev ucu tam MC+90'da; karşıt uçlar 180° (ampirik, iki
    // yarımkürede doğrulandı). Meridyen sistemi: 10. ev = Tepe Noktası.
    {
      const c = swe.houses(jd, lat, lon, 'M').cusps;
      at('M 1. ev = MC+90', diff(c[0], norm(mc + 90)) < 1e-6, `cusp1=${c[0].toFixed(6)}`);
      for (let i = 0; i < 6; i++) {
        at(`M karşıt evler (${i + 1}/${i + 7})`, diff(c[i + 6], norm(c[i] + 180)) < 1e-6,
          `${c[i].toFixed(4)} + 180 vs ${c[i + 6].toFixed(4)}`);
      }
    }
    {
      const c = swe.houses(jd, lat, lon, 'X').cusps;
      at('X 10. ev = Tepe Noktası', diff(c[9], mc) < 1e-6, `cusp10=${c[9].toFixed(6)}`);
    }

    // Sripati: cusp1 = ASC − (ASC→MC yayı)/6; genişlikler Porphyry
    // kadranlarının üçte birlikleri, [30, a, a, 30, b, b] ×2 kalıbında
    // (Ankara ve Sidney'de ampirik doğrulandı).
    {
      const h = swe.houses(jd, lat, lon, 'S');
      const c = h.cusps;
      const q1 = norm(ic - asc) / 3;          // ASC→IC kadranının üçte biri
      const q2 = norm(norm(asc + 180) - ic) / 3; // IC→DSC kadranının üçte biri
      at('S 1. ev = ASC−(ASC−MC)/6', diff(c[0], norm(asc - norm(asc - mc) / 6)) < 1e-6,
        `cusp1=${c[0].toFixed(6)} beklenen=${norm(asc - norm(asc - mc) / 6).toFixed(6)}`);
      const pattern = [30, q1, q1, 30, q2, q2, 30, q1, q1, 30, q2, q2];
      for (let i = 0; i < 12; i++) {
        const width = norm(c[(i + 1) % 12] - c[i]);
        at(`S genişlik ${i + 1}`, Math.abs(width - pattern[i]) < 1e-6,
          `${width.toFixed(4)} beklenen ${pattern[i].toFixed(4)}`);
      }
    }

    // Gauquelin: 36 sektör; ASC/MC/DSC/IC sektör sınırıdır.
    {
      const h = swe.houses(jd, lat, lon, 'G');
      at('G 36 sektör', h.cusps.length === 36, `${h.cusps.length}`);
      for (const [name, angle] of [['ASC', asc], ['MC', mc], ['DSC', norm(asc + 180)], ['IC', ic]]) {
        const near = h.cusps.some((c) => diff(c, angle) < 1e-6);
        at(`G ${name} sektör sınırı`, near, `${name}=${angle.toFixed(4)}`);
      }
    }

    // Tüm sistemler: sonlu, 0-360 aralığında.
    for (const sys of ['A', 'B', 'C', 'D', 'F', 'H', 'I', 'i', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y']) {
      const h = swe.houses(jd, lat, lon, sys);
      const bad = h.cusps.find((c) => !Number.isFinite(c) || c < 0 || c >= 360);
      at(`${sys} değerler geçerli`, bad === undefined, `bozuk değer: ${bad}`);
    }
  }
}

r.check('sistem tanımı denetimi', problems.length === 0,
  problems.length === 0 ? `${checked} denetim geçti` : `${problems.length} SORUN`);
for (const p of problems.slice(0, 10)) console.log(`    ✗ ${p}`);

// --- 3) Kutup dairesi ötesi: Porphyry ikamesi -----------------------------
r.section('3) Kutup dairesi ötesi — Porphyry ikamesi');

{
  const jd = swe.julianDay(1990, 5, 15, 11.5);
  for (const lat of [75, 89]) {
    const porphyry = swe.houses(jd, lat, 32.86, 'O');
    for (const sys of ['P', 'K', 'G']) {
      const h = swe.houses(jd, lat, 32.86, sys);
      r.check(`|${lat}°| ${sys} ikame bayrağı`, h.substituted === true,
        h.warning ? `uyarı: ${h.warning.slice(0, 60)}` : 'bayrak yok');
      if (sys !== 'G') {
        const maxDiff = Math.max(...h.cusps.map((c, i) => diff(c, porphyry.cusps[i])));
        r.check(`|${lat}°| ${sys} uçları Porphyry ile aynı`, maxDiff < 1e-9,
          `en büyük fark ${maxDiff.toExponential(2)}°`);
      }
    }
  }
}

// --- 4) MCP referans haritası (bağımsız oturum çıktısı) -------------------
r.section('4) Ankara 1990-05-15 14:30 (+03) referansı');

{
  const jd = swe.julianDay(1990, 5, 15, 11.5); // 14:30 yerel, +03
  const h = swe.houses(jd, 39.93, 32.86);
  const toDms = (v) => {
    const deg = Math.floor(v);
    const min = Math.floor((v - deg) * 60);
    const sec = Math.round(((v - deg) * 60 - min) * 60);
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
  };
  r.check('Yükselen 20°38\'41" Başak', diff(h.ascendant, 170.6447) < 0.0003, toDms(h.ascendant));
  r.check('Tepe Noktası 19°14\'17" İkizler', diff(h.midheaven, 79.2381) < 0.0003, toDms(h.midheaven));
}

// --- 5) Üçüncü taraf yayın haritaları --------------------------------------
/*
 * Bağımsız yayımlanmış haritalarla çapraz doğrulama (2026-08-06'da alındı):
 *
 *   Einstein — astrotheme.com/astrology/Albert_Einstein
 *     1879-03-14 11:30 LMT, Ulm (48.4011 N, 9.9876 E).
 *     1879'da Ulm yerel ortalama zamanı UT+0:40; dolayısıyla 10:50 UT.
 *     Yayın: ASC 11°38' Yengeç, MC 12°50' Balık, Güneş 23°30' Balık.
 *
 *   JFK — astrotheme.com/astrology/John_Fitzgerald_Kennedy
 *     1917-05-29 15:00 EST (−5, ABD yaz saati 1918'de başladı), Brookline
 *     (42.3318 N, 71.1212 W). 20:00 UT.
 *     Yayın: ASC 20°00' Terazi, MC 23°46' Yengeç, Güneş 7°51' İkizler.
 *
 * Eşik 1 yay-dakikası: yayınlar dakikaya yuvarlar. Saatte ~15° dönen
 * Yükselen için 1' fark, UT'de 4 saniyelik bant demektir — ΔT ve
 * yuvarlama payı. Saat/dilim hatası DERECELERLE ölçülürdü.
 */
r.section('5) Üçüncü taraf yayın haritaları (Einstein, JFK)');

{
  const toDeg = (deg, min) => deg + min / 60;
  const einstein = swe.houses(swe.julianDay(1879, 3, 14, 10 + 50 / 60), 48.4011, 9.9876);
  r.check('Einstein ASC 11°38\' Yengeç', diff(einstein.ascendant, toDeg(101, 38)) < 1 / 60,
    `${einstein.ascendant.toFixed(4)}° (beklenen 101.6333°)`);
  r.check('Einstein MC 12°50\' Balık', diff(einstein.midheaven, toDeg(342, 50)) < 1 / 60,
    `${einstein.midheaven.toFixed(4)}° (beklenen 342.8333°)`);

  const jfk = swe.houses(swe.julianDay(1917, 5, 29, 20), 42.3318, -71.1212);
  r.check('JFK ASC 20°00\' Terazi', diff(jfk.ascendant, toDeg(200, 0)) < 1 / 60,
    `${jfk.ascendant.toFixed(4)}° (beklenen 200.0°)`);
  r.check('JFK MC 23°46\' Yengeç', diff(jfk.midheaven, toDeg(113, 46)) < 1 / 60,
    `${jfk.midheaven.toFixed(4)}° (beklenen 113.7667°)`);
}

swe.dispose();
r.finish('Ev sistemleri geometrik olarak tutarlı.');
