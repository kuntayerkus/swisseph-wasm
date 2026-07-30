#!/usr/bin/env node
/**
 * Build çalışıyor mu? — fizik temelli akıl kontrolleri.
 *
 * Sayısal doğrulama DEĞİL (o Faz 3'te native swetest referansıyla gelecek).
 * Üç şeyi kanıtlar:
 *   1. Modül yükleniyor, C tarafı ayakta
 *   2. Moshier modunda hiçbir .se1 dosyası olmadan hesap yapılabiliyor
 *   3. Pointer tabanlı binding tekniği çalışıyor
 */

import { loadSwissEph, createReporter, PLANETS, BODY, SEFLG } from './_harness.mjs';

const se = await loadSwissEph();
const r = createReporter('Smoke testi');

r.section('1) Modül yükleme');
const version = se.version();
r.check('swe_version = 2.10.03', version === '2.10.03', `-> "${version}"`);

r.section('2) Tarih dönüşümü');
// J2000.0 tanım gereği tam olarak JD 2451545.0'dır.
const jd = se.julday(2000, 1, 1, 12.0);
r.check('swe_julday(2000-01-01 12:00) = 2451545.0', Math.abs(jd - 2451545.0) < 1e-9, `-> ${jd}`);

r.section('3) swe_calc_ut, Moshier modu (dosyasız)');
const pos = new Map();
for (const [ipl, name] of PLANETS) {
  const p = se.calc(jd, ipl, SEFLG.MOSEPH);
  if (p.error) { r.check(name, false, p.error); continue; }
  pos.set(name, p);
  r.check(name.padEnd(8),
    p.lon >= 0 && p.lon < 360 && Number.isFinite(p.dist) && p.dist > 0,
    `boylam ${p.lon.toFixed(4).padStart(9)}°  enlem ${p.lat.toFixed(4).padStart(8)}°  ` +
    `uzaklık ${p.dist.toFixed(6).padStart(11)} AU  hız ${p.lonSpeed.toFixed(4).padStart(8)}°/gün`);
}

r.section('4) Fizik kontrolleri');
const sun = pos.get('Güneş'), moon = pos.get('Ay'), pluto = pos.get('Plüton');

if (sun) {
  // Dünya günberiye 3-4 Ocak'ta geçer; 1 Ocak'ta uzaklık ~0.983 AU.
  r.check('Güneş uzaklığı ~0.983 AU (günberi civarı)',
    Math.abs(sun.dist - 0.983) < 0.002, `-> ${sun.dist.toFixed(6)} AU`);
  // Yılda 360° -> ~1.019°/gün, günberide en hızlı.
  r.check('Güneş hızı ~1.019°/gün',
    Math.abs(sun.lonSpeed - 1.019) < 0.01, `-> ${sun.lonSpeed.toFixed(5)}°/gün`);
  // Güneş tanım gereği ekliptik üzerindedir.
  r.check('Güneş enlemi ~0° (ekliptik tanımı)',
    Math.abs(sun.lat) < 0.001, `-> ${sun.lat.toExponential(2)}°`);
}

if (moon) {
  // 27.32 günlük tur -> ortalama 13.18°/gün, eksantriklikle 11-15 arası salınır.
  r.check('Ay hızı 11-15°/gün',
    moon.lonSpeed > 11 && moon.lonSpeed < 15, `-> ${moon.lonSpeed.toFixed(4)}°/gün`);
  // Ay yörüngesi ekliptiğe ~5.15° eğik.
  r.check('Ay enlemi |lat| < 5.5°',
    Math.abs(moon.lat) < 5.5, `-> ${moon.lat.toFixed(4)}°`);
  // 356.000-407.000 km = 0.00238-0.00272 AU.
  r.check('Ay uzaklığı 0.0024-0.0028 AU',
    moon.dist > 0.0024 && moon.dist < 0.0028, `-> ${moon.dist.toFixed(8)} AU`);
}

if (sun && pluto) {
  r.check('Plüton, Güneş\'ten çok daha yavaş',
    Math.abs(pluto.lonSpeed) < Math.abs(sun.lonSpeed) / 10,
    `-> ${pluto.lonSpeed.toFixed(5)}°/gün`);
}

se.dispose();
r.finish('Build çalışıyor, Moshier modu dosyasız hesap yapıyor.');
