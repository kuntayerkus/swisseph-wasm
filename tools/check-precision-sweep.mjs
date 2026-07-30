#!/usr/bin/env node
/**
 * Moshier ile tam Swiss Ephemeris farkının dosya aralığı (1800-2399 CE)
 * boyunca nasıl değiştiğini ölçer.
 *
 * Tek tarihte ölçüp genelleme yapmak yanıltıcı: Moshier'in uyumu yaklaşık
 * 1900-1950 civarında merkezlenmiş, kenarlara doğru bozuluyor ve bozulma
 * neredeyse tamamen dış gezegenlerde. Veri paketinin değer önermesini
 * README'de dürüst yazabilmek için gerçek eğriye bakıyoruz.
 */

import { loadSwissEph, SEFLG, BODY } from './_harness.mjs';

const BODIES = [
  [BODY.SUN, 'Güneş'], [BODY.MOON, 'Ay'], [BODY.MARS, 'Mars'],
  [BODY.JUPITER, 'Jüpiter'], [BODY.PLUTO, 'Plüton'],
];
const YEARS = [1800, 1850, 1900, 1950, 2000, 2050, 2100, 2200, 2300, 2399];

const se = await loadSwissEph();
const { bytes } = se.mountEphemeris(['sepl_18.se1', 'semo_18.se1', 'seas_18.se1']);
if (bytes === 0) {
  console.error('\n.se1 dosyası bulunamadı. SWISSEPH_EPHE_PATH ayarla.\n');
  process.exit(1);
}

console.log('\nMoshier ile tam Swiss Ephemeris farkı, yay-saniyesi (″)\n');
console.log('  yıl   ' + BODIES.map(([, n]) => n.padStart(9)).join('') + '     max');
console.log('  ' + '-'.repeat(6 + BODIES.length * 9 + 8));

let globalMax = 0, globalMaxAt = '';

for (const year of YEARS) {
  const tjd = se.julday(year, 6, 15);
  const cells = [], row = [];

  for (const [ipl, name] of BODIES) {
    const sw = se.calc(tjd, ipl, SEFLG.SWIEPH);
    const mo = se.calc(tjd, ipl, SEFLG.MOSEPH);
    // sw.usedMoshier ise dosya kapsamıyor demektir; ikisini karşılaştırmak
    // anlamsız olur (fark sıfır çıkar ve tabloyu yanıltır).
    if (sw.error || mo.error || sw.usedMoshier) {
      cells.push('n/a'.padStart(9));
      continue;
    }
    let d = Math.abs(sw.lon - mo.lon);
    if (d > 180) d = 360 - d;
    const arcsec = d * 3600;
    row.push(arcsec);
    if (arcsec > globalMax) { globalMax = arcsec; globalMaxAt = `${name}, ${year}`; }
    cells.push(arcsec.toFixed(3).padStart(9));
  }

  const rowMax = row.length ? Math.max(...row) : 0;
  console.log(`  ${year}  ${cells.join('')}  ${rowMax.toFixed(3).padStart(8)}`);
}

se.dispose();

console.log('\n' + '='.repeat(64));
console.log(`En büyük sapma: ${globalMax.toFixed(3)}″  (${globalMaxAt})`);
console.log(`Yay-dakikası cinsinden: ${(globalMax / 60).toFixed(4)}′`);
console.log('='.repeat(64) + '\n');
