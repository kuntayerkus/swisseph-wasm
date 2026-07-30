#!/usr/bin/env node
/**
 * Veri paketi spec doğrulaması.
 *
 * @swisseph-data paketinin İÇERİĞİNİ tahminle değil deneyle sabitler:
 *   1. Aday dosyalar MEMFS'e yüklenince SEFLG_SWIEPH gerçekten çalışıyor mu?
 *   2. sefstars.txt sabit yıldızları açıyor mu?
 *   3. Aralık dışına çıkınca ne oluyor? (cevap: Moshier'e düşüyor, çökmüyor)
 *
 * .se1 dosyaları repoda yok. Varsayılan yol upstream checkout'u;
 * SWISSEPH_EPHE_PATH ile değiştirilebilir.
 */

import {
  loadSwissEph, createReporter, PLANETS, BODY, SEFLG,
  DATA_PACKAGE_FILES, EPHE_DIR,
} from './_harness.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const se = await loadSwissEph();
const r = createReporter('Veri paketi spec doğrulaması');

r.section('1) Aday dosyaları MEMFS\'e yükle');
if (!existsSync(EPHE_DIR)) {
  console.error(`\n  Ephemeris dizini yok: ${EPHE_DIR}`);
  console.error('  SWISSEPH_EPHE_PATH ile .se1 dosyalarının yerini göster.\n');
  process.exit(1);
}

for (const [file, purpose] of DATA_PACKAGE_FILES) {
  r.check(file.padEnd(14), existsSync(join(EPHE_DIR, file)), purpose);
}

const { bytes } = se.mountEphemeris();
console.log(`\n  Paket toplamı: ${(bytes / 1024 / 1024).toFixed(2)} MB`);

r.section('2) SEFLG_SWIEPH (tam hassasiyet) — 1 Ocak 2000');
const jd = se.julday(2000, 1, 1, 12.0);
const diffs = [];

for (const [ipl, name] of PLANETS) {
  const sw = se.calc(jd, ipl, SEFLG.SWIEPH);
  const mo = se.calc(jd, ipl, SEFLG.MOSEPH);
  if (sw.error) { r.check(name, false, sw.error); continue; }

  const arcsec = angularDiffArcsec(sw.lon, mo.lon);
  diffs.push([name, arcsec]);
  // usedMoshier kontrolü şart: SE dosya bulamazsa sessizce düşer,
  // sonuç yine doğru gelir ama tam hassasiyet almamış oluruz.
  r.check(name.padEnd(8), !sw.usedMoshier,
    `SWIEPH ${sw.lon.toFixed(6).padStart(11)}°   Moshier farkı ${arcsec.toFixed(3).padStart(7)}″`);
}

r.section('3) sefstars.txt — sabit yıldız araması');
for (const star of ['Aldebaran', 'Regulus', 'Antares', 'Fomalhaut', 'Sirius']) {
  const s = se.fixstar(star, jd);
  if (s.error) { r.check(star, false, s.error); continue; }
  r.check(star.padEnd(10), s.lon >= 0 && s.lon < 360,
    `boylam ${s.lon.toFixed(4).padStart(9)}°  enlem ${s.lat.toFixed(4).padStart(8)}°  [${s.resolvedName}]`);
}

r.section('4) Aralık dışı davranışı (dosyalar 1800-2399 CE kapsıyor)');
for (const [year, note] of [[2500, 'aralık dışı'], [1700, 'aralık dışı'], [2100, 'aralık içi (kontrol)']]) {
  const p = se.calc(se.julday(year, 1, 1), BODY.MARS, SEFLG.SWIEPH);
  const status = p.error ? 'HATA' : p.usedMoshier ? 'Moshier\'e düştü' : 'SWIEPH kullandı';
  r.info(`${String(year).padEnd(6)} ${note.padEnd(22)} -> ${status}`);
}

function angularDiffArcsec(a, b) {
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;   // 0/360 sınırını doğru geç
  return d * 3600;
}

if (diffs.length) {
  const sorted = [...diffs].sort((x, y) => y[1] - x[1]);
  console.log(`\n  Moshier'e göre en büyük sapma: ${sorted[0][1].toFixed(3)}″ (${sorted[0][0]})`);
  console.log(`  Medyan: ${sorted[Math.floor(sorted.length / 2)][1].toFixed(3)}″`);
}

se.dispose();
r.finish(`Spec doğrulandı: ${DATA_PACKAGE_FILES.length} dosya yeterli.`);
