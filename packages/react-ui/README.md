# @kuntay/swisseph-react-ui

React bileşenleri - Natal harita, transit ve diğer astrolojik görselleştirmeler için hazır UI komponentleri.

## Kurulum

```bash
npm install @kuntay/swisseph-react-ui
```

## Kullanım

### Natal Harita Bileşeni

```tsx
import { SwissEph } from '@kuntay/swisseph';
import { NatalChart } from '@kuntay/swisseph-react-ui';

function App() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    async function loadChart() {
      const swe = await SwissEph.create();
      const chart = swe.natalChart(jd, lat, lon, 'P');
      setChartData(chart);
    }
    loadChart();
  }, []);

  if (!chartData) return <div>Loading...</div>;

  return (
    <NatalChart
      data={chartData}
      width={500}
      height={500}
      showAspects={true}
      theme="light"
    />
  );
}
```

### Dark Tema

```tsx
<NatalChart
  data={chartData}
  theme="dark"
  width={600}
  height={600}
/>
```

### Özel Stil

```tsx
<NatalChart
  data={chartData}
  className="my-custom-chart"
  style={{ border: '2px solid #3498db', borderRadius: '8px' }}
/>
```

## API

### NatalChart

```typescript
interface NatalChartProps {
  data: NatalChart;           // @kuntay/swisseph natal chart verisi
  width?: number;             // Genişlik (px) - Varsayılan: 500
  height?: number;            // Yükseklik (px) - Varsayılan: 500
  showAspects?: boolean;      // Açılar gösterilsin mi - Varsayılan: true
  theme?: 'light' | 'dark';   // Tema - Varsayılan: 'light'
  className?: string;         // CSS class
  style?: React.CSSProperties; // Inline styles
}
```

## Özellikler

✅ **Hazır Bileşen**: Tek satırda natal harita  
✅ **Responsive**: Farklı boyutlara uyumlu  
✅ **Tema Desteği**: Light ve dark mod  
✅ **TypeScript**: Tam tip desteği  
✅ **React 18+**: Modern React ile uyumlu  

## Gelecek Sürümler

- [ ] TransitChart bileşeni
- [ ] SynastryChart (iki harita karşılaştırma)
- [ ] AspectTable (açı tablosu)
- [ ] PlanetList (gezegen konumları listesi)
- [ ] HouseSystem (ev sistemi seçici)
- [ ] Interactive tooltip'lar
- [ ] Export to PNG/SVG

## Örnekler

### Tam Uygulama Örneği

```tsx
import React, { useState, useEffect } from 'react';
import { SwissEph } from '@kuntay/swisseph';
import { NatalChart } from '@kuntay/swisseph-react-ui';

function AstrologyApp() {
  const [chart, setChart] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    async function calculateChart() {
      const swe = await SwissEph.create();
      
      // 15 Mayıs 1990, 14:30, Ankara
      const jd = swe.dateToJulian(1990, 5, 15, 14, 30);
      const natalChart = swe.natalChart(jd, 39.93, 32.86, 'P');
      
      setChart(natalChart);
    }
    
    calculateChart();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Natal Harita</h1>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
          Toggle Theme
        </button>
      </header>
      
      <main>
        {chart && (
          <NatalChart
            data={chart}
            width={600}
            height={600}
            theme={theme}
          />
        )}
      </main>
    </div>
  );
}
```

### Next.js Entegrasyonu

```tsx
// app/page.tsx
'use client';

import { NatalChart } from '@kuntay/swisseph-react-ui';

export default function Home() {
  // ... chart data calculation
  
  return (
    <div>
      <NatalChart data={chartData} />
    </div>
  );
}
```

## Lisans

AGPL-3.0 - Ticari kullanım için @kuntay/swisseph-license paketine bakın.

## Bağımlılıklar

- `@kuntay/swisseph`: ^0.3.0
- `react`: ^18.2.0
- `react-dom`: ^18.2.0

## Boyut

- Gzip: ~8 KB
- Brotli: ~7 KB
