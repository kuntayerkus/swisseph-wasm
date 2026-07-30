/**
 * Kontrol betikleri için ortak kurulum.
 *
 * Bunlar henüz gerçek test paketi değil — Faz 3'te native swetest'ten
 * üretilecek altın referansla değiştirilecekler. Şimdilik build'in
 * çalıştığını ve veri paketi spec'inin doğru olduğunu kanıtlıyorlar.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');

/**
 * .se1 dosyalarının bulunduğu dizin. Repoda yok (379 MB) — varsayılan olarak
 * upstream checkout'una bakar, SWISSEPH_EPHE_PATH ile değiştirilebilir.
 */
export const EPHE_DIR =
  process.env.SWISSEPH_EPHE_PATH ?? resolve(ROOT, '..', 'swiss', 'ephe');

// --- Swiss Ephemeris sabitleri (vendor/swisseph/swephexp.h'den) ----------

export const SEFLG = {
  JPLEPH: 1,
  SWIEPH: 2,      // .se1 dosyaları, tam hassasiyet
  MOSEPH: 4,      // dosyasız analitik teori
  SPEED: 256,
};

export const SE_GREG_CAL = 1;

export const BODY = {
  SUN: 0, MOON: 1, MERCURY: 2, VENUS: 3, MARS: 4, JUPITER: 5,
  SATURN: 6, URANUS: 7, NEPTUNE: 8, PLUTO: 9,
  MEAN_NODE: 10, TRUE_NODE: 11, MEAN_APOG: 12, OSCU_APOG: 13,
  EARTH: 14, CHIRON: 15, PHOLUS: 16,
  CERES: 17, PALLAS: 18, JUNO: 19, VESTA: 20,
};

export const PLANETS = [
  [BODY.SUN, 'Güneş'], [BODY.MOON, 'Ay'], [BODY.MERCURY, 'Merkür'],
  [BODY.VENUS, 'Venüs'], [BODY.MARS, 'Mars'], [BODY.JUPITER, 'Jüpiter'],
  [BODY.SATURN, 'Satürn'], [BODY.URANUS, 'Uranüs'], [BODY.NEPTUNE, 'Neptün'],
  [BODY.PLUTO, 'Plüton'],
];

/** Veri paketi spec'i — Faz 0'da deneyle doğrulandı, 2.05 MB. */
export const DATA_PACKAGE_FILES = [
  ['sepl_18.se1', 'gezegenler'],
  ['semo_18.se1', 'Ay'],
  ['seas_18.se1', 'ana asteroidler (Ceres, Chiron, Pallas, Juno, Vesta, Pholus)'],
  ['sefstars.txt', 'sabit yıldız kataloğu'],
  ['seorbel.txt', 'kurgusal cisimlerin yörünge elemanları'],
];

/**
 * WASM modülünü yükler ve pointer tabanlı binding katmanını kurar.
 *
 * ccall/cwrap yerine tamponları bir kez ayırıp tekrar kullanıyoruz —
 * Faz 2'deki gerçek API katmanı da bu tekniği kullanacak.
 */
export async function loadSwissEph({ variant = 'full' } = {}) {
  const modulePath = variant === 'full'
    ? join(ROOT, 'packages', 'core', 'wasm', 'swisseph.mjs')
    : join(ROOT, 'packages', 'core', '.measure', variant, 'swisseph.mjs');
  if (!existsSync(modulePath)) {
    throw new Error(`Build yok: ${modulePath}\n  Önce: npm run build:wasm`);
  }

  const { default: createSwissEphModule } = await import(pathToFileURL(modulePath).href);
  const wasm = await createSwissEphModule();

  const XX = wasm._malloc(6 * 8);     // double xx[6]
  const SERR = wasm._malloc(256);     // char serr[AS_MAXCH]
  const NAME = wasm._malloc(256);     // yıldız/gezegen adı (giriş+çıkış)

  const fn = {
    setEphePath: wasm.cwrap('swe_set_ephe_path', null, ['string']),
    julday: wasm.cwrap('swe_julday', 'number', ['number', 'number', 'number', 'number', 'number']),
    calcUt: wasm.cwrap('swe_calc_ut', 'number', ['number', 'number', 'number', 'number', 'number']),
    fixstar2: wasm.cwrap('swe_fixstar2', 'number', ['number', 'number', 'number', 'number', 'number']),
    housesEx2: wasm.cwrap('swe_houses_ex2', 'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']),
    version: wasm.cwrap('swe_version', 'string', ['number']),
    close: wasm.cwrap('swe_close', null, []),
  };

  const readDoubles = (ptr, n) =>
    Array.from({ length: n }, (_, i) => wasm.getValue(ptr + i * 8, 'double'));

  return {
    wasm,
    fn,
    buffers: { XX, SERR, NAME },
    readDoubles,

    version() {
      return fn.version(NAME);
    },

    julday(y, m, d, hour = 12) {
      return fn.julday(y, m, d, hour, SE_GREG_CAL);
    },

    /**
     * Konum hesaplar. Dönen flag'i kontrol eder: Swiss Ephemeris dosya
     * bulamazsa HATA VERMEZ, sessizce Moshier'e düşer ve flag'i değiştirir.
     * usedMoshier'i döndürmezsek "tam hassasiyet aldık" yanılgısına düşeriz.
     */
    calc(tjd, ipl, ephFlag) {
      const ret = fn.calcUt(tjd, ipl, ephFlag | SEFLG.SPEED, XX, SERR);
      const warning = wasm.UTF8ToString(SERR);
      if (ret < 0) return { error: warning || 'bilinmeyen hata' };
      const [lon, lat, dist, lonSpeed, latSpeed, distSpeed] = readDoubles(XX, 6);
      return {
        lon, lat, dist, lonSpeed, latSpeed, distSpeed,
        usedMoshier: (ret & SEFLG.MOSEPH) !== 0,
        warning: warning || null,
      };
    },

    fixstar(name, tjd, ephFlag = SEFLG.SWIEPH) {
      wasm.stringToUTF8(name, NAME, 256);
      const ret = fn.fixstar2(NAME, tjd, ephFlag, XX, SERR);
      if (ret < 0) return { error: wasm.UTF8ToString(SERR) };
      const [lon, lat, dist] = readDoubles(XX, 6);
      return { lon, lat, dist, resolvedName: wasm.UTF8ToString(NAME) };
    },

    /** Veri paketi dosyalarını MEMFS'e yükler. Eksik dosya sessizce atlanır —
     *  SE zaten olmayan dosyada Moshier'e düşüyor. */
    mountEphemeris(files = DATA_PACKAGE_FILES.map(([f]) => f), dir = '/ephe') {
      try { wasm.FS.mkdir(dir); } catch { /* zaten var */ }
      let bytes = 0;
      const loaded = [];
      for (const file of files) {
        const src = join(EPHE_DIR, file);
        if (!existsSync(src)) continue;
        const buf = readFileSync(src);
        wasm.FS.writeFile(`${dir}/${file}`, buf);
        bytes += buf.length;
        loaded.push([file, buf.length]);
      }
      fn.setEphePath(dir);
      return { loaded, bytes };
    },

    dispose() {
      wasm._free(XX); wasm._free(SERR); wasm._free(NAME);
      fn.close();
    },
  };
}

// --- küçük test koşucusu -------------------------------------------------

export function createReporter(title) {
  let failures = 0;
  const skipped = [];
  console.log(`\n=== ${title} ===\n`);
  return {
    section: (s) => console.log(`\n${s}`),
    check(label, ok, detail = '') {
      console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
      if (!ok) failures++;
      return ok;
    },
    info: (s) => console.log(`  · ${s}`),

    /**
     * Koşulamayan bir kontrol grubunu YÜKSEK SESLE bildirir.
     *
     * `info()` yetmiyordu: veri yoksa koca bir doğrulama bloğu hiç koşmuyor ve
     * çıktıda bunu bir yorum satırından ayırt etmek mümkün olmuyordu. Denetim
     * bunu asteroid bloğunda ölçtü — ayna erişilemediğinde tüm asteroid
     * sayısal doğrulaması sessizce atlanıyor ve CI yeşil kalıyordu.
     *
     * CI'da atlamak KABUL EDİLEMEZ: orada bir kontrolün koşmaması, koşup
     * başarısız olmasıyla aynı ağırlıkta. Yerelde ise bir uyarı, çünkü
     * geliştiricinin 379 MB veriyi indirmiş olması gerekmiyor.
     */
    skip(label, reason) {
      skipped.push(label);
      const where = process.env.CI ? '✗ ATLANDI (CI\'da hata)' : '⚠ ATLANDI';
      console.log(`  ${where} ${label}`);
      if (reason) console.log(`      ${reason}`);
      if (process.env.CI) failures++;
    },

    finish(summary = '') {
      console.log('\n' + '='.repeat(62));
      if (skipped.length) {
        console.log(`${skipped.length} kontrol grubu ATLANDI: ${skipped.join(', ')}`);
      }
      console.log(failures === 0
        ? (summary || 'Tüm kontroller geçti.')
        : `${failures} kontrol BAŞARISIZ.`);
      console.log('='.repeat(62) + '\n');
      // process.exit() çağırmıyoruz: Emscripten runtime ayaktayken zorla
      // çıkmak Windows'ta libuv assertion'ı tetikliyor (async.c:94).
      process.exitCode = failures === 0 ? 0 : 1;
      return failures;
    },
  };
}
