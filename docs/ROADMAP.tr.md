# Yol haritası: bu kütüphane gerçekten nereye değer katabilir

*[English](ROADMAP.md) · Türkçe*

Her şeyi iki soru belirledi:

1. Efemeris verisinin kendisi iyileştirilebilir mi?
2. İyileştirilemezse, yapmaya değer olan ne?

Kısa cevaplar: **hayır** ve **türetilmiş katman**.

---

## 1. Efemeris verisi burada iyileştirilemez — ve iyileştirilmemeli

### Veri aslında ne

`.se1` dosyaları **JPL DE441**'e sıkıştırılmış Chebyshev uyumları. DE441
birinin ayarladığı bir model değil; hareket denklemleri — Newton çekimi artı
genel görelilik düzeltmeleri, Güneş basıklığı, asteroid pertürbasyonları —
sayısal olarak integre edilip gözlem kaydına en küçük karelerle oturtulmuş:

- iç gezegenlere radar mesafe ölçümü
- uzay aracı telemetrisi (Cassini, MESSENGER, Juno, Mars yörüngecileri)
- Dünya-Ay uzaklığını milimetre düzeyinde ölçen Lunar Laser Ranging
- tüm çerçevenin yönelimi için VLBI

> **Bir açıklama, çünkü bu ifade sıkça geçiyor:** efemerisler makine öğrenmesi
> anlamında "eğitilmiyor" ve bulunacak daha iyi eğitilmiş bir sürüm yok.
> İyileştirilecek bir model yok — dinamik doğrudan çözülüyor. Doğruluk tavanını
> teknik değil, gözlemler belirliyor.

### Kim iyileştirebilir

Bu düzeyde güneş sistemi efemerisi üreten dünyada üç grup var: JPL (DE serisi),
IMCCE/Fransa (INPOP), IAA RAS/Rusya (EPM). İç gezegenlerde birbirleriyle
milisaniye-yay altında uyuşuyorlar. Onları geçmek ham gözlem arşivlerini, bir
güneş sistemi integratörünü ve uzman-yılları gerektirir. Yan proje değil, ve
denemek daha kötü bir şey üretir.

### Astroloji için veri zaten absürt derecede hassas

Herhangi bir haritadaki baskın hata efemeris değil, **doğum saati**:

| Hata kaynağı | Haritaya etkisi |
|---|---|
| Doğum saatinde 1 dakika belirsizlik | Yükselen ~900″ (~15′) kayar |
| Doğum saatinde 1 dakika belirsizlik | Ay ~30″ kayar |
| Moshier ↔ tam efemeris (en kötü: Plüton 2399) | 5.9″ |
| Moshier ↔ tam efemeris (Güneş, her tarih) | < 0.07″ |

Dakikaya yuvarlanmış bir doğum saati, en kötü efemeris farkından **~150 kat**
büyük belirsizlik taşıyor. Rektifikasyon, ev sistemi ve zodyak seçimi bunu daha
da gölgede bırakıyor. **5 yay-saniyesinde cevabı değişen astrolojik soru yok.**

### Astronomi için DE441 zaten referansın kendisi

Onu geçmezsiniz, kullanırsınız. Daha fazlası gerekiyorsa
[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) doğrudan sorgulanır.

**Sonuç: efemeris verisi çözülmüş sabit bir girdi. Tüm mühendislik onun
üstüne.**

---

## 2. Değer asıl nerede

Swiss Ephemeris koordinat verir, harita vermez. Aradaki boşluk büyük,
JavaScript tarafında karşılıksız, ve tamamen kod — veri problemi yok,
hassasiyet problemi yok.

---

### 2.1 Arap noktaları ✅ *tamamlandı*

Swiss Ephemeris bunları hiç sağlamıyor — saf aritmetik oldukları için
kapsamının dışındalar. JavaScript'te düzgün yapılmış bir uygulaması yoktu.

**Sekt zor kısımdı ve endişe haklı çıktı.** Geleneksel hesaplama kuralı —
"Güneş, Yükselen'den 180°'den ileriyse ufkun üstündedir" — kutup dairesine
kadar *tam doğru*, ötesinde *fena halde yanlış* çıktı:

| Enlem | Gerçek yükseklikle uyuşmazlık |
|---|---|
| 0–66.5° | %0.00 |
| 67° | %6.25 (en kötü 4.2° sapma) |
| 70° | %18.40 (en kötü 11.2°) |
| 80° | %36.46 (en kötü 19.5°) |

Sebep Swiss Ephemeris'in kendisinde: kutup dairesinin ötesinde Yükselen
"yanlış tarafta" kaldığında AC/DC'yi takas ediyor (`swehouse.c:998`) ve
kısayolun dayandığı varsayım tersine dönüyor. 70°N'de Güneş ufkun 11°
üstündeyken harita "gece" sayılabiliyor — ve hiçbir hata verilmiyor, yani
sekte bağlı bütün lotlar sessizce kayıyor.

Çözüm: varsayılanı Güneş'in gerçek yüksekliği (`swe_azalt`) yapmak. Her yerde
doğru, ve geleneğin geliştirildiği enlemlerde geleneksel kuralla birebir aynı.
Kısayol seçenek olarak duruyor, sınırları gizlenmeden belgeleniyor.

**İkinci ders: her lot `A + B − C` değil.** Temel Noktası, Şans ile Ruh
arasındaki kısa yayı alıyor — bir formül değil, koşullu bir karar. Evrensel
`A + B − C` kalıbını varsayan uygulamalar Temel'i sekt aynası sanıp yanlış yere
koyuyor. Tanım tipi bu tür durumlar için `compute` kaçış kapağı taşıyor.

---

### 2.2 Sabit yıldızlar ✅ *kürasyon tamamlandı*

`sefstars.txt` zaten 5. kadirden parlak her şeyi ICRS koordinatları, öz hareket,
paralaks ve radyal hızla içeriyor.

#### Gaia ile yeniden kurmalı mıyız?

**Hayır — ve sebebi sezgiye aykırı.** Gaia DR3'ün 1.8 milyar kaynak için
mikro-yay-saniyesi astrometrisi var, bariz bir yükseltme gibi görünüyor. Ama
**Gaia parlak yıldızlarda doyuma giriyor.** Astrometrisi parlak uçta bozuluyor
ve ~3. kadirde tükeniyor.

Geleneksel astroloji yıldızları tam olarak parlak olanlar: Sirius (−1.46),
Canopus (−0.74), Arcturus (−0.05), Vega (0.03), Aldebaran (0.86), Antares
(1.06), Fomalhaut (1.16), Regulus (1.40). **Hepsi Gaia'nın sorunlu aralığında.**

Hipparcos temelli konumlar bu yıldızlar için daha iyi kalıyor ve `sefstars.txt`
esasen ona dayanıyor. Gaia'ya geçmek kimsenin kullanmadığı sönük yıldızları
kimsenin algılayamayacağı kadar iyileştirip önemlileri kötüleştirirdi.

#### Bunun yerine yapılan

Dört Kraliyet Yıldızı (Pers Bekçileri), 15 Behenian yıldızı ve 10 dikkate değer
yıldız kürasyon listesi olarak geliyor. Test paketi her adın gerçek katalogda
çözümlendiğini doğruluyor.

Ayrıca `byDesignation()`: katalog bazı yıldızları aynı adın farklı yazımlarıyla
iki kez içeriyor ve `qsort` kararsız olduğu için hangi yazımın döneceği
platforma göre değişebiliyor. Adlandırmayla arama bu belirsizliği kaldırıyor.

---

### 2.3 Asteroidler ✅ *tamamlandı — 16 cisim, 409 KB*

Altısı ana dosyalarda zaten var: Chiron, Pholus, Ceres, Pallas, Juno, Vesta.

Ötesi ayrı dosyalarda. Upstream 760.000+ asteroid yayınlıyor; astrologların
istediği 16'sı paketlendi: Eris, Sedna, Quaoar, Makemake, Haumea, Orcus, Ixion,
Varuna, Gonggong, Chariklo, Nessus, Eros, Psyche, Hygiea, Astraea, Lilith.

Dosya adlandırması ters mühendislikle çözüldü — 8 karakterlik taban ad sabit
tutuluyor (DOS 8.3 mirası): `se00433s.se1` ama `s136199s.se1`.

> **Belgelenmesi gereken bir tuzak.** "Lilith" astrolojide üç ayrı şey demek:
>
> | Ad | Nedir | Nasıl hesaplanır |
> |---|---|---|
> | Black Moon Lilith (ortalama) | Ortalama Ay apojesi — *cisim değil* | `Body.BlackMoonLilithMean` |
> | Black Moon Lilith (gerçek) | Oskülatör apoje | `Body.BlackMoonLilithTrue` |
> | Asteroid Lilith | Gerçek bir asteroid | `asteroidBody(Asteroid.Lilith)` |
>
> Tamamen farklı konumlar veriyorlar: 15 Mayıs 1990'da asteroid 309.09°,
> Black Moon Lilith 231.48° — **77° fark**.

İki davranış farkı belgelendi: asteroid dosyaları **1500–2100 CE** kapsıyor
(ana dosyalardan dar), ve **eksik dosyada Moshier'e sessiz düşüş yok** —
analitik teori olmadığı için gerçekten hata veriyor.

---

### 2.4 Türetilmiş teknikler ✅ *tamamlandı*

Hepsi saf kod, hepsi kütüphanenin zaten döndürdüğü konumların üstünde.

**Onurlar ve yöneticiler** — ev sahipliği, yücelme, zarar, düşüş, üçlü
yönetici (sekte bağlı), Mısır sınırları, Keldani yüzleri ve klasik puanlama.
Yüz tablosu elle yazılmadı, Keldani dizisinden üretiliyor: 36 girdiyi elle
yazmak sessiz bir sıra hatasına açık olurdu.

**Açı motoru** — üç orb şeması geliyor (modern açı-bazlı, geleneksel moiety,
dar) ve özel şema birinci sınıf. Çoğu kütüphane tek bir şemayı sabitliyor;
oysa gelenekler ciddi biçimde ayrışıyor. Uygulanan/ayrılan ayrımı hızları
ileri iterek bulunuyor — retrograd hareket ve 0/360 sınırı özel durum
gerektirmiyor.

**Antiscia / kontra-antiscia** — gündönümü ve ekinoks eksenlerinde yansıma.
Bağıntı simetrik olduğu için her çift bir kez raporlanıyor.

**Deklinasyon, paralel ve kontraparalel** — `swe.equatorial()` ekvatoral
koordinatı alanları adlarıyla veriyor; `findDeclinationAspects()` paralel ve
kontraparalelleri buluyor. Ekvatora yakın çiftler ikisini birden sağlıyor ve
bu bir hata değil, geometrinin kendisi — ikisi de raporlanıyor.
`outOfBounds()` eğikliği aşan cisimleri işaretliyor; eğiklik yüzyılda 47″
kaydığı için TARİHE AİT değeri geçmek gerekiyor, `swe.obliquity()` veriyor.

**Dönüşler** — güneş, ay ve herhangi bir cismin dönüşü. Güneş ve Ay için Swiss
Ephemeris'in kendi kesişim rutinleri, diğerleri için adımlayıp ikiye bölen bir
arama; testler ikisini birbirine karşı 0.09 saniye içinde doğruluyor.
Presesyon düzeltmeli dönüş (`precessionCorrected`) ayrı bir seçenek — hangisinin
doğru olduğu uygulayıcılar arasında canlı bir tartışma, sessizce bir tarafı
seçmiyoruz.

**Paranlar** — `swe.angleEvents()` her cisim için dört açı zamanını veriyor,
`findParans()` çakışanları eşleştiriyor. Olaylar günde bir tekrarladığı için
karşılaştırma gün modulo yapılıyor: 23:50'deki doğuş ile ertesi 00:10'daki
kültminasyon 20 dakika arayla, 23 saat değil.

**Profeksiyonlar ve firdaria** — yıllık/aylık/günlük profeksiyon ve dokuz
dönemlik Pers firdaria dizisi, alt dönemleriyle. Yıl uzunluğu açık bir seçenek
(tropik / Jülyen / Mısır): 75 yıllık bir devirde tropik ile Mısır yılı 18 gün
ayrışıyor ve bu bir alt dönem sınırını kaydırmaya yeter.

**Tutulmalar** — güneş ve ay tutulmaları, küresel ve yerel arama, tip
süzgeci, geriye doğru arama. Zamanlamalar adlandırılmış alanlara çevrildi:
C API'sinde `tret[4]` küresel aramada tam evrenin başlangıcı, yerel aramada
dördüncü temas — aynı indis, farklı anlam.

**Heliacal doğuşlar** — `swe.heliacal()`. Atmosfer ve gözlemci parametreleri
tiplenmiş ve varsayılanları açık; görünürlük hesabı bir modele dayanıyor ve
bunu gizlemek yerine göstermek doğrusu.

**Ayanamsalar** — 48 sidereal mod zaten uygulanmış; hangi geleneğin hangisini
kullandığını açıklayan bir belge hâlâ eksik.

### 2.5 MCP sunucusu — hesap değil, dağıtım

`@kuntay/swisseph-mcp` yeni bir aritmetik getirmiyor. Bu bir dağıtım sorusu ve
yol haritasında yeri var, çünkü çağıranın kim olduğu değişiyor.

Harita istenen bir dil modeli yine de cevap verir. ΔT, nutasyon ve aberasyon
düzeltmeli binlerce terimli bir seriyi hesaplayamaz, üstelik bunu kendisi
bilmez. Dolayısıyla değer "API'yi bir protokolle dışarı açmak" değil; **modelin
işi kendi yapma fırsatını tamamen ortadan kaldırmak**:

- **Araçlar kaba, API'nin aynası değil.** Tek `natal_chart` çağrısı konumları,
  evleri, açıları, onurları, lotları ve sekti birlikte döndürüyor. İnce
  ayrılmış on iki araç verilse model onları zincirler ve döndürmediğimiz her
  şeyi kendi türetirdi — en başta açıları: 0/360 sarmalı, cisme bağlı orb izni
  ve geri harekette uygulanan/ayrılan ayrımı, üçü de sessizce.
- **Float değil metin.** `54.5033` verilen bir model çevrimi kendi yapar ve
  **yuvarlar**, oysa astroloji yazılımı **keser**. Bu tek fark, bu projenin
  kendi demosunda on cismin dördünde bir dakikalık sahte hata üretti.
- **Yerel saat alınır, UT geri yazdırılır.** Doğum saatini olduğu gibi UT
  saymak yanlış harita üretmenin bir numaralı yolu; Ankara için Yükselen'i
  ~36° oynatıyor.

Türetilmiş katmanı yapmaya değer kılan gerekçe bunu yayınlamaya da değer
kılıyor: hata sessiz, makul görünüyor ve soran kişiye görünmüyor.

---

## 3. Özet

| Alan | Karar | Durum |
|---|---|---|
| Efemeris sayısal verisi | **Dokunma.** JPL çözmüş; astroloji için zaten fazla hassas. | — |
| Sabit yıldız kataloğu | **Yeniden kurma.** Gaia parlak yıldızlarda daha kötü; kürasyon yap. | — |
| Arap noktaları | **Yap.** Upstream'de yok, saf kod, her yerde kötü yapılmış. | ✅ 16 lot |
| Yıldız kürasyonu | **Yap.** Ucuz, algılanan değeri yüksek. | ✅ 72 yıldız |
| Asteroid katmanları | **Yap.** Veri upstream'de var; paketleme ve aralık işi. | ✅ 16 cisim |
| Onurlar ve yöneticiler | **Yap.** | ✅ 5 onur + puanlama |
| Açı motoru | **Yap.** Saf kod; koordinatı haritaya çeviren şey bu. | ✅ 3 orb şeması |
| Antiscia | **Yap.** | ✅ |
| Deklinasyon / paralel | **Yap.** JS'te neredeyse hiç yok. | ✅ + sınır dışı |
| Dönüşler | **Yap.** | ✅ + presesyon düzeltmeli |
| Paranlar | `swe_rise_trans` üzerine kurulabilir. | ✅ |
| Profeksiyon / firdaria | **Yap.** Saf aritmetik. | ✅ |
| Tutulmalar, heliacal | Sarmalama işi; upstream'de çözülmüş. | ✅ |
| MCP sunucusu | **Yayınla.** Yeni hesap yok; modelin sayıyı uydurma fırsatını kapatıyor. | ✅ 8 araç |

---

## 4. Hâlâ açık olanlar

Kod tarafında planlanan teknikler bitti. Kapatılmamış üç başlık var ve
bunları bilerek bırakıyoruz:

**Vedik nakshatra yogatara yıldızları** — 27 nakshatra'nın belirleyici yıldızı
gerçek ve kaynaklandırılabilir bir liste, ama doğru yazmak için düzgün bir
kaynak gerekiyor. Elle yazılmış bir tablo, tam da kürasyon bölümünde
eleştirdiğimiz hatanın kendisi olurdu.

**Genişletilmiş asteroid katmanı** (~100 cisim, ~4 MB) — kürasyon listesi
metadata olarak tutulmalı ve yükleme seçmeli kalmalı; şu anki 16 cisimlik
paket çoğu kullanım için yeterli.

**Tarayıcı yolunun gerçek tarayıcıda otomatik testi** — `check:browser`
tarayıcının katı kısıtlarını Node'da taklit ediyor ve gerçek bir hatayı bu
yolla yakaladı (`fetch`'in bağlanma zorunluluğu), ama gerçek tarayıcı testinin
yerini tutmaz. Demo elle çalıştırılarak doğrulandı.

---

## 5. Yayın için kalanlar

Kod tarafında her şey hazır. Kalanlar yalnızca senin yapabileceklerin:

1. **npm hesabı aç** (`kuntay` kullanıcı adıyla) ve 2FA'yı etkinleştir
2. **GitHub reposu oluştur**, `swiss-npm/` içeriğini it
3. Repo ayarlarında **`NPM_TOKEN` secret'ı** ve — onay kapısı istiyorsan —
   **`npm-publish` environment**'ı tanımla
4. Yayına karar verdiğinde: dört `package.json`'da `private: true`'yu kaldır,
   sürümü `0.1.0` yap, `npm run check:release` ile doğrula, `v0.1.0` etiketi it

`check:release` şunları engelliyor: bayat artefaktlar, `-dev` sürüm ekleri,
hâlâ `private` işaretli paketler, etiketle ya da birbirleriyle uyuşmayan
sürümler, eksik LICENSE/NOTICE/README, boş veri manifestleri.
