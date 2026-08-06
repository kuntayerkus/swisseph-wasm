/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: seasnam.txt (Astrodienst'in numaralı asteroid ad listesi)
 * Kanonik kaynak: https://github.com/aloistr/swisseph (Astrodienst)
 * Üreten: tools/generate-asteroid-names.mjs (2026-08-05)
 *
 * Adlar kaynaktan okundu, elle yazılmadı. Kürasyon kararı üreteçte:
 * ilk 100 numaralı asteroid + yayınlanan 16 küratörlü cisim.
 *
 * Yeniden üretmek için: node tools/generate-asteroid-names.mjs
 */
/** Numarası ve resmi adı bilinen bir asteroid. */
export interface NamedAsteroid {
    /** Küçük gezegen numarası — `asteroidBody()` ve `asteroidFile()` bunu alır. */
    number: number;
    /** MPC resmi adı, kaynaktan. */
    name: string;
}
/**
 * Genişletilmiş kademe: ilk 100 numaralı asteroid + 16 küratörlü cisim.
 *
 * Numaraya göre sıralı. Dosyaları pakete dahil DEĞİLDİR — seçici yükleme
 * için `loadAsteroids()` kullanılır.
 */
export declare const EXTENDED_ASTEROIDS: readonly NamedAsteroid[];
/** Numaradan ada; bilinmeyen numarada `undefined`. */
export declare const extendedAsteroidName: (number: number) => string | undefined;
//# sourceMappingURL=asteroid-names.d.ts.map