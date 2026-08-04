# Ayanamsa Guide

*English · [Türkçe](AYANAMSA.tr.md)*

This document provides comprehensive documentation for all 48 sidereal modes (ayanamsas) supported by swisseph-wasm. Each ayanamsa is documented with its historical context, traditional usage, and recommended applications.

## What is Ayanamsa?

**Ayanamsa** (Sanskrit: अयनांश) is the difference between the tropical zodiac (aligned with equinoxes) and the sidereal zodiac (aligned with fixed stars). It accounts for the precession of the equinoxes, which causes the vernal point to drift westward along the ecliptic at approximately 50.3 arcseconds per year.

The choice of ayanamsa determines where the sidereal zodiac begins, specifically the position of 0° Aries relative to the fixed stars.

## Available Ayanamsas

### ID 0: Fagan/Bradley

- **Epoch**: 1950
- **Initial Value**: 24°02'31.35" at J1950
- **Tradition**: Western Astrology
- **Usage**: Most common in Western sidereal astrology
- **Notes**: Based on Spica at 29° Virgo; developed by Donald Bradley and Cyril Fagan

### ID 1: Lahiri

- **Epoch**: 1950
- **Initial Value**: 23°08'56.11" at J1950
- **Tradition**: Vedic (Indian) Astrology
- **Usage**: Official ayanamsa of India; most widely used in Vedic astrology
- **Notes**: Government-approved for Indian calendars; Chitra Paksha (Spica-based)

### ID 2: De Luce

- **Epoch**: 1950
- **Initial Value**: 23°51'07.26" at J1950
- **Tradition**: Modern Western
- **Usage**: Rare; primarily academic interest
- **Notes**: Based on birth of Christ epoch

### ID 3: Raman

- **Epoch**: 1950
- **Initial Value**: 21°39'01.87" at J1950
- **Tradition**: Vedic Astrology
- **Usage**: Followers of B.V. Raman
- **Notes**: Developed by famous Indian astrologer B.V. Raman; Pushya Paksha

### ID 4: Usha/Shashi

- **Epoch**: 1950
- **Initial Value**: 23°51'07.26" at J1950
- **Tradition**: Vedic Astrology
- **Usage**: Limited; specific lineages
- **Notes**: Similar to De Luce but with different precession model

### ID 5: Krishnamurti

- **Epoch**: 1950
- **Initial Value**: 23°05'29.96" at J1950
- **Tradition**: Vedic Astrology (KP System)
- **Usage**: KP (Krishnamurti Paddhati) practitioners
- **Notes**: Designed for sub-lord calculations in KP system

### ID 6: Djwhal Khul

- **Epoch**: 1950
- **Initial Value**: 22°27'37.39" at J1950
- **Tradition**: Theosophical Astrology
- **Usage**: Esoteric/Theosophical astrology
- **Notes**: Based on Age of Aquarius beginning in 2142 CE

### ID 7: Yukteshwar

- **Epoch**: 1950
- **Initial Value**: 21°27'37.39" at J1950
- **Tradition**: Vedic/Yogic
- **Usage**: Followers of Sri Yukteswar
- **Notes**: From "The Holy Science"; 24,000-year precession cycle

### ID 8: J.N. Bhasin

- **Epoch**: 1950
- **Initial Value**: 22°27'37.39" at J1950
- **Tradition**: Vedic Astrology
- **Usage**: Limited; specific schools
- **Notes**: Similar starting point to Djwhal Khul

### ID 9: Babylonian/Kugler

- **Epoch**: 1950
- **Initial Value**: 24°08'31.35" at J1950
- **Tradition**: Historical/Babylonian
- **Usage**: Historical research; Babylonian astrology reconstruction
- **Notes**: Based on Kugler's research of Babylonian tablets

### ID 10: Babylonian/Thompson

- **Epoch**: 1950
- **Initial Value**: 24°08'31.35" at J1950
- **Tradition**: Historical/Babylonian
- **Usage**: Historical research
- **Notes**: Thompson's interpretation of Babylonian data

### ID 11: Babylonian/Huber

- **Epoch**: 1950
- **Initial Value**: 24°08'31.35" at J1950
- **Tradition**: Historical/Huber School
- **Usage**: Huber School practitioners; historical work
- **Notes**: Used in psychological astrology by Hubers

### ID 12: Aldebaran 15° Tau

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Reconstructionist
- **Usage**: Academic/historical research
- **Notes**: Places Aldebaran at 15° Taurus

### ID 13: Hipparchos

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Historical/Greek
- **Usage**: Historical research
- **Notes**: Reconstruction of Hipparchos's measurements

### ID 14: Sassanian

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Historical/Persian
- **Usage**: Historical research; Persian astrology
- **Notes**: Sassanian Empire period ayanamsa

### ID 15: Galactica

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Modern
- **Usage**: Experimental/galactic astrology
- **Notes**: Aligned with galactic center

### ID 16: J2000 Equinox

- **Epoch**: J2000.0
- **Initial Value**: 0° at J2000
- **Tradition**: Modern Astronomical
- **Usage**: Astronomical calculations
- **Notes**: Reference to J2000 epoch

### ID 17: J1900 Equinox

- **Epoch**: J1900.0
- **Initial Value**: 0° at J1900
- **Tradition**: Modern Astronomical
- **Usage**: Historical astronomical data
- **Notes**: Reference to J1900 epoch

### ID 18: B1950 Equinox

- **Epoch**: B1950.0
- **Initial Value**: 0° at B1950
- **Tradition**: Modern Astronomical
- **Usage**: Older astronomical catalogs
- **Notes**: Besselian epoch 1950

### ID 19: Surya Siddhanta

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Traditional Vedic calculations
- **Notes**: Based on ancient Surya Siddhanta text

### ID 20: Surya Siddhanta Mean Sun

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Traditional calculations
- **Notes**: Mean sun variant of Surya Siddhanta

### ID 21: Aryabhata

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Historical/traditional
- **Notes**: Based on Aryabhata's calculations (499 CE)

### ID 22: Aryabhata Mean Sun

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Traditional calculations
- **Notes**: Mean sun variant

### ID 23: SS Revati

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Specific Vedic schools
- **Notes**: Based on Revati nakshatra

### ID 24: Citra

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Chitra Paksha followers
- **Notes**: Spica (Citra) based

### ID 25: True Citra

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Precise Chitra calculations
- **Notes**: Uses true position of Spica

### ID 26: Pushya

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Pushya Paksha followers
- **Notes**: Based on Pushya nakshatra

### ID 27: Galactic Center (0° Sagittarius)

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Modern/Astro*Carto*Graphy
- **Usage**: Galactic alignment work
- **Notes**: Aligns galactic center with 0° Sagittarius

### ID 28: True Pushya

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Jyotish
- **Usage**: Precise Pushya calculations
- **Notes**: True position variant

### ID 29: ICRC

- **Epoch**: 1950
- **Initial Value**: Standard value at J1950
- **Tradition**: Research Committee
- **Usage**: ICRC standardized calculations
- **Notes**: International Centre for Research in Cosmobiology

### ID 30: Cosmic

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Modern
- **Usage**: Cosmic/evolutionary astrology
- **Notes**: Holistic approach

### ID 31: K.P. Parameshwaran

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic (KP)
- **Usage**: KP practitioners
- **Notes**: Alternative KP ayanamsa

### ID 32: Babini

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Modern
- **Usage**: Limited
- **Notes**: Regional usage

### ID 33: Coimbatore

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: South Indian tradition
- **Notes**: Regional variant from Coimbatore

### ID 34: R. Balakrishna Rao

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: Specific lineage
- **Notes**: Named after proponent

### ID 35: Graha Bheda Chintamani

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: Textual tradition followers
- **Notes**: Based on classical text

### ID 36: Dhruva

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: Dhruva school
- **Notes**: Named after Dhruva (Pole Star devotion)

### ID 37: Chandra Kala Nadi

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic/Nadi
- **Usage**: Nadi astrology practitioners
- **Notes**: From Chandra Kala Nadi text

### ID 38: Koppe Yogi Sundaram

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: Specific lineage
- **Notes**: Named after proponent

### ID 39: Subramanyam

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Vedic
- **Usage**: Limited
- **Notes**: Regional variant

### ID 40: Shri Yukteshwar (alternative)

- **Epoch**: 1950
- **Initial Value**: ~21° at J1950
- **Tradition**: Yogic
- **Usage**: Kriya Yoga lineage
- **Notes**: Alternative calculation

### ID 41: Sri Sathya Sai Baba

- **Epoch**: 1950
- **Initial Value**: ~23° at J1950
- **Tradition**: Modern Spiritual
- **Usage**: Sai Baba followers
- **Notes**: Spiritual lineage

### ID 42: Adyar

- **Epoch**: 1950
- **Initial Value**: ~22° at J1950
- **Tradition**: Theosophical
- **Usage**: Theosophical Society
- **Notes**: From Adyar headquarters

### ID 43: Aldebaran 14° Tau

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Historical
- **Usage**: Research
- **Notes**: Alternative Aldebaran placement

### ID 44: Aldebaran 15° Tau (alternative)

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Historical
- **Usage**: Research
- **Notes**: Variant calculation

### ID 45: Grebner

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Modern
- **Usage**: Limited
- **Notes**: Modern researcher's calculation

### ID 46: Mohr

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Modern
- **Usage**: Limited
- **Notes**: Modern variant

### ID 47: Wilkinson

- **Epoch**: 1950
- **Initial Value**: ~24° at J1950
- **Tradition**: Modern
- **Usage**: Limited
- **Notes**: Modern researcher

## Usage Examples

### TypeScript/JavaScript

```typescript
import { swe, Ayanamsa } from '@kuntay/swisseph';

// Set Lahiri ayanamsa (most common for Vedic)
swe.setAyanamsaMode(Ayanamsa.Lahiri);

// Calculate planetary positions
const jd = 2451545.0;
const sunPos = swe.calc(jd, Body.Sun);

console.log(`Sun longitude (sidereal): ${sunPos.longitude}°`);
```

### Choosing the Right Ayanamsa

| Use Case | Recommended Ayanamsa | ID |
|----------|---------------------|-----|
| General Vedic Astrology | Lahiri | 1 |
| KP System | Krishnamurti | 5 |
| Western Sidereal | Fagan/Bradley | 0 |
| Theosophical Astrology | Djwhal Khul | 6 |
| Historical Research | Babylonian variants | 9-11 |
| Traditional Texts | Surya Siddhanta | 19 |
| Galactic Work | Galactic Center | 27 |

## Important Notes

1. **Consistency**: Always use the same ayanamsa within a chart analysis
2. **Documentation**: Record which ayanamsa was used for any reading
3. **Client Communication**: Inform clients about ayanamsa choice
4. **Software Compatibility**: Different software may use different defaults
5. **Precession Rate**: All modern ayanamsas use the same precession rate; they differ only in initial value

## See Also

- [API Documentation](API.md) - Complete API reference
- [Swiss Ephemeris Documentation](https://www.astro.com/swisseph/) - Original source
- [Vedic Astrology Resources](https://www.vedicastrologer.org/) - Educational materials

---

*Last updated: 2024*
