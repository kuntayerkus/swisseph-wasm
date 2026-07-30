#!/usr/bin/env node
/**
 * Efemeris yükleyici katmanının kontrolü (Faz 4).
 *
 * En kritik kısım dosya adı kuralı: files.ts, tarihten hangi .se1 dosyasının
 * gerektiğini hesaplıyor ve tembel yüklemenin tamamı buna dayanıyor. Kural
 * yanlışsa hiçbir hata almazsınız — Swiss Ephemeris sessizce Moshier'e döner
 * ve tam hassasiyet aldığınızı sanırsınız.
 *
 * Bu yüzden kuralı teoriye göre değil DENEYE göre doğruluyoruz: hesaplanan
 * dosyayı tek başına yükle, sonra o yıl için hesap yap ve dönen bayraktan
 * gerçekten SWIEPH kullanıldığını teyit et.
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createReporter, EPHE_DIR } from './_harness.mjs';

const {
  createSwissEph, Body, requiredEphemerisFiles, ephemerisFileFor,
  approximateYearFromJulianDay, COVERAGE,
  MemoryEphemeris, NodeFsEphemeris, FetchEphemeris,
} = await import('../packages/core/dist/index.js');

const r = createReporter('Efemeris yükleyicileri (Faz 4)');
const DATA_DIR = join(import.meta.dirname, '..', 'packages', 'data', 'ephe');

// --- 1. Dosya adı hesabı, bilinen sınır değerlerle ----------------------
r.section('1) Dosya adı hesabı — dilim sınırları');

const nameCases = [
  [1990, 'sepl_18.se1', 'sıradan modern tarih'],
  [1800, 'sepl_18.se1', '_18 diliminin ilk yılı'],
  [2399, 'sepl_18.se1', '_18 diliminin son yılı'],
  [1799, 'sepl_12.se1', 'bir yıl önce -> önceki dilim'],
  [2400, 'sepl_24.se1', 'bir yıl sonra -> sonraki dilim'],
  [0, 'sepl_00.se1', 'astronomik yıl 0 (= MÖ 1)'],
  [599, 'sepl_00.se1', '_00 diliminin son yılı'],
  [600, 'sepl_06.se1', '_06 başlangıcı'],
  [-1, 'seplm06.se1', 'astronomik -1 (= MÖ 2)'],
  [-600, 'seplm06.se1', 'm06 diliminin sonu'],
  [-601, 'seplm12.se1', 'm12 başlangıcı'],
  [-13200, 'seplm132.se1', 'kapsamın en eski yılı'],
  [17399, 'sepl_168.se1', 'kapsamın en yeni yılı'],
  [17400, null, 'kapsam dışı -> null'],
  [-13201, null, 'kapsam dışı -> null'],
];

for (const [year, expected, note] of nameCases) {
  const got = ephemerisFileFor('planets', year);
  r.check(`${String(year).padStart(7)} -> ${String(expected).padEnd(14)}`,
    got === expected, `${note}${got !== expected ? `  ALDIK: ${got}` : ''}`);
}

// Elde tam arşiv mi yoksa kısmi ayna mı? CI yalnızca gereken birkaç dosyayı
// çekiyor; tam arşiv 185 .se1 içeriyor. Kontrolleri buna göre uyarlıyoruz ki
// kısmi aynada sahte başarısızlık üretmesin.
const available = existsSync(EPHE_DIR) ? new Set(await readdir(EPHE_DIR)) : new Set();
const se1Count = [...available].filter((f) => f.endsWith('.se1')).length;
const hasFullArchive = se1Count >= 100;

// --- 2. Hesaplanan adlar gerçekten var mı? -------------------------------
r.section('2) Hesaplanan adlar upstream dizinde mevcut mu');
if (hasFullArchive) {
  let checked = 0, found = 0;
  // Kapsamın tamamını 300'er yıl adımlarla tara (dilimler 600 yıllık,
  // bu adım her dilime en az bir kez düşer).
  for (let year = COVERAGE.minYear; year <= COVERAGE.maxYear; year += 300) {
    for (const kind of ['planets', 'moon', 'asteroids']) {
      const name = ephemerisFileFor(kind, year);
      if (!name) continue;
      checked++;
      if (available.has(name)) found++;
      else console.log(`      YOK: ${name} (yıl ${year}, ${kind})`);
    }
  }
  r.check(`kapsam boyunca üretilen ${checked} adın hepsi mevcut`, found === checked,
    `${found}/${checked}`);
} else {
  r.info(`kısmi ayna (${se1Count} .se1) — tam arşiv gerektiren kontrol atlandı`);
}

// --- 3. Aralık hesabı ----------------------------------------------------
r.section('3) requiredEphemerisFiles — aralık');

const single = requiredEphemerisFiles({ fromYear: 1900, toYear: 2100 });
r.check('tek dilim -> 3 dosya', single.length === 3, `-> ${single.join(', ')}`);

const spanning = requiredEphemerisFiles({ fromYear: 1750, toYear: 1850, kinds: ['planets'] });
r.check('1799/1800 sınırını geçen aralık -> 2 dosya',
  spanning.length === 2 && spanning.includes('sepl_12.se1') && spanning.includes('sepl_18.se1'),
  `-> ${spanning.join(', ')}`);

const withAux = requiredEphemerisFiles({
  fromYear: 2000, kinds: ['planets'], fixedStars: true, fictitiousBodies: true,
});
r.check('yardımcı dosyalar eklendi',
  withAux.includes('sefstars.txt') && withAux.includes('seorbel.txt'),
  `-> ${withAux.join(', ')}`);

const reversed = requiredEphemerisFiles({ fromYear: 2100, toYear: 1900, kinds: ['moon'] });
r.check('ters sıralı aralık normalleştiriliyor',
  reversed.length === 1 && reversed[0] === 'semo_18.se1', `-> ${reversed.join(', ')}`);

// --- 4. ASIL KONTROL: kural deneyle doğru mu? ---------------------------
r.section('4) Hesaplanan dosya gerçekten o yılı kapsıyor mu (deneysel)');
{
  let tested = 0, skipped = 0;
  // Her test yılı için YALNIZCA hesaplanan dosyayı yükle. Kural yanlışsa
  // SE sessizce Moshier'e döner ve bunu ephemeris alanından yakalarız.
  for (const year of [1600, 1800, 1990, 2399, 2400, 2600]) {
    const needed = ['planets', 'moon'].map((k) => ephemerisFileFor(k, year));
    // Gereken dosyalardan biri elde yoksa bu yılı test etmenin anlamı yok:
    // Moshier'e düşerdi ve kuralı değil eksikliği ölçmüş olurduk.
    if (!needed.every((n) => n && available.has(n))) { skipped++; continue; }

    const swe = await createSwissEph();
    const files = {};
    for (const name of needed) files[name] = await readFile(join(EPHE_DIR, name));
    swe.mountEphemeris(files);

    const mars = swe.calc(swe.julianDay(year, 6, 15, 12), Body.Mars);
    r.check(`yıl ${year}: ${needed.join('+')}`,
      mars.ephemeris === 'swiss',
      `-> ${mars.ephemeris}${mars.warning ? ` (${mars.warning.slice(0, 40)})` : ''}`);
    tested++;
    swe.dispose();
  }
  if (skipped) r.info(`${skipped} yıl atlandı (gereken dosya elde yok)`);
  // Kuralın hiç sınanmaması sessizce geçmemeli.
  r.check('en az bir yıl deneysel olarak sınandı', tested > 0, `${tested} yıl`);
}

// --- 5. JD -> yıl tahmini ------------------------------------------------
r.section('5) approximateYearFromJulianDay');
{
  const swe = await createSwissEph();
  let worst = 0;
  for (const year of [-3000, 0, 1000, 1990, 2026, 2400, 5000]) {
    const jd = swe.julianDay(year, 6, 15, 12);
    const diff = Math.abs(approximateYearFromJulianDay(jd) - year);
    worst = Math.max(worst, diff);
  }
  // Dosya seçimi için ±1 yıl fazlasıyla yeterli (dilimler 600 yıllık).
  r.check('tahmin ±1 yıl içinde', worst <= 1, `en büyük sapma ${worst} yıl`);
  swe.dispose();
}

// --- 6. MemoryEphemeris --------------------------------------------------
r.section('6) MemoryEphemeris');
if (existsSync(DATA_DIR)) {
  const swe = await createSwissEph();
  const source = new MemoryEphemeris({
    'sepl_18.se1': await readFile(join(DATA_DIR, 'sepl_18.se1')),
    'semo_18.se1': await readFile(join(DATA_DIR, 'semo_18.se1')),
  });
  const res = await swe.loadEphemeris(source, {
    fromYear: 1990, kinds: ['planets', 'moon'],
  });
  r.check('2 dosya yüklendi', res.loaded.length === 2 && res.missing.length === 0,
    `${(res.bytes / 1024 / 1024).toFixed(2)} MB`);
  const p = swe.calc(swe.julianDay(1990, 5, 15), Body.Jupiter);
  r.check('tam hassasiyet elde edildi', p.ephemeris === 'swiss', `-> ${p.ephemeris}`);
  swe.dispose();
} else {
  r.info('veri paketi yok — önce: node tools/build-data-package.mjs');
}

// --- 7. NodeFsEphemeris --------------------------------------------------
r.section('7) NodeFsEphemeris');
if (existsSync(DATA_DIR)) {
  const swe = await createSwissEph();
  const res = await swe.loadEphemeris(new NodeFsEphemeris(DATA_DIR), {
    fromYear: 1990, fixedStars: true,
  });
  r.check('dosyalar okundu', res.loaded.length >= 3, `yüklendi: ${res.loaded.join(', ')}`);
  const star = swe.fixedStar('Regulus', swe.julianDay(1990, 5, 15));
  r.check('sabit yıldız çalışıyor', star.longitude > 0, `Regulus ${star.longitude.toFixed(4)}°`);

  // Bulunmayan dosya hata değil, sadece raporlanıyor.
  const swe2 = await createSwissEph();
  const res2 = await swe2.loadEphemeris(new NodeFsEphemeris(DATA_DIR), { fromYear: 3000 });
  r.check('kapsam dışı istek -> missing, hata değil',
    res2.missing.length > 0 && res2.loaded.length === 0, `eksik: ${res2.missing.join(', ')}`);
  const far = swe2.calc(swe2.julianDay(3000, 1, 1), Body.Mars);
  r.check('dosya yokken Moshier ile hesap sürüyor', far.ephemeris === 'moshier' && far.longitude >= 0,
    `${far.longitude.toFixed(4)}° [${far.ephemeris}]`);
  swe.dispose(); swe2.dispose();
}

// --- 8. NODEFS: kopyasız bağlama ----------------------------------------
r.section('8) mountEphemerisDirectory — NODEFS, kopyasız');
if (existsSync(DATA_DIR)) {
  const swe = await createSwissEph();
  let ok = true;
  try {
    swe.mountEphemerisDirectory(DATA_DIR);
  } catch (e) {
    ok = false;
    r.check('NODEFS bağlama', false, e.message);
  }
  if (ok) {
    const p = swe.calc(swe.julianDay(1990, 5, 15), Body.Saturn);
    r.check('gerçek dizinden tam hassasiyet', p.ephemeris === 'swiss',
      `Satürn ${p.longitude.toFixed(4)}° [${p.ephemeris}]`);
    // Asıl kazanç: iki örnek aynı dizini paylaşıyor, 2 MB iki kez kopyalanmıyor.
    const swe2 = await createSwissEph();
    swe2.mountEphemerisDirectory(DATA_DIR);
    const q = swe2.calc(swe2.julianDay(1990, 5, 15), Body.Saturn);
    r.check('ikinci örnek aynı dizini kopyasız paylaşıyor',
      q.ephemeris === 'swiss' && Math.abs(q.longitude - p.longitude) < 1e-12);
    swe2.dispose();
  }
  swe.dispose();
}

// --- 9. FetchEphemeris (yerel HTTP sunucu ile) --------------------------
r.section('9) FetchEphemeris');
if (existsSync(DATA_DIR)) {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent(req.url.replace(/^\/+/, ''));
    // Yol geçişini engelle: istek adı düz bir dosya adı olmalı.
    if (name.includes('/') || name.includes('..') || !extname(name)) {
      res.writeHead(400).end(); return;
    }
    try {
      const body = await readFile(join(DATA_DIR, name));
      res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const swe = await createSwissEph();
  const res = await swe.loadEphemeris(new FetchEphemeris({ baseUrl }), {
    fromYear: 1990, kinds: ['planets', 'moon'], fixedStars: true,
  });
  r.check('HTTP üzerinden indirildi', res.loaded.length === 3,
    `${res.loaded.join(', ')}  (${(res.bytes / 1024 / 1024).toFixed(2)} MB)`);
  const p = swe.calc(swe.julianDay(1990, 5, 15), Body.Venus);
  r.check('indirilen dosyalarla tam hassasiyet', p.ephemeris === 'swiss',
    `Venüs ${p.longitude.toFixed(4)}° [${p.ephemeris}]`);

  // 404 hata değil: istenen aralık pakette olmayabilir.
  const swe2 = await createSwissEph();
  const res2 = await swe2.loadEphemeris(new FetchEphemeris({ baseUrl }), { fromYear: 3000 });
  r.check('404 -> missing, istisna fırlatmıyor', res2.missing.length > 0,
    `eksik: ${res2.missing.length} dosya`);

  // Cache arayüzü: ikinci okuma ağa gitmemeli.
  let fetchCount = 0;
  const store = new Map();
  const cache = {
    async get(k) { return store.get(k) ?? null; },
    async set(k, v) { store.set(k, v); },
  };
  const countingFetch = async (url) => { fetchCount++; return fetch(url); };
  const swe3 = await createSwissEph();
  const opts = { fromYear: 1990, kinds: ['planets'] };
  await swe3.loadEphemeris(new FetchEphemeris({ baseUrl, cache, fetchImpl: countingFetch }), opts);
  const afterFirst = fetchCount;
  await swe3.loadEphemeris(new FetchEphemeris({ baseUrl, cache, fetchImpl: countingFetch }), opts);
  r.check('cache ikinci indirmeyi engelliyor',
    fetchCount === afterFirst, `ağ isteği: ${afterFirst} -> ${fetchCount}`);

  swe.dispose(); swe2.dispose(); swe3.dispose();
  await new Promise((ok) => server.close(ok));
}

// --- 10. Asteroidler -----------------------------------------------------
r.section('10) Numaralı asteroidler');
{
  const { Asteroid, asteroidBody, asteroidFile, AsteroidOffset, BUILT_IN_ASTEROIDS } =
    await import('../packages/core/dist/index.js');

  // Dosya adı kuralı: 8 karakterlik taban ad sabit (DOS 8.3 mirası).
  const nameCases = [
    [433, 'se00433s.se1', 'ast0'],
    [5, 'se00005s.se1', 'ast0'],
    [20000, 'se20000s.se1', 'ast20'],
    [136199, 's136199s.se1', 'ast136'],
    [225088, 's225088s.se1', 'ast225'],
  ];
  for (const [n, file, dir] of nameCases) {
    const spec = asteroidFile(n);
    r.check(`${String(n).padStart(6)} -> ${file}`,
      spec.fileName === file && spec.directory === dir, spec.path);
  }
  r.check('uzun dosya sondaki s\'yi düşürüyor',
    asteroidFile(433, { long: true }).fileName === 'se00433.se1');

  const AST_DIR = join(import.meta.dirname, '..', 'packages', 'asteroids', 'ephe');
  if (existsSync(AST_DIR)) {
    const swe = await createSwissEph();
    swe.mountEphemerisDirectory(DATA_DIR);
    // Asteroid dosyaları ikinci bir dizinden geliyor; SE ephepath'te ';' ile
    // ayrılmış birden çok dizini destekliyor.
    swe.raw.FS.mkdir('/ast');
    (swe.raw.FS).mount(swe.raw.NODEFS, { root: AST_DIR }, '/ast');
    swe.setEphemerisPath('/ephe;/ast');

    const jd = swe.julianDay(1990, 5, 15, 12);
    for (const name of ['Eris', 'Sedna', 'Quaoar', 'Eros', 'Lilith']) {
      const p = swe.calc(jd, asteroidBody(Asteroid[name]));
      r.check(name.padEnd(8), p.ephemeris === 'swiss' && p.longitude >= 0 && p.longitude < 360,
        `${p.longitude.toFixed(4)}°  [${p.ephemeris}]`);
    }

    // TUZAK: ham offset aritmetiği Chiron'da ayrı dosya arar ve hata verir;
    // asteroidBody() ana efemeristeki Body sabitine çeviriyor.
    const chiron = swe.calc(jd, asteroidBody(Asteroid.Chiron));
    r.check('asteroidBody(Chiron) ayrı dosyasız çalışıyor',
      chiron.ephemeris === 'swiss', `${chiron.longitude.toFixed(4)}°`);
    r.check('asteroidBody(Chiron) Body.Chiron döndürüyor',
      asteroidBody(Asteroid.Chiron) === Body.Chiron,
      `-> ${asteroidBody(Asteroid.Chiron)}`);

    let rawOffsetFailed = false;
    try { swe.calc(jd, AsteroidOffset + Asteroid.Chiron); } catch { rawOffsetFailed = true; }
    r.check('ham AsteroidOffset+2060 ayrı dosya arıyor (tuzak belgelendi)',
      rawOffsetFailed, 'asteroidBody() bu yüzden var');

    // GEZEGENLERDEN FARK: eksik asteroid dosyası Moshier'e düşmez, hata verir.
    let threw = false;
    try {
      swe.calc(jd, AsteroidOffset + 99999);   // paketlenmemiş bir asteroid
    } catch {
      threw = true;
    }
    r.check('eksik asteroid -> HATA (Moshier\'e düşmez)', threw,
      'gezegenlerdeki sessiz düşüşten farklı');

    // Asteroid Lilith ile Black Moon Lilith karıştırılmamalı.
    const astLilith = swe.calc(jd, asteroidBody(Asteroid.Lilith));
    const bmlMean = swe.calc(jd, Body.BlackMoonLilithMean);
    r.check('asteroid Lilith != Black Moon Lilith',
      Math.abs(astLilith.longitude - bmlMean.longitude) > 1,
      `asteroid ${astLilith.longitude.toFixed(2)}° vs BML ${bmlMean.longitude.toFixed(2)}°`);

    swe.dispose();
  } else {
    /*
     * Bu blok asteroid tarafının TEK sayısal doğrulaması — altın korpus
     * asteroidleri kapsamıyor. Sessizce atlanması, asteroid paketinin hiç
     * doğrulanmadan yayınlanabilmesi demekti ve CI yeşil kalıyordu.
     *
     * release.yml'de asteroid paketi adımında `continue-on-error` YOK, yani
     * yayın zaten aynanın erişilebilirliğine bağlı. O hâlde CI'da sessiz
     * atlamaya izin vermenin bir kazancı yok.
     */
    r.skip('10) Asteroid sayısal doğrulaması',
      'packages/asteroids/ephe yok — önce: npm run build:asteroids');
  }
}

r.finish('Efemeris yükleyicileri çalışıyor, dosya adı kuralı deneyle doğrulandı.');
