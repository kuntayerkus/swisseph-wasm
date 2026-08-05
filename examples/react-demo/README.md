# SwissEph React Demo

@kuntay/swisseph ve @kuntay/swisseph-react-ui kullanarak hazırlanmış interaktif natal harita demo uygulaması.

## Özellikler

- ✅ Gerçek zamanlı natal harita hesaplama
- ✅ Light/Dark tema desteği
- ✅ Responsive tasarım
- ✅ TypeScript + Vite + React 18
- ✅ Modern UI/UX

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build
```

## Kullanım

Demo uygulama varsayılan olarak:
- **Tarih:** 15 Mayıs 1990
- **Saat:** 14:30
- **Konum:** Ankara, Türkiye (39.93°N, 32.86°E)
- **Ev Sistemi:** Placidus

Temayı değiştirmek için sağ üst köşedeki butonu kullanın.

## Teknolojiler

- **Framework:** React 18
- **Build Tool:** Vite 5
- **Dil:** TypeScript 5
- **Astroloji:** @kuntay/swisseph
- **UI:** @kuntay/swisseph-react-ui

## Özelleştirme

`src/App.tsx` dosyasını düzenleyerek farklı doğum bilgileri girebilirsiniz:

```typescript
const jd = swe.dateToJulian(year, month, day, hour, minute);
const natalChart = swe.natalChart(jd, latitude, longitude, houseSystem);
```

## Lisans

AGPL-3.0

## Daha Fazla Örnek

Diğer örnek projeler için: https://github.com/kuntay/swisseph-wasm/tree/main/examples
