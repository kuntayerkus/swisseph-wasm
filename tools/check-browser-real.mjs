#!/usr/bin/env node
/**
 * Gerçek tarayıcı testi — Faz 4 yol haritasının açık maddesi.
 *
 * Tarayıcı demosunu baştan sona headless Chromium'da koşturur:
 * modül yüklenir, Moshier ile hesap yapılır, .se1 dosyaları
 * FetchEphemeris + BrowserCache ile indirilir, tam hassasiyette yeniden
 * hesaplanır. Konsol ve sayfa hataları da toplanır — sessizce yutulan bir
 * istisna burada kırmızıya döner.
 *
 *   node tools/check-browser-real.mjs
 *
 * Gereksinim: `npx playwright install chromium`. Playwright kurulu değilse
 * betik YÜKSEK SESLE atlar (CI'da hata sayılır) — check:golden'ın atlama
 * politikasıyla aynı.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporter } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const r = createReporter('Gerçek tarayıcı testi (Playwright + Chromium)');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  r.skip('Playwright', 'kurulu değil — önce: npm i -D @playwright/test && npx playwright install chromium');
  r.finish();
  process.exit(process.exitCode ?? 0);
}

/** Boş port bul — sunucuyla aynı mantık, çakışma olmasın. */
function freePort() {
  return new Promise((resolvePromise, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePromise(port));
    });
  });
}

const port = await freePort();
const server = spawn(process.execPath, [join(ROOT, 'examples', 'browser', 'serve.mjs'), String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

await new Promise((resolvePromise, reject) => {
  const timer = setTimeout(() => reject(new Error('demo sunucusu başlamadı')), 10_000);
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('Demo:')) { clearTimeout(timer); resolvePromise(); }
  });
  server.on('exit', (code) => reject(new Error(`sunucu erken kapandı (kod ${code})`)));
});

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(String(err)));

try {
  r.section('1) Modül yükleniyor');
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true || window.__error, undefined, { timeout: 30_000 });
  const loadError = await page.evaluate(() => window.__error ?? null);
  r.check('WASM modülü yüklendi', loadError === null, loadError ?? 'window.__ready = true');

  r.section('2) Moshier hesabı (dosyasız)');
  await page.click('#calc');
  await page.waitForFunction(() => /Hesaplandı/.test(document.getElementById('status').textContent), undefined, { timeout: 10_000 });
  const rows = await page.locator('#planets tbody tr').count();
  r.check('cisim tablosu doldu', rows >= 14, `${rows} satır`);

  const used = await page.locator('#used').textContent();
  r.check('UT dönüşümü doğru (1990-05-15 14:30 +03 -> JD 2448026.979167)',
    used.includes('JD 2448026.979167'), used.trim());

  const sunSource = await page.locator('#planets tbody tr').first().locator('td').last().textContent();
  r.check('Güneş Moshier kaynağıyla', sunSource.includes('moshier'), sunSource.trim());

  r.section('3) Tam hassasiyet yükleme (FetchEphemeris + BrowserCache)');
  await page.click('#load');
  await page.waitForFunction(() => window.__loaded || window.__error, undefined, { timeout: 60_000 });
  const loadResult = await page.evaluate(() => window.__loaded ?? null);
  const loadError2 = await page.evaluate(() => window.__error ?? null);
  r.check('.se1 dosyaları indirildi', loadResult !== null && loadResult.loaded.length >= 4,
    loadResult ? `${loadResult.loaded.length} dosya, ${(loadResult.bytes / 1048576).toFixed(2)} MB` : String(loadError2));
  r.check('eksik dosya yok', loadResult !== null && loadResult.missing.length === 0,
    loadResult ? `eksik: ${loadResult.missing.join(', ') || 'yok'}` : '-');

  await page.waitForFunction(() => /Tam hassasiyet etkin/.test(document.getElementById('status').textContent), undefined, { timeout: 10_000 });
  const sunSource2 = await page.locator('#planets tbody tr').first().locator('td').last().textContent();
  r.check('Güneş artık swiss kaynağından', sunSource2.includes('swiss'), sunSource2.trim());

  const chiron = await page.locator('#planets tbody tr', { hasText: 'Chiron' }).locator('td').nth(1).textContent();
  r.check('Chiron hesaplanıyor (seas_18.se1 yüklü)', !chiron.includes('gerekli'), chiron.trim());

  const star = await page.locator('#stars tbody tr').first().locator('td').nth(1).textContent();
  r.check('kraliyet yıldızı konumu geldi (sefstars.txt)', /\d+°\d{2}'\d{2}"/.test(star), star.trim());

  // Şehir seçici: 34 bin şehirlik GeoNames tablosundan Ankara'yı bul,
  // koordinatları doldur, dilimi TARİHE göre çöz (1990 yazı +03, kışı +02).
  r.section('4) Şehir seçici — koordinat + tarihsel saat dilimi');
  await page.waitForFunction(() => (window.__cities ?? 0) > 0, undefined, { timeout: 30_000 });
  const cityCount = await page.evaluate(() => window.__cities);
  r.check('şehir tablosu yüklendi', cityCount > 30_000, `${cityCount} şehir`);

  await page.fill('#city', 'ankara');
  await page.waitForSelector('#cityResults button', { timeout: 5_000 });
  await page.click('#cityResults button');
  const cityValue = await page.inputValue('#city');
  r.check('Ankara seçildi', cityValue.startsWith('Ankara'), cityValue);

  const cityLat = Number(await page.inputValue('#lat'));
  const cityLon = Number(await page.inputValue('#lon'));
  r.check('enlem kendiliğinden doldu', Math.abs(cityLat - 39.92) < 0.1, cityLat.toFixed(2));
  r.check('boylam kendiliğinden doldu', Math.abs(cityLon - 32.85) < 0.1, cityLon.toFixed(2));

  // Varsayılan tarih 1990-05-15: Türkiye o yaz +03'tü.
  const tzSummer = Number(await page.inputValue('#tz'));
  r.check('Mayıs 1990 dilimi +03 (yaz saati)', tzSummer === 3, `tz=${tzSummer}`);

  // Tarihi kışa çek: aynı şehir, farklı dilim — elle tablo değil, tz veritabanı.
  await page.fill('#date', '1990-01-15');
  await page.locator('#date').dispatchEvent('change');
  const tzWinter = Number(await page.inputValue('#tz'));
  r.check('Ocak 1990 dilimi +02 (kış saati)', tzWinter === 2, `tz=${tzWinter}`);

  const statusNote = await page.locator('#status').textContent();
  r.check('durum satırı IANA bölgesini bildiriyor', statusNote.includes('Europe/Istanbul'),
    statusNote.trim().slice(0, 60));

  r.section('5) Sessiz hata yok');
  r.check('konsol hatası yok', consoleErrors.length === 0, consoleErrors[0] ?? 'temiz');
  r.check('sayfa hatası yok', pageErrors.length === 0, pageErrors[0] ?? 'temiz');

  // Aynı hesaplama ikinci kez — BrowserCache önbellekten okuyor, ağ yok.
  r.section('6) Önbellekten yeniden yükleme');
  await page.evaluate(() => { window.__loaded = null; });
  await page.click('#load');
  await page.waitForFunction(() => window.__loaded || window.__error, undefined, { timeout: 30_000 });
  const cached = await page.evaluate(() => window.__loaded ?? null);
  r.check('ikinci yükleme başarılı (önbellek)', cached !== null && cached.loaded.length >= 4,
    cached ? `${cached.loaded.length} dosya` : 'yok');
} finally {
  await browser.close();
  server.kill();
}

r.finish('Gerçek tarayıcıda uçtan uca doğrulandı.');
