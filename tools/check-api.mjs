#!/usr/bin/env node
/**
 * TypeScript API katmanının uçtan uca kontrolü (Faz 2).
 *
 * Derlenmiş dist/ üzerinden gidiyor — kullanıcının göreceği yolun aynısı.
 * Özellikle şunları kanıtlıyor:
 *   1. Genel API yüzeyi çalışıyor (calc, houses, fixedStar, tarih, ayanamsa)
 *   2. `ephemeris` alanı gerçekten kullanılan kaynağı bildiriyor
 *   3. INSTANCE İZOLASYONU: iki örneğin ayarları birbirine sızmıyor
 *   4. dispose() sonrası kullanım hata veriyor, sessizce bozulmuyor
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createReporter, EPHE_DIR, DATA_PACKAGE_FILES } from './_harness.mjs';

const {
  createSwissEph, Body, Flag, HouseSystem, HOUSE_SYSTEM_NAMES, Ayanamsa,
  SwissEphError, SIGNS,
} = await import('../packages/core/dist/index.js');

const r = createReporter('TypeScript API kontrolü (Faz 2)');

// Ankara: 39.93 K, 32.86 D
const LAT = 39.93, LON = 32.86;

// --- 1. Temel yüzey -----------------------------------------------------
r.section('1) Temel API yüzeyi');
const swe = await createSwissEph();

r.check('version', swe.version === '2.10.03', `-> ${swe.version}`);

const jd = swe.julianDay(1990, 5, 15, 14.5);
r.check('julianDay(1990-05-15 14:30)', Math.abs(jd - 2448027.104166667) < 1e-6, `-> ${jd}`);

const back = swe.calendarDate(jd);
r.check('calendarDate() gidiş-dönüş',
  back.year === 1990 && back.month === 5 && back.day === 15 && Math.abs(back.hour - 14.5) < 1e-6,
  `-> ${back.year}-${back.month}-${back.day} ${back.hour.toFixed(4)}h`);

r.check('planetName(Chiron)', swe.planetName(Body.Chiron) === 'Chiron',
  `-> "${swe.planetName(Body.Chiron)}"`);

// --- 2. calcWithSign türetmeleri ----------------------------------------
r.section('2) calcWithSign — burç/derece/retrograd türetmesi');
for (const [name, body] of [['Güneş', Body.Sun], ['Ay', Body.Moon], ['Merkür', Body.Mercury],
                            ['Satürn', Body.Saturn], ['Plüton', Body.Pluto]]) {
  const p = swe.calcWithSign(jd, body);
  const consistent =
    p.signIndex === Math.floor(((p.longitude % 360) + 360) % 360 / 30) &&
    p.degreeInSign >= 0 && p.degreeInSign < 30 &&
    p.sign === SIGNS[p.signIndex] &&
    p.retrograde === (p.longitudeSpeed < 0);
  r.check(name.padEnd(8), consistent,
    `${p.degreeInSign.toFixed(3).padStart(7)}° ${p.sign.padEnd(11)}` +
    `${p.retrograde ? 'R' : ' '}  [${p.ephemeris}]`);
}

// --- 3. Lilith ayrımı ---------------------------------------------------
r.section('3) Lilith ayrımı — üçü de farklı konum vermeli');
const lilithMean = swe.calc(jd, Body.BlackMoonLilithMean);
const lilithTrue = swe.calc(jd, Body.BlackMoonLilithTrue);
const meanTrueDiff = Math.abs(lilithMean.longitude - lilithTrue.longitude);
r.check('BlackMoonLilithMean != BlackMoonLilithTrue', meanTrueDiff > 0.01,
  `ortalama ${lilithMean.longitude.toFixed(4)}°, gerçek ${lilithTrue.longitude.toFixed(4)}° ` +
  `(fark ${meanTrueDiff.toFixed(4)}°)`);

// --- 4. Evler ------------------------------------------------------------
r.section('4) Ev sistemleri');
/*
 * Beklenen cusp sayısı sisteme göre. 'G' 36 SEKTÖR döndürür, 12 ev değil
 * (swehouse.c: ito = 36). Okuma bir zamanlar sabit 12'ye kodluydu ve 'G'
 * sessizce kırpılıyordu; dönen 12 değer gerçek olduğu için hiçbir şey bozuk
 * görünmüyordu. Yayın kapısı artık sayıyı da denetliyor.
 */
const expectedCusps = (sys) => (String(sys).toUpperCase() === 'G' ? 36 : 12);

for (const [label, sys] of [['Placidus', HouseSystem.Placidus], ['Koch', HouseSystem.Koch],
                            ['WholeSign', HouseSystem.EqualWholeSign],
                            ['Regiomontanus', HouseSystem.Regiomontanus],
                            ['Gauquelin', HouseSystem.GauquelinSectors]]) {
  const h = swe.houses(jd, LAT, LON, sys);
  const want = expectedCusps(sys);
  const sane = h.cusps.length === want &&
    h.cusps.every((cusp) => cusp >= 0 && cusp < 360) &&
    h.ascendant >= 0 && h.ascendant < 360;
  r.check(label.padEnd(14), sane,
    `ASC ${h.ascendant.toFixed(3).padStart(8)}°  MC ${h.midheaven.toFixed(3).padStart(8)}°  ` +
    `${h.cusps.length} cusp`);
}

// Placidus'ta 1. ev başlangıcı tanım gereği Yükselen'e eşittir.
const plac = swe.houses(jd, LAT, LON, HouseSystem.Placidus);
r.check('Placidus: 1. ev == Yükselen (tanım)',
  Math.abs(plac.cusps[0] - plac.ascendant) < 1e-9);

// Her ev sistemi beklenen sayıda cusp döndürmeli. Üretilmiş liste üzerinde
// döngü kuruyoruz: gelecekte eklenen sistem kendiliğinden kapsanır.
{
  const wrong = Object.keys(HOUSE_SYSTEM_NAMES).filter((code) => {
    try {
      return swe.houses(jd, LAT, LON, code).cusps.length !== expectedCusps(code);
    } catch {
      return true;
    }
  });
  r.check('her ev sistemi beklenen sayıda cusp veriyor', wrong.length === 0,
    wrong.length ? `sapan: ${wrong.join(' ')}` :
      `${Object.keys(HOUSE_SYSTEM_NAMES).length} sistem denetlendi`);
}

// --- 5. Sabit yıldızlar --------------------------------------------------
r.section('5) Sabit yıldızlar (kraliyet yıldızları)');
const hasData = existsSync(join(EPHE_DIR, 'sefstars.txt'));
if (hasData) {
  swe.mountEphemeris(Object.fromEntries(
    DATA_PACKAGE_FILES.map(([f]) => [f, readFileSync(join(EPHE_DIR, f))])
      .filter(([, buf]) => buf),
  ));
  for (const star of ['Aldebaran', 'Regulus', 'Antares', 'Fomalhaut']) {
    const s = swe.fixedStar(star, jd);
    const signIdx = Math.floor(s.longitude / 30);
    r.check(star.padEnd(10), s.longitude >= 0 && s.longitude < 360,
      `${(s.longitude - signIdx * 30).toFixed(3).padStart(7)}° ${SIGNS[signIdx].padEnd(11)}` +
      `[${s.resolvedName}]`);
  }
} else {
  r.info('sefstars.txt yok, atlandı (SWISSEPH_EPHE_PATH ayarlayın)');
}

// --- 6. ephemeris alanı doğruyu söylüyor mu ------------------------------
r.section('6) `ephemeris` alanı gerçek kaynağı bildiriyor mu');
const forcedMoshier = swe.calc(jd, Body.Mars, { ephemeris: 'moshier' });
r.check('ephemeris:"moshier" istendi -> "moshier" bildirildi',
  forcedMoshier.ephemeris === 'moshier', `-> ${forcedMoshier.ephemeris}`);

if (hasData) {
  const swiss = swe.calc(jd, Body.Mars, { ephemeris: 'swiss' });
  r.check('dosya varken swiss istendi -> "swiss" bildirildi',
    swiss.ephemeris === 'swiss', `-> ${swiss.ephemeris}`);

  // 2500 CE dosya kapsamı dışında: sessiz düşüşün bildirildiğini kanıtla.
  const outOfRange = swe.calc(swe.julianDay(2500, 1, 1), Body.Mars, { ephemeris: 'swiss' });
  r.check('aralık dışında swiss istendi -> "moshier" bildirildi (sessiz düşüş görünür)',
    outOfRange.ephemeris === 'moshier',
    `-> ${outOfRange.ephemeris}, uyarı: ${(outOfRange.warning ?? '').slice(0, 45)}...`);
}

// --- 7. Ayanamsa ---------------------------------------------------------
r.section('7) Sidereal mod / ayanamsa');
swe.setSiderealMode(Ayanamsa.Lahiri);
const ayan = swe.ayanamsa(jd);
// Lahiri ayanamsası 1990'da ~23.7°.
r.check('Lahiri ayanamsa 1990 ~23.7°', ayan > 23.5 && ayan < 24.0, `-> ${ayan.toFixed(5)}°`);

const tropical = swe.calc(jd, Body.Sun);
const sidereal = swe.calc(jd, Body.Sun, { flags: Flag.Sidereal });
const shift = ((tropical.longitude - sidereal.longitude) % 360 + 360) % 360;
r.check('tropikal − sidereal == ayanamsa', Math.abs(shift - ayan) < 1e-6,
  `-> ${shift.toFixed(5)}° vs ${ayan.toFixed(5)}°`);

// --- 8. INSTANCE İZOLASYONU ---------------------------------------------
r.section('8) Instance izolasyonu — asıl mesele');
// swe örneğinde sidereal mod Lahiri olarak ayarlı. Yeni bir örnek bundan
// etkilenmemeli; tek WASM örneği paylaşılsaydı etkilenirdi.
const swe2 = await createSwissEph();
const sun2Default = swe2.calc(jd, Body.Sun, { flags: Flag.Sidereal });
const sun1Lahiri = swe.calc(jd, Body.Sun, { flags: Flag.Sidereal });

r.check('yeni örnek, önceki örneğin sidereal modunu miras ALMIYOR',
  Math.abs(sun2Default.longitude - sun1Lahiri.longitude) > 0.01,
  `örnek1(Lahiri) ${sun1Lahiri.longitude.toFixed(4)}° vs ` +
  `örnek2(varsayılan) ${sun2Default.longitude.toFixed(4)}°`);

// Ters yön: örnek2'yi değiştir, örnek1 sabit kalsın.
swe2.setSiderealMode(Ayanamsa.FaganBradley);
const after = swe.calc(jd, Body.Sun, { flags: Flag.Sidereal });
r.check('örnek2\'yi değiştirmek örnek1\'i ETKİLEMİYOR',
  Math.abs(after.longitude - sun1Lahiri.longitude) < 1e-9,
  `örnek1 değişmedi: ${after.longitude.toFixed(6)}°`);

swe2.dispose();

// --- 9. dispose() sonrası davranış --------------------------------------
r.section('9) dispose() sonrası kullanım');
let threw = false;
try {
  swe2.calc(jd, Body.Sun);
} catch (e) {
  threw = e instanceof SwissEphError;
}
r.check('dispose() edilmiş örnek SwissEphError fırlatıyor', threw);
r.check('dispose() iki kez çağrılabilir (idempotent)',
  (() => { try { swe2.dispose(); return true; } catch { return false; } })());

// --- 10. Hata yolu -------------------------------------------------------
r.section('10) Hata yolu');
let starErr = false;
try {
  swe.fixedStar('BuYildizYok', jd);
} catch (e) {
  starErr = e instanceof SwissEphError && e.fn === 'swe_fixstar2';
}
r.check('bilinmeyen yıldız -> fn alanıyla SwissEphError', starErr);

swe.dispose();
r.finish('TypeScript API katmanı çalışıyor, instance izolasyonu doğrulandı.');
