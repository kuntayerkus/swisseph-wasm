/**
 * Türetilmiş katmanın gerçek WASM build'i üzerinden entegrasyon testleri.
 *
 * Birim testleri (sect.test.ts, lots.test.ts) saf aritmetiği sınıyor; burada
 * ise kütüphanenin gerçek konumlarıyla uçtan uca çalıştığını doğruluyoruz.
 * Derlenmiş dist/ üzerinden gidiyor — kullanıcının göreceği yolun aynısı.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/*
 * Ev sistemi listesini ÜRETİLMİŞ sabitten statik olarak alıyoruz: test
 * kayıt anında (beforeAll'dan önce) gerekiyor, dolayısıyla dinamik dist
 * import'u iş görmez. Yan etkisi olmayan düz bir nesne — hesaplar hâlâ
 * dist/ üzerinden gidiyor.
 */
import { HOUSE_SYSTEM_NAMES } from '../src/generated/constants.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist', 'index.js');
const SRC = join(HERE, '..', 'src');
const DATA_DIR = join(HERE, '..', '..', 'data', 'ephe');

const hasBuild = existsSync(DIST);
const hasData = existsSync(join(DATA_DIR, 'sefstars.txt'));

/**
 * Bu dosya derlenmiş dist/'i test ediyor — kullanıcının göreceği artefaktın
 * aynısı. Bunun bir tuzağı var: src/ değişip dist/ yeniden derlenmezse
 * testler ESKİ kodu sınar ve düzeltilmiş bir hata hâlâ varmış gibi görünür
 * (bir kez tam olarak bu oldu). Bayatlığı sessiz bırakmıyoruz.
 */
function newestSourceTime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory()
      ? newestSourceTime(path)
      : statSync(path).mtimeMs);
  }
  return newest;
}

if (hasBuild && newestSourceTime(SRC) > statSync(DIST).mtimeMs) {
  throw new Error(
    'packages/core/dist/ bayat — src/ daha yeni.\n' +
    '  Entegrasyon testleri eski kodu sınardı. Önce: npm run build:ts',
  );
}

// Build yoksa testler anlamsız; sessizce geçmek yerine açıkça atlıyoruz.
const describeBuilt = hasBuild ? describe : describe.skip;

describeBuilt('türetilmiş katman — gerçek harita', () => {
  let mod: typeof import('../src/index.js');
  let swe: Awaited<ReturnType<typeof mod.createSwissEph>>;

  // Ankara, 1990-05-15 14:30 UT (yerel 17:30). Mayıs ortası — Güneş yukarıda.
  const LAT = 39.93, LON = 32.86;
  let jd: number;

  beforeAll(async () => {
    mod = await import(DIST);
    swe = await mod.createSwissEph();
    if (hasData) {
      const files: Record<string, Uint8Array> = {};
      for (const f of ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1', 'sefstars.txt']) {
        const p = join(DATA_DIR, f);
        if (existsSync(p)) files[f] = readFileSync(p);
      }
      swe.mountEphemeris(files);
    }
    jd = swe.julianDay(1990, 5, 15, 14.5);
  });

  afterAll(() => swe?.dispose());

  describe('sekt', () => {
    it('Mayıs öğleden sonrası gündüz haritası', () => {
      const result = swe.sect(jd, LAT, LON);
      expect(result.sect).toBe('day');
      expect(result.borderline).toBe(false);
      // Varsayılan gerçek yükseklik: her enlemde doğru.
      expect(result.method).toBe('altitude');
    });

    it('ılıman enlemde iki yöntem aynı sonucu veriyor', () => {
      for (let hour = 0; hour < 24; hour += 2) {
        const t = swe.julianDay(1990, 5, 15, hour);
        expect(swe.sect(t, LAT, LON).sect, `saat ${hour}`)
          .toBe(swe.sect(t, LAT, LON, { method: 'ascendant' }).sect);
      }
    });

    /**
     * Kutup dairesinin ötesinde yükselen kısayolu bozuluyor: Swiss Ephemeris
     * orada AC/DC'yi takas ettiğinden (swehouse.c:998) "1.-6. evler ufkun
     * altındadır" varsayımı tersine dönüyor. Ölçüm: 70° enlemde vakaların
     * %18'i yanlış, Güneş ufkun 11° üstündeyken bile "gece" diyebiliyor.
     *
     * Varsayılan yöntem gerçek yüksekliği kullandığı için bundan etkilenmiyor.
     * Bu testler regresyonu engelliyor.
     */
    describe('kutup dairesi ötesi (Tromsø 69.65°N)', () => {
      const POLAR_LAT = 69.65, POLAR_LON = 18.96;

      it('gece yarısı güneşinde gündüz diyor', () => {
        // 21 Haziran, gece yarısı: Tromsø\'da Güneş batmaz.
        const midnight = swe.julianDay(2024, 6, 21, 22);   // yerel ~00:00
        const result = swe.sect(midnight, POLAR_LAT, POLAR_LON);
        const { altitude } = swe.horizontal(midnight, mod.Body.Sun, POLAR_LAT, POLAR_LON);
        expect(altitude).toBeGreaterThan(0);
        expect(result.sect).toBe('day');
      });

      it('kutup gecesinde gece diyor', () => {
        // 21 Aralık, öğle: Tromsø\'da Güneş doğmaz.
        const noon = swe.julianDay(2024, 12, 21, 11);
        const result = swe.sect(noon, POLAR_LAT, POLAR_LON);
        const { altitude } = swe.horizontal(noon, mod.Body.Sun, POLAR_LAT, POLAR_LON);
        expect(altitude).toBeLessThan(0);
        expect(result.sect).toBe('night');
      });

      it('varsayılan yöntem gün boyunca gerçek yükseklikle örtüşüyor', () => {
        for (let hour = 0; hour < 24; hour++) {
          const t = swe.julianDay(2024, 5, 1, hour);
          const { altitude } = swe.horizontal(t, mod.Body.Sun, POLAR_LAT, POLAR_LON);
          expect(swe.sect(t, POLAR_LAT, POLAR_LON).sect, `saat ${hour}, yükseklik ${altitude}`)
            .toBe(altitude >= 0 ? 'day' : 'night');
        }
      });

      it('yükselen kısayolu burada GERÇEKTEN ayrışıyor (belgelenen sınır)', () => {
        let disagreements = 0;
        for (let hour = 0; hour < 24; hour++) {
          const t = swe.julianDay(2024, 5, 1, hour);
          if (swe.sect(t, POLAR_LAT, POLAR_LON).sect
              !== swe.sect(t, POLAR_LAT, POLAR_LON, { method: 'ascendant' }).sect) {
            disagreements++;
          }
        }
        // Ayrışma olmasaydı yukarıdaki uyarılar gereksiz olurdu; olduğunu
        // kayda geçiriyoruz ki belgelenen sınır gerçek kalsın.
        expect(disagreements).toBeGreaterThan(0);
      });
    });

    it('gece yarısı gece haritası', () => {
      const midnight = swe.julianDay(1990, 5, 15, 0);
      expect(swe.sect(midnight, LAT, LON).sect).toBe('night');
    });

    it('gün boyunca tam olarak bir kez gündüze, bir kez geceye geçer', () => {
      const sects: string[] = [];
      for (let hour = 0; hour < 24; hour++) {
        sects.push(swe.sect(swe.julianDay(1990, 5, 15, hour), LAT, LON).sect);
      }
      // Dairesel dizide geçiş sayısı 2 olmalı: bir doğuş, bir batış.
      let transitions = 0;
      for (let i = 0; i < sects.length; i++) {
        if (sects[i] !== sects[(i + 1) % sects.length]) transitions++;
      }
      expect(transitions).toBe(2);
      expect(sects).toContain('day');
      expect(sects).toContain('night');
    });
  });

  describe('ev sistemi ikamesi (kutup dairesi)', () => {
    /**
     * Placidus, Koch, Gauquelin ve Sunshine kutup dairesinin ötesinde
     * tanımsız. Swiss Ephemeris orada sessizce Porphyry'ye geçip -1
     * döndürüyor ama cusps'ı GEÇERLİ değerlerle dolduruyor — yani -1 bir
     * hata değil, uyarı. Bunu hata sanmak kütüphaneyi yüksek enlemlerde
     * tamamen kullanılamaz yapardı.
     */
    it('ılıman enlemde ikame yok', () => {
      const h = swe.houses(jd, LAT, LON, 'P');
      expect(h.substituted).toBe(false);
      expect(h.requestedSystem).toBe('P');
      expect(h.warning).toBeNull();
    });

    it('kutup dairesi ötesinde Placidus istisna DEĞİL, ikame bildiriyor', () => {
      const polar = swe.julianDay(2024, 6, 21, 12);
      const h = swe.houses(polar, 69.65, 18.96, 'P');
      expect(h.substituted).toBe(true);
      expect(h.warning).toMatch(/polar|Porphyry/i);
      // Asıl mesele: veri geçerli ve kullanılabilir olmalı.
      expect(h.cusps).toHaveLength(12);
      for (const cusp of h.cusps) {
        expect(cusp).toBeGreaterThanOrEqual(0);
        expect(cusp).toBeLessThan(360);
      }
      expect(new Set(h.cusps).size).toBe(12);   // hepsi sıfır değil
    });

    it('kutup dairesi ötesinde Porphyry ikame gerektirmiyor', () => {
      const polar = swe.julianDay(2024, 6, 21, 12);
      expect(swe.houses(polar, 69.65, 18.96, 'O').substituted).toBe(false);
    });
  });

  /*
   * Cusp SAYISI, ev sistemine göre.
   *
   * Okuma sabit 13 double'a kodlanmıştı, dolayısıyla 'G' 36 sektörün yalnızca
   * 12'sini döndürüyordu. Dönen 12 değer gerçek olduğu için hiçbir şey bozuk
   * görünmüyordu ve kırpılma belgelere de geçmişti.
   *
   * Test ÜRETİLMİŞ liste üzerinde döngü kuruyor: gelecekte eklenen bir ev
   * sistemi kendiliğinden kapsanır. Elle seçilmiş birkaç sistemi denemek tam
   * olarak bu hatanın kaçmasına izin veren şeydi.
   */
  describe('cusp sayısı ev sistemine göre', () => {
    const systems = Object.keys(HOUSE_SYSTEM_NAMES);

    it('üretilmiş liste boş değil ve G içeriyor', () => {
      expect(systems.length).toBeGreaterThan(20);
      expect(systems).toContain('G');
    });

    for (const code of Object.keys(HOUSE_SYSTEM_NAMES)) {
      const expected = code.toUpperCase() === 'G' ? 36 : 12;
      it(`'${code}' (${HOUSE_SYSTEM_NAMES[code]}) → ${expected} cusp`, () => {
        const h = swe.houses(jd, LAT, LON, code);
        expect(h.cusps).toHaveLength(expected);
        // Hepsi gerçek değer olmalı — kırpmayı düzeltirken yerine sıfır
        // doldurmak, sessiz kırpmadan daha iyi olmazdı.
        for (const cusp of h.cusps) {
          expect(Number.isFinite(cusp)).toBe(true);
          expect(cusp).toBeGreaterThanOrEqual(0);
          expect(cusp).toBeLessThan(360);
        }
        expect(new Set(h.cusps).size).toBe(expected);
      });
    }

    /**
     * Gauquelin sektörleri ~10°lik adımlarla ve SAAT YÖNÜNDE sayılıyor
     * (swehouse.c: "Gauquelin sectors are counted in clockwise direction").
     * 36 sektör × 10° = 360°, yani komşu sektörler arasındaki fark kabaca
     * −10° olmalı.
     */
    it('G sektörleri saat yönünde ~10° aralıklı', () => {
      const h = swe.houses(jd, LAT, LON, 'G');
      expect(h.cusps).toHaveLength(36);

      let total = 0;
      for (let i = 1; i < h.cusps.length; i++) {
        // 0/360 sarmalını hesaba katarak imzalı fark.
        let step = h.cusps[i] - h.cusps[i - 1];
        if (step > 180) step -= 360;
        if (step < -180) step += 360;
        expect(step).toBeLessThan(0);            // saat yönü
        expect(Math.abs(step)).toBeGreaterThan(2);
        expect(Math.abs(step)).toBeLessThan(30);
        total += step;
      }
      // 35 adım × ~−10° ≈ −350°
      expect(total).toBeGreaterThan(-360);
      expect(total).toBeLessThan(-300);
    });

    it('G büyük/küçük harf duyarsız — C toupper kullanıyor', () => {
      expect(swe.houses(jd, LAT, LON, 'g').cusps).toHaveLength(36);
    });

    /**
     * Kutup dairesi ötesinde 'G' tanımsız: CalcH Porphyry'ye düşüyor ve
     * swe_houses_armc_ex2 ito'yu 12'ye indiriyor (swehouse.c:665). Orada 36
     * okumak, 24'ü sıfır olan bir dizi döndürürdü — kırpmayı düzeltirken
     * yerine sahte veri koymak olurdu.
     */
    it('kutup dairesi ötesinde G, 36 değil 12 cusp veriyor (sıfır dolgu yok)', () => {
      const polar = swe.julianDay(2024, 6, 21, 12);
      const h = swe.houses(polar, 69.65, 18.96, 'G');
      expect(h.substituted).toBe(true);
      expect(h.cusps).toHaveLength(12);
      for (const cusp of h.cusps) expect(cusp).not.toBe(0);
      expect(new Set(h.cusps).size).toBe(12);
    });

    /**
     * Tamponlar çağrılar arasında yeniden kullanılıyor. 36 sektörlük bir
     * çağrının ardından 12 evlik bir çağrı yapmak, bayat sektör verisini
     * sızdırmamalı — ve tersi de bayat sıfır okumamalı.
     */
    it('G ve 12-ev çağrıları birbirini kirletmiyor', () => {
      const g1 = swe.houses(jd, LAT, LON, 'G');
      const p = swe.houses(jd, LAT, LON, 'P');
      const g2 = swe.houses(jd, LAT, LON, 'G');
      expect(p.cusps).toHaveLength(12);
      expect(g2.cusps).toHaveLength(36);
      expect(g2.cusps).toEqual(g1.cusps);
    });
  });

  describe('lotlar', () => {
    it('tek çağrıda sekt, noktalar ve lotlar', () => {
      const { sect, points, lots } = swe.lots(jd, { latitude: LAT, longitude: LON });
      expect(sect.sect).toBe('day');
      expect(points.ascendant).toBeCloseTo(206.622, 2);
      expect(Object.keys(lots).length).toBeGreaterThan(10);
    });

    it('Şans + Ruh = 2 × Yükselen (gerçek konumlarla)', () => {
      const { points, lots } = swe.lots(jd, { latitude: LAT, longitude: LON });
      const sum = ((lots.Fortune.longitude + lots.Spirit.longitude) % 360 + 360) % 360;
      const twiceAsc = ((2 * points.ascendant) % 360 + 360) % 360;
      expect(sum).toBeCloseTo(twiceAsc, 8);
    });

    it('sekt elle geçilebiliyor', () => {
      const auto = swe.lots(jd, { latitude: LAT, longitude: LON });
      const forced = swe.lots(jd, { latitude: LAT, longitude: LON, sect: 'night' });
      expect(auto.lots.Fortune.longitude).not.toBeCloseTo(forced.lots.Fortune.longitude, 3);
      expect(forced.lots.Fortune.sectUsed).toBe('night');
    });

    it('ev sistemi değişince Yükselen sabit, lotlar sabit', () => {
      // Şans Noktası yalnızca Asc, Güneş ve Ay'a bağlı; ev sistemi Asc'ı
      // değiştirmediği için sonuç da değişmemeli.
      const placidus = swe.lots(jd, { latitude: LAT, longitude: LON, houseSystem: 'P' });
      const koch = swe.lots(jd, { latitude: LAT, longitude: LON, houseSystem: 'K' });
      expect(placidus.lots.Fortune.longitude).toBeCloseTo(koch.lots.Fortune.longitude, 9);
    });
  });

  describe('yıldız kürasyonu', () => {
    const itData = hasData ? it : it.skip;

    itData('kraliyet yıldızlarının hepsi katalogda bulunuyor', () => {
      for (const star of mod.ROYAL_STARS) {
        const found = swe.fixedStar(mod.byDesignation(star.designation), jd);
        expect(found.longitude, star.name).toBeGreaterThanOrEqual(0);
        expect(found.longitude, star.name).toBeLessThan(360);
      }
    });

    /**
     * Kürasyon listeleri elle yazıldı; bir yazım hatası yalnızca çalışma
     * anında ortaya çıkardı. Hepsini katalogda arayıp doğruluyoruz.
     */
    itData('tüm kürasyon listelerindeki yıldızlar çözümleniyor', () => {
      // CURATED_STARS katalogdan üretiliyor, ama üretimin doğru olduğunu
      // ancak gerçekten arayarak anlarız: adlandırma alanındaki bir hata
      // yalnızca çalışma anında ortaya çıkardı.
      const all = mod.CURATED_STARS;
      const failures: string[] = [];
      for (const star of all) {
        try {
          swe.fixedStar(mod.byDesignation(star.designation), jd);
        } catch (error) {
          failures.push(`${star.name} (${star.designation}): ${(error as Error).message}`);
        }
      }
      expect(failures).toEqual([]);
    });

    itData('adlandırmayla arama, yazım belirsizliğini ortadan kaldırıyor', () => {
      // sefstars.txt "Zubenelgenubi" ve "Zuben Elgenubi" olarak iki kez
      // içeriyor; hangisinin döneceği qsort kararlılığına bağlı. Adlandırma
      // ile arama tek bir kaydı gösterir.
      const byName = swe.fixedStar(mod.byDesignation('al-2Lib'), jd);
      expect(byName.resolvedName).toContain('al-2Lib');
      expect(byName.longitude).toBeGreaterThanOrEqual(0);
    });

    itData('Regulus 1990\'da Aslan\'ın son derecesinde', () => {
      // Presesyon Regulus'u 2011-2012 civarında Başak'a taşıdı; 1990'da
      // hâlâ Aslan'ın sonunda olmalı. Kürasyon notunun doğrulaması.
      const regulus = swe.fixedStar(mod.byDesignation('alLeo'), jd);
      expect(regulus.longitude).toBeGreaterThan(149);
      expect(regulus.longitude).toBeLessThan(150);
    });

    it('findCuratedStar ada göre buluyor', () => {
      expect(mod.findCuratedStar('Aldebaran')?.designation).toBe('alTau');
      expect(mod.findCuratedStar('aldebaran')?.designation).toBe('alTau');
      expect(mod.findCuratedStar('YokBöyleBirYıldız')).toBeUndefined();
    });

    it('gruplar beklenen boyutta ve çakışmalar korunuyor', () => {
      expect(mod.ROYAL_STARS).toHaveLength(4);
      expect(mod.BEHENIAN_STARS).toHaveLength(15);
      expect(mod.CURATED_STARS.length).toBeGreaterThan(60);

      // 'bright' grubu katalogdan nesnel türetiliyor; sınırın gerçekten
      // uygulandığını doğrula.
      for (const star of mod.BRIGHT_STARS) {
        expect(star.magnitude, star.name).toBeLessThan(mod.BRIGHT_MAGNITUDE_LIMIT);
      }
      // Referans noktaları (galaktik kutup vb.) sızmamalı.
      for (const star of mod.CURATED_STARS) {
        expect(star.magnitude, star.name).not.toBe(0);
        expect(star.name.startsWith('#'), star.name).toBe(false);
      }
      // Aldebaran, Regulus, Antares her iki listede.
      const behenianNames = mod.BEHENIAN_STARS.map((s) => s.name);
      for (const name of ['Aldebaran', 'Regulus', 'Antares']) {
        expect(behenianNames).toContain(name);
      }
    });
  });

  /*
   * REQUIRES_EPHEMERIS_FILE ve eksik dosya hatası.
   *
   * Body.Chiron, Body.Pluto'nun yanında duruyor ve tipte hiçbir fark yok, ama
   * gezegenler eksik dosyada Moshier'e düşerken asteroidler PATLIYOR. "Tüm
   * cisimler üzerinde döngü kur" diyen bir kullanıcı, Moshier modunda tam
   * gezegenlerde çalışıp Chiron'da patlayan kod yazıyordu. Ayrımın makine
   * tarafından okunabilir hâli bu küme.
   */
  describe('REQUIRES_EPHEMERIS_FILE', () => {
    /** Veri YÜKLENMEMİŞ ayrı bir örnek — Moshier modunu yalıtmak için. */
    let bare: Awaited<ReturnType<typeof mod.createSwissEph>>;

    beforeAll(async () => { bare = await mod.createSwissEph(); });
    afterAll(() => bare?.dispose());

    it('gezegenler kümede DEĞİL ve Moshier\'e düşüyor', () => {
      const planets = [
        mod.Body.Sun, mod.Body.Moon, mod.Body.Mercury, mod.Body.Venus,
        mod.Body.Mars, mod.Body.Jupiter, mod.Body.Saturn, mod.Body.Uranus,
        mod.Body.Neptune, mod.Body.Pluto,
      ];
      for (const body of planets) {
        expect(mod.REQUIRES_EPHEMERIS_FILE.has(body)).toBe(false);
        const p = bare.calc(jd, body);
        expect(p.ephemeris, `body ${body}`).toBe('moshier');
      }
    });

    it('kümedeki her cisim veri olmadan HATA veriyor', () => {
      expect(mod.REQUIRES_EPHEMERIS_FILE.size).toBeGreaterThan(0);
      for (const body of mod.REQUIRES_EPHEMERIS_FILE) {
        expect(() => bare.calc(jd, body), `body ${body}`).toThrow();
      }
    });

    it('Chiron ve Pholus kümede — Pluto\'nun yanında dururlar ama farklıdırlar', () => {
      expect(mod.REQUIRES_EPHEMERIS_FILE.has(mod.Body.Chiron)).toBe(true);
      expect(mod.REQUIRES_EPHEMERIS_FILE.has(mod.Body.Pholus)).toBe(true);
      expect(mod.REQUIRES_EPHEMERIS_FILE.has(mod.Body.Pluto)).toBe(false);
    });

    /** Kümeye göre süzülen bir döngü Moshier modunda patlamamalı. */
    it('kümeyle süzülen döngü Moshier modunda güvenli', () => {
      const all = Object.values(mod.Body).filter((b): b is number =>
        typeof b === 'number' && b >= 0 && b <= 9);
      const safe = all.filter((b) => !mod.REQUIRES_EPHEMERIS_FILE.has(b));
      expect(safe.length).toBeGreaterThan(0);
      for (const body of safe) expect(() => bare.calc(jd, body)).not.toThrow();
    });

    /*
     * Eksik dosya hatası EYLEME DÖNÜK olmalı.
     *
     * SE'nin kendi metni sanal WASM dosya sistemindeki bir yolu gösteriyor
     * ('.:/users/ephe/'), yani okuyanı makinesinde var olmayan bir dizine
     * bakmaya yönlendiriyor. Ham metin kaybolmuyor, detail'de duruyor.
     */
    it('eksik efemeris hatası ne yapılacağını söylüyor', () => {
      let error: unknown;
      try { bare.calc(jd, mod.Body.Chiron); } catch (e) { error = e; }

      expect(error).toBeInstanceOf(mod.SwissEphError);
      const err = error as InstanceType<typeof mod.SwissEphError>;

      // Eyleme dönük: dosya adı, paket, nasıl bağlanacağı.
      expect(err.message).toContain('seas_18.se1');
      expect(err.message).toContain('mountEphemeris');
      expect(err.message).toMatch(/@kuntay\/swisseph-data/);
      // Neden Moshier'e düşmediğini de söylüyor.
      expect(err.message).toMatch(/asteroids.*cannot|cannot.*Moshier/i);

      // Sanal yolu ARTIK MESAJDA GÖSTERMİYOR — yanlış yere yönlendiriyordu.
      expect(err.message).not.toContain('/users/ephe');

      // Ama ham serr kaybolmuyor: detail'de ve missingFile'da erişilebilir.
      expect(err.detail).toContain('not found in PATH');
      expect(err.missingFile).toBe('seas_18.se1');
      expect(err.fn).toBe('swe_calc_ut');
    });

    it('eksik dosya dışındaki hatalarda missingFile null', () => {
      const err = new mod.SwissEphError('something else', 'swe_calc_ut');
      expect(err.missingFile).toBeNull();
    });
  });
});
