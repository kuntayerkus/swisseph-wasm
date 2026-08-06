# Roadmap: where this library can actually add value

*English · [Türkçe](ROADMAP.tr.md)*

Two questions shape everything below:

1. Can the ephemeris data itself be improved?
2. If not, what *is* worth building?

The short answers are **no** and **the derived layer**. This document explains
both, and lays out the plan that follows from them.

---

## 1. The ephemeris data cannot be improved here — and should not be

### What the data actually is

The `.se1` files are compressed Chebyshev fits to **JPL DE441**, NASA/Jet
Propulsion Laboratory's numerical integration of the solar system. DE441 is not
a model somebody tuned; it is the equations of motion — Newtonian gravity plus
general-relativistic corrections, solar oblateness, asteroid perturbations —
integrated numerically and fitted by least squares to the observational record:

- radar ranging to the inner planets
- spacecraft telemetry (Cassini, MESSENGER, Juno, the Mars orbiters)
- Lunar Laser Ranging, which measures the Earth–Moon distance to millimetres
- VLBI for the orientation of the whole frame

> **A clarification, since the phrasing comes up:** ephemerides are not
> "trained" in the machine-learning sense, and there is no better-trained
> version to find. There is no model to improve — the dynamics are solved
> directly. The accuracy ceiling is set by the observations, not by technique.

### Who could improve it

Three groups on Earth produce solar system ephemerides at this level:

| Group | Product |
|---|---|
| JPL (USA) | DE series — DE440, DE441 |
| IMCCE (France) | INPOP |
| IAA RAS (Russia) | EPM |

They agree with each other to well under a milliarcsecond for the inner
planets. Improving on them requires the raw observation archives, a solar
system integrator, and specialist years. It is not a side project, and
attempting it would produce something worse.

### For astrology, the data is already absurdly over-precise

The dominant error in any chart is the **birth time**, not the ephemeris:

| Source of error | Effect on the chart |
|---|---|
| 1 minute of birth-time uncertainty | Ascendant moves ~900″ (~15′) |
| 1 minute of birth-time uncertainty | Moon moves ~30″ |
| Moshier vs full ephemeris (worst case, Pluto 2399) | 5.9″ |
| Moshier vs full ephemeris (Sun, any date) | < 0.07″ |

A birth time recorded to the nearest minute already carries an uncertainty
roughly **150× larger** than the worst-case ephemeris difference, and the
comparison is far more lopsided for the Sun. Rectification, house system choice
and zodiac choice all dwarf it further. There is no astrological question whose
answer changes at 5 arcseconds.

### For astronomy, DE441 *is* the reference

You do not improve on it; you use it. Anyone needing more than Swiss Ephemeris
provides should query [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
directly, which is where the authoritative numbers live.

**Conclusion: treat the ephemeris data as a fixed, solved input.** All
engineering effort goes above it.

---

## 2. Where the value actually is

Everything a user wants that Swiss Ephemeris does *not* hand them directly.
Swiss Ephemeris gives coordinates; it does not give a chart. The gap between
those two is large, underserved in JavaScript, and is entirely code — no data
problem, no accuracy problem, no licensing complication beyond the AGPL that
already applies.

---

### 2.1 Arabic lots / Arabic parts — the biggest single win

Not provided by Swiss Ephemeris at all — pure arithmetic, and nobody had done
it well in JavaScript.

Lots are simple formulas over positions the library already computes:

```
Lot of Fortune   (day)    Asc + Moon − Sun
Lot of Fortune   (night)  Asc + Sun  − Moon
Lot of Spirit    (day)    Asc + Sun  − Moon
Lot of Spirit    (night)  Asc + Moon − Sun
```

There are 100+ traditional lots (the Hermetic lots, Paulus of Alexandria's set,
Bonatti's list, the seven Hermetic lots of the planets).

**Status: implemented.** What follows is what building it actually taught us,
kept here because the reasoning is the useful part.

**Sect was the hard part, and the concern was justified.** Whether a chart is
diurnal decides which formula applies. The traditional computational rule —
"the Sun is above the horizon if it lies more than 180° past the Ascendant" —
turns out to be *exactly* correct up to the polar circle and *badly wrong*
beyond it:

| Latitude | Disagreement with the Sun's true altitude |
|---|---|
| 0–66.5° | 0.00% |
| 67° | 6.25% (worst case 4.2° off) |
| 70° | 18.40% (worst case 11.2° off) |
| 80° | 36.46% (worst case 19.5° off) |

The cause is in Swiss Ephemeris itself: beyond the polar circle it swaps the
Ascendant and Descendant when the Ascendant falls on the wrong side
(`swehouse.c:998`), which inverts the assumption the shortcut rests on. At
70°N the rule can call a chart nocturnal while the Sun stands 11° above the
horizon — and no error is raised, so every sect-dependent lot silently moves.

The fix was to default to the Sun's true altitude (`swe_azalt`), which is
correct everywhere and identical to the traditional rule wherever the
tradition was actually developed. The shortcut remains available and its
limits are documented rather than hidden.

Other edge cases that turned out to matter less than expected: the twilight
allowance (offered, defaults to zero) and the Sun exactly on the horizon
(flagged via `borderline` rather than resolved arbitrarily).

**A second lesson: not every lot is `A + B − C`.** The Lot of Basis takes the
shorter arc between Fortune and Spirit — a conditional decision, not a
formula. Implementations that assume the universal `A + B − C` shape usually
treat Basis as a sect mirror and put it in the wrong place. The definition
type carries an optional `compute` escape hatch for cases like this.

---

### 2.2 Fixed stars — curate, do not re-catalogue

**Status: curation implemented.** `sefstars.txt` already ships 1360 entries covering everything
brighter than magnitude 5, in ICRS with proper motion, parallax and radial
velocity.

#### Should we rebuild it from Gaia?

**No — and the reason is counterintuitive.** Gaia DR3 has microarcsecond
astrometry for 1.8 billion sources, so it looks like an obvious upgrade. But
**Gaia saturates on bright stars.** Its astrometry degrades badly at the bright
end and effectively gives out around magnitude 3.

The traditional astrological stars are precisely the bright ones:

| Star | Magnitude |
|---|---|
| Sirius | −1.46 |
| Canopus | −0.74 |
| Arcturus | −0.05 |
| Vega | 0.03 |
| Aldebaran | 0.86 |
| Antares | 1.06 |
| Fomalhaut | 1.16 |
| Regulus | 1.40 |

Every one of them is in Gaia's problem range. **Hipparcos-derived positions
remain the better source for exactly the stars this library's users care
about**, and that is effectively what `sefstars.txt` rests on. A Gaia rebuild
would improve faint stars nobody uses, by milliarcseconds nobody can perceive,
while making the important ones worse.

#### What to build instead

Curation and derived calculations:

**Royal Stars (the Four Watchers of Persia)** — pure curation, four entries,
all already present:

| Star | Watcher of | Approx. tropical position |
|---|---|---|
| Aldebaran | East | ~9–10° Gemini |
| Regulus | North | ~0° Virgo |
| Antares | West | ~9–10° Sagittarius |
| Fomalhaut | South | ~3–4° Pisces |

Regulus is a good documentation example in its own right: precession carried it
out of Leo and into Virgo around 2011–2012, after ~2,000 years in the sign it
rules. It makes the precession handling concrete for users.

**Behenian stars** — the 15 stars of medieval magical tradition. Again pure
curation.

**Parans** — star–planet co-risings, culminations and settings. This needs real
work but Swiss Ephemeris provides `swe_rise_trans` to build on.

**Star aspects and orbs** — conjunctions to natal points with magnitude-scaled
orbs, the way the tradition actually uses fixed stars.

---

### 2.3 Asteroids — tiered data packages

**Status: implemented — 16 bodies ship as a 409 KB package.** Six are built into the core files already: — Chiron (`15`),
Pholus (`16`), Ceres (`17`), Pallas (`18`), Juno (`19`), Vesta (`20`) — all
covered by `seas_18.se1` in the base data package.

Beyond those, Swiss Ephemeris addresses any numbered asteroid as
`SE_AST_OFFSET (10000) + asteroid number`, reading one file per asteroid.
Upstream publishes files for 760,000+ asteroids totalling ~48 GB, averaging
roughly 63 KB per body — so a curated set is cheap.

Proposed tier 2, the bodies astrologers actually request:

| Body | Number | Note |
|---|---|---|
| Eris | 136199 | Dwarf planet, heavily used in modern practice |
| Sedna | 90377 | |
| Haumea | 136108 | |
| Makemake | 136472 | |
| Quaoar | 50000 | |
| Orcus | 90482 | |
| Ixion | 28978 | |
| Varuna | 20000 | Swiss Ephemeris has a dedicated constant for it |
| Chariklo | 10199 | Centaur |
| Nessus | 7066 | Centaur |
| Eros | 433 | |
| Psyche | 16 | |
| Lilith (asteroid) | 1181 | **See the warning below** |
| Astraea | 5 | |
| Hygiea | 10 | |

Roughly 1 MB for the set.

> **A naming trap worth documenting prominently.** "Lilith" means three
> different things in astrology and users conflate them constantly:
>
> | Name | What it is | How to compute |
> |---|---|---|
> | Black Moon Lilith (mean) | Mean lunar apogee — *not a body* | `SE_MEAN_APOG` (12) |
> | Black Moon Lilith (true/osculating) | Osculating lunar apogee | `SE_OSCU_APOG` (13) |
> | Asteroid Lilith | An actual asteroid | `SE_AST_OFFSET + 1181` |
>
> These give completely different positions. Most astrology software means the
> first. A library that names them unambiguously prevents a whole class of user
> error.

Note also that per-asteroid files cover **1500–2100 CE** in their short form —
narrower than the main planetary files. The loader must surface that, because
the silent Moshier fallback does *not* apply to asteroids: there is no analytic
theory for them, so an out-of-range request genuinely fails.

---

### 2.4 Derived calculations — built

All pure code on top of positions the WASM build already returns.

- **Dignities and rulerships** — domicile, exaltation, detriment, fall,
  sect-dependent triplicity, Egyptian bounds, Chaldean faces and classical
  scoring. The face table is generated from the Chaldean sequence rather than
  typed out; thirty-six hand-written entries invite a silent ordering error.
- **Aspects and orbs** — three schemes ship (modern by-aspect, traditional
  moieties, tight) and custom schemes are first-class. Most libraries hardcode
  one, and the traditions genuinely disagree. Applying and separating are
  found by nudging both points forward by their speeds, which handles
  retrograde motion and the 0/360 boundary without special cases.
- **Antiscia / contra-antiscia** — reflections across the solstitial and
  equinoctial axes. Each pair is reported once, because the relation is
  symmetric.
- **Declinations, parallels and contraparallels** — `swe.equatorial()` returns
  equatorial coordinates with the fields named for what they hold, and
  `findDeclinationAspects()` finds the ties. Near the celestial equator a pair
  can satisfy both relations at once; that is the geometry, not a bug, and
  both are reported. `outOfBounds()` flags bodies past the obliquity — pass
  the obliquity **for the date**, which `swe.obliquity()` gives you, since it
  drifts 47″ per century.
- **Returns** — solar, lunar and any other body. Swiss Ephemeris's own
  crossing routines are used for the Sun and Moon; everything else steps and
  bisects, and the tests check the two against each other to within a tenth
  of a second. Precession-corrected returns are a separate option rather than
  a silent choice, because which one is right is a live disagreement.
- **Parans** — `swe.angleEvents()` gives the four angle times per object and
  `findParans()` matches the coincidences. Times are compared modulo one day,
  since each event recurs daily: a rise at 23:50 and a culmination at 00:10
  the next day are twenty minutes apart, not twenty-three hours.
- **Profections and firdaria** — annual, monthly and daily profection, and the
  nine-period Persian firdaria sequence with its sub-periods. Year length is
  an explicit option (tropical, Julian or Egyptian): over one 75-year cycle
  the tropical and Egyptian years drift 18 days apart, enough to move a
  sub-period boundary.
- **Eclipses** — solar and lunar, global and local searches, type filtering
  and backward search. Timings are mapped to named fields because the C API
  reuses the same slot for different phases: `tret[4]` is the start of
  totality in a global search and the fourth contact in a local one.
- **Heliacal risings** — `swe.heliacal()`. The atmosphere and observer
  parameters are typed with their defaults made explicit; visibility rests on
  a model, and showing that is better than hiding it.
- **Ayanamsas** — 48 sidereal modes are already implemented and typed. What is
  still missing is documentation explaining which tradition uses which.

### 2.5 The MCP server — delivery, not calculation

`@kuntay/swisseph-mcp` adds no arithmetic. It is a distribution question, and
it belongs on this roadmap because of who the caller is.

A language model asked for a chart answers anyway. It cannot compute a
multi-thousand-term series corrected for ΔT, nutation and aberration, and it
does not know that about itself. So the value is not "expose the API over a
protocol" — it is **removing every opportunity the model has to do the work
itself**:

- **Coarse tools, not a mirror of the API.** One `natal_chart` call returns
  positions, houses, aspects, dignities, lots and sect together. Twelve
  fine-grained tools would be chained, and whatever was not returned would be
  derived by the model — the aspects above all, where it would have to get the
  0/360 wrap, the body-dependent orb allowance and retrograde applying/
  separating right, silently, three times.
- **Text, not floats.** Given `54.5033` a model converts and **rounds**, while
  astrology software **truncates**. That single difference produced a phantom
  one-arcminute error on four of ten bodies in this project's own demo.
- **Local clock time, echoed back as UT.** Passing a birth time through as UT
  is the most common way to get a wrong chart; for Ankara it moves the
  Ascendant about 36°.

The same argument that makes the derived layer worth building makes this worth
shipping: the failure is silent, plausible and invisible to the person asking.

---

## 3. Summary

| Area | Verdict | State |
|---|---|---|
| Ephemeris numerical data | **Do not touch.** Solved by JPL; already over-precise for astrology. | — |
| Fixed star catalogue | **Do not rebuild.** Gaia is worse for bright stars; curate instead. | — |
| Arabic lots | **Build it.** Not provided upstream, pure code, currently done badly everywhere. | ✅ 16 lots, sect handled |
| Star curation (royal, Behenian) | **Build it.** Cheap, high perceived value. | ✅ 72 stars curated |
| Asteroid tiers | **Build it.** Data exists upstream; needs packaging and range handling. | ✅ 16 bodies, 409 KB |
| Dignities and rulerships | **Build it.** | ✅ 5 dignities + scoring |
| Aspect engine | **Build it.** Pure code, this is what turns coordinates into a chart. | ✅ 3 orb schemes |
| Antiscia | **Build it.** | ✅ |
| Declinations and parallels | **Build it.** Almost absent from JavaScript. | ✅ + out-of-bounds |
| Returns | **Build it.** | ✅ + precession-corrected |
| Parans | Needs `swe_rise_trans`; real work but the primitive exists. | ✅ |
| Profections and firdaria | **Build it.** Pure arithmetic. | ✅ |
| Eclipses and heliacal | Wrapping and typing; solved upstream. | ✅ |
| MCP server | **Ship it.** No new arithmetic — it denies a model the chance to invent the numbers. | ✅ 8 tools |

The instinct to add asteroids, fixed stars, lots and royal stars was the right
one. None of it required better data — it required the layer above the data,
which is exactly the layer that does not exist properly in JavaScript today.

---

## 4. Deliberately still open

The planned techniques are done. Three things are left open on purpose.

**Vedic nakshatra junction stars.** The 27 defining stars are a real and
citable list, but getting them right needs a proper source. A hand-typed table
would be exactly the mistake the curation section argues against.

*Update:* source research is done — `docs/NAKSHATRA-STARS.md` carries the
verified list (Sūrya Siddhānta via Burgess; asterism membership via Basham),
every junction star resolved end to end through the WASM build (27/27), and
the catalogue quirks documented (Bharani → 41 Arietis, Viśākhā → `al-2Lib`,
σ Sagittarii → `siSgr`). Wiring it into `@kuntay/swisseph-advanced` remains.

**An extended asteroid tier** (~100 bodies, ~4 MB). The curation list should
live as metadata and loading should stay selective; the current 16-body
package covers most use.

*Update:* the mechanism exists — `EXTENDED_ASTEROIDS` (first 100 numbered
asteroids + the 16 curated bodies, names generated from the official
`seasnam.txt` via `tools/generate-asteroid-names.mjs`) ships as metadata, and
`SwissEph.loadAsteroids(source, numbers)` loads exactly the files requested
(both nested upstream and flat npm layouts, deduplicated, with a `missing`
report). Bundling a wider file tier is still open.

**Automated testing of the browser path in a real browser.** `check:browser`
simulates the browser's stricter constraints under Node and caught a real bug
that way — `fetch` requiring its receiver to be the global object — but it is
not a substitute. The demo has been verified by hand.

*Update:* this is now covered — `check:browser-real` (`npm run
check:browser-real`) drives the demo end to end in headless Chromium via
Playwright: WASM load, Moshier calculation, `.se1` download through
`FetchEphemeris` + `BrowserCache`, the full-precision upgrade, and cache
reload, collecting console and page errors along the way. Requires a one-time
`npx playwright install chromium`.
