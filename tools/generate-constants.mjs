#!/usr/bin/env node
/**
 * Swiss Ephemeris sabitlerini TypeScript'e üretir.
 *
 * İki kaynaktan, ikisi de otoriter:
 *   1. vendor/swisseph/swephexp.h  -> #define sabitleri
 *   2. derlenmiş WASM'ın kendisi   -> swe_house_name() ile ev sistemi adları
 *
 * Elle yazmıyoruz çünkü 200+ sabitin hepsini doğru kopyalamak imkânsız;
 * tek bir rakam hatası sessizce yanlış hesap üretir. Upstream sürüm
 * yükseltmesinde de liste kendiliğinden güncellenir.
 *
 *   node tools/generate-constants.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSwissEph } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const HEADER = join(ROOT, 'vendor', 'swisseph', 'swephexp.h');
const OUT_DIR = join(ROOT, 'packages', 'core', 'src', 'generated');

/**
 * #define satırlarını toplar. Değerler ham metin olarak saklanır;
 * çözümleme ikinci geçişte, çünkü sabitler birbirine referans verebiliyor
 * (ör. SE_VARUNA = SE_AST_OFFSET + 20000).
 */
function parseDefines(source) {
  const defines = new Map();
  // Diyez ile "define" arasında boşluk olabiliyor — swephexp.h'de hem
  // "#define SE_SUN" hem "# define SE_GREG_CAL" geçiyor. Boşluğa izin
  // vermezsek sabit sessizce undefined olur.
  const re = /^#\s*define\s+(SE_[A-Z0-9_]+|SEFLG_[A-Z0-9_]+)\s+(.+?)\s*(?:\/\*.*)?$/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const [, name, rawValue] = m;
    // Satır sonu yorumlarını ve fazla boşluğu at.
    const value = rawValue.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
    if (value) defines.set(name, value);
  }
  return defines;
}

/**
 * İfadeyi güvenli biçimde sayıya çevirir.
 *
 * eval kullanmıyoruz. Yalnızca sayı, temel aritmetik/bit operatörleri ve
 * ÇÖZÜLMÜŞ sabit adlarından oluşan ifadelere izin var; başka her şey
 * reddedilir. Bu, header'a girecek beklenmedik bir makronun sessizce
 * yanlış sayıya dönüşmesini engelliyor.
 */
function evaluate(expr, resolved) {
  let e = expr.trim();

  // Tek başına string sabitler (ör. SE_STARFILE "sefstars.txt") sayı değil.
  if (/^"(.*)"$/.test(e)) return { kind: 'string', value: e.slice(1, -1) };

  // Bilinen sabit adlarını değerleriyle değiştir (uzun adlar önce).
  const names = [...resolved.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const v = resolved.get(name);
    if (typeof v !== 'number') continue;
    e = e.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${v})`);
  }

  // Çözülemeyen tanımlayıcı kaldıysa vazgeç.
  if (/[A-Za-z_]/.test(e)) return null;

  // Sadece güvenli karakter kümesi.
  if (!/^[0-9xXa-fA-F\s()+\-*/|&<>~]+$/.test(e)) return null;

  try {
    // Function ctor, kısıtlı karakter kümesinden sonra aritmetik değerlendirici
    // olarak kullanılıyor; girdi header'dan geliyor ve yukarıdaki testleri geçti.
    const n = Function(`"use strict";return(${e});`)();
    return Number.isFinite(n) ? { kind: 'number', value: n } : null;
  } catch {
    return null;
  }
}

function resolveAll(defines) {
  const resolved = new Map();
  // Birbirine referans veren sabitler için tekrarlı geçiş; yeni bir şey
  // çözülmediğinde dur.
  for (let pass = 0; pass < 10; pass++) {
    let progress = false;
    for (const [name, expr] of defines) {
      if (resolved.has(name)) continue;
      const r = evaluate(expr, resolved);
      if (r) { resolved.set(name, r.kind === 'number' ? r.value : r.value); progress = true; }
    }
    if (!progress) break;
  }
  return resolved;
}

/** Ev sistemlerini kütüphanenin kendisine sorar — dokümanı parse etmekten güvenilir. */
async function readHouseSystems() {
  const se = await loadSwissEph();
  const houseName = se.wasm.cwrap('swe_house_name', 'string', ['number']);
  const systems = [];

  for (const ch of 'ABCDEFGHIiJKLMNOPQRSTUVWXY') {
    const name = houseName(ch.charCodeAt(0));
    // Tanınmayan harfler için SE boş ya da 'undefined'/placeholder döndürür.
    if (!name || /^undefined$/i.test(name.trim())) continue;
    systems.push({ code: ch, name: name.trim() });
  }

  se.dispose();
  return systems;
}

const tsName = (n) => n.replace(/^SE_/, '').replace(/^SIDM_/, '');

function emitEnum(title, comment, entries) {
  const lines = [`/** ${comment} */`, `export const ${title} = {`];
  for (const [key, value, note] of entries) {
    lines.push(`  ${key}: ${value},${note ? `  // ${note}` : ''}`);
  }
  lines.push('} as const;', '');
  lines.push(`export type ${title} = (typeof ${title})[keyof typeof ${title}];`, '');
  return lines.join('\n');
}

// --- main ---------------------------------------------------------------

const source = readFileSync(HEADER, 'utf8');
const defines = parseDefines(source);
const resolved = resolveAll(defines);

console.log(`swephexp.h: ${defines.size} tanım okundu, ${resolved.size} tanesi çözüldü.`);

const num = (name) => resolved.get(name);
const pick = (pattern, exclude = []) =>
  [...resolved.entries()]
    .filter(([k, v]) => pattern.test(k) && typeof v === 'number' && !exclude.includes(k))
    .sort((a, b) => a[1] - b[1]);

// Gök cisimleri: 0-22 arası yerleşik gezegenler + offsetler.
const BODY_NAMES = [
  'SE_SUN', 'SE_MOON', 'SE_MERCURY', 'SE_VENUS', 'SE_MARS', 'SE_JUPITER',
  'SE_SATURN', 'SE_URANUS', 'SE_NEPTUNE', 'SE_PLUTO', 'SE_MEAN_NODE',
  'SE_TRUE_NODE', 'SE_MEAN_APOG', 'SE_OSCU_APOG', 'SE_EARTH', 'SE_CHIRON',
  'SE_PHOLUS', 'SE_CERES', 'SE_PALLAS', 'SE_JUNO', 'SE_VESTA',
  'SE_INTP_APOG', 'SE_INTP_PERG',
];

const bodyNotes = {
  SE_MEAN_APOG: 'Black Moon Lilith (ortalama) — cisim değil, Ay apojesi',
  SE_OSCU_APOG: 'Black Moon Lilith (gerçek/oskülatör)',
  SE_EARTH: 'yalnızca heliosentrik hesapta anlamlı',
};

const houseSystems = await readHouseSystems();
console.log(`WASM'dan ${houseSystems.length} ev sistemi okundu.`);

const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: vendor/swisseph/swephexp.h (Swiss Ephemeris ${
  (resolved.get('SE_VERSION') ?? '2.10.03')})
 * Üreten: tools/generate-constants.mjs
 *
 * Yeniden üretmek için: node tools/generate-constants.mjs
 */
/* eslint-disable */

`;

const parts = [header];

parts.push(emitEnum('Body', 'Gök cisimleri. swe_calc() ipl parametresi.',
  BODY_NAMES.filter((n) => resolved.has(n)).map((n) => {
    const key = tsName(n).split('_').map((w, i) =>
      i === 0 ? w[0] + w.slice(1).toLowerCase()
              : w[0] + w.slice(1).toLowerCase()).join('');
    return [key, num(n), bodyNotes[n]];
  })));

parts.push(`/** Numaralı asteroide erişim: Body.AsteroidOffset + numara.
 *  Örn. Eris = ${num('SE_AST_OFFSET')} + 136199. Her asteroid ayrı dosya ister
 *  ve asteroidlerde Moshier'e sessiz düşüş YOKTUR — analitik teori yok. */
export const AsteroidOffset = ${num('SE_AST_OFFSET')};

/** Kurgusal cisimler (Witte/Sieggrün uranyen gezegenler, Transpluto vb.):
 *  FictitiousOffset + seorbel.txt içindeki sıra numarası. */
export const FictitiousOffset = ${num('SE_FICT_OFFSET')};

/** Gezegen uydularına erişim: PlanetMoonOffset + uydu numarası. */
export const PlanetMoonOffset = ${num('SE_PLMOON_OFFSET')};
`);

parts.push(emitEnum('Flag', 'swe_calc() iflag bayrakları. Bit maskesi olarak OR\'lanır.',
  pick(/^SEFLG_/).map(([k, v]) => [
    k.replace(/^SEFLG_/, '').split('_').map((w) =>
      w[0] + w.slice(1).toLowerCase()).join(''),
    v,
  ])));

parts.push(emitEnum('Ayanamsa', `Sidereal mod (ayanamsa). swe_set_sid_mode() içindir.
 * ${pick(/^SE_SIDM_/).length} mod mevcut; hangi geleneğin hangisini kullandığı
 * için docs/ dizinine bakın.`,
  pick(/^SE_SIDM_/).map(([k, v]) => [
    k.replace(/^SE_SIDM_/, '').split('_').map((w) =>
      w[0] + w.slice(1).toLowerCase()).join(''),
    v,
  ])));

// Farklı kodlar aynı ada çözülebiliyor: 'A' ve 'E' ikisi de "equal" ve
// swehouse.c:994-995'te aynı case'e düşüyorlar — gerçekten aynı sistemin
// iki kodu. Bunları tek girdi + diğer-ad olarak ayırmazsak TypeScript
// nesnesinde yinelenen anahtar oluşur ve sonuncusu öncekini SESSİZCE ezer.
const canonicalByName = new Map();
const aliases = [];
for (const hs of houseSystems) {
  const existing = canonicalByName.get(hs.name);
  if (existing) aliases.push({ ...hs, canonical: existing.code });
  else canonicalByName.set(hs.name, hs);
}

const toKey = (name) =>
  name.replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/[^A-Za-z0-9]/g, '')
      .replace(/^./, (c) => c.toUpperCase());

// Ad farklı ama anahtara aynı şekilde sadeleşen durumlara karşı son savunma;
// upstream yeni sistem eklerse sessiz çakışma yerine ayırt edici anahtar üret.
const seenKeys = new Map();
const canonical = [...canonicalByName.values()].map((hs) => {
  let key = toKey(hs.name);
  if (seenKeys.has(key)) key = `${key}${hs.code}`;
  seenKeys.set(key, hs.code);
  return { ...hs, key };
});

if (aliases.length) {
  console.log(`  diğer-ad olarak ayrılan kodlar: ` +
    aliases.map((a) => `'${a.code}' -> '${a.canonical}' (${a.name})`).join(', '));
}

parts.push(`/** Ev sistemleri. Değer, swe_houses() hsys parametresine geçen ASCII harfi.
 *  Adlar derlenmiş kütüphaneden swe_house_name() ile okundu. */
export const HouseSystem = {
${canonical.map(({ key, code }) => `  ${key}: '${code}',`).join('\n')}
} as const;

export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];

/** Aynı sistemi gösteren alternatif kodlar. Swiss Ephemeris ikisini de kabul
 *  eder; girdi normalleştirmek için kullanın. */
export const HOUSE_SYSTEM_ALIASES: Record<string, string> = {
${aliases.map((a) => `  '${a.code}': '${a.canonical}',`).join('\n')}
};

/** Her geçerli kod için insan-okunur ad (diğer-adlar dahil). */
export const HOUSE_SYSTEM_NAMES: Record<string, string> = {
${houseSystems.map(({ code, name }) => `  '${code}': ${JSON.stringify(name)},`).join('\n')}
};
`);

parts.push(emitEnum('Calendar', 'Takvim seçimi. swe_julday() / swe_revjul() içindir.', [
  ['Julian', num('SE_JUL_CAL'), 'Jülyen takvimi'],
  ['Gregorian', num('SE_GREG_CAL'), 'Gregoryen takvimi'],
]));

/**
 * Adı biz veriyoruz, DEĞERİ başlıktan geliyor.
 *
 * Bu üç grup için regex ile toplamak güvenli değil:
 *   - SE_ECL_NUT bir cisim kimliği (-1), tutulma bayrağı değil; /^SE_ECL_/
 *     onu da yakalar.
 *   - SE_HELIACAL_* takma adları başlıkta `#if 0` bloğunun içinde ve
 *     yansıttıkları SE_HELFLAG_* adlarıyla DEĞERLERİ TUTMUYOR
 *     (AVKIND_VR: 1<<15 vs 1<<16). parseDefines önişlemci koşullarını
 *     görmediği için ikisi de tabloya girer.
 *
 * Ad çözülmezse üretim burada patlıyor. Sessizce `undefined` yazmak, ilk
 * sürümde on sabiti kaybettiren hatanın ta kendisiydi.
 */
function curated(title, comment, entries) {
  return emitEnum(title, comment, entries.map(([key, cName, note]) => {
    const value = resolved.get(cName);
    if (typeof value !== 'number') {
      throw new Error(
        `${title}.${key}: ${cName} başlıkta sayı olarak çözülmedi ` +
        `(bulunan: ${JSON.stringify(value)})`);
    }
    return [key, value, note ? `${cName} — ${note}` : cName];
  }));
}

parts.push(curated('RiseTransit',
  `Doğuş / batış / kültminasyon olayları. swe_rise_trans() rsmi parametresi.
 * Olaylardan BİRİ seçilir, SE_BIT_* değiştiricileri OR'lanır.`, [
  ['Rise', 'SE_CALC_RISE'],
  ['Set', 'SE_CALC_SET'],
  ['UpperCulmination', 'SE_CALC_MTRANSIT', 'meridyen geçişi (üst)'],
  ['LowerCulmination', 'SE_CALC_ITRANSIT', 'alt meridyen geçişi'],
  ['DiscCenter', 'SE_BIT_DISC_CENTER', 'kenar yerine merkez'],
  ['DiscBottom', 'SE_BIT_DISC_BOTTOM', 'alt kenar'],
  ['FixedDiscSize', 'SE_BIT_FIXED_DISC_SIZE'],
  ['NoRefraction', 'SE_BIT_NO_REFRACTION', 'atmosferik kırılmayı yok say'],
  ['GeocentricNoEclipticLatitude', 'SE_BIT_GEOCTR_NO_ECL_LAT'],
  ['CivilTwilight', 'SE_BIT_CIVIL_TWILIGHT', 'Güneş -6°'],
  ['NauticalTwilight', 'SE_BIT_NAUTIC_TWILIGHT', 'Güneş -12°'],
  ['AstronomicalTwilight', 'SE_BIT_ASTRO_TWILIGHT', 'Güneş -18°'],
  ['HinduRising', 'SE_BIT_HINDU_RISING', 'merkez + kırılmasız + geosentrik'],
]));

parts.push(curated('EclipseFlag',
  `Tutulma tipleri ve görünürlük bayrakları. swe_*_eclipse_* dönüş değeri.
 * DİKKAT: 8192 ve 16384 bağlama göre iki anlama geliyor — ay tutulmasında
 * yarıgölge başlangıcı/bitişi, örtülmede (occultation) olayın gündüz
 * başlaması/bitmesi. Aynı bit, farklı çağrı, farklı anlam.`, [
  ['Central', 'SE_ECL_CENTRAL'],
  ['NonCentral', 'SE_ECL_NONCENTRAL'],
  ['Total', 'SE_ECL_TOTAL'],
  ['Annular', 'SE_ECL_ANNULAR', 'halkalı'],
  ['Partial', 'SE_ECL_PARTIAL', 'parçalı'],
  ['AnnularTotal', 'SE_ECL_ANNULAR_TOTAL', 'hibrit; SE_ECL_HYBRID ile aynı bit'],
  ['Penumbral', 'SE_ECL_PENUMBRAL', 'yalnızca ay tutulması'],
  ['AllSolarTypes', 'SE_ECL_ALLTYPES_SOLAR'],
  ['AllLunarTypes', 'SE_ECL_ALLTYPES_LUNAR'],
  ['Visible', 'SE_ECL_VISIBLE'],
  ['MaxVisible', 'SE_ECL_MAX_VISIBLE'],
  ['PartialBeginVisible', 'SE_ECL_PARTBEG_VISIBLE'],
  ['TotalBeginVisible', 'SE_ECL_TOTBEG_VISIBLE'],
  ['TotalEndVisible', 'SE_ECL_TOTEND_VISIBLE'],
  ['PartialEndVisible', 'SE_ECL_PARTEND_VISIBLE'],
  ['PenumbralBeginVisible', 'SE_ECL_PENUMBBEG_VISIBLE'],
  ['PenumbralEndVisible', 'SE_ECL_PENUMBEND_VISIBLE'],
  ['OneTry', 'SE_ECL_ONE_TRY', 'aramayı tek denemede bırak'],
]));

parts.push(curated('HeliacalEvent',
  'Heliacal olay tipi. swe_heliacal_ut() TypeEvent parametresi.', [
  ['HeliacalRising', 'SE_HELIACAL_RISING', 'sabah ilk görünüş (SE_MORNING_FIRST)'],
  ['HeliacalSetting', 'SE_HELIACAL_SETTING', 'akşam son görünüş (SE_EVENING_LAST)'],
  ['EveningFirst', 'SE_EVENING_FIRST', 'yalnızca iç gezegenler ve Ay'],
  ['MorningLast', 'SE_MORNING_LAST', 'yalnızca iç gezegenler ve Ay'],
  ['AcronychalRising', 'SE_ACRONYCHAL_RISING', 'upstream\'de HENÜZ UYGULANMADI'],
  ['AcronychalSetting', 'SE_ACRONYCHAL_SETTING', 'upstream\'de HENÜZ UYGULANMADI'],
]));

parts.push(curated('HeliacalFlag',
  'swe_heliacal_ut() iflag değiştiricileri. Efemeris bayrağıyla OR\'lanır.', [
  ['LongSearch', 'SE_HELFLAG_LONG_SEARCH', 'bulamazsa daha uzun ara'],
  ['HighPrecision', 'SE_HELFLAG_HIGH_PRECISION', 'yavaş'],
  ['OpticalParams', 'SE_HELFLAG_OPTICAL_PARAMS', 'dobs[] gözlemci verisini kullan'],
  ['NoDetails', 'SE_HELFLAG_NO_DETAILS', 'yalnızca olay anı; çok daha hızlı'],
  ['SearchOnePeriod', 'SE_HELFLAG_SEARCH_1_PERIOD'],
  ['VisibilityLimitDark', 'SE_HELFLAG_VISLIM_DARK'],
  ['VisibilityLimitNoMoon', 'SE_HELFLAG_VISLIM_NOMOON'],
  ['VisibilityLimitPhotopic', 'SE_HELFLAG_VISLIM_PHOTOPIC'],
  ['VisibilityLimitScotopic', 'SE_HELFLAG_VISLIM_SCOTOPIC'],
  ['AverageVisibility', 'SE_HELFLAG_AV'],
]));

parts.push(`/** swe_calc() bunu bir cisim gibi alıp eğikliği ve nutasyonu döndürüyor.
 *  Cisim değil; ${num('SE_ECL_NUT')} özel bir kimlik (SE_ECL_NUT). */
export const EclipticNutationId = ${num('SE_ECL_NUT')};
`);

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, 'constants.ts');
const next = parts.join('\n');

/*
 * İÇERİK AYNIYSA DOSYAYA DOKUNMA.
 *
 * Koşulsuz writeFileSync, çıktı byte byte aynı olsa bile mtime'ı ilerletiyordu.
 * Bu yalnızca kozmetik değil: release.yml önce `npm run build` ile dist/
 * üretiyor, HEMEN ARDINDAN sabitleri yeniden üretip karşılaştırıyor. O ikinci
 * üretim constants.ts'e dokununca packages/core/src, packages/core/dist'ten
 * yeni görünüyor ve check-release-ready'nin tazelik kontrolü "dist BAYAT"
 * diyerek yayını durduruyordu — içerik değişmemiş, tek fark zaman damgası.
 * v0.1.0'ın ikinci denemesi tam olarak burada düştü.
 *
 * Yalnızca gerçekten değişince yazmak, "yeniden üret ve karşılaştır" desenini
 * doğası gereği yan etkisiz kılıyor: değişiklik yoksa ağaç hiç kirlenmiyor.
 */
let unchanged = false;
try {
  unchanged = readFileSync(outFile, 'utf8') === next;
} catch {
  unchanged = false;                       // dosya yok — ilk üretim
}
if (!unchanged) writeFileSync(outFile, next);

console.log(`\n${unchanged ? 'Değişmedi' : 'Yazıldı'}: packages/core/src/generated/constants.ts`);
console.log(`  ${BODY_NAMES.length} cisim, ${pick(/^SEFLG_/).length} bayrak, ` +
            `${pick(/^SE_SIDM_/).length} ayanamsa, ${houseSystems.length} ev sistemi`);
