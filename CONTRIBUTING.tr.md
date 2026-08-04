# swisseph-wasm'e Katkıda Bulunma

*English · [Türkçe](CONTRIBUTING.tr.md)*

swisseph-wasm projesine katkıda bulunmayı düşündüğünüz için teşekkürler! Bu belge, katkıda bulunmak için rehberler ve talimatlar sağlar.

## İçindekiler

- [Davranış Kuralları](#davranış-kuralları)
- [Başlangıç](#başlangıç)
- [Geliştirme Kurulumu](#geliştirme-kurulumu)
- [Kodlama Standartları](#kodlama-standartları)
- [Test Gereksinimleri](#test-gereksinimleri)
- [Commit Mesajı Konvansiyonu](#commit-mesajı-konvansiyonu)
- [Pull Request Süreci](#pull-request-süreci)
- [Hata Bildirimi](#hata-bildirimi)

## Davranış Kuralları

Lütfen etkileşimlerinizde saygılı ve yapıcı olun. Bu proje tüm geçmiş ve deneyim seviyelerinden katkıda bulunanları memnuniyetle karşılar.

## Başlangıç

1. Repository'yi fork edin
2. Fork'unuzu klonlayın: `git clone https://github.com/KULLANICI_ADINIZ/swisseph-wasm.git`
3. Bağımlılıkları yükleyin: `npm install`
4. Bir branch oluşturun: `git checkout -b feature/ozellikoubunuzun-adi`

## Geliştirme Kurulumu

### Önkoşullar

- Node.js >= 20
- npm >= 11
- Docker (WASM derlemeleri için)
- Git

### İlk Kurulum

```bash
# Bağımlılıkları yükle
npm install

# WASM modülünü derle (Docker gerektirir)
npm run build:wasm

# C headerlarından sabitleri üret
npm run build:constants

# TypeScript'i derle
npm run build:ts

# Tüm kontrolleri çalıştır
npm run check
```

### Proje Yapısı

```
swisseph-wasm/
├── packages/
│   ├── core/           # Ana Swiss Ephemeris WASM wrapper
│   ├── data/           # Efemeris veri dosyaları (isteğe bağlı)
│   ├── asteroids/      # Asteroid efemeris dosyaları
│   └── mcp/            # Model Context Protocol sunucusu
├── tools/              # Derleme ve doğrulama scriptleri
├── vendor/swisseph/    # Swiss Ephemeris C kaynağı
└── examples/           # Kullanım örnekleri
```

## Kodlama Standartları

### TypeScript

- Strict mod kullanın (tsconfig.json'da `"strict": true`)
- `let` yerine `const` tercih edin, `var` kullanmayın
- Fonksiyon parametreleri ve dönüş tipleri için açık tip tanımlamaları kullanın
- `any` tipinden kaçının; gerekirse `unknown` kullanın
- Yalnızca public API yüzeyini export edin; internals'ı private tutun

### JavaScript (Araçlar ve Scriptler)

- ES modülleri kullanın (`import`/`export`)
- Yeni kodda CommonJS kullanmayın
- Uygulanabilir durumlarda Airbnb stil rehberini takip edin

### Dosya İsimlendirme

- TypeScript: `.ts` uzantısı
- JavaScript: ES modülleri için `.js` veya `.mjs`
- Test dosyaları: `.test.ts` veya `.spec.ts`

### Dokümantasyon

- Tüm public API'ler JSDoc yorumlarına sahip olmalı
- Karmaşık fonksiyonlar için örnekler ekleyin
- Kenar durumları ve limitasyonları dokümante edin
- README dosyalarını güncel tutun

## Test Gereksinimleri

### PR Göndermeden Önce

Tüm testler geçmeli:

```bash
npm test
```

### Test Coverage

Temel işlevsellikte %90+ coverage hedefliyoruz. Coverage çalıştırma:

```bash
npx vitest run --coverage
```

### Test Türleri

1. **Birim Testleri**: Bireysel fonksiyonları izole olarak test eder
2. **Entegrasyon Testleri**: Bileşenler arası etkileşimi test eder
3. **Golden Testler**: Native C derlemesine karşı sayısal doğruluğu doğrular
4. **Smoke Testleri**: Veri dosyaları olmadan temel işlevselliği test eder

### Yeni Test Ekleme

Yeni özellikler eklerken şunları dahil edin:

- Temel mantık için birim testleri
- Diğer modüllerle etkileşim varsa entegrasyon testleri
- Sayısal hesaplamalar yapıyorsa golden testler

Örnek test yapısı:

```typescript
import { describe, it, expect } from 'vitest';
import { calc } from '../src/index.js';

describe('calc', () => {
  it('should return planetary positions', () => {
    const result = calc(2451545.0, Body.Sun);
    expect(result.longitude).toBeCloseTo(279.28, 2);
  });
});
```

## Commit Mesajı Konvansiyonu

[Conventional Commits](https://www.conventionalcommits.org/) standardını takip ediyoruz:

```
<tip>(<kapsam>): <açıklama>

[isteğe bağlı gövde]

[isteğe bağlı altbilgi(ler)]
```

### Tipler

- `feat`: Yeni özellik
- `fix`: Hata düzeltme
- `docs`: Dokümantasyon değişiklikleri
- `style`: Kod stili değişiklikleri (formatlama, vb.)
- `refactor`: Davranış değişikliği olmayan kod refactoring'i
- `perf`: Performans iyileştirmeleri
- `test`: Test ekleme veya güncelleme
- `chore`: Derleme süreci, araçlar veya yardımcı dosya değişiklikleri

### Örnekler

```
feat(lots): Lot of Basis hesaplama ekle

Fortune ve Spirit arasındaki kısa yayı kullanarak geleneksel
Lot of Basis'i uygular, sect-farklı aynalama ile.

Kapatır #42

---

fix(wasm): Ev hesaplama kutup dairesi kenar durumunu ele al

Ascendant 66.5° enleminin ötesinde yanlış değiştiriliyordu.
Artık swehouse.c'nin dahili kutup işlemesini kullanıyor.

Düzeltir #38

---

docs(api): Ayanamsa dokümantasyonu ekle

Tüm 48 sidereal modu geleneksel bağlamları ve önerilen
kullanım senaryoları ile dokümante eder.
```

## Pull Request Süreci

### PR Açmadan Önce

1. Tüm testlerin yerelde geçtiğinden emin olun
2. `npm run check` komutunu çalıştırarak tüm kalite kapılarını doğrulayın
3. API değiştiyse dokümantasyonu güncelleyin
4. Yeni işlevsellik için test ekleyin
5. En son `main` branch'ine rebase yapın

### PR Şablonu

PR açarken lütfen şunları dahil edin:

- **Açıklama**: Bu PR ne yapıyor?
- **Motivasyon**: Bu neden gerekli?
- **Test Etme**: Nasıl test edildi?
- **Breaking Changes**: Mevcut API'leri bozuyor mu?
- **İlgili Sorunlar**: İlgili sorunlara link verin

### İnceleme Süreci

1. En az bir bakıcı onaylamalı
2. Tüm CI kontrolleri geçmeli
3. Kod coverage önemli ölçüde azalmamalı
4. Gerekirse dokümantasyon güncellenmiş olmalı

### Birleştirme

- Feature branch'leri için squash merge
- Hata düzeltmeleri için rebase merge
- Paylaşılan branch'lere asla force push yapmayın

## Hata Bildirimi

### Hata Raporları

[Hata Raporu Şablonu](.github/ISSUE_TEMPLATE/bug_report.md)'nu kullanın:

- Hatayı açıkça tanımlayın
- Tekrarlama adımları sağlayın
- Beklenen vs gerçek davranışı dahil edin
- Çevre detaylarını paylaşın (Node versiyonu, OS, vb.)
- Uygulanabilirsa kod parçacıkları ekleyin

### Özellik İstekleri

[Özellik İsteği Şablonu](.github/ISSUE_TEMPLATE/feature_request.md)'nu kullanın:

- İstenen özelliği tanımlayın
- Kullanım durumunu açıklayın
- Mümkünse örnekler sağlayın
- Diğer kütüphanelerdeki benzer uygulamalardan bahsedin

### Dokümantasyon İyileştirmeleri

[Dokümantasyon İyileştirme Şablonu](.github/ISSUE_TEMPLATE/docs_improvement.md)'nu kullanın:

- Hangi dokümantasyonun iyileştirilmesi gerektiğini belirtin
- Belirli değişiklikler önerin
- Gerekirse bağlam sağlayın

## Sorularınız mı Var?

Katkıda bulunmadan önce sorularınız varsa:

1. Mevcut [dokümantasyonu](docs/) kontrol edin
2. Benzer sorular için kapatılmış sorunları arayın
3. GitHub Discussions'da tartışma açın

swisseph-wasm'e katkıda bulunduğunuz için teşekkürler! 🙏
