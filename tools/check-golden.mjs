#!/usr/bin/env node
/**
 * Sayısal parite doğrulaması — Faz 3'ün asıl işi.
 *
 * Altın korpustaki her satırı WASM build'inde tekrar oynatır ve native gcc
 * çıktısıyla karşılaştırır. İki taraf da aynı C kaynağı ama farklı derleyici
 * (gcc 13 vs clang/LLVM-WASM), farklı libm ve farklı hedef mimari kullanıyor.
 * Uyuşuyorlarsa port sayısal olarak sağlamdır.
 *
 * Karşılaştırma HAM WASM üzerinden yapılıyor, TypeScript API üzerinden değil:
 * fixture'daki iflag değerleri birebir geçirilmeli, API katmanı ise Flag.Speed
 * gibi bayrakları kendiliğinden ekliyor. API katmanı check-api.mjs ile ayrıca
 * doğrulanıyor.
 *
 *   node tools/check-golden.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSwissEph, EPHE_DIR } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, 'golden', 'golden.tsv.gz');

/**
 * Korpustaki yıllar 1500-2500'e yayıldığı için üç 600-yıllık dosya takımı
 * gerekiyor. Eksik dosya sessiz Moshier düşüşü demek — o durumda native ile
 * WASM farklı efemeris kullanır ve karşılaştırma anlamsızlaşır.
 */
const REQUIRED_FILES = [
  'sepl_12.se1', 'semo_12.se1', 'seas_12.se1',   // 1200-1799
  'sepl_18.se1', 'semo_18.se1', 'seas_18.se1',   // 1800-2399
  'sepl_24.se1', 'semo_24.se1', 'seas_24.se1',   // 2400-2999
  'sefstars.txt', 'seorbel.txt',
];

/* ---------------------------------------------------------------------------
 * Kabul ölçütleri
 *
 * Tek bir tolerans sayısı bu veriye uymuyor, çünkü sütunlar fiziksel olarak
 * farklı büyüklükler: derece, AU, derece/gün, AU/gün. Hepsini tek bağıl
 * farkla ölçmek iki yönde de yanıltır — Deneb'in 8.9e7 AU uzaklığında
 * anlamsız görünen bir mutlak fark, sıfıra yakın bir hızda devasa bir bağıl
 * fark üretir.
 *
 * Bu yüzden her sütun sınıfı KENDİ fiziksel ölçüsüyle değerlendiriliyor ve
 * eşikler gözlemden değil, ANLAMLILIK sınırından türetiliyor.
 *
 * Hızlar neden daha gevşek: Swiss Ephemeris hızları sayısal türevle buluyor
 * (sweph.c:3705, 6416) — konumu t ve t+dt'de hesaplayıp farkı dt'ye bölüyor.
 * Bu felaket sadeleşme demek: konumdaki 1 ULP'lik fark, dt'ye bölününce
 * binlerce kat büyüyor. Moshier modunda ayrıca yüzlerce periyodik terim
 * toplanıyor ve her sin/cos çağrısı iki libm arasında son bitte ayrışabiliyor.
 * ------------------------------------------------------------------------- */
const LIMITS = {
  /** Açısal konum, derece. 1e-9° = 3.6e-6 yay-saniyesi.
   *  Kıyas: en hassas VLBI ölçümü ~1e-4 yay-saniyesi. */
  angle: { kind: 'abs', limit: 1e-9, unit: '°', toArcsec: true },

  /** Uzaklık, AU. Ölçek 1e-3 (Ay) ile 1e8 (uzak yıldız) arasında
   *  değiştiğinden bağıl ölçü doğru olan. */
  distance: { kind: 'rel', limit: 1e-12, unit: 'AU' },

  /** Açısal hız, derece/gün. 1e-7 °/gün = 3.6e-4 yay-saniyesi/gün —
   *  bir yüzyılda 0.013 yay-saniyesi birikir, yani hâlâ ölçülemez. */
  angleSpeed: { kind: 'abs', limit: 1e-7, unit: '°/gün', toArcsec: true },

  /** Uzaklık hızı, AU/gün. Türevlenmiş büyüklük olduğundan bağıl 1e-5;
   *  Neptün ölçeğinde (30 AU) bu 1e-8 AU/gün ~ 1.5 km/gün demek, yani
   *  4.5 milyar km uzaklıktaki bir cisim için ölçülemez. */
  distanceSpeed: { kind: 'rel', limit: 1e-5, unit: 'AU/gün' },

  /** Jülyen günü ve ΔT — gün cinsinden, tam eşleşmeli. */
  day: { kind: 'abs', limit: 1e-9, unit: 'gün' },
};

/* sweph.h:298-300 — cisme göre sayısal türev aralığı. */
const MOON_SPEED_INTV = 0.00005;
const PLAN_SPEED_INTV = 0.0001;
const MEAN_NODE_SPEED_INTV = 0.001;
const STAR_SPEED_INTV = PLAN_SPEED_INTV * 0.1;   // sweph.c:6416

/** Konum, türev alınmadan önce yüzlerce işlemden geçiyor; tek ULP değil
 *  birikmiş yuvarlama hatası ölçü olmalı. */
const ACCUM_ULP = 64;

/**
 * Kötü koşullanmış cisimler — Ay'ın OSKÜLATÖR yörünge elemanları.
 *
 * Bunlar Ay'ın konum+hız vektöründen Kepler elemanları türetilerek bulunuyor.
 * Ay'ın yörüngesi Güneş tarafından o kadar bozuluyor ki oskülatör elemanlar
 * günler içinde derecelerce salınıyor; türetme ise birbirini götüren
 * büyüklüklerin bölünmesini içeriyor. Girdideki son-bit farkı çıktıda
 * orders-of-magnitude büyüyor.
 *
 * Bu cisimlere AYRI ve daha gevşek eşik uygulanıyor. Eşiği topluca
 * gevşetmek yanlış olurdu: o zaman Güneş konumundaki gerçek bir regresyon
 * da fark edilmezdi. Burada tam olarak neyin istisna olduğu adlandırılmış.
 *
 * Ölçek için: astroloji yazılımları "gerçek Lilith" konusunda birbirleriyle
 * DERECELERCE ayrışıyor; buradaki fark 1.7e-4 yay-saniyesi düzeyinde.
 */
const ILL_CONDITIONED = new Map([
  [11, 'gerçek Ay düğümü (oskülatör)'],
  [13, 'oskülatör Ay apojesi — "gerçek" Black Moon Lilith'],
  [21, 'interpolasyonlu apoje'],
  [22, 'interpolasyonlu perige'],
]);

const ILL_LIMITS = {
  angle: 1e-6,          // 3.6e-3 yay-saniyesi
  distance: 1e-9,
  angleSpeed: 1e-4,
  distanceSpeed: 1e-4,
  day: 1e-9,
};

function speedInterval(ipl) {
  if (ipl === 1) return MOON_SPEED_INTV;                      // Ay
  if (ipl === 10 || ipl === 12) return MEAN_NODE_SPEED_INTV;  // ortalama düğüm/apoje
  return PLAN_SPEED_INTV;
}

// --- kurulum -------------------------------------------------------------

if (!existsSync(GOLDEN)) {
  console.error(`\nAltın korpus yok: ${GOLDEN}\n  Önce: node tools/generate-golden.mjs\n`);
  process.exit(1);
}

const se = await loadSwissEph();
const { wasm } = se;

// Native üretim '/ephe/' yolunu kullandı; hata mesajları bu yolu içerdiğinden
// WASM tarafında da aynısı olmalı, yoksa serr karşılaştırması sahte alarm verir.
const mounted = se.mountEphemeris(REQUIRED_FILES, '/ephe');
se.fn.setEphePath('/ephe/');

console.log('\n=== Sayısal parite: native gcc  vs  WASM ===\n');
console.log(`Efemeris kaynağı : ${EPHE_DIR}`);
console.log(`MEMFS'e yüklendi : ${mounted.loaded.length}/${REQUIRED_FILES.length} dosya, ` +
            `${(mounted.bytes / 1024 / 1024).toFixed(2)} MB`);

const missing = REQUIRED_FILES.filter((f) => !mounted.loaded.some(([n]) => n === f));
if (missing.length) {
  console.log(`\n  UYARI — eksik dosya sessiz Moshier düşüşüne yol açar: ${missing.join(', ')}`);
}

const buf = {
  x: wasm._malloc(6 * 8),
  serr: wasm._malloc(256),
  name: wasm._malloc(256),
  cusps: wasm._malloc(37 * 8),
  ascmc: wasm._malloc(10 * 8),
  cuspSpeed: wasm._malloc(37 * 8),
  ascmcSpeed: wasm._malloc(10 * 8),
  i32: wasm._malloc(4 * 4),
  dbl: wasm._malloc(8),
};

const c = {
  calcUt: wasm.cwrap('swe_calc_ut', 'number', ['number', 'number', 'number', 'number', 'number']),
  julday: wasm.cwrap('swe_julday', 'number', ['number', 'number', 'number', 'number', 'number']),
  revjul: wasm.cwrap('swe_revjul', null, ['number', 'number', 'number', 'number', 'number', 'number']),
  housesEx2: wasm.cwrap('swe_houses_ex2', 'number',
    ['number', 'number', 'number', 'number', 'number',
     'number', 'number', 'number', 'number', 'number']),
  fixstar2: wasm.cwrap('swe_fixstar2', 'number', ['number', 'number', 'number', 'number', 'number']),
  setSidMode: wasm.cwrap('swe_set_sid_mode', null, ['number', 'number', 'number']),
  getAyanamsaExUt: wasm.cwrap('swe_get_ayanamsa_ex_ut', 'number',
    ['number', 'number', 'number', 'number']),
  deltatEx: wasm.cwrap('swe_deltat_ex', 'number', ['number', 'number', 'number']),
};

const readD = (ptr, n) =>
  Array.from({ length: n }, (_, i) => wasm.getValue(ptr + i * 8, 'double'));
const clearErr = () => wasm.setValue(buf.serr, 0, 'i8');
const readErr = () => wasm.UTF8ToString(buf.serr).replace(/[\t\n\r]/g, ' ');

/** |v| büyüklüğündeki bir double'ın son bit ağırlığı. */
function ulpOf(v) {
  const a = Math.abs(v);
  if (!Number.isFinite(a) || a === 0) return Number.MIN_VALUE;
  return Math.pow(2, Math.floor(Math.log2(a)) - 52);
}

// --- istatistikler -------------------------------------------------------

const categories = Object.fromEntries(
  Object.keys(LIMITS).map((k) => [k, {
    compared: 0, exact: 0, worst: 0, worstWhere: '', worstPair: null, violations: 0,
  }]),
);

const categoriesIll = Object.fromEntries(
  Object.keys(LIMITS).map((k) => [k, {
    compared: 0, exact: 0, worst: 0, worstWhere: '', worstPair: null, violations: 0,
  }]),
);

const stats = {
  noiseAbsorbed: 0,
  nonFinite: [],
  retMismatch: [],
  serrMismatch: [],
  starNameAmbiguity: [],
  violationDetail: [],
  parseErrors: 0,
};

function compare(category, expected, actual, where, ill = false) {
  const cat = ill ? categoriesIll[category] : categories[category];
  const spec = LIMITS[category];
  const limit = ill ? ILL_LIMITS[category] : spec.limit;
  cat.compared++;

  if (Object.is(expected, actual)) { cat.exact++; return; }
  if (Number.isNaN(expected) && Number.isNaN(actual)) { cat.exact++; return; }

  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    if (stats.nonFinite.length < 10) {
      stats.nonFinite.push(`${where}: native=${expected} wasm=${actual}`);
    }
    return;
  }

  const absDiff = Math.abs(expected - actual);
  const scale = Math.max(Math.abs(expected), Math.abs(actual));
  const measure = spec.kind === 'abs' ? absDiff : (scale > 0 ? absDiff / scale : 0);

  if (measure > cat.worst) {
    cat.worst = measure;
    cat.worstWhere = where;
    cat.worstPair = [expected, actual];
  }
  if (measure >= limit) {
    cat.violations++;
    // Sapmaları nereden geldiğini görebilmek için sakla: tek bir kötü
    // koşullanmış hesaba mı yığılıyorlar, yoksa yayılmış mı?
    stats.violationDetail.push({ category: name_of(where), where, measure });
  }
}

/** "calc jd=... ipl=13 flags=260[0] boylam" -> "ipl=13 flags=260" */
function name_of(where) {
  const m = /ipl=(\d+)\s+flags=(\d+)/.exec(where);
  if (m) return `ipl=${m[1]} flags=${m[2]}`;
  const s = /^(\w+)/.exec(where);
  return s ? s[1] : where;
}

function compareInt(expected, actual, where) {
  if (expected !== actual && stats.retMismatch.length < 20) {
    stats.retMismatch.push(`${where}: native=${expected} wasm=${actual}`);
  }
}

function compareSerr(expected, actual, where) {
  const e = expected.trim(), a = actual.trim();
  if (e !== a && stats.serrMismatch.length < 20) {
    stats.serrMismatch.push(`${where}\n      native: "${e}"\n      wasm  : "${a}"`);
  }
}

/**
 * Yıldız adı karşılaştırması.
 *
 * sefstars.txt bazı yıldızları iki kez içeriyor — koordinatlar birebir aynı,
 * yalnızca geleneksel adın yazımı farklı (899. satır "Zubenelgenubi",
 * 900. satır "Zuben Elgenubi", ikisi de al-2Lib). Arama anahtarları da özdeş
 * olduğundan sweph.c:6392'deki qsort ikisini eşit görüyor ve C'de qsort
 * kararlı olmak ZORUNDA DEĞİL: glibc ile emscripten'in libc'si eşit
 * elemanları farklı sıralayınca farklı satır seçiliyor.
 *
 * Sayısal sapma değil, verideki belirsizlik — konumlar zaten özdeş çıkıyor.
 * Yine de gizlemiyoruz: nomenklatür adı (al-2Lib) TAM eşleşmeli, çünkü o
 * kısım tekil. Gerçek bir yanlış yıldız seçimi bu kontrolden geçemez.
 */
function compareStarName(expected, actual, where) {
  const split = (s) => {
    const i = s.indexOf(',');
    return i < 0
      ? { traditional: s.trim(), nomenclature: '' }
      : { traditional: s.slice(0, i).trim(), nomenclature: s.slice(i + 1).trim() };
  };
  const e = split(expected), a = split(actual);

  if (e.nomenclature !== a.nomenclature) {
    if (stats.serrMismatch.length < 20) {
      stats.serrMismatch.push(
        `${where} NOMENKLATÜR\n      native: "${e.nomenclature}"\n      wasm  : "${a.nomenclature}"`);
    }
    return;
  }
  if (e.traditional !== a.traditional) {
    stats.starNameAmbiguity.push(`${where}: "${e.traditional}" / "${a.traditional}"`);
  }
}

/**
 * Konum+hız altılısı. İlk üç sütun konum, son üç sütun hız.
 *
 * Hız sütunlarında önce türev gürültü tabanına bakılıyor: taban
 * ACCUM_ULP × ulp(konum) / dt. Fark bunun altındaysa ya da her iki değer de
 * tabanın altındaysa (ikisi de sayısal olarak sıfır — ör. ortalama düğümün
 * uzaklık hızı, çünkü uzaklığı sabit) karşılaştırma anlamsızdır, elenir.
 */
function comparePosSpeed(expected, actual, where, dt, ill = false) {
  compare('angle', expected[0], actual[0], `${where}[0] boylam`, ill);
  compare('angle', expected[1], actual[1], `${where}[1] enlem`, ill);
  compare('distance', expected[2], actual[2], `${where}[2] uzaklık`, ill);

  for (let i = 3; i < 6; i++) {
    const floor = ACCUM_ULP * ulpOf(expected[i - 3]) / dt;
    const diff = Math.abs(expected[i] - actual[i]);
    const bothNegligible =
      Math.abs(expected[i]) <= floor && Math.abs(actual[i]) <= floor;

    if (diff <= floor || bothNegligible) { stats.noiseAbsorbed++; continue; }

    compare(i === 5 ? 'distanceSpeed' : 'angleSpeed',
            expected[i], actual[i], `${where}[${i}] hız`, ill);
  }
}

// --- korpusu oynat -------------------------------------------------------

const text = gunzipSync(readFileSync(GOLDEN)).toString('utf8');
const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));

console.log(`Korpus           : ${lines.length} satır\n`);
const started = Date.now();
const byKind = new Map();

for (const line of lines) {
  const p = line.split('\t');
  const kind = p[0];
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  const N = Number;

  switch (kind) {
    case 'date': {
      const [, y, m, d, hour, greg, jd, jy, jm, jdOut, jut] = p;
      compare('day', N(jd), c.julday(N(y), N(m), N(d), N(hour), N(greg)),
        `date julday ${y}-${m}-${d}`);

      const py = buf.i32, pm = buf.i32 + 4, pd = buf.i32 + 8;
      c.revjul(N(jd), N(greg), py, pm, pd, buf.dbl);
      const w = `date revjul ${y}-${m}-${d}`;
      compareInt(N(jy), wasm.getValue(py, 'i32'), `${w}.year`);
      compareInt(N(jm), wasm.getValue(pm, 'i32'), `${w}.month`);
      compareInt(N(jdOut), wasm.getValue(pd, 'i32'), `${w}.day`);
      compare('day', N(jut), wasm.getValue(buf.dbl, 'double'), `${w}.hour`);
      break;
    }

    case 'calc': {
      const [, jd, ipl, iflag, ret, ...rest] = p;
      clearErr();
      const got = c.calcUt(N(jd), N(ipl), N(iflag), buf.x, buf.serr);
      const where = `calc jd=${jd} ipl=${ipl} flags=${iflag}`;
      compareInt(N(ret), got, where);
      comparePosSpeed(rest.slice(0, 6).map(N), readD(buf.x, 6), where,
        speedInterval(N(ipl)), ILL_CONDITIONED.has(N(ipl)));
      compareSerr(rest[6] ?? '', readErr(), where);
      break;
    }

    case 'calcsid': {
      const [, jd, ipl, iflag, sidmode, ret, ...rest] = p;
      c.setSidMode(N(sidmode), 0, 0);
      clearErr();
      const got = c.calcUt(N(jd), N(ipl), N(iflag), buf.x, buf.serr);
      const where = `calcsid jd=${jd} ipl=${ipl} sid=${sidmode}`;
      compareInt(N(ret), got, where);
      comparePosSpeed(rest.slice(0, 6).map(N), readD(buf.x, 6), where,
        speedInterval(N(ipl)), ILL_CONDITIONED.has(N(ipl)));
      compareSerr(rest[6] ?? '', readErr(), where);
      break;
    }

    case 'ayanamsa': {
      const [, jd, sidmode, ret, value, serr = ''] = p;
      c.setSidMode(N(sidmode), 0, 0);
      clearErr();
      const got = c.getAyanamsaExUt(N(jd), 2 /* SEFLG_SWIEPH */, buf.dbl, buf.serr);
      const where = `ayanamsa jd=${jd} mode=${sidmode}`;
      compareInt(N(ret), got, where);
      compare('angle', N(value), wasm.getValue(buf.dbl, 'double'), where);
      compareSerr(serr, readErr(), where);
      break;
    }

    case 'houses': {
      const [, jd, lat, lon, hsys, ret, ...rest] = p;
      clearErr();
      const got = c.housesEx2(N(jd), 0, N(lat), N(lon), hsys.charCodeAt(0),
        buf.cusps, buf.ascmc, buf.cuspSpeed, buf.ascmcSpeed, buf.serr);
      const where = `houses jd=${jd} lat=${lat} hsys=${hsys}`;
      compareInt(N(ret), got, where);
      // C dizisi 1-tabanlı: cusps[1..12]
      const gotCusps = readD(buf.cusps + 8, 12);
      const gotAscmc = readD(buf.ascmc, 8);
      for (let i = 0; i < 12; i++) {
        compare('angle', N(rest[i]), gotCusps[i], `${where} cusp${i + 1}`);
      }
      for (let i = 0; i < 8; i++) {
        compare('angle', N(rest[12 + i]), gotAscmc[i], `${where} ascmc${i}`);
      }
      compareSerr(rest[20] ?? '', readErr(), where);
      break;
    }

    case 'star': {
      const [, name, jd, iflag, ret, ...rest] = p;
      wasm.stringToUTF8(name, buf.name, 256);
      clearErr();
      const got = c.fixstar2(buf.name, N(jd), N(iflag), buf.x, buf.serr);
      const where = `star ${name} jd=${jd}`;
      compareInt(N(ret), got, where);
      comparePosSpeed(rest.slice(0, 6).map(N), readD(buf.x, 6), where, STAR_SPEED_INTV);
      compareStarName(rest[6] ?? '', wasm.UTF8ToString(buf.name), `${where} ad`);
      compareSerr(rest[7] ?? '', readErr(), where);
      break;
    }

    case 'deltat': {
      const [, jd, ephe, value, serr = ''] = p;
      clearErr();
      compare('day', N(value), c.deltatEx(N(jd), N(ephe), buf.serr), `deltat jd=${jd}`);
      compareSerr(serr, readErr(), `deltat jd=${jd}`);
      break;
    }

    default:
      stats.parseErrors++;
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
for (const ptr of Object.values(buf)) wasm._free(ptr);
se.dispose();

// --- rapor ---------------------------------------------------------------

console.log('Satır türleri:');
for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(10)} ${String(n).padStart(7)}`);
}

const totalCompared = Object.values(categories).reduce((s, c) => s + c.compared, 0);
const totalExact = Object.values(categories).reduce((s, c) => s + c.exact, 0);

console.log(`\nKarşılaştırılan : ${totalCompared.toLocaleString('tr-TR')} sayı  (${elapsed}s)`);
console.log(`Türev gürültüsü olarak elenen: ${stats.noiseAbsorbed.toLocaleString('tr-TR')}`);

let failed = false;

function printTable(title, cats, limitFor) {
  console.log(`\n${title}\n`);
  console.log('  sınıf            karşılaştırılan   bit-aynı   en büyük fark        eşik');
  console.log('  ' + '-'.repeat(76));
  for (const [name, cat] of Object.entries(cats)) {
    if (cat.compared === 0) continue;
    const spec = LIMITS[name];
    const exactPct = ((cat.exact / cat.compared) * 100).toFixed(1);
    let worstStr = cat.worst.toExponential(2) + (spec.kind === 'abs' ? '' : ' (bağıl)');
    if (spec.toArcsec && cat.worst > 0) {
      worstStr += ` = ${(cat.worst * 3600).toExponential(1)}″`;
    }
    console.log(
      `  ${name.padEnd(16)} ${String(cat.compared).padStart(11)}   ` +
      `%${exactPct.padStart(6)}   ${worstStr.padEnd(22)} ${limitFor(name).toExponential(0)}`);
    if (cat.violations > 0) failed = true;
  }
}

printTable('İyi koşullanmış cisimler:', categories, (n) => LIMITS[n].limit);

const illTotal = Object.values(categoriesIll).reduce((s, c) => s + c.compared, 0);
if (illTotal > 0) {
  printTable(
    'Kötü koşullanmış (oskülatör Ay elemanları: ' +
      [...ILL_CONDITIONED.keys()].join(', ') + ') — ayrı eşik:',
    categoriesIll, (n) => ILL_LIMITS[n]);
}

if (stats.violationDetail.length) {
  const groups = new Map();
  for (const v of stats.violationDetail) {
    groups.set(v.category, (groups.get(v.category) ?? 0) + 1);
  }
  console.log('\nEşiği aşan değerler, kaynağa göre:');
  for (const [g, n] of [...groups].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${g}`);
  }
}

for (const [name, cat] of Object.entries(categories)) {
  if (cat.violations > 0) {
    console.log(`\n  ${name}: ${cat.violations} değer eşiği aştı`);
    console.log(`    en kötü: ${cat.worstWhere}`);
    if (cat.worstPair) {
      console.log(`      native ${cat.worstPair[0]}`);
      console.log(`      wasm   ${cat.worstPair[1]}`);
    }
  }
}

if (stats.nonFinite.length) {
  failed = true;
  console.log('\nSONLU OLMAYAN DEĞER UYUŞMAZLIĞI:');
  stats.nonFinite.forEach((m) => console.log(`  ${m}`));
}

if (stats.retMismatch.length) {
  failed = true;
  console.log(`\nDÖNÜŞ KODU / TAMSAYI UYUŞMAZLIĞI:`);
  stats.retMismatch.forEach((m) => console.log(`  ${m}`));
}

if (stats.serrMismatch.length) {
  failed = true;
  console.log(`\nHATA MESAJI UYUŞMAZLIĞI:`);
  stats.serrMismatch.forEach((m) => console.log(`  ${m}`));
}

if (stats.parseErrors) {
  failed = true;
  console.log(`\nAyrıştırılamayan satır: ${stats.parseErrors}`);
}

if (stats.starNameAmbiguity.length) {
  // Hata değil — katalogdaki yinelenen kayıt + kararsız qsort. Konumlar özdeş.
  console.log(`\nNot: ${stats.starNameAmbiguity.length} yıldız adı belirsizliği ` +
              `(sefstars.txt'te yinelenen kayıt, konumlar aynı)`);
  console.log(`  ör. ${stats.starNameAmbiguity[0]}`);
}

console.log('\n' + '='.repeat(76));
if (failed) {
  console.log('SONUÇ: WASM build native referanstan SAPIYOR.');
} else {
  console.log('SONUÇ: WASM build native referansla parite halinde.');
  console.log(`  ${totalCompared.toLocaleString('tr-TR')} değer, ` +
              `%${((totalExact / totalCompared) * 100).toFixed(1)} bit düzeyinde özdeş,`);
  console.log('  kalan farklar libm yuvarlama düzeyinde ve fiziksel anlamlılığın altında.');
}
console.log('='.repeat(76) + '\n');

process.exitCode = failed ? 1 : 0;
