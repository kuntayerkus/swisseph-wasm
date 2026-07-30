import { describe, expect, it } from 'vitest';
import { determineSect, normalizeDegrees } from '../src/derived/sect.js';

describe('normalizeDegrees', () => {
  it('açıyı [0, 360) aralığına indirger', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(-370)).toBe(350);
    expect(normalizeDegrees(720.5)).toBeCloseTo(0.5, 12);
  });
});

describe('determineSect — yükselen yöntemi', () => {
  /**
   * Evler Yükselen'den itibaren artan boylam yönünde numaralanır; 1.-6. evler
   * ufkun altında, 7.-12. üstündedir. Dolayısıyla Güneş'in Asc'tan farkı
   * 180°'yi geçtiyse harita gündüzdür.
   */
  it('Güneş Yükselen\'in hemen üstündeyse (12. ev) gündüz', () => {
    // Asc 0°, Güneş 350° -> fark 350° -> 12. ev, ufkun üstünde
    expect(determineSect(350, 0).sect).toBe('day');
  });

  it('Güneş Yükselen\'in hemen altındaysa (1. ev) gece', () => {
    // Asc 0°, Güneş 10° -> fark 10° -> 1. ev, ufkun altında
    expect(determineSect(10, 0).sect).toBe('night');
  });

  it('Güneş Tepe Noktası yönündeyse gündüz ve en yüksek', () => {
    // Asc'tan 270° = MC yönü
    const result = determineSect(270, 0);
    expect(result.sect).toBe('day');
    expect(result.sunElevation).toBeCloseTo(90, 9);
  });

  it('Güneş IC yönündeyse gece ve en alçak', () => {
    const result = determineSect(90, 0);
    expect(result.sect).toBe('night');
    expect(result.sunElevation).toBeCloseTo(-90, 9);
  });

  it('Yükselen sıfırdan farklıyken de doğru — 360° sarması', () => {
    // Asc 350°, Güneş 20° -> fark 30° -> ufkun altında
    expect(determineSect(20, 350).sect).toBe('night');
    // Asc 20°, Güneş 350° -> fark 330° -> ufkun üstünde
    expect(determineSect(350, 20).sect).toBe('day');
  });

  /**
   * Ankara, 1990-05-15 14:30 UT. Asc ve Güneş konumları gerçek hesaptan.
   * Yerel saat 17:30, Mayıs ortası — Güneş kesinlikle ufkun üstünde.
   */
  it('gerçek harita: Ankara 1990-05-15 14:30 UT -> gündüz', () => {
    const result = determineSect(54.497, 206.622);
    expect(result.sect).toBe('day');
    expect(result.borderline).toBe(false);
  });

  it('Alçalan noktasında sınır durumu işaretlenir', () => {
    // Asc 0°, Güneş 180° = tam Alçalan -> yükseklik 0
    const result = determineSect(180, 0);
    expect(result.sunElevation).toBeCloseTo(0, 9);
    expect(result.borderline).toBe(true);
  });

  it('yükseliş anında (Asc üzerinde) sınır durumu işaretlenir', () => {
    const result = determineSect(0, 0);
    expect(Math.abs(result.sunElevation)).toBeCloseTo(0, 9);
    expect(result.borderline).toBe(true);
  });
});

describe('determineSect — alacakaranlık payı', () => {
  it('pay olmadan ufkun 3° altı gecedir', () => {
    // Asc 0°, Güneş 3° içeride -> yaklaşık -3° yükseklik
    expect(determineSect(3, 0).sect).toBe('night');
  });

  it('6° pay ile aynı harita gündüz olur', () => {
    const result = determineSect(3, 0, { twilightAllowance: 6 });
    expect(result.sect).toBe('day');
  });

  it('pay sekti değiştirebildiği için varsayılan 0 olmalı', () => {
    // Aynı girdi, farklı sonuç: bu yüzden varsayılan katı geometrik ufuk.
    expect(determineSect(3, 0).sect).not.toBe(
      determineSect(3, 0, { twilightAllowance: 6 }).sect,
    );
  });
});

describe('determineSect — yükseklik yöntemi', () => {
  it('gerçek yüksekliği kullanır', () => {
    expect(determineSect(0, 0, { method: 'altitude', sunAltitude: 30 }).sect).toBe('day');
    expect(determineSect(0, 0, { method: 'altitude', sunAltitude: -30 }).sect).toBe('night');
  });

  it('sunAltitude verilmezse sessizce yanlış cevap vermek yerine hata verir', () => {
    expect(() => determineSect(0, 0, { method: 'altitude' })).toThrow(/sunAltitude/);
  });

  it('ufka yakın yüksekliği sınır durumu sayar', () => {
    expect(determineSect(0, 0, { method: 'altitude', sunAltitude: 0.5 }).borderline).toBe(true);
    expect(determineSect(0, 0, { method: 'altitude', sunAltitude: 5 }).borderline).toBe(false);
  });
});
