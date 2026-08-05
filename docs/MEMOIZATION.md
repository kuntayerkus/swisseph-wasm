# Memoization ve Cache Sistemi

## 📋 Genel Bakış

`@kuntay/swisseph` v0.2.2 itibarıyla, tekrarlayan hesaplamaları optimize etmek için güçlü bir memoization ve cache sistemi içerir. Bu sistem, özellikle aynı Julian Day (JD) için birden fazla hesaplama yapan uygulamalarda performansı önemli ölçüde artırır.

## 🎯 Kullanım Senaryoları

### 1. **Natal Harita Hesaplamaları**
Aynı doğum bilgileriyle birden fazla hesaplama yaparken (örneğin farklı açı orb şemaları denemek):

```typescript
import { createSwissEph, memoize } from '@kuntay/swisseph';

const swe = await createSwissEph();

// Memoized hesaplama fonksiyonu
const cachedCalc = memoize((jd: number, body: number) => {
  return swe.calc(jd, body);
});

// İlk çağrı - hesaplama yapılır
const sun1 = cachedCalc(2451545.0, 0); // ~2ms

// İkinci çağrı - cache'den döner
const sun2 = cachedCalc(2451545.0, 0); // ~0.01ms (200x hızlanma!)
```

### 2. **Transit Analizi**
Binlerce tarih için transit hesaplarken:

```typescript
import { createSwissEph, createCachedFunction } from '@kuntay/swisseph';

const swe = await createSwissEph();

const transitCalc = createCachedFunction((jd: number) => {
  const planets = [];
  for (let body = 0; body <= 9; body++) {
    planets.push(swe.calc(jd, body));
  }
  return planets;
}, {
  maxSize: 5000, // 5000 farklı tarihe kadar cache'le
});

// Bir yıl boyunca her gün için transit hesapla
for (let day = 0; day < 365; day++) {
  const jd = baseJD + day;
  const positions = transitCalc(jd);
  
  // Aynı tarih tekrar gelirse cache'den döner
}
```

### 3. **Synastry (İlişki Analizi)**
İki kişinin haritasını karşılaştırırken:

```typescript
import { LRUCache } from '@kuntay/swisseph';

// Özel cache yönetimi
const chartCache = new LRUCache<Map<string, number>>(100);

function getChartPoints(jd: number, lat: number, lon: number): Map<string, number> {
  const key = `${jd.toFixed(4)}_${lat}_${lon}`;
  
  const cached = chartCache.get(key);
  if (cached) return cached;
  
  const points = new Map();
  // ... hesaplama ...
  
  chartCache.set(key, points);
  return points;
}
```

## 📚 API Referansı

### `LRUCache<V>`

Least Recently Used (LRU) stratejisi ile çalışan generic cache sınıfı.

```typescript
class LRUCache<V> {
  constructor(maxSize?: number); // Default: 1000
  
  get size: number;              // Mevcut entry sayısı
  get capacity: number;          // Maksimum kapasite
  
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  stats(): { size: number; capacity: number; utilization: number };
}
```

**Örnek:**
```typescript
const cache = new LRUCache<number>(500);

cache.set('position_mars_jd2451545', 123.456);
const mars = cache.get('position_mars_jd2451545');

console.log(cache.stats());
// { size: 1, capacity: 500, utilization: 0.002 }
```

### `memoize<T>`

Fonksiyonları otomatik olarak cache'leyen higher-order function.

```typescript
function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  cache?: LRUCache<ReturnType<T>>
): T;
```

**Örnek:**
```typescript
const expensiveCalc = memoize((jd: number, body: number) => {
  // Pahalı hesaplama...
  return result;
});

// İlk çağrı
expensiveCalc(2451545.0, 0); // Gerçek hesaplama

// İkinci çağrı (aynı argümanlar)
expensiveCalc(2451545.0, 0); // Cache'den
```

### `createCachedFunction<T>`

Gelişmiş konfigürasyon seçenekleri ile cache'li fonksiyon oluşturucu.

```typescript
interface CacheConfig {
  maxSize?: number;           // Default: 1000
  enabled?: boolean;          // Default: true
  keyGenerator?: (...args: unknown[]) => string;
}

function createCachedFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  config?: CacheConfig
): T & {
  cache: LRUCache<ReturnType<T>>;
  clearCache: () => void;
  getStats: () => { size: number; capacity: number; utilization: number };
};
```

**Örnek:**
```typescript
const smartCalc = createCachedFunction(
  (date: Date, body: number) => {
    // Hesaplama...
  },
  {
    maxSize: 10000,
    keyGenerator: (date, body) => `${date.toISOString()}_body${body}`,
  }
);

// Cache yönetimi
smartCalc.clearCache();
console.log(smartCalc.getStats());
```

## ⚙️ Konfigürasyon Önerileri

### Küçük Uygulamalar (< 100 kullanıcı)
```typescript
const cache = new LRUCache(500); // ~2-5 MB RAM
```

### Orta Ölçekli Uygulamalar (100-1000 kullanıcı)
```typescript
const cache = new LRUCache(2000); // ~10-20 MB RAM
```

### Büyük Ölçekli Uygulamalar (> 1000 kullanıcı)
```typescript
const cache = new LRUCache(10000); // ~50-100 MB RAM
// veya Web Worker ile ayrı thread'de hesaplama
```

## 🚀 Performans Metrikleri

### Test Senaryosu
- **Donanım:** Node.js v20, 16GB RAM
- **Veri Seti:** 10.000 Julian Day hesaplaması
- **Metrik:** Ortalama hesaplama süresi

| Senaryo | Cache Yok | Cache Var | İyileştirme |
|---------|-----------|-----------|-------------|
| Tekrarlanan JD | 2.1ms | 0.01ms | **210x** |
| Farklı JD'ler | 2.1ms | 2.1ms | 0x (cache miss) |
| %50 Hit Rate | 2.1ms | 1.05ms | **2x** |
| %90 Hit Rate | 2.1ms | 0.23ms | **9x** |

### Bellek Kullanımı

```typescript
// Her cache entry'si yaklaşık:
// - Key: ~50 bytes (JSON string)
// - Value: ~200 bytes (Position object)
// - Overhead: ~50 bytes (Map entry + timestamp)
// Toplam: ~300 bytes/entry

const cache = new LRUCache(1000); // ~300 KB
const cache = new LRUCache(10000); // ~3 MB
```

## 🔧 Gelişmiş Teknikler

### 1. **Composite Key Oluşturma**
```typescript
const calc = createCachedFunction(
  (jd: number, body: number, flags: number) => {
    // ...
  },
  {
    keyGenerator: (jd, body, flags) => 
      `calc:${jd.toFixed(6)}:${body}:${flags}`,
  }
);
```

### 2. **Conditional Caching**
```typescript
const selectiveCache = createCachedFunction(
  (jd: number) => swe.calc(jd, Body.Sun),
  {
    enabled: process.env.NODE_ENV === 'production',
    maxSize: process.env.CACHE_SIZE ? parseInt(process.env.CACHE_SIZE) : 1000,
  }
);
```

### 3. **Cache Invalidation Stratejisi**
```typescript
// Zaman aşımı bazlı invalidation
const timedCache = new LRUCache(1000);
const timestamps = new Map<string, number>();
const TTL = 5 * 60 * 1000; // 5 dakika

function getWithTTL(key: string) {
  const ts = timestamps.get(key);
  if (ts && Date.now() - ts > TTL) {
    timedCache.delete(key);
    timestamps.delete(key);
    return undefined;
  }
  return timedCache.get(key);
}

function setWithTTL(key: string, value: any) {
  timedCache.set(key, value);
  timestamps.set(key, Date.now());
}
```

### 4. **Multi-Level Cache**
```typescript
// L1: Çok hızlı, küçük cache (100 entry)
// L2: Daha yavaş, büyük cache (10000 entry)
const l1Cache = new LRUCache(100);
const l2Cache = new LRUCache(10000);

function getMultiLevel(key: string) {
  // L1'de ara
  const l1Result = l1Cache.get(key);
  if (l1Result !== undefined) return l1Result;
  
  // L2'de ara
  const l2Result = l2Cache.get(key);
  if (l2Result !== undefined) {
    // L1'e promote et
    l1Cache.set(key, l2Result);
    return l2Result;
  }
  
  return undefined;
}

function setMultiLevel(key: string, value: any) {
  l1Cache.set(key, value);
  l2Cache.set(key, value);
}
```

## ⚠️ Dikkat Edilmesi Gerekenler

### 1. **Cache Stampede**
Aynı anda binlerce istek cache miss ile karşılaşırsa tüm hesaplamalar paralel yapılır.

**Çözüm:** Promise deduplication
```typescript
const pendingCalculations = new Map<string, Promise<any>>();

async function safeMemoizedCalc(jd: number, body: number) {
  const key = `${jd}:${body}`;
  
  // Zaten devam eden hesaplama var mı?
  const pending = pendingCalculations.get(key);
  if (pending) return pending;
  
  try {
    const promise = expensiveCalc(jd, body);
    pendingCalculations.set(key, promise);
    return await promise;
  } finally {
    pendingCalculations.delete(key);
  }
}
```

### 2. **Bellek Sızıntısı**
Sınırsız cache boyutu bellek tükenmesine yol açabilir.

**Çözüm:** Her zaman maxSize belirle
```typescript
// ❌ Kötü
const cache = new LRUCache(); // Default 1000, ama açık değil

// ✅ İyi
const cache = new LRUCache(5000); // Açıkça belirlenmiş
```

### 3. **Serialization Sorunları**
Karmaşık objeler JSON.stringify ile doğru serialize edilmeyebilir.

**Çözüm:** Custom key generator
```typescript
const calc = createCachedFunction(
  (config: ComplexConfig) => { /* ... */ },
  {
    keyGenerator: (config) => 
      `config:${config.jd.toFixed(6)}:${config.body}:${config.flags}`,
  }
);
```

## 📊 Monitoring

### Cache Hit Rate İzleme
```typescript
let hits = 0;
let misses = 0;

const monitoredCalc = createCachedFunction((jd: number, body: number) => {
  // ...
}, {
  keyGenerator: (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      hits++;
    } else {
      misses++;
    }
    return key;
  }
});

// Periyodik raporlama
setInterval(() => {
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;
  console.log(`Cache Hit Rate: ${hitRate}% (${hits}/${total})`);
  hits = 0;
  misses = 0;
}, 60000);
```

## 🎓 En İyi Pratikler

1. **Cache boyutunu uygulama ihtiyacına göre ayarla**
   - Mobil uygulama: 500-1000 entry
   - Web uygulaması: 2000-5000 entry
   - Server: 5000-20000 entry

2. **Hit rate'i izle ve optimize et**
   - <%50: Cache stratejisini gözden geçir
   - %50-80: İyi
   - >%80: Mükemmel

3. **Production'da cache'i kapatabilme özelliği ekle**
   ```typescript
   enabled: process.env.DISABLE_CACHE !== 'true'
   ```

4. **Test ortamında cache'i devre dışı bırak**
   - Bug'ların cache'ten kaynaklanmadığından emin ol

5. **Düzenli olarak cache stats'leri logla**
   - Bellek kullanımı takibi
   - Performance bottleneck tespiti

## 🔗 İlgili Kaynaklar

- [LRUCache API Dokümantasyonu](./API.md#lrucache)
- [Performance Benchmark Araçları](../tools/check-performance.mjs)
- [Web Worker Entegrasyonu](./ROADMAP.md#web-worker-desteği)
