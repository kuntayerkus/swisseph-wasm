# @kuntay/swisseph-viz

D3.js tabanlı astrolojik görselleştirme bileşenleri. Natal harita, transit ve synastry grafikleri için interaktif SVG render motoru.

## Kurulum

```bash
npm install @kuntay/swisseph-viz d3
```

## Kullanım

### Natal Harita Görselleştirme

```typescript
import { SwissEph } from '@kuntay/swisseph';
import { NatalChartViz } from '@kuntay/swisseph-viz';

// Initialize
const swe = await SwissEph.create();

// Natal harita hesapla
const chart = swe.natalChart(
  jd, // Julian Date
  39.93, // Latitude
  32.86, // Longitude
  'P' // House system
);

// Görselleştir
const viz = new NatalChartViz('#chart-container', chart, {
  width: 600,
  height: 600,
  showAspects: true,
  aspectOrb: 8,
  showDegrees: true,
  showHouses: true,
  colorScheme: 'light' // 'light' | 'dark' | 'custom'
});

// Güncelleme
viz.update(newChartData);

// Temizleme
viz.destroy();
```

### Özel Renklendirme

```typescript
const viz = new NatalChartViz('#container', chart, {
  colorScheme: 'custom',
  customColors: {
    background: '#1a1a2e',
    planetBorder: '#e94560',
    conjunction: '#ff6b6b',
    trine: '#95e1d3'
  }
});
```

## API

### NatalChartViz

#### Constructor
```typescript
new NatalChartViz(
  container: string | SVGSVGElement,
  data: NatalChart,
  config?: NatalChartConfig
)
```

#### Config Options
- `width`: Grafik genişliği (px) - Varsayılan: 600
- `height`: Grafik yüksekliği (px) - Varsayılan: 600
- `showAspects`: Açılar gösterilsin mi - Varsayılan: true
- `aspectOrb`: Açı orbı (derece) - Varsayılan: 8
- `showDegrees`: Derece bilgisi gösterilsin mi - Varsayılan: true
- `showHouses`: Ev çizgileri gösterilsin mi - Varsayılan: true
- `colorScheme`: Renk şeması - Varsayılan: 'light'
- `customColors`: Özel renkler (Record<string, string>)

#### Methods
- `update(data: NatalChart)`: Yeni veri ile grafiği güncelle
- `destroy()`: SVG elementini temizle

## Renk Şemaları

### Light (Varsayılan)
- Arka plan: Beyaz
- Gezegenler: Mavi kenarlıklar
- Açılar: Renk kodlu (kırmızı konjunction, yeşil trine, vb.)

### Dark
- Arka plan: Koyu lacivert (#1a1a2e)
- Gezegenler: Pembe kenarlıklar (#e94560)
- Açılar: Pastel tonlar

### Custom
Tüm renkleri özelleştirebilirsiniz:
```typescript
{
  background: string;
  border: string;
  houseLine: string;
  zodiacBorder: string;
  zodiacLight: string;
  zodiacDark: string;
  zodiacText: string;
  planetBg: string;
  planetBorder: string;
  planetText: string;
  degreeText: string;
  degreeMarker: string;
  conjunction: string;
  opposition: string;
  trine: string;
  square: string;
  sextile: string;
  aspectDefault: string;
  text: string;
}
```

## Özellikler

✅ **Tam Natal Harita**: 12 ev, zodyak kuşağı, gezegenler, açılar  
✅ **Interaktif SVG**: D3.js ile yüksek kaliteli vektörel grafik  
✅ **Responsive**: Farklı boyutlara uyumlu  
✅ **Tema Desteği**: Light, dark ve custom renk şemaları  
✅ **Performans**: Optimize edilmiş render motoru  
✅ **TypeScript**: Tam tip desteği  

## Gelecek Sürümler

- [ ] Transit grafiği overlay
- [ ] Synastry (iki harita karşılaştırma)
- [ ] Composite chart
- [ ] Progressed chart animasyonları
- [ ] Export to PNG/SVG
- [ ] Tooltip ve detay bilgileri
- [ ] Zoom ve pan desteği

## Lisans

AGPL-3.0 - Astrolog.com AG'nin Swiss Ephemeris kütüphanesini kullanır. Ticari kullanım için Astrodienst ile iletişime geçin.

## Bağımlılıklar

- `@kuntay/swisseph`: ^0.3.0
- `d3`: ^7.8.5

## Boyut

- Gzip: ~45 KB
- Brotli: ~38 KB
