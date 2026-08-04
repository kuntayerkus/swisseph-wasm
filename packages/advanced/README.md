# @kuntay/swisseph-advanced

Vedik astroloji modülleri - Nakshatra sistemi, uyumluluk analizi ve isim önerileri. Brihat Parashara Hora Shastra'ya dayalı hesaplamalar.

## Kurulum

```bash
npm install @kuntay/swisseph-advanced
```

## Kullanım

### Nakshatra Hesaplama

```typescript
import { calculateNakshatra, NAKSHATRAS } from '@kuntay/swisseph-advanced';

// Ay'ın boylamı (derece)
const moonLongitude = 125.45;

const result = calculateNakshatra(moonLongitude);

console.log(result.nakshatra.name); // "Magha"
console.log(result.nakshatra.deity); // "Pitris"
console.log(result.pada); // 1-4 arası
console.log(result.padaLord); // Gezegen
console.log(result.percentComplete); // Nakshatra içindeki ilerleme %
```

### Uyumluluk Analizi (Kuta Matching)

```typescript
import { analyzeCompatibility } from '@kuntay/swisseph-advanced';

const person1Moon = 45.67; // Kişi 1 ay boylamı
const person2Moon = 234.89; // Kişi 2 ay boylamı

const compatibility = analyzeCompatibility(person1Moon, person2Moon);

console.log(`Uyumluluk Skoru: ${compatibility.score}/${compatibility.maxScore}`);
console.log(`Yüzde: ${(compatibility.score / compatibility.maxScore * 100).toFixed(1)}%`);
console.log(compatibility.recommendation);

// Detaylı faktörler
compatibility.factors.forEach(factor => {
  console.log(`${factor.name}: ${factor.points} puan - ${factor.description}`);
});
```

### İsim Önerisi

```typescript
import { getNameSuggestions } from '@kuntay/swisseph-advanced';

const babyMoonLongitude = 78.34;
const suggestions = getNameSuggestions(babyMoonLongitude);

console.log(suggestions); // ['Ke', 'Ko', 'Ha', 'Hi']
// Vedik geleneğe göre bu harflerle başlayan isimler şans getirir
```

### Tüm Nakshatralar

```typescript
import { NAKSHATRAS } from '@kuntay/swisseph-advanced';

NAKSHATRAS.forEach(nak => {
  console.log(`${nak.id}. ${nak.name} (${nak.sanskritName})`);
  console.log(`   Tanrı: ${nak.deity}`);
  console.log(`   Sembol: ${nak.symbol}`);
  console.log(`   Yönetici: ${nak.rulingPlanet}`);
  console.log(`   Element: ${nak.element}`);
  console.log(`   Amaç: ${nak.purpose}`);
});
```

## API Referansı

### calculateNakshatra(longitude: number): NakshatraResult

**Parametreler:**
- `longitude`: Ekliptik boylam (0-360 derece)

**Döndürür:**
```typescript
interface NakshatraResult {
  nakshatra: NakshatraData;
  pada: number;              // 1-4
  padaLord: Body;            // Pada yöneticisi gezegen
  longitude: number;         // Normalized longitude
  remainingDegrees: number;  // Nakshatra bitimine kalan derece
  percentComplete: number;   // Tamamlanma yüzdesi (0-100)
}
```

### analyzeCompatibility(moon1: number, moon2: number): CompatibilityResult

**Parametreler:**
- `moon1`: Kişi 1 ay boylamı
- `moon2`: Kişi 2 ay boylamı

**Değerlendirilen Faktörler:**
- **Gana** (6 puan): Temperament uyumu (Deva, Manushya, Rakshasa)
- **Yoni** (4 puan): Hayvan doğası uyumu
- **Nadi** (8 puan): Sağlık/genetik uyumluluk
- **Element** (3 puan): Element uyumu (Fire, Earth, Air, Water)
- **Varna** (1 puan): Spiritüel gelişim seviyesi

**Toplam Maksimum Puan:** 22

**Yorumlama:**
- 16.5+ puan (%75+): Mükemmel uyum
- 11-16.5 puan (%50-75): İyi uyum
- <11 puan (%50-): Zorlu uyum

### getNameSuggestions(longitude: number): string[]

Verilen nakshatra için geleneksel Sanskritçe başlangıç hecelerini döndürür.

## Nakshatra Veri Yapısı

```typescript
interface NakshatraData {
  id: number;                    // 1-27
  name: string;                  // İngilizce isim
  sanskritName: string;          // Sanskritçe isim (Devanagari)
  deity: string;                 // Yönetici tanrı
  symbol: string;                // Sembol
  animal: string;                // Hayvan
  bird: string;                  // Kuş
  tree: string;                  // Ağaç
  startLongitude: number;        // Başlangıç derecesi
  endLongitude: number;          // Bitiş derecesi
  padaCount: number;             // Her zaman 4
  rulingPlanet: Body;            // Nakshatra yöneticisi
  gana: 'Deva' | 'Manushya' | 'Rakshasa';
  nadi: 'Adi' | 'Madhya' | 'Antya';
  varna: string;                 // Brahmin, Kshatriya, Vaishya, Shudra
  yoni: string;                  // Hayvan sembolü
  quality: 'Fixed' | 'Movable' | 'Dual';
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  purpose: 'Dharma' | 'Artha' | 'Kama' | 'Moksha';
  luckyLetter: string[];         // Şanslı harfler
}
```

## 27 Nakshatra Listesi

| # | Name | Ruler | Element | Purpose |
|---|------|-------|---------|---------|
| 1 | Ashwini | Ketu | Earth | Dharma |
| 2 | Bharani | Venus | Earth | Artha |
| 3 | Krittika | Sun | Fire | Kama |
| 4 | Rohini | Moon | Earth | Artha |
| 5 | Mrigashira | Mars | Air | Kama |
| 6 | Ardra | Rahu | Air | Artha |
| 7 | Punarvasu | Jupiter | Air | Dharma |
| 8 | Pushya | Saturn | Water | Dharma |
| 9 | Ashlesha | Mercury | Water | Dharma |
| 10 | Magha | Ketu | Fire | Dharma |
| 11 | Purva Phalguni | Venus | Air | Kama |
| 12 | Uttara Phalguni | Sun | Air | Artha |
| 13 | Hasta | Moon | Air | Kama |
| 14 | Chitra | Mars | Air | Kama |
| 15 | Swati | Rahu | Air | Artha |
| 16 | Vishakha | Jupiter | Air | Dharma |
| 17 | Anuradha | Saturn | Fire | Dharma |
| 18 | Jyeshtha | Mercury | Water | Artha |
| 19 | Mula | Ketu | Fire | Artha |
| 20 | Purva Ashadha | Venus | Air | Kama |
| 21 | Uttara Ashadha | Sun | Air | Dharma |
| 22 | Shravana | Moon | Air | Dharma |
| 23 | Dhanishta | Mars | Air | Artha |
| 24 | Shatabhisha | Rahu | Air | Dharma |
| 25 | Purva Bhadrapada | Jupiter | Air | Dharma |
| 26 | Uttara Bhadrapada | Saturn | Water | Artha |
| 27 | Revati | Mercury | Water | Kama |

## Örnekler

### Doğum Haritasında Nakshatra Kullanımı

```typescript
import { SwissEph } from '@kuntay/swisseph';
import { calculateNakshatra } from '@kuntay/swisseph-advanced';

const swe = await SwissEph.create();

const chart = swe.natalChart(jd, lat, lon, 'P');
const moonPosition = chart.planets.Moon;

const moonNakshatra = calculateNakshatra(moonPosition.longitude);

console.log(`Ay ${moonNakshatra.nakshatra.name} nakshatrasında`);
console.log(`Pada: ${moonNakshatra.pada}`);
console.log(`Pada Lordu: ${Body[moonNakshatra.padaLord]}`);
console.log(`İsim önerileri: ${moonNakshatra.nakshatra.luckyLetter.join(', ')}`);
```

### Vimshottari Dasha Başlangıcı

```typescript
// Her nakshatra'nın kendi dasha süresi vardır
const dashaPeriods = {
  [Body.Ketu]: 7,
  [Body.Venus]: 20,
  [Body.Sun]: 6,
  [Body.Moon]: 10,
  [Body.Mars]: 7,
  [Body.Rahu]: 18,
  [Body.Jupiter]: 16,
  [Body.Saturn]: 19,
  [Body.Mercury]: 17
};

const nak = calculateNakshatra(moonLongitude);
const totalYears = dashaPeriods[nak.nakshatra.rulingPlanet];
const remainingYears = totalYears * (1 - nak.percentComplete / 100);

console.log(`Kalan dasha süresi: ${remainingYears.toFixed(2)} yıl`);
```

## Kaynaklar

- **Brihat Parashara Hora Shastra**: Klasik Vedik astroloji metni
- **Phaladeepika**: Mantreswara tarafından yazılmış
- **Jataka Parijata**: Vaidyanatha Dikshita

## Lisans

AGPL-3.0 - Vedik astroloji hesaplamaları için açık kaynak implementasyon.

## Bağımlılıklar

- `@kuntay/swisseph`: ^0.3.0

## Boyut

- Gzip: ~18 KB
- Brotli: ~15 KB

## Gelecek Özellikler

- [ ] Vimshottari Dasha hesaplama
- [ ] Ashtakavarga sistemi
- [ ] Divisional charts (D-9, D-10, vb.)
- [ ] Muhurta (seçici astroloji)
- [ ] Prashna (soru astrolojisi)
- [ ] Tajika sistemi (yıllık prognoz)
