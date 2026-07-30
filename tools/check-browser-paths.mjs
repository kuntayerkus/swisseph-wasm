#!/usr/bin/env node
/**
 * Yalnızca tarayıcıda ortaya çıkan hataları Node'da yakalamaya çalışır.
 *
 * Demo'da iki hata çıktı ve ikisi de Node testlerinden geçmişti. Sebebi
 * ortam farkı: Node'un web API'leri tarayıcının uyguladığı bazı kısıtları
 * uygulamıyor. Bu betik o kısıtları TAKLİT ederek aynı sınıftan hataları
 * yayın öncesinde yakalar.
 *
 *   node tools/check-browser-paths.mjs
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createReporter } from './_harness.mjs';

const {
  createSwissEph, Body, HouseSystem, ROYAL_STARS, byDesignation,
  FetchEphemeris, MemoryEphemeris,
} = await import('../packages/core/dist/index.js');

const r = createReporter('Tarayıcıya özgü yol kontrolleri');
const DATA_DIR = join(import.meta.dirname, '..', 'packages', 'data', 'ephe');

// --- 1. fetch'in "Illegal invocation" kısıtı ----------------------------
r.section('1) fetch, ayrık referans olarak çağrılabiliyor mu');

/**
 * Tarayıcı davranışını taklit et: fetch yalnızca this === globalThis ile
 * çağrılabilsin. Kütüphane fetch'i bağlamadan saklıyorsa burada patlar.
 */
const realFetch = globalThis.fetch;
let illegalInvocations = 0;

globalThis.fetch = function strictFetch(...args) {
  // Tarayıcıda `const f = window.fetch; f(url)` -> this undefined -> hata.
  if (this !== globalThis && this !== undefined) {
    illegalInvocations++;
    throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  }
  if (this === undefined) {
    illegalInvocations++;
    throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  }
  return realFetch.apply(globalThis, args);
};

const server = createServer(async (req, res) => {
  const name = decodeURIComponent(req.url.replace(/^\/+/, ''));
  if (name.includes('/') || name.includes('..')) { res.writeHead(400).end(); return; }
  try {
    res.writeHead(200, { 'content-type': 'application/octet-stream' })
       .end(await readFile(join(DATA_DIR, name)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

if (existsSync(DATA_DIR)) {
  const swe = await createSwissEph();
  let error = null;
  try {
    await swe.loadEphemeris(new FetchEphemeris({ baseUrl }), {
      fromYear: 1990, kinds: ['planets'],
    });
  } catch (e) {
    error = e;
  }
  r.check('FetchEphemeris katı fetch ile çalışıyor', error === null,
    error ? error.message : `${illegalInvocations} illegal invocation`);
  r.check('hiç "Illegal invocation" tetiklenmedi', illegalInvocations === 0);
  swe.dispose();
} else {
  r.info('veri paketi yok — atlandı');
}

globalThis.fetch = realFetch;
await new Promise((ok) => server.close(ok));

// --- 2. Demo'nun compute() akışı ----------------------------------------
r.section('2) Demo compute() akışı, baştan sona');

{
  const swe = await createSwissEph();
  if (existsSync(DATA_DIR)) {
    const files = {};
    for (const f of ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1', 'sefstars.txt']) {
      const p = join(DATA_DIR, f);
      if (existsSync(p)) files[f] = await readFile(p);
    }
    swe.mountEphemeris(files);
  }

  const BODIES = [
    Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter,
    Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto,
    Body.NorthNodeTrue, Body.Chiron,
  ];

  /** Demo'daki compute() ile aynı sıra ve aynı çağrılar. */
  function compute(lat, lon) {
    const jd = swe.julianDay(1990, 5, 15, 14.5);
    for (const body of BODIES) swe.calcWithSign(jd, body);
    const h = swe.houses(jd, lat, lon, HouseSystem.Placidus);
    const { sect, lots } = swe.lots(jd, { latitude: lat, longitude: lon });
    for (const star of ROYAL_STARS) {
      try { swe.fixedStar(byDesignation(star.designation), jd); } catch { /* veri yok */ }
    }
    return {
      cusps: h.cusps.length,
      substituted: h.substituted,
      lots: Object.keys(lots).length,
      sect: sect.sect,
      ephemeris: swe.calc(jd, Body.Mars).ephemeris,
    };
  }

  // Demo compute()'u sayfa yüklenince BİR, düğmeye basınca TEKRAR çağırıyor.
  // İkinci çağrının patlaması kullanıcıya "düğme çalışmıyor" gibi görünür.
  let first = null, second = null, error = null;
  try {
    first = compute(39.93, 32.86);
    second = compute(39.93, 32.86);
  } catch (e) {
    error = e;
  }

  r.check('ilk çağrı çalışıyor', first !== null, error ? error.message : '');
  r.check('ikinci çağrı da çalışıyor (düğme yolu)', second !== null,
    error ? error.message : '');
  if (first && second) {
    r.check('iki çağrı aynı sonucu veriyor',
      JSON.stringify(first) === JSON.stringify(second),
      `${first.lots} lot, ${first.cusps} ev, ${first.sect}, ${first.ephemeris}`);
  }

  // Girdi değişince sonucun gerçekten değişmesi lazım — yoksa düğme
  // "hiçbir şey yapmıyor" gibi görünür.
  const other = compute(-33.87, 151.21);
  r.check('farklı konum farklı sonuç veriyor',
    JSON.stringify(other) !== JSON.stringify(first),
    `Sidney: ${other.sect}, Ankara: ${first?.sect}`);

  swe.dispose();
}

// --- 3. Tarayıcı globalleri Node'da yok — kod bunu varsaymamalı ---------
r.section('3) Tarayıcı globallerine bağımlılık');
{
  const { BrowserCache } = await import('../packages/core/dist/index.js');
  r.check('BrowserCache.create() caches yokken null dönüyor',
    BrowserCache.create() === null, 'istisna fırlatmıyor');

  const swe = await createSwissEph();
  let threw = false;
  try {
    swe.mountEphemerisDirectory('/olmayan/dizin');
  } catch {
    threw = true;
  }
  r.check('mountEphemerisDirectory olmayan dizinde hata veriyor', threw);
  swe.dispose();
}

r.finish('Tarayıcıya özgü yollar Node\'da taklit edilerek doğrulandı.');
