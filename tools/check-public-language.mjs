#!/usr/bin/env node
/**
 * Public runtime yüzeyinde Türkçe string literal olmamalı.
 *
 * Projenin dil kararı (what-it-is.md §10) "public JSDoc İngilizce, iç yorumlar
 * ve testler Türkçe" diyor. Bir denetim üçüncü bir kategorinin gözden
 * kaçtığını gösterdi: **çalışma anında dışarı çıkan string'ler.** Bunlar yorum
 * değil, veri — `LotResult.name`, `CuratedStar.meaning`, `throw` mesajları.
 * Paket uluslararası npm'e çıkıyor ve MCP sunucusu bu string'leri modele
 * aktarıyor, dolayısıyla İngilizce konuşan bir geliştirici için Türkçe bir
 * yığın izi tanılanamaz.
 *
 * 72 string bir kez temizlendi. Bu betik tekrarını engelliyor — elle yapılan
 * bir temizlik, onu koruyan bir kontrol olmadan çürür.
 *
 *   node tools/check-public-language.mjs
 *
 * YORUMLAR KAPSAM DIŞI. Türkçe iç yorum bilinçli bir karar ve bu betik onu
 * bozmamalı; yalnızca string literal'lere bakıyor.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/** Taranan ağaçlar: yayınlanan iki paketin kaynağı. */
const ROOTS = ['packages/core/src', 'packages/mcp/src'];

/**
 * Bilinçli istisnalar.
 *
 * `lot-names-tr.ts` Türkçe lot adlarını KASITLI olarak taşıyan locale
 * haritası: varsayılan İngilizce, Türkçe isteyen çağıran için opt-in. Dosyanın
 * tek işi bu, dolayısıyla taramanın dışında.
 *
 * `i18n/index.ts` beş dilin (tr/en/de/fr/es) çeviri tablolarını taşıyan
 * locale haritası: Türkçe string'ler veri, kodun dili değil. Dosyanın tek
 * işi bu, dolayısıyla taramanın dışında.
 */
const ALLOWED = new Set([
  'packages/core/src/derived/lot-names-tr.ts',
  'packages/core/src/i18n/index.ts',
]);

const TURKISH = /[çğıİöşüÇĞÖŞÜ]/;

/*
 * AKSANSIZ TÜRKÇE.
 *
 * Yukarıdaki sınıf yalnızca Türkçe'ye ÖZGÜ HARFLERİ arıyor. ASCII ile yazılmış
 * Türkçe kelimeler bu elekten geçiyordu — ve geçti: 0.1.0 iki tanesini public
 * API'ye taşıdı, `MemoryEphemeris.description = 'bellek'` ve
 * `NodeFsEphemeris.description = \`dosya sistemi(...)\``. İkisi de tam olarak
 * bu betiğin engellemek için var olduğu şeydi; denetim yeşil verdi çünkü
 * kelimelerin hiçbirinde ç/ğ/ı/ö/ş/ü yok.
 *
 * Liste kasten dar tutuldu: yalnızca İngilizce'de aynı yazımla bir anlamı
 * OLMAYAN kelimeler. "var", "ile", "ay", "an" gibi kodla ya da İngilizce
 * metinle çakışabilecek olanlar bilerek dışarıda — yanlış pozitif, denetimi
 * kapatmanın en hızlı yolu.
 */
const TURKISH_ASCII =
  /\b(bellek|dosya|sistemi|hata|kaynak|hedef|boyut|deger|sayi|liste|eksik|gerekli|gerekiyor|bulunamadi|gecersiz|tanimsiz|yuklendi|okundu|basarisiz|desteklenmiyor|olmali|yazildi)\b/i;

/** Tek/çift/ters tırnaklı string literal — kaçışlı tırnakları hesaba katarak. */
const STRING_LITERAL = new RegExp(
  "'(?:[^'\\\\]|\\\\.)*'" + '|"(?:[^"\\\\]|\\\\.)*"' + '|`(?:[^`\\\\]|\\\\.)*`',
  'g',
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

/**
 * Bir dosyadaki Türkçe karakterli string literal satırları.
 *
 * Yorum satırlarını atlıyoruz. Tam bir TypeScript ayrıştırıcısı değil ama bu
 * kod tabanında yeterli: blok yorumu, satır yorumu ve satır sonu yorumu
 * ayıklanıyor.
 */
function offendingLines(file) {
  const hits = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    const code = lines[i].replace(/\/\/.*$/, '');
    for (const literal of code.match(STRING_LITERAL) ?? []) {
      if (TURKISH.test(literal) || TURKISH_ASCII.test(literal)) {
        hits.push({ line: i + 1, text: literal.slice(0, 90) });
      }
    }
  }
  return hits;
}

console.log('\n=== Public dil kontrolü ===\n');

let scanned = 0;
let skipped = 0;
const problems = [];

for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (ALLOWED.has(rel)) {
      skipped++;
      console.log(`  · atlandı (bilinçli): ${rel}`);
      continue;
    }
    scanned++;
    for (const hit of offendingLines(file)) {
      problems.push(`${rel}:${hit.line}  ${hit.text}`);
    }
  }
}

console.log(`\n  ${scanned} dosya tarandı, ${skipped} bilinçli istisna.`);

if (problems.length) {
  console.log(`\nTürkçe string literal bulundu — ${problems.length} yer:\n`);
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  console.log(
    '\nBunlar çalışma anında dışarı çıkan VERİ, yorum değil. İngilizce\'ye ' +
    'çevirin.\nTürkçe metin gerekiyorsa packages/core/src/derived/' +
    'lot-names-tr.ts gibi\nayrı bir locale haritasına koyun ve buradaki ' +
    'ALLOWED listesine ekleyin.\n');
  process.exitCode = 1;
} else {
  console.log('\nPublic runtime yüzeyi İngilizce.\n');
}
