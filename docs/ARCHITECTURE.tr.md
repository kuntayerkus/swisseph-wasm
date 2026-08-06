# Mimari

swisseph-wasm, Swiss Ephemeris 2.10.03'ü (C) WebAssembly'ye derler ve hem
Node'da hem tarayıcıda çalışan, tipli bir TypeScript API ile sarar. Bu dosya
katılım haritasıdır: ne nerede durur, katmanlar nasıl birbirine bağlanır ve
bir değişiklik nasıl doğrulanır. Yol haritası için [`ROADMAP.tr.md`](ROADMAP.tr.md),
public API yüzeyi için [`API.md`](API.md).

## Depo yerleşimi

```
vendor/swisseph/        Swiss Ephemeris 2.10.03 C kaynakları (AGPL; NOTICE'a bakın)
tools/                  Build + doğrulama betikleri (Node, çerçevesiz)
  golden/golden.tsv.gz  Native gcc swetest ile üretilmiş 12.930 satırlık referans korpus
docs/                   Bu dosya, API.md, AYANAMSA.md, MEMOIZATION.md, ROADMAP.md
examples/
  browser/              Build gerektirmeyen tarayıcı demosu + statik sunucu (serve.mjs)
  react-demo/           @kuntay/swisseph-react-ui kullanan Vite + React demosu
packages/
  core/                 @kuntay/swisseph — WASM + tipli API + türetilmiş katman
  mcp/                  @kuntay/swisseph-mcp — LLM'ler için MCP sunucusu (stdio)
  data/                 @kuntay/swisseph-data — .se1 dosyaları, 1800–2399
  asteroids/            @kuntay/swisseph-asteroids — küratörlü 16 asteroid dosyası
  advanced/             @kuntay/swisseph-advanced — Vedik (nakshatra) modülleri
  viz/                  @kuntay/swisseph-viz — D3 tarzı harita çizimi
  react-ui/             @kuntay/swisseph-react-ui — React bileşenleri
  license/              @kuntay/swisseph-license — lisans uyumluluk araçları
  geo/                  @kuntay/swisseph-geo — GeoNames şehir arama + saat dilimi
```

npm'de yayınlanmış olanlar: `core`, `mcp`, `data`, `asteroids` (0.2.x hattı).
Diğer beş paket geliştirmede (0.3.0-dev).

## Katmanlar

```
Swiss Ephemeris C (vendor/)
        │  tools/build-wasm.mjs — emcc (PATH'te veya Docker emscripten/emsdk)
        ▼
packages/core/wasm/swisseph.{mjs,wasm}          ← build çıktısı, repoda YOK
        │  instance.ts — tamponlar bir kez ayrılır, pointer tabanlı binding
        ▼
Tipli API: createSwissEph() → SwissEph örneği (packages/core/src/instance.ts)
        │
        ├── ephemeris/  dosya adlandırma, kaynaklar (Memory/NodeFs/Fetch/BrowserCache)
        ├── derived/    API üzerine kurulu saf astronomi/astroloji:
        │               aspects, antiscia, chart-builder, declination, dignities,
        │               eclipses, heliacal, houses, lots, parans, sect, stars,
        │               timelords
        ├── generated/  constants.ts, stars.ts — C header/veriden yeniden üretilir
        ├── cache/      LRU + memoize yardımcıları
        └── worker/     Web Worker sarmalayıcı
        ▼
Tüketiciler: packages/mcp · viz · react-ui · advanced · sizin uygulamanız
```

Katmanları dürüst tutan kurallar:

- **WASM sınırı dardır.** `instance.ts` her C çıktı tamponunu bir kez ayırır
  (`xx[6]`, `serr[256]`, ad, cusp'lar, ...) ve tekrar kullanır. C bu
  tamponlara yazar; TypeScript geri okur. Tampon boyutlarını
  `test/wasm-buffers.test.ts` sabitler: C'nin gerçekte kaç double yazdığını
  ölçer.
- **Her `createSwissEph()` bir WASM örneği.** C'nin global durumu
  (`swe_set_sid_mode`, `swe_set_topo`, yüklü dosyalar) örnek başınadır; farklı
  ayarlı iki harita birbirini asla kirletmez. `check:api` doğrular (örnek
  izolasyonu bölümü).
- **Türetilmiş modüller API üzerinde saf fonksiyonlardır.** Konumları ya da
  örneği alır, tipli sonuç dönerler; durum tutmazlar.

## Efemeris veri modeli

`CalcOptions.ephemeris` ile hesap başına seçilen üç hassasiyet kademesi:

| Model    | Kaynak                                   | Hassasiyet           |
|----------|------------------------------------------|----------------------|
| `moshier`| Gömülü analitik teori, dosyasız          | ~0,1″ (gezegenler)   |
| `swiss`  | `.se1` dilim dosyaları (JPL DE441)       | ~0,001″ — tam        |
| `jpl`    | JPL DE ikili dosyası (dağıtılmaz)        | referans             |

**Sessiz düşüş sistemin merkezindeki tuzaktır.** Swiss Ephemeris bir `.se1`
dosyasını bulamazsa hata VERMEZ — Moshier'e düşer ve yalnızca dönen bayrağı
değiştirir. Bu yüzden her `calc()` sonucu, gerçekte çalışan modeli bildiren
bir `ephemeris` alanı taşır; kontroller ve testler bu alanı denetler. Analitik
teorisi olmayan cisimlerde (ana efemerisin dışındaki asteroidler, sabit
yıldızlar) eksik dosya `SwissEphError` fırlatır; mesaj, ilgili npm paketini ve
mount çağrısını adlandırır.

Dosya adlandırma (`ephemeris/files.ts`): 600 yıllık dilimler; `sepl_18.se1` =
gezegenler 1800–2399, `semo_18.se1` Ay, `seas_18.se1` ana asteroidler; ayrıca
`sefstars.txt` (yıldız kataloğu) ve `seorbel.txt` (kurgusal cisimler). Bir
tarihin hangi dosyayı gerektirdiği yalnızca tarihten hesaplanabilir —
tarayıcıdaki `FetchEphemeris` yükleyicisini mümkün kılan da budur: gerekli
dosyaları hesapla, yalnızca onları indir, veri paketi manifestindeki SHA-256
ile doğrula, bağla, hesapla.

Ana efemerisin dışındaki asteroidler (`ephemeris/asteroids.ts`): dosya
`asteroidFile(433)` → `ast0/se00433s.se1`; cisim numarası `asteroidBody(433)`
→ `SE_AST_OFFSET + 433`. Swiss Ephemeris ana efemeris dizininde düz dosya
adına da bakar (sweph.c art zinciri), dolayısıyla düz bağlama da çalışır.
`mountEphemeris()`, `astN/` yolları için ara dizinleri kendisi kurar
(regresyon testi: `test/ephemeris-mount.test.ts`).

Veri paketleri:

- `@kuntay/swisseph-data` — yukarıdaki beş dosya, 1800–2399, ~2 MB; SHA-256
  özetleri ve kapsam aralıklarını taşıyan manifest ile.
- `@kuntay/swisseph-asteroids` — küratörlü 16 kısa dosya (1500–2100), ~0,4 MB;
  build sırasında kanonik Astrodienst dağıtımına karşı hash doğrulamalı.

## Temel tasarım kararları

- **Singleton yerine örnek izolasyonu** — yukarı bakın; MCP sunucusu oturum
  başına bir örnek oluşturur.
- **Dil kararı**: public JSDoc ve çalışma anında dışarı çıkan her string
  İngilizce; iç yorumlar Türkçe. `tools/check-public-language.mjs` bunu
  uygular (`i18n/index.ts` ve `derived/lot-names-tr.ts` gibi locale
  haritaları izin listesinde VERİdir, kod değil).
- **Hatalar bağlam taşır**: `SwissEphError` içinde `fn` (C fonksiyonu) ve
  `detail` (ham C mesajı) bulunur; `getErrorSuggestion()` hata kodlarını
  sorun/çözüm çiftlerine eşler.
- **Commit'lenmiş ikili dosya yok**: `.wasm` çıktısı ve tüm `.se1` dosyaları
  CI'da üretilir (emsdk build; efemeris kanonik aynadan indirilir). Taze
  checkout ya `npm run build:wasm` (emcc veya Docker) ister ya da yayınlanmış
  npm paketinden çıkarılmış artifact'lar.

## Build hattı

| Betik | Ne yapar |
|---|---|
| `npm run build:wasm` | 9 kütüphane `.c` dosyasının emcc derlemesi; export listesi `swephexp.h`'den parse edilir (elle liste yok) |
| `npm run build:ts` | core + mcp için `tsc` |
| `npm run build:data` | `.se1` dosyalarını `$SWISSEPH_EPHE_PATH`'ten (veya `../swiss/ephe`) `packages/data/ephe/`'ye kopyalar, manifest yazar |
| `npm run build:asteroids` | 16 asteroid dosyasını indirir/doğrular ve `packages/asteroids/ephe/`'ye yazar |
| `npm run check:*` | Aşağıdaki on bir doğrulama betiği |
| `npm run check:release` | Yayın provası: sürümler, changelog'lar, pack dry-run |

CI (`.github/workflows/ci.yml`) sırasıyla: emsdk → `build:wasm` → sabit
yenileme kontrolü → dil → typecheck → `build:ts` → smoke → efemeris indirme →
API kontrolü → testler → golden parite → pack.

## Doğrulama sistemi

İki birbirini tamamlayan katman:

1. **Vitest** (`npm test`, 18 dosya): birim + entegrasyon testleri.
   Entegrasyon testleri derlenmiş `dist/`'i — kullanıcının gerçekte aldığı
   artifact'ı — import eder ve `src/` `dist/`'ten yeniyse hızla hata verir.
2. **Kontrol betikleri** (`npm run check`, on iki adet): dil, smoke, API,
   **golden parite**, açılar, **ev sistemi değişmezleri**, efemeris
   yükleyicileri, sekt doğruluğu, tarayıcı yolları, veri paketi spec'i,
   hassasiyet, pack. `check:browser-real` ayrıca koşar (tek seferlik
   `npx playwright install chromium` ister): demoyu headless Chromium'da uçtan
   uca sürer; şehir seçicinin tarihsel saat dilimi çözümlemesi dahil.

Golden korpus güvenin merkezidir: aynı C kaynağının native gcc derlemesinden
(`swetest`) üretilmiş 12.930 fixture satırı, WASM build'inde tekrar oynatılır.
89 binden çok sayı, fiziksel anlamlılıktan türetilmiş sütun bazlı eşiklerle
karşılaştırılır (açılar 1e-9°, uzaklıklar bağıl 1e-12, hızlar daha gevşek —
sayısal türev oldukları için). İki derleyici, iki libm gerçeklemesi ve iki
mimarinin bu düzeyde uyuşması, portun sayısal sağlamlık kanıtıdır.

## Yerel çalıştırma

```bash
npm install                 # kök workspace
npm run build:wasm          # PATH'te emcc veya Docker gerekir (emscripten/emsdk)
npm test
set SWISSEPH_EPHE_PATH=<.se1 dosyalarının dizini>   # Windows; POSIX'ta export
npm run check
npm run demo                # examples/browser'ı sunar
```

emcc/Docker yok mu? Yayınlanmış `@kuntay/swisseph` paketinden
`wasm/swisseph.mjs` + `wasm/swisseph.wasm` dosyalarını `packages/core/wasm/`
altına, `@kuntay/swisseph-data` / `@kuntay/swisseph-asteroids` paketlerindeki
`.se1` dosyalarını `SWISSEPH_EPHE_PATH` olarak göstereceğiniz bir dizine
çıkarın. Ardından `npm run build:data` ve `npm run build:asteroids` paket
dizinlerini doldurur. Golden kontrolü ayrıca `_12` ve `_24` yüzyıl dilimlerini
ister (resmi `aloistr/swisseph` dağıtımı).

## Yeni katılımcılar için okuma sırası

1. `README.md` (veya `README.tr.md`) — tanıtım ve hızlı başlangıç
2. `docs/ROADMAP.md` — faz geçmişi ve bilinçli açık maddeler
3. `packages/core/src/instance.ts` — WASM binding ve API'nin tamamı
4. `packages/core/src/ephemeris/{files,sources,asteroids}.ts` — veri yükleme
5. Türetilmiş bir modül, ör. `derived/sect.ts` — o katmanın yazım tarzı
6. `tools/_harness.mjs` + bir kontrol betiği, ör. `tools/check-golden.mjs`
7. `packages/mcp/src/index.ts` — API'nin LLM'lere nasıl açıldığı

## Bilinen boşluklar

`ROADMAP.md` §4'te açıkça izleniyor: Vedik nakshatra kavşak yıldızları
(atıf yapılabilir bir kaynak gerekiyor), genişletilmiş asteroid kademesi
(seçici yüklemeyle ~100 cisim) ve gerçek tarayıcıda otomatik test (mevcut
tarayıcı kontrolleri Node altında koşuyor).
