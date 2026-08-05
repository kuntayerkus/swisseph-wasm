/**
 * Yönlendirme ve İlerletme Motoru (Directions & Progressions)
 * 
 * Astrolojide zaman teknikleri:
 * - Secondary Progressions (Sekonder İlerletmeler)
 * - Tertiary Progressions (Tersiyer İlerletmeler)
 * - Solar Arc Directions (Güneş Yayı Yönlendirmeleri)
 * - Primary Directions (Primer Yönlendirmeler)
 * 
 * @package @kuntay/swisseph-advanced
 */

import type { SwissEphemeris, PlanetPositions, HouseCusps } from '@kuntay/swisseph';
import { Body, Ayanamsa } from '@kuntay/swisseph';

export interface DirectionConfig {
  method: 'secondary' | 'tertiary' | 'solarArc' | 'primary';
  focusPoint?: Body; // Odak noktası (genellikle Güneş veya Yükselen)
  promissors?: Body[]; // Tetikleyici gezegenler
  aspects?: number[]; // Açılar (derece cinsinden)
  orb?: number; // Orb değeri
}

export interface DirectionEvent {
  age: number; // Yaş
  year: number; // Takvim yılı
  jd: number; // Julian Day
  method: string;
  promissor: Body; // Tetikleyici gezegen
  significator: Body; // Anlamlandırıcı nokta
  aspect: number; // Açı türü
  exactDegree: number; // Tam açı derecesi
  orbUsed: number; // Kullanılan orb
  applying: boolean; // Uyguluyor mu?
  description: string; // Yorum metni
}

export interface DirectionResult {
  natalJD: number;
  directionMethod: string;
  startDate: Date;
  endDate: Date;
  events: DirectionEvent[];
  totalEvents: number;
  ageRange: { start: number; end: number };
}

export class DirectionsEngine {
  private swe: SwissEphemeris;

  constructor(swe: SwissEphemeris) {
    this.swe = swe;
  }

  /**
   * Sekonder İlerletmeler (Secondary Progressions)
   * 1 gün = 1 yıl prensibi
   */
  calculateSecondaryProgressions(
    natalJD: number,
    birthDate: Date,
    maxAge: number = 100,
    config: Partial<DirectionConfig> = {}
  ): DirectionResult {
    const { 
      promissors = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn],
      aspects = [0, 60, 90, 120, 180],
      orb = 1.0
    } = config;

    const events: DirectionEvent[] = [];
    const startDate = birthDate;
    
    for (let age = 0; age <= maxAge; age++) {
      // 1 gün = 1 yıl kuralı
      const progressJD = natalJD + age;
      const progressDate = new Date(birthDate.getTime() + age * 365.25 * 24 * 60 * 60 * 1000);
      
      // İlerletilmiş gezegen pozisyonları
      const progressedPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        progressedPositions.set(body, this.swe.calc(progressJD, body));
      }

      // Natal pozisyonlar (significators)
      const natalPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        natalPositions.set(body, this.swe.calc(natalJD, body));
      }

      // Aspect kontrolü
      const ageEvents = this.findAspects(
        progressedPositions,
        natalPositions,
        age,
        progressDate.getFullYear(),
        progressJD,
        aspects,
        orb,
        'secondary'
      );

      events.push(...ageEvents);
    }

    return {
      natalJD,
      directionMethod: 'secondary',
      startDate,
      endDate: new Date(birthDate.getTime() + maxAge * 365.25 * 24 * 60 * 60 * 1000),
      events,
      totalEvents: events.length,
      ageRange: { start: 0, end: maxAge }
    };
  }

  /**
   * Tersiyer İlerletmeler (Tertiary Progressions)
   * 1 gün = 1 lunar ay (~27.3 gün) prensibi
   */
  calculateTertiaryProgressions(
    natalJD: number,
    birthDate: Date,
    maxAge: number = 100,
    config: Partial<DirectionConfig> = {}
  ): DirectionResult {
    const { 
      promissors = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars],
      aspects = [0, 60, 90, 120, 180],
      orb = 1.0
    } = config;

    const events: DirectionEvent[] = [];
    const lunarMonth = 27.321661; // Ortalama sinodik ay
    
    for (let age = 0; age <= maxAge; age += 0.25) { // Çeyrek yıl hassasiyeti
      // 1 gün = 1 lunar ay
      const daysToAdd = (age * 365.25) / lunarMonth;
      const progressJD = natalJD + daysToAdd;
      const progressDate = new Date(birthDate.getTime() + age * 365.25 * 24 * 60 * 60 * 1000);

      const progressedPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        progressedPositions.set(body, this.swe.calc(progressJD, body));
      }

      const natalPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        natalPositions.set(body, this.swe.calc(natalJD, body));
      }

      const ageEvents = this.findAspects(
        progressedPositions,
        natalPositions,
        age,
        progressDate.getFullYear(),
        progressJD,
        aspects,
        orb,
        'tertiary'
      );

      events.push(...ageEvents);
    }

    return {
      natalJD,
      directionMethod: 'tertiary',
      startDate: birthDate,
      endDate: new Date(birthDate.getTime() + maxAge * 365.25 * 24 * 60 * 60 * 1000),
      events,
      totalEvents: events.length,
      ageRange: { start: 0, end: maxAge }
    };
  }

  /**
   * Güneş Yayı Yönlendirmeleri (Solar Arc Directions)
   * Tüm gezegenler, Güneş'in katettiği mesafe kadar ilerler
   */
  calculateSolarArcDirections(
    natalJD: number,
    birthDate: Date,
    maxAge: number = 100,
    config: Partial<DirectionConfig> = {}
  ): DirectionResult {
    const { 
      promissors = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn],
      aspects = [0, 60, 90, 120, 180],
      orb = 1.0
    } = config;

    const events: DirectionEvent[] = [];
    
    // Natal Güneş pozisyonu
    const natalSun = this.swe.calc(natalJD, Body.Sun);

    for (let age = 0; age <= maxAge; age += 0.5) { // Yarım yıl hassasiyeti
      // İlerletilmiş Güneş
      const progressJD = natalJD + age;
      const progressedSun = this.swe.calc(progressJD, Body.Sun);
      
      // Güneş'in katettiği mesafe (solar arc)
      let solarArc = progressedSun.longitude - natalSun.longitude;
      if (solarArc < 0) solarArc += 360;

      const progressDate = new Date(birthDate.getTime() + age * 365.25 * 24 * 60 * 60 * 1000);

      // Tüm gezegenleri solar arc kadar ilerlet
      const arcDirectedPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        const natalPos = this.swe.calc(natalJD, body);
        let directedLongitude = natalPos.longitude + solarArc;
        if (directedLongitude >= 360) directedLongitude -= 360;

        // Diğer parametreleri aynı tut (basitleştirilmiş)
        arcDirectedPositions.set(body, {
          ...natalPos,
          longitude: directedLongitude
        });
      }

      const natalPositions = new Map<Body, PlanetPositions>();
      for (const body of promissors) {
        natalPositions.set(body, this.swe.calc(natalJD, body));
      }

      const ageEvents = this.findAspects(
        arcDirectedPositions,
        natalPositions,
        age,
        progressDate.getFullYear(),
        natalJD + age, // Yaklaşık JD
        aspects,
        orb,
        'solarArc'
      );

      events.push(...ageEvents);
    }

    return {
      natalJD,
      directionMethod: 'solarArc',
      startDate: birthDate,
      endDate: new Date(birthDate.getTime() + maxAge * 365.25 * 24 * 60 * 60 * 1000),
      events,
      totalEvents: events.length,
      ageRange: { start: 0, end: maxAge }
    };
  }

  /**
   * Açılık bulma motoru
   */
  private findAspects(
    progressed: Map<Body, PlanetPositions>,
    natal: Map<Body, PlanetPositions>,
    age: number,
    year: number,
    jd: number,
    aspects: number[],
    orb: number,
    method: string
  ): DirectionEvent[] {
    const events: DirectionEvent[] = [];

    for (const [promissor, progPos] of progressed.entries()) {
      for (const [significator, natPos] of natal.entries()) {
        if (promissor === significator) continue;

        const diff = Math.abs(progPos.longitude - natPos.longitude);
        const actualDiff = diff > 180 ? 360 - diff : diff;

        for (const aspect of aspects) {
          const orbDiff = Math.abs(actualDiff - aspect);
          
          if (orbDiff <= orb) {
            // Applying/separating belirleme (basitleştirilmiş)
            const applying = progPos.longitude < natPos.longitude;
            
            events.push({
              age: Math.round(age * 10) / 10,
              year,
              jd,
              method,
              promissor,
              significator,
              aspect,
              exactDegree: actualDiff,
              orbUsed: Math.round(orbDiff * 100) / 100,
              applying,
              description: this.generateDescription(promissor, significator, aspect, age, method)
            });
          }
        }
      }
    }

    // Events'i yaşa göre sırala
    return events.sort((a, b) => a.age - b.age);
  }

  /**
   * Otomatik yorum üretimi
   */
  private generateDescription(
    promissor: Body,
    significator: Body,
    aspect: number,
    age: number,
    method: string
  ): string {
    const aspectNames: Record<number, string> = {
      0: 'Kavuşum',
      60: 'Sekstil',
      90: 'Kare',
      120: 'Üçgen',
      180: 'Karşıtlık'
    };

    const methodNames: Record<string, string> = {
      secondary: 'Sekonder İlerletme',
      tertiary: 'Tersiyer İlerletme',
      solarArc: 'Güneş Yayı'
    };

    const planetNames: Record<Body, string> = {
      [Body.Sun]: 'Güneş',
      [Body.Moon]: 'Ay',
      [Body.Mercury]: 'Merkür',
      [Body.Venus]: 'Venüs',
      [Body.Mars]: 'Mars',
      [Body.Jupiter]: 'Jüpiter',
      [Body.Saturn]: 'Satürn'
    } as any;

    return `${age} yaşında, ${methodNames[method]} ile ${planetNames[promissor]} ile ${planetNames[significator]} arasında ${aspectNames[aspect] || aspect + '°'} açısı.`;
  }
}

export { DirectionsEngine };
