# swisseph-wasm

*[English](README.md) · Türkçe*

**Swiss Ephemeris 2.10.03, WebAssembly'ye derlenmiş.** Yüksek hassasiyetli
gezegen konumları, ev sistemleri, tutulmalar ve sabit yıldızlar — Node.js,
tarayıcı, Deno, Bun ve edge ortamlarında, tek bir build ile.

Kütüphanenin tamamı **230 KB brotli** ve **hiçbir veri dosyası olmadan**
çalışır.

---

> ## ⚠️ Lisans: AGPL-3.0 — kullanmadan önce okuyun
>
> Swiss Ephemeris, Astrodienst AG tarafından ikili lisanslanıyor: **AGPL-3.0**
> ya da ücretli **Professional License**. Bu proje AGPL'i seçti, dolayısıyla
> buradaki her şey AGPL kapsamında.
>
> **AGPL'in ağ maddesi (13. bölüm) insanları şaşırtan kısım.** Bu paketi bir
> web servisinde kullanırsanız — dağıtmasanız bile, sadece kullanıcıların ağ
> üzerinden etkileşmesine izin verseniz bile — *kendi* uygulamanızın kaynak
> kodunu o kullanıcılara uyumlu bir lisansla açmak zorundasınız.
>
> Ürününüz kapalı kaynaksa Astrodienst'ten
> [Swiss Ephemeris Professional License](https://www.astro.com/swisseph/)
> almanız gerekir. O lisans sizinle Astrodienst arasındadır; bu proje onu
> vermez ve alt-lisanslayamaz.
>
> Bu, göz ardı edebileceğimiz bir teknik ayrıntı değil. Ayrıntı: [NOTICE](NOTICE).

---

## Durum

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Toolchain, WASM build, boyut ölçümü, veri paketi spec'i | ✅ |
| 1 | Monorepo, lisanslama, CI | ✅ |
| 2 | Tipli TypeScript API, `createSwissEph()` instance izolasyonu | ✅ |
| 3 | Native derlemeye karşı sayısal parite | ✅ |
| 4 | Efemeris yükleyicileri ve veri paketleri | ✅ |
| 5 | Türetilmiş katman: loturlar, yıldız kürasyonu, asteroidler | ✅ |
| 6 | Demo, API referansı, yayın altyapısı | ✅ |
| 7 | MCP sunucusu: stdio üzerinden sekiz araç, uçtan uca doğrulanmış | ✅ |

**Henüz npm'de değil — bilinçli olarak.** Yayın için gereken her şey hazır;
kalan tek şey bir karar, bir npm hesabı ve bir etiket.

Belgeler: [API referansı](docs/API.md) · [Yol haritası](docs/ROADMAP.tr.md) · [English README](README.md)

## Native derlemeye karşı doğrulanmış

Bu kütüphanenin dayandığı iddia şu: referans C kodunu WebAssembly'ye derlemek
sayıları değiştirmiyor. Bu iddia edilmiyor, **test ediliyor**.

**gcc 13 / x86-64 Linux** ile derlenen bir üreteç 12.930 vakalık bir ızgarayı
tam `%.17g` hassasiyetle yazıyor: 1500–2500 arası 15 epok, 21 yerleşik cisim,
6 bayrak kümesi, 10 sidereal mod, 26 ev sisteminin tamamı × 8 enlem, 20 sabit
yıldız. WebAssembly build'i aynı girdileri tekrar oynatıyor ve iki taraf değer
değer karşılaştırılıyor.

Aynı C kaynağı, farklı derleyici, farklı libm, farklı hedef mimari.
**89.224 değer:**

| Büyüklük | Karşılaştırılan | Bit düzeyinde aynı | En büyük fark |
|---|---|---|---|
| Açısal konum | 79.830 | %92.3 | 1.25e-10° = **4.5e-7 yay-saniyesi** |
| Uzaklık | 8.640 | %90.7 | 4.75e-13 bağıl |
| Açısal hız | 169 | — | 2.02e-8 °/gün |
| Jülyen günü, ΔT | 540 | **%100** | tam |

Ölçek için: 4.5e-7 yay-saniyesi, yapılmış en hassas VLBI ölçümünden ~200 kat
keskin. Kalan farklar glibc ile Emscripten'in `sin`/`cos` fonksiyonlarının
son-bit yuvarlama tercihlerinden geliyor.

**Ay'ın oskülatör elemanları ayrı ve daha gevşek eşikte** tutuluyor: gerçek
düğüm (`11`), oskülatör apoje (`13`) ve interpolasyonlu apoje/perige (`21`,
`22`) Ay'ın durum vektöründen Kepler elemanları türetilerek bulunuyor ve bu
doğası gereği kötü koşullanmış. En kötü farkları 1.7e-4 yay-saniyesi. Eşik
topluca gevşetilmiyor, bu cisimler **adıyla** istisna ediliyor — böylece
sıradan bir gezegen konumundaki gerçek bir regresyon yine yakalanır.

Ayrıca açılar **Swiss Ephemeris'ten bağımsız** olarak da doğrulanıyor: Tepe
Noktası ve Yükselen küresel astronominin klasik formülleriyle sıfırdan
hesaplanıp karşılaştırılıyor (1.8″ ve 8.7″ içinde uyuşuyorlar). Altın korpus
iki *build*'i karşılaştırıyor; bu kontrol ortak bir hatayı da yakalar.

## Kullanım

```ts
import { createSwissEph, Body, HouseSystem } from '@kuntay/swisseph';

const swe = await createSwissEph();

const jd = swe.julianDay(1990, 5, 15, 11.5);   // 11:30 UT

const gunes = swe.calcWithSign(jd, Body.Sun);
console.log(`${gunes.degreeInSign.toFixed(2)}° ${gunes.sign}`);

const merkur = swe.calcWithSign(jd, Body.Mercury);
console.log(merkur.retrograde);

const { ascendant, midheaven, cusps } =
  swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);

swe.dispose();
```

Zaman **Evrensel Zaman (UT)** olarak veriliyor. Doğum saati her zaman yereldir;
dönüştürmeyi unutmak, başka bir yazılımla arada fark çıkmasının en yaygın
sebebidir — Ankara için 3 saatlik bir kayma gezegenleri dakikalarla ama
Yükselen'i **36 dereceyle** oynatır.

### Kolay yapılan üç hata

**`result.ephemeris` alanını kontrol edin.** Swiss Ephemeris veri dosyası
bulamayınca hata vermez, sessizce Moshier'e döner. Her sonuç hangi kaynağın
gerçekten kullanıldığını bildirir.

**Eşzamanlı istek başına bir örnek kullanın.** Bu bir üslup tercihi değil,
doğruluk meselesi — aşağıya bakın.

**"Lilith" üç ayrı şey demek:**

```ts
Body.BlackMoonLilithMean        // ortalama Ay apojesi — cisim değil
Body.BlackMoonLilithTrue        // oskülatör apoje — 29.96°'ye kadar farklı
asteroidBody(Asteroid.Lilith)   // asteroid 1181 — gerçek bir kaya
```

15 Mayıs 1990 için asteroid 309.09°, Black Moon Lilith 231.48° — **77° fark.**

## LLM'den kullanmak

Bir dil modeli efemeris hesaplayamaz. Harita istendiğinde kendinden emin ve
yanlış bir şey üretir, çünkü aritmetik binlerce terimli bir seri açılımı ve
üstüne ΔT, nutasyon, aberasyon düzeltmeleri — akıl yürütülerek ya da
hatırlanarak varılacak bir şey değil.

`@kuntay/swisseph-mcp` bu kütüphaneyi bir
[Model Context Protocol](https://modelcontextprotocol.io) sunucusu olarak açıyor;
model sayıları uydurmak yerine dışarı sorup alıyor.

```bash
claude mcp add swisseph -- npx -y @kuntay/swisseph-mcp
```

Sekiz araç: `natal_chart`, `transits`, `synastry`, `return_chart`, `eclipses`,
`rise_set`, `time_lords`, `declinations`.

**Açılar hesaplanmış geliyor.** Tasarımın bütün meselesi bu. Yalnızca boylam
verilse model açıları kendi çıkarırdı — ve 0/360 sarmalını doğru ele alması
(355° ile 85° kare yapar), orb izninin hangi cisimlerin karıştığına bağlı olduğu
bir şemayı uygulaması, geri hareketteki bir gezegen için uygulanan/ayrılan
ayrımını yapması gerekirdi. Üç hata fırsatı, hepsi sessizce. Aynı şey onurlar,
loturlar, paraleller ve zaman efendileri için de geçerli.

Dereceler biçimlendirilmiş (`24°30'11" Taurus`) ve ondalığı yanında geliyor;
çünkü çıplak float verilen bir model çevrimi kendi yapar ve **yuvarlar**, oysa
astroloji yazılımları **keser**. Saatler yerel saat + dilim olarak alınıp
türetilen UT geri yazdırılıyor, çünkü doğum saatini olduğu gibi UT sanmak
yanlış harita üretmenin bir numaralı yolu.

Ayrıntı: [packages/mcp/README.md](packages/mcp/README.md). Barındırılan bir
sunucuda AGPL'in ağ maddesi tam olarak geçerlidir.

## Neden WebAssembly, neden elle JavaScript'e çevrilmedi

Upstream C 56.083 satır ve bunun ~13.500'ü yoğun sayısal tablo. Elle çevirmek,
bit-paketlenmiş Chebyshev katsayı çözümlemesini, pointer aritmetiğini ve C
`double` semantiğini yeniden yazmak demek — her satır, kimsenin üç yıl boyunca
fark etmeyeceği bir yay-saniyesi kesri hata üretme fırsatı. Üstelik upstream'den
kalıcı olarak ayrışırdı.

Referans C'yi derlemek, sayıların referans sayılar olması demek; upstream
güncellemesi de yalnızca yeniden derleme. `sweph.c`'deki tüm dosya erişimi
zaten tek bir `swi_fopen()` üzerinden geçiyor ve Emscripten'in sanal dosya
sistemi bunu şeffaf karşılıyor.

## Boyut

Ölçülmüş, tahmin değil — `-O3`, 106 fonksiyonun tamamı, API kırpması yok:

| | Ham | gzip | **brotli** |
|---|---|---|---|
| `swisseph.wasm` | 550 KB | 256 KB | **211 KB** |
| JS glue | 75 KB | 21 KB | 18 KB |
| **Toplam** | **624 KB** | **277 KB** | **230 KB** |

Kıyas için: bu, tüm güneş sistemi — gezegenler, Ay, asteroidler, tutulmalar,
20+ ev sistemi, 1360 sabit yıldız, heliacal görünürlük — kabaca three.js
boyutunda.

API yüzeyini 106'dan 12 fonksiyona indirmek yalnızca 53 KB brotli (%23)
kazandırıyor; bu yüzden **tek build, her şey dahil**.

## Hassasiyet, dürüstçe

**Moshier** — WASM ikilisine gömülü yarı-analitik teori. Dosya gerekmez,
anında çalışır, MÖ 3000 – MS 3000 kapsar.

**Swiss (`.se1`)** — NASA/JPL DE441'den türetilmiş sıkıştırılmış tablolar. Tam
referans hassasiyeti, dosya gerektirir.

Aradaki fark, dosya kapsamı boyunca boylamda yay-saniyesi olarak:

```
  yıl     Güneş       Ay     Mars  Jüpiter   Plüton
  1800    0.027    0.613    0.079    0.120    3.690
  1900    0.005    0.075    0.037    0.193    0.252
  2000    0.024    0.633    0.038    0.399    0.265
  2100    0.038    0.471    0.052    0.184    1.453
  2399    0.013    0.933    0.010    0.933    5.903
```

Moshier'in uyumu 1900–1950 civarında merkezlenmiş, kenarlara doğru bozuluyor ve
bozulma neredeyse tamamen dış gezegenlerde. En kötü durum Plüton'da 5.9″ =
**0.098 yay-dakikası**.

- **Astroloji için fark görünmez.** Haritalar yay-dakikası hassasiyetinde
  çizilir ve baskın hata efemeris değil doğum saatidir: bir dakikalık
  belirsizlik Yükselen'i ~900″ oynatır — tablodaki en kötü sayıdan iki kat
  büyüklük mertebesi fazla.
- **Astronomi ve referans sadakati için gerçek.** Yayımlanmış efemeris
  değerlerini basamak basamak üretmeniz gerekiyorsa veri dosyalarını kullanın.

Yani veri paketi bir *doğruluk düzeltmesi* değil, referans uygulamayla *tam
uyum*.

## Efemeris verisi

Upstream `ephe/` dizini **379 MB** — MÖ 13000'den MS 17000'e ve 760.000+
asteroid. Kimsenin hepsine ihtiyacı yok.

1800–2399 CE için beş dosya, toplam **2.05 MB**, çoğu uygulamanın kullandığı
her şeyi kapsıyor: `sepl_18.se1` (gezegenler), `semo_18.se1` (Ay),
`seas_18.se1` (Ceres, Pallas, Juno, Vesta, Chiron, Pholus), `sefstars.txt`
(1360 sabit yıldız), `seorbel.txt`.

Bunlar ayrı, isteğe bağlı bir paket. npm'e yayınlamak onları jsDelivr ve
unpkg'de de erişilebilir kıldığı için tarayıcı yükleyicisi bedava CDN alıyor.

**Veri dosyaları tamamen isteğe bağlı.** Swiss Ephemeris dosya eksikken
başarısız olmuyor, Moshier'e dönüp uyarı veriyor. Başarısız bir indirme, yanlış
bir tarih aralığı ya da veri paketini hiç kurmayan bir kullanıcı yine doğru
sonuç alır — sadece biraz daha az hassas. Tasarlanacak bir hata yolu yok.

### Veri yükleme

Swiss Ephemeris dosyalarını C tarafında **senkron** okuyor, dolayısıyla bir
hesabın ortasında hiçbir şey indirilemez — veri önceden yerinde olmalı. Bu
uygulanabilir çünkü arşiv 600 yıllık dilimlere bölünmüş ve dosya adları
tarihten hesaplanabiliyor:

```ts
import { createSwissEph, FetchEphemeris, BrowserCache } from '@kuntay/swisseph';

const swe = await createSwissEph();
const { loaded, missing, bytes } = await swe.loadEphemeris(
  new FetchEphemeris({ cache: BrowserCache.create() }),
  { fromYear: 1900, toYear: 2100, fixedStars: true },
);
```

| Kaynak | Kullanım |
|---|---|
| `MemoryEphemeris` | Baytlar zaten elinizde |
| `FetchEphemeris` | Tarayıcı; takılabilir cache |
| `NodeFsEphemeris` | Bir dizinden okur |

Sunucuda hepsinden önce `mountEphemerisDirectory()` tercih edin — NODEFS ile
gerçek dizini **kopyasız** bağlar. Örnekler yalıtık olduğu için kopyalamak
örnek başına 2 MB demek olurdu.

Adlandırma kuralı **deneyle** doğrulanıyor: test bir yıl için *yalnızca*
hesaplanan dosyayı yükleyip Swiss Ephemeris'in onu gerçekten kullandığını
(Moshier'e düşmediğini) teyit ediyor — çünkü yanlış bir kural hata üretmez,
sessizce hassasiyeti düşürür.

### Asteroidler

Ceres, Pallas, Juno, Vesta, Chiron ve Pholus ana efemeriste geliyor. On altısı
daha — Eris, Sedna, Quaoar, Makemake, Haumea, Orcus, Ixion, Varuna, Gonggong,
Chariklo, Nessus, Eros, Psyche, Hygiea, Astraea ve asteroid Lilith — ayrı bir
**409 KB**'lık pakette, 1500–2100 CE.

```ts
swe.calc(jd, asteroidBody(Asteroid.Eris));
```

**Her zaman `asteroidBody()` kullanın**, `AsteroidOffset + numara` değil. Swiss
Ephemeris yalnızca 1–4 arası numaraları yerleşik cisimlere eşliyor
(`sweph.c:1031`), dolayısıyla `AsteroidOffset + 2060` Chiron ana efemeriste
olmasına rağmen `se02060s.se1` dosyasını arayıp hata veriyor.

Gezegenlerden iki farkı var: **eksik dosya hata verir** (analitik teori yok) ve
kapsam 1800–2399 değil 1500–2100.

## Koordinatların ötesi

Swiss Ephemeris size konum verir, harita vermez. Aradaki boşluk tamamen
aritmetik ve bu kütüphanenin C koduna eklediği şey orası.

### Arap noktaları

Swiss Ephemeris bunları hiç sağlamıyor. On altı lot geliyor — yedi Hermetik
lot artı dokuz yaygın olan — ve her tanım `source` alanında hangi geleneğe
dayandığını söylüyor.

```ts
const { sect, lots } = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });
lots.Fortune.degreeInSign;
lots.Fortune.source;        // 'Paulus Alexandrinus, Introduction 23'
```

**Zorluk formülde değil.** Çoğu lotun gündüz/gece formülü birbirinin aynası,
yani sekt ters hesaplanırsa nokta bambaşka yere düşer ve hiçbir hata alınmaz.

Varsayılan sekt yöntemi Güneş'in **gerçek yüksekliği** — her enlemde doğru.
Geleneksel kısayol (`method: 'ascendant'`) kutup dairesine kadar birebir aynı
sonucu veriyor ama **ötesinde bozuluyor**:

| Enlem | Gerçek yükseklikle uyuşmazlık |
|---|---|
| 0–66.5° | %0.00 |
| 67° | %6.25 (en kötü 4.2°) |
| 70° | %18.40 (en kötü 11.2°) |
| 80° | %36.46 (en kötü 19.5°) |

Kutup dairesinin ötesinde Swiss Ephemeris, Yükselen "yanlış tarafta" kaldığında
AC/DC'yi takas ediyor (`swehouse.c:998`) ve kısayolun dayandığı "1.-6. evler
ufkun altındadır" varsayımı tersine dönüyor. 70°N'de Güneş ufkun 11° üstündeyken
"gece" diyebiliyor.

**Ayrıca her lot `A + B − C` değil.** Temel Noktası, Şans ile Ruh arasındaki
**kısa yayı** alıyor — bu bir formül değil koşullu bir karar. Tanımlar bu tür
durumlar için `compute` fonksiyonu verebiliyor.

### Onurlar ve yöneticiler

```ts
const r = evaluateDignities(Body.Sun, 135, 'day');   // 15° Aslan
r.dignities;   // ['domicile', 'triplicity']
r.score;       // 8
r.termRuler;   // sınır yöneticisi
r.faceRuler;   // yüz yöneticisi
```

Beş temel onur: ev sahipliği, yücelme, üçlü yönetici (sekte bağlı), Mısır
sınırları ve Keldani yüzleri. Zarar ve düşüş türetiliyor. Geleneksel ve modern
yönetici atamaları ayrı.

### Sabit yıldız kürasyonu

Katalogda zaten 1360 kayıt var. Eksik olan, hangi yıldızın hangi gelenekte
anlamlı olduğu ve nasıl belirsizliksiz aranacağıydı:

```ts
import { ROYAL_STARS, BEHENIAN_STARS, byDesignation } from '@kuntay/swisseph';
const regulus = swe.fixedStar(byDesignation('alLeo'), jd);
```

**Adla değil, adlandırmayla arayın.** `sefstars.txt` bazı yıldızları aynı adın
farklı yazımlarıyla iki kez içeriyor ve arama `qsort` ile sıralandığı için —
ki C'de `qsort` kararlı olmak zorunda değil — hangi yazımın döneceği platforma
göre değişebiliyor. `,alLeo` her zaman tek bir kaydı gösterir.

Presesyonun doğru işlendiğini gösteren güzel bir örnek: Regulus 1990'da 29.7°
Aslan'da, ve yönettiği burçta yaklaşık iki bin yıl kaldıktan sonra 2011–2012
civarında Başak'a geçti.

### Açı motoru

Üç orb şeması geliyor ve özel şema birinci sınıf. Çoğu kütüphane tek bir şemayı
sabitliyor; oysa gelenekler ciddi biçimde ayrışıyor — modern şemada orb açıya
bağlı, geleneksel moiety şemasında her cismin kendi yarım orbu var ve iki cismin
yarımları toplanıyor:

```ts
import { findAspects, TRADITIONAL_MOIETIES, findAspectsBetween } from '@kuntay/swisseph';

const aspects = findAspects([
  { name: 'Sun', longitude: 54.5, body: Body.Sun, speed: 0.97 },
  { name: 'Moon', longitude: 296.9, body: Body.Moon, speed: 12.8 },
], { orbs: TRADITIONAL_MOIETIES });

aspects[0].applying;   // uygulanan mı, ayrılan mı
```

Sinastri ve transitler için `findAspectsBetween()`: yalnızca kümeler arası
çiftleri karşılaştırıyor, küme içindekileri değil.

Uygulanan/ayrılan ayrımı, konumları ileri itip yeniden ölçerek değil, orbun
TÜREVİNDEN bulunuyor. Sonlu bir adım tam açının üstünden atlıyor: Ay günün
yüzde birinde 0.13° gidiyor, dolayısıyla örnekleyerek okuyan bir hesap tam
açıya 0.06°'den yakın bir Ay temasını hâlâ yaklaşırken "ayrılan" diyor — üstelik
tam da önemli olan partil aralıkta. Retrograd hareket ve 0/360 sınırı işaretli
farkın içinde olduğu için özel durum gerektirmiyor.

Noktalar bir `group` bildirebiliyor; `findAspects()` aynı gruptaki iki noktayı
asla eşleştirmiyor:

```ts
findAspects([
  { name: 'Ascendant', longitude: 0, group: 'angles' },
  { name: 'Midheaven', longitude: 89.98, group: 'angles' },
]);   // []
```

Yükselen–Tepe Noktası ayrımı yalnızca enlemin ve eğikliğin fonksiyonu: 20°
enlemde 89.98° çıkıyor, yani bu olmadan o enlemdeki her harita bir yay-dakikası
orb'lu bir kare raporluyor ve o kare listenin başına oturuyor. İki ay düğümü de
aynı durumda. `findAspectsBetween()` grubu yok sayıyor, çünkü bir haritanın
açıları başka bir haritanınkilerle *gerçekten* temas kuruyor.

### Antiscia

Gündönümü ekseninde (0° Yengeç – 0° Oğlak) yansıma. Antiscion'daki iki nokta
aynı deklinasyonu ve aynı gün uzunluğunu paylaşıyor — tekniğin fiziksel temeli
bu:

```ts
import { findAntiscia, reflect } from '@kuntay/swisseph';
reflect('Sun', 75);   // 15° İkizler -> antiscion 15° Yengeç
```

### Deklinasyon, paralel, sınır dışı

Boylam konumun yarısı. İki cisim zodyakta 90° uzakta olup aynı deklinasyon
çemberinde durabiliyor:

```ts
import { findDeclinationAspects, outOfBounds } from '@kuntay/swisseph';

const points = swe.declinations(jd, [Body.Sun, Body.Moon, Body.Venus]);
const ties = findDeclinationAspects(points);              // paralel / kontraparalel
const oob = outOfBounds(points, swe.obliquity(jd).trueObliquity);
```

**Eğikliği tarihe göre geçin.** Eğiklik yüzyılda ~47″ küçülüyor; sabit
kullanmak, sınıra yakın duran bir cismi yanlış tarafa düşürür.

Ekvatora yakın çiftler hem paralel hem kontraparalel sayılabiliyor (+0.3° ile
−0.3° arasında fark 0.6°, toplam 0°). Bu geometrinin kendisi; ikisi de
raporlanıyor.

### Dönüşler

```ts
const { jd } = swe.solarReturn(natalJd, { after: swe.julianDay(2026, 1, 1) });
const chart = swe.houses(jd, 39.93, 32.86);
```

Presesyon düzeltmeli dönüş ayrı bir seçenek (`precessionCorrected: true`),
çünkü hangisinin doğru olduğu uygulayıcılar arasında canlı bir tartışma. Otuz
yılda ikisi arasında yaklaşık bir gün fark oluyor — sessizce bir tarafı
seçmiyoruz.

Güneş ve Ay için Swiss Ephemeris'in kendi kesişim rutinleri kullanılıyor;
diğer cisimler için adımlayıp ikiye bölen bir arama var ve testler ikisini
birbirine karşı 0.09 saniye içinde doğruluyor.

### Doğuş, batış ve paranlar

```ts
const contacts = swe.parans(jd, [Body.Sun, Body.Mars, 'Sirius'],
  { latitude: 39.93, longitude: 32.86 }, { orbMinutes: 20 });
```

Kutup bölgesinde bir cisim hiç doğmayabilir ya da hiç batmayabilir. Bu bir hata
değil: `riseTransit()` `occurs: false` döndürüyor, `angleEvents()` ise cismi
`circumpolar` ya da `neverRises` olarak işaretleyip kültminasyonlarını yine de
veriyor — kutup yıldızıyla paran tam da böyle mümkün oluyor.

Olaylar günde bir tekrarladığı için karşılaştırma gün modulo yapılıyor:
23:50'deki doğuş ile ertesi 00:10'daki kültminasyon 20 dakika arayla, 23 saat
değil.

### Tutulmalar

```ts
const eclipse = swe.solarEclipse(swe.julianDay(2017, 8, 1, 0));
eclipse.kind;                  // 'total'
eclipse.timings.totalityBegin;

const local = swe.solarEclipse(jd, { place: { latitude: 36.97, longitude: -76.29 } });
local.local!.magnitude;        // büyüklük, görünürlük, Güneş'in yüksekliği
```

C API'sinde zamanlamalar isimsiz bir dizi ve indislerin anlamı çağrıya göre
değişiyor: `tret[4]` küresel aramada tam evrenin başlangıcı, yerel aramada
dördüncü temas. Burada adlandırılmış alanlara çevriliyor.

Yerel arama tip süzgeci almıyor; `place` ile birlikte `type` geçmek sessizce
yok sayılmak yerine hata veriyor.

### Heliacal doğuşlar

```ts
const { visibilityBegin } = swe.heliacal(
  swe.julianDay(-3000, 7, 1), 'Sirius',
  { latitude: 30.0, longitude: 31.2, altitude: 20 },
  HeliacalEvent.HeliacalRising,
);
```

Kütüphanedeki tek "saf geometri olmayan" hesap: bir cismin görünür olup
olmadığı atmosfere ve gözlemcinin gözüne bağlı. Bu varsayımlar tiplenmiş ve
varsayılanları açık.

### Profeksiyon ve firdaria

```ts
import { profection, firdariaAt, EGYPTIAN_YEAR } from '@kuntay/swisseph';

const p = profection(natalJd, jd, natalAscendant);
p.house;   // 1–12   p.lord;   // profeksiyon burcunun yöneticisi

const lords = firdariaAt(natalJd, 'day', jd);
lords?.major.lord;   // 'Sun'   lords?.minor?.lord;   // alt dönem
```

Yıl uzunluğu açık bir seçenek (tropik, Jülyen ya da Mısır yılı). 75 yıllık bir
firdaria devrinde tropik ile Mısır yılı 18 gün ayrışıyor ve bu bir alt dönem
sınırını kaydırmaya yeter.

### Evler: yerleşim ve cusp'ların vermediği açı noktaları

Bir cismin hangi evde olduğu `floor((boylam − yükselen) / 30) + 1` değil. O
formül yalnızca eşit evlerde doğru; Placidus'ta 12°'lik bir evin yanında 60°'lik
bir ev olabiliyor ve hesabın 0° Koç'u fark etmeden geçmesi gerekiyor:

```ts
import { houseOf, assignHouses } from '@kuntay/swisseph';

const { cusps, descendant, imumCoeli } = swe.houses(jd, 39.93, 32.86, 'P');
houseOf(swe.calc(jd, Body.Sun).longitude, cusps);   // 7
```

`descendant` ve `imumCoeli` 7. ve 4. ev ucundan okunmuyor, hesaplanıyor —
çünkü o eşitlik yalnızca dörtlü sistemlerde geçerli. Whole sign'da 4. ev ucu ile
gerçek Dip Noktası bir burç ayrı düşebiliyor:

```ts
const w = swe.houses(jd, 39.93, 32.86, 'W');
w.cusps[3];     //  0°00' Oğlak — dördüncü ev burada başlıyor
w.imumCoeli;    //  1°11' Kova  — alt meridyen burada
```

Equal, Morinus, Vehlow ve meridyen sistemleri de aynı şekilde davranıyor. Tepe
Noktası da öyle: o haritada 10. değil, 11. whole sign evinde duruyor.

`houseOf()` Gauquelin sektörlerini reddediyor — 36 tane ve saat yönünde
sayılıyorlar, dolayısıyla hiçbir ev numarası anlamlı değil.

### Kutuplara yakın ev sistemleri

Placidus, Koch, Gauquelin ve Sunshine kutup dairesinin ötesinde matematiksel
olarak tanımsız. Swiss Ephemeris orada Porphyry'ye geçip `-1` döndürüyor ama
**cusps'ı geçerli değerlerle dolduruyor** — yani `-1` bir uyarı, hata değil:

```ts
const { cusps, substituted, warning } = swe.houses(jd, 69.65, 18.96, 'P');
```

Bu `-1`'i hata saymak kütüphaneyi 66.5°N üzerinde kullanılamaz yapar; referans
korpusundaki vakaların %4.9'u bu durumda.

`cusps.length` `'G'` DIŞINDA her ev sisteminde 12; `'G'` 36 Gauquelin sektörü
döndürüyor. On iki varsaymak yerine uzunluğu okuyun. Kutup ikamesi `'G'`'nin 12
verdiği tek durum: orada yalnızca yerine geçen Porphyry evleri hesaplanıyor.

## Tasarım notları

**Instance izolasyonu.** Swiss Ephemeris tüm durumunu tek bir global `swed`
struct'ında tutuyor — `swe_set_topo`, `swe_set_sid_mode` ve `swe_set_ephe_path`
C tarafında süreç-genelinde geçerli. Eşzamanlı istek işleyen bir sunucuda o
durum istekler arasında sızar. Build `-sMODULARIZE` ile derlendiği için
`createSwissEph()` her çağırana kendi lineer belleğine sahip yeni bir WASM
örneği verebiliyor. Bu bir kolaylık değil, doğruluk özelliği.

**Negatif dönüşler tekdüze hata değil.** `swe_calc_ut`, `swe_fixstar2` ve
`swe_get_ayanamsa_ex_ut` negatifi gerçek başarısızlık için kullanıyor, ama
`swe_houses_ex2` `-1`'i "ev sistemini değiştirdim ama veri geçerli" demek için
kullanıyor. İkisi farklı ele alınıyor ve hangisinin ne yaptığı varsayılmadı,
korpustan doğrulandı.

## Doğrulama yaklaşımı

Bu belgede yanlış olabilecek her iddia, yanlış olsaydı başarısız olacak bir
şeyle kontrol ediliyor:

| İddia | Nasıl doğrulanıyor |
|---|---|
| WASM referans C ile aynı | Native gcc derlemesine karşı 89.224 değer |
| Efemeris dosya adlandırması doğru | 306 hesaplanan ad upstream'de mevcut; her yıl yalnızca kendi dosyasını yükleyip Moshier'e düşmemeli |
| Açılar doğru | MC ve Yükselen küresel trigonometriyle bağımsız hesaplanıyor — 1.8″ ve 8.7″ |
| Sekt belirleme doğru | 4.608 enlem/zaman kombinasyonunda `swe_azalt`'a karşı |
| Lot formülleri doğru girilmiş | Değişmezler — Şans + Ruh = 2 × Yükselen |
| Kürasyon yıldızları gerçek | Her ad gerçek katalogda çözümleniyor |
| Tarayıcı kısıtları sağlanıyor | Node testleri tarayıcının katı `fetch` kontrolünü taklit ediyor |
| Sabitler header ile uyumlu | CI'da yeniden üretilip commit'lenmiş halle diff'leniyor |

Genel yaklaşım: birinin yazdığı bir sayı hakkındaki iddia yerine, tutmak
zorunda olan bir özelliği tercih etmek. Bu yolla birkaç gerçek hata ortaya
çıktı — sektte işaret hatası, kutup dairesinde kırık ev hesabı, yanlış Temel
Noktası kuralı, ve tarayıcıda `fetch`'in bağlanmamış olması.

## Katkı

```bash
npm install
npm run build          # WASM (~10 sn) + sabit codegen + TypeScript
npm run check          # sekiz doğrulama takımı
npm test               # 59 birim ve entegrasyon testi
npm run demo           # tarayıcı demosu, http://127.0.0.1:8080
```

Tam hassasiyet gerektiren kontroller için `.se1` dosyalarını gösterin:

```bash
export SWISSEPH_EPHE_PATH=/dizin/yolu/ephe
```

`packages/core/src/generated/constants.ts` üretilmiş bir dosya —
`swephexp.h`'deki `#define`'lardan ve derlenmiş kütüphanenin kendisinden
(ev sistemi adları için `swe_house_name()` çağrılıyor). Commit'leniyor ki temiz
bir checkout derlemeden önce typecheck yapabilsin; CI bayatlarsa build kırılıyor.
288 sabit, elle doğru kopyalanabilecek sayının çok ötesinde.

## Teşekkür

Swiss Ephemeris, Astrodienst AG'de (Zürih) **Dieter Koch** ve **Alois
Treindl**'in eseri — onlarca yıllık emek, NASA/JPL DE441 üzerine kurulu. Bu
proje onların işi üzerine bir paketleme çalışması ve astronomik özgünlük iddia
etmiyor.

- Upstream: <https://github.com/aloistr/swisseph>
- Dokümantasyon: <https://www.astro.com/swisseph>

Bu proje bağımsızdır; Astrodienst AG ile ilişkili değildir ve onun tarafından
desteklenmiyor. Bu paketle ilgili destek taleplerini lütfen Swiss Ephemeris
posta listesine göndermeyin.

## Lisans

[AGPL-3.0-or-later](LICENSE). Atıf ve lisans açıklamasının tamamı için
[NOTICE](NOTICE).
