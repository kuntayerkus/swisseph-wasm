# Nakshatra junction stars — source research

Status: research complete, list verified against the shipped star catalogue,
and implemented — see the integration note at the end. This document exists
to answer the roadmap item: *"getting them right needs a proper source"*.

## What a junction star is

Each of the 27 nakshatras is an asterism, and each asterism has one defining
star, the *yogatāra* (junction star). Traditionally the nakshatra's position
is the position of its junction star; sidereal zodiacs are anchored to them
(the Lahiri ayanāṁśa is defined so that Citrā/Spica sits at 0° sidereal
Libra). Any Vedic module that reports "the Moon is in nakshatra X" at the
precision this library offers ultimately needs these 27 stars.

## Sources

1. **Sūrya Siddhānta** — the classical statement of the 27 nakshatras and
   their junction stars. English translation: Ebenezer Burgess, *The
   Sûrya-Siddhânta: A Text-Book of Hindu Astronomy*, Journal of the American
   Oriental Society vol. 6 (1860); reprint with notes by Phanindralal
   Gangooly (University of Calcutta, 1935). The junction-star table appears
   with the discussion of the stars (ch. 8).
2. **A. L. Basham, *The Wonder that was India* (1954), Appendix II
   (Astronomy)** — the standard secondary source reproducing the full
   asterism membership for all 27 nakshatras, including the multi-star ones.
3. **IAU Working Group on Star Names** — modern proper names (Sheratan,
   Meissa, Shaula, ...); used only for display, never for coordinates.

Coordinates are **not** taken from any of these: they come from
`sefstars.txt` (ICRS with proper motion), resolved through Swiss Ephemeris's
fixed-star machinery. That is the project's standing rule — curation decides
*which* stars matter; the catalogue supplies the numbers.

## The verified list

Every entry below was resolved against `packages/data/ephe/sefstars.txt` on
2026-08-05. "Lookup" is the string for `swe.fixedStar()` (via
`byDesignation()`); all of them return a hit with a magnitude.

End-to-end verification: on the same date all 27 lookups were replayed
through the WASM build (`createSwissEph()` → `mountEphemeris()` →
`fixedStar()` at J2000) — **27/27 resolved**, and the Lahiri anchor holds:
Spica's tropical longitude at J2000 comes out at 203.836° ≈ 180° + Lahiri
ayanāṁśa, i.e. Citrā at 0° sidereal Libra as defined.

Note: the catalogue already carries nakshatra-named entries for several of
these stars (Ashvini, Bharani, Rohini, Ashlesha, Mula, Revati), independent
confirmation of the identifications.

| # | Nakshatra | Asterism (Basham) | Junction star | Lookup | Mag |
|---|---|---|---|---|---|
| 1 | Aśvinī | β, γ Arietis | **β Arietis** (Sheratan) | `,beAri` | 2.65 |
| 2 | Bharaṇī | 35, 39, 41 Arietis | **41 Arietis** ⚠ | `,41Ari` | 3.59 |
| 3 | Kṛttikā | Pleiades | **η Tauri** (Alcyone) | `,etTau` | 2.87 |
| 4 | Rohiṇī | α Tauri | **α Tauri** (Aldebaran) | `,alTau` | 0.86 |
| 5 | Mṛgaśira | λ, φ Orionis | **λ Orionis** (Meissa) | `,laOri` | 3.66 |
| 6 | Ārdrā | α Orionis | **α Orionis** (Betelgeuse) | `,alOri` | 0.42 |
| 7 | Punarvasū | α, β Geminorum | **β Geminorum** (Pollux) | `,beGem` | 1.14 |
| 8 | Puṣya | γ, δ, θ Cancri | **γ Cancri** (Asellus Borealis) | `,gaCnc` | 4.65 |
| 9 | Āśleṣā | δ, ε, η, ρ, σ Hydrae | **ε Hydrae** | `,epHya` | 3.38 |
| 10 | Maghā | α Leonis | **α Leonis** (Regulus) | `,alLeo` | 1.40 |
| 11 | Pūrva Phalgunī | δ, θ Leonis | **δ Leonis** (Zosma) | `,deLeo` | 2.53 |
| 12 | Uttara Phalgunī | β Leonis | **β Leonis** (Denebola) | `,beLeo` | 2.13 |
| 13 | Hasta | α–ε Corvi | **δ Corvi** (Algorab) | `,deCrv` | 2.94 |
| 14 | Citrā | α Virginis | **α Virginis** (Spica) | `,alVir` | 0.97 |
| 15 | Svātī | α Boötis | **α Boötis** (Arcturus) | `,alBoo` | −0.05 |
| 16 | Viśākhā | α, β, γ, ι Librae | **α² Librae** (Zubenelgenubi) ⚠ | `,al-2Lib` | 2.75 |
| 17 | Anurādhā | β, δ, π Scorpii | **δ Scorpii** (Dschubba) | `,deSco` | 2.32 |
| 18 | Jyeṣṭhā | α, σ, τ Scorpii | **α Scorpii** (Antares) | `,alSco` | 0.91 |
| 19 | Mūla | ε–ν Scorpii | **λ Scorpii** (Shaula) | `,laSco` | 1.62 |
| 20 | Pūrva Āṣāḍhā | δ, ε Sagittarii | **δ Sagittarii** (Kaus Media) | `,deSgr` | 2.67 |
| 21 | Uttara Āṣāḍhā | ζ, σ Sagittarii | **σ Sagittarii** (Nunki) ⚠ | `,siSgr` | 2.07 |
| 22 | Śravaṇa | α, β, γ Aquilae | **α Aquilae** (Altair) | `,alAql` | 0.76 |
| 23 | Dhaniṣṭhā | α–δ Delphini | **β Delphini** (Rotanev) | `,beDel` | 3.63 |
| 24 | Śatabhiṣā | λ Aquarii | **λ Aquarii** | `,laAqr` | 3.79 |
| 25 | Pūrva Bhādrapadā | α, β Pegasi | **α Pegasi** (Markab) | `,alPeg` | 2.48 |
| 26 | Uttara Bhādrapadā | γ Pegasi, α Andromedae | **γ Pegasi** (Algenib) | `,gaPeg` | 2.84 |
| 27 | Revatī | ζ Piscium | **ζ Piscium** | `,zePsc` | 5.19 |

### Entries that needed judgment (⚠)

- **Bharaṇī** — Burgess's junction-star table gives 35 Arietis; the
  asterism is the triangle 35/39/41 Arietis. 35 Arietis (mag 4.66) is
  **absent from `sefstars.txt`** (unnamed stars near the magnitude limit are
  not exhaustive), while **41 Arietis** — the brightest member of the
  triangle — is present and catalogued *under the name Bharani*. The list
  above uses 41 Arietis; the Burgess variant is recorded here.
- **Viśākhā** — α Librae is a visual pair; the catalogue carries the
  brighter component as `al-2Lib` (α² Librae, Zubenelgenubi). A plain
  `,alLib` lookup does not resolve; the designation must be `al-2Lib`. Some
  lists give ι Librae instead — the α-star reading is the Surya Siddhanta
  one and is used here.
- **Uttara Āṣāḍhā** — σ Sagittarii (Nunki) is catalogued with the Bayer
  code `siSgr` (sigma = `si` in this catalogue), not `sgSgr`.

## Multi-star nakshatras

For nine nakshatras the tradition names an asterism, not a single star
(Bharaṇī, Kṛttikā, Mṛgaśira, Punarvasū, Puṣya, Āśleṣā, Pūrva Phalgunī,
Hasta, Viśākhā, Anurādhā, Jyeṣṭhā, Mūla, Pūrva Āṣāḍhā, Uttara Āṣāḍhā,
Śravaṇa, Dhaniṣṭhā, Pūrva Bhādrapadā, Uttara Bhādrapadā). The junction star
is still a single star per the table; the full asterism membership above is
from Basham, for display only.

## Integration note (implemented)

The list shipped in two places, mirroring the existing star curation
(`packages/core/src/derived/stars.ts`, catalogue in
`packages/core/src/generated/stars.ts`):

- **Core** — a `nakshatra` group on `CuratedStar` entries, generated by
  `tools/generate-stars.mjs` (designation-keyed, since several junction
  stars are unnamed in the catalogue). `NAKSHATRA_STARS` gives the group,
  `NAKSHATRA_JUNCTION_STARS` the traditional 1-27 order, and positions come
  from `sefstars.txt` at runtime via `byDesignation()` — never from a
  hand-typed table. Tested: all 27 resolve, and the Lahiri anchor holds
  (Spica at ~203.84° tropical at J2000).
- **Consumer** — `@kuntay/swisseph-advanced`
  (`packages/advanced/src/Nakshatra.ts`) carries the same junction-star
  mapping keyed by nakshatra id (`NAKSHATRA_JUNCTION_STARS`,
  `junctionStarOf()`), resolved through core's `fixedStar()` at runtime.
