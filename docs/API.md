# API reference

Complete surface of `@kuntay/swisseph`. For the reasoning behind the design
choices, see the [README](../README.md); for what is worth building next, see
[ROADMAP.md](./ROADMAP.md).

Calling this from a language model instead of from code? Use
[`@kuntay/swisseph-mcp`](../packages/mcp/README.md), which wraps the same
engine as eight Model Context Protocol tools. It deliberately does **not**
mirror this API — coarse tools return a finished chart, so the model has no
occasion to derive the aspects itself.

---

## `createSwissEph(options?) → Promise<SwissEph>`

Creates an isolated instance. **Each call gets its own WebAssembly instance and
its own linear memory.**

```ts
const swe = await createSwissEph();
const swe = await createSwissEph({ files: { 'sepl_18.se1': bytes } });
const swe = await createSwissEph({ ephemerisPath: '/var/lib/ephe' });
```

This is a correctness property, not a convenience. Swiss Ephemeris keeps all
state in one global C struct, so `setSiderealMode`, `setTopocentric` and the
ephemeris path are process-global in the original. On a server handling
concurrent requests, one request's sidereal setting would silently change the
next one's results. Use one instance per concurrent request, or serialise
access to a shared instance. Instances are not cheap to create (WASM
compilation), so pooling is a reasonable middle ground.

Instances support `Symbol.dispose`, so `using swe = await createSwissEph()`
works on TypeScript 5.2+.

---

## Positions

### `calc(jd, body, options?) → Position`

```ts
const mars = swe.calc(jd, Body.Mars);
mars.longitude;       // degrees
mars.longitudeSpeed;  // degrees/day, negative when retrograde
mars.ephemeris;       // 'swiss' | 'moshier' | 'jpl' — what was ACTUALLY used
mars.warning;         // string | null
```

**Always check `ephemeris`.** Swiss Ephemeris does not error when a data file
is missing; it falls back to the built-in Moshier theory. The field reports
what really happened so you never claim precision you did not get.

`options.flags` takes a bitmask of `Flag.*`; `options.ephemeris` selects the
source (`'swiss'` by default). Throws `SwissEphError` on genuine failure.

### `calcWithSign(jd, body, options?) → PositionWithSign`

`calc()` plus `sign`, `signIndex`, `degreeInSign` and `retrograde`.

### `fixedStar(name, jd, options?) → StarPosition`

```ts
swe.fixedStar('Aldebaran', jd);
swe.fixedStar(byDesignation('alTau'), jd);   // preferred — see below
```

Prefer searching by designation. `sefstars.txt` lists some stars twice with
different spellings of the same traditional name, and because the lookup sorts
with `qsort` — which C does not require to be stable — which spelling is
returned can vary between platforms. `,alTau` always identifies one record.

### `horizontal(jd, body, latitude, longitude, altitudeMetres?, options?)`

Returns `{ azimuth, altitude, apparentAltitude }` in degrees. `altitude` is
geometric; `apparentAltitude` includes atmospheric refraction.

### `planetName(body) → string`

---

## Houses

### `houses(jd, latitude, longitude, system?, options?) → Houses`

```ts
const { cusps, ascendant, midheaven, substituted, warning } =
  swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);
```

`cusps` is zero-based (the C API is one-based). Also returns `vertex`,
`equatorialAscendant`, `coAscendantKoch`, `coAscendantMunkasey` and
`polarAscendant`.

**`cusps.length` is 12 for every system except `'G'`.** Gauquelin sectors are
36, counted clockwise. Read `cusps.length`; do not hard-code twelve.

**Check `substituted`.** Placidus, Koch, Gauquelin and Sunshine are undefined
beyond the polar circle; Swiss Ephemeris silently substitutes Porphyry there,
returns `-1`, and still fills in valid cusps. That `-1` is a warning, not a
failure — treating it as an error makes the library unusable above 66.5°. For
`'G'` this is also the one case where `cusps.length` is 12 rather than 36: the
substituted Porphyry cusps are all that exist.

---

## Dates

| Method | |
|---|---|
| `julianDay(year, month, day, hour?, calendar?)` | Calendar → JD. Hour is decimal UT. |
| `calendarDate(jd, calendar?)` | JD → `{ year, month, day, hour }` |
| `deltaT(jd, ephemeris?)` | ΔT (TT − UT) in days |

Years use astronomical numbering: `0` is 1 BCE, `-1` is 2 BCE.

---

## Settings

These change instance-wide state — the reason instances are isolated.

| Method | |
|---|---|
| `setSiderealMode(ayanamsa, t0?, ayanT0?)` | Use with `Flag.Sidereal` |
| `ayanamsa(jd, ephemeris?)` | Ayanamsa value in degrees |
| `setTopocentric(longitude, latitude, altitudeMetres?)` | Use with `Flag.Topocentric` |
| `setEphemerisPath(path)` | Where to look for `.se1` files |

---

## Ephemeris data

### `loadEphemeris(source, range, dir?) → Promise<{ loaded, missing, bytes }>`

```ts
await swe.loadEphemeris(new FetchEphemeris(), {
  fromYear: 1900, toYear: 2100, fixedStars: true,
});
```

Files must be present before a calculation runs — Swiss Ephemeris reads them
synchronously in C, so nothing can be fetched mid-call. Because file names are
computable from the date, only what a range actually needs is downloaded.
Missing files are reported, not thrown: the library degrades to Moshier.

### `mountEphemeris(files, dir?) → number`

Writes files into the virtual filesystem from memory.

### `mountEphemerisDirectory(hostDirectory, dir?)`

**Node only.** Mounts a real directory through NODEFS with no copy. Prefer this
on a server: with isolated instances, `mountEphemeris` would copy 2 MB per
instance.

### Sources

| | |
|---|---|
| `new MemoryEphemeris(files)` | You already have the bytes |
| `new FetchEphemeris({ baseUrl?, cache?, fetchImpl? })` | HTTP; defaults to the data package on jsDelivr |
| `new NodeFsEphemeris(directory)` | Reads from a directory |
| `BrowserCache.create(name?)` | Cache API storage; `null` where unavailable |

Implement `EphemerisSource` for anything else — it is one method,
`read(fileName) → Promise<Uint8Array | null>`.

### File-name helpers

```ts
requiredEphemerisFiles({ fromYear: 1750, toYear: 1850, kinds: ['planets'] });
// ['sepl_12.se1', 'sepl_18.se1'] — the range crosses the 1799/1800 boundary

ephemerisFileFor('moon', 1990);          // 'semo_18.se1'
approximateYearFromJulianDay(2448027);   // 1990
COVERAGE;                                // { minYear: -13200, maxYear: 17399 }
```

---

## Derived calculations

### `sect(jd, latitude, longitude, options?) → SectResult`

```ts
const { sect, sunElevation, borderline, method } = swe.sect(jd, lat, lon);
```

Defaults to the Sun's true altitude, which is correct at every latitude. The
traditional shortcut (`method: 'ascendant'`) agrees exactly up to the polar
circle and **breaks beyond it** — at 70°N it can report a nocturnal chart while
the Sun stands 11° above the horizon. `borderline` marks charts where the Sun
is within 1° of the horizon and the answer is fragile.

`twilightAllowance` counts a Sun that far below the horizon as still diurnal;
it defaults to 0.

### `lots(jd, options) → { sect, points, lots }`

```ts
const { lots } = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });
lots.Fortune.degreeInSign;
lots.Fortune.source;        // 'Paulus Alexandrinus, Introduction 23'
```

Options: `latitude`, `longitude`, `houseSystem?`, `sect?` (to override
detection), `sectOptions?`, `definitions?`, `calcOptions?`.

Sixteen lots ship — the seven Hermetic lots plus nine common ones. Each carries
its `source`, and the ones where traditions genuinely disagree carry a `note`.

### `calculateLots(points, sect, definitions?)`

The pure function behind `lots()`, if you already have positions.

Definitions have the shape `A + B − C` for day and (optionally) night, may
reference other lots with `'lot:Fortune'`, and may supply a `compute` function
for cases that are not a formula — the Lot of Basis takes the *shorter arc*
between Fortune and Spirit, which is a conditional decision. Dependencies
resolve automatically; a circular definition throws.

### Star curation

```ts
ROYAL_STARS       // 4 Persian Watchers
BEHENIAN_STARS    // 15 medieval magical stars
NOTABLE_STARS     // 10 more in common use
byDesignation('alLeo')   // ',alLeo' — unambiguous lookup
findCuratedStar('Aldebaran')
```

---

### Aspects

```ts
findAspects(points, options?) → Aspect[]
findAspectsBetween(from, to, options?) → Aspect[]   // synastry, transits
separation(a, b) → number                           // shortest arc, 0–180
```

Orb schemes: `MODERN_ORBS` (by aspect), `TRADITIONAL_MOIETIES` (by body,
summed), `TIGHT_ORBS`, or your own `OrbScheme`. Aspect sets: `MAJOR_ASPECTS`
(the Ptolemaic five, the default), `MINOR_ASPECTS`, `ALL_ASPECTS`.

Points carry `speed` to get `applying`; they carry `body` for `byBody` orbs.

### Antiscia

```ts
antiscion(longitude) → number          // mirror across 0° Cancer – 0° Capricorn
contraAntiscion(longitude) → number    // mirror across 0° Aries – 0° Libra
reflect(name, longitude) → ReflectedPoint
findAntiscia(points, options?) → AntisciaContact[]
```

### Declination

```ts
equatorial(jd, body, options?) → EquatorialPosition
obliquity(jd, options?) → Obliquity
declinations(jd, bodies, options?) → DeclinationPoint[]

findDeclinationAspects(points, options?) → DeclinationAspect[]
outOfBounds(points, obliquity?) → OutOfBoundsReport[]
```

`outOfBounds` defaults to `OBLIQUITY_J2000`; pass `obliquity(jd).trueObliquity`
when a body sits near the boundary.

### Rise, set, culmination and parans

```ts
riseTransit(jd, target, place, event?, options?) → { jd: number | null; occurs: boolean }
angleEvents(jd, targets, place, options?) → AngleEventTimes[]
parans(jd, targets, place, options?) → ParanContact[]

findParans(objects, options?) → ParanContact[]
eventSeparationMinutes(a, b) → number
```

`target` is a body constant or a fixed star name. `event` comes from
`RiseTransit`: `Rise`, `Set`, `UpperCulmination`, `LowerCulmination`, OR'd with
modifier bits such as `DiscCenter` or `NoRefraction`.

`occurs: false` means the object does not cross the horizon at that latitude —
not an error.

### Returns

```ts
solarReturn(natalJd, options?) → ReturnResult
lunarReturn(natalJd, options?) → ReturnResult
returnOf(body, natalJd, options?) → ReturnResult
nextCrossing(body, targetLongitude, afterJd, options?) → number
```

Options: `after` (where to start; defaults to the birth moment),
`precessionCorrected`, `maxDays`, and `forceSearch` to bypass Swiss
Ephemeris's own routines for the Sun and Moon.

`nextCrossing` returns the **first** crossing; a planet near a station can
cross the same longitude three times.

### Eclipses

```ts
solarEclipse(afterJd, options?) → SolarEclipse
lunarEclipse(afterJd, options?) → LunarEclipse
```

Options: `place` (switches to a local search and fills `local`), `type` (an
`EclipseFlag`, global searches only), `backward`.

Passing `place` and `type` together throws — the C API has no local type
filter, and ignoring the filter silently would be worse.

### Heliacal events

```ts
heliacal(afterJd, object, place, event, options?) → HeliacalResult
```

`event` comes from `HeliacalEvent`. Options: `atmosphere`, `observer`, and
`heliacalFlags` (`HeliacalFlag.NoDetails` is much faster when only the event
time is needed).

### Time lords

```ts
profection(natalJd, jd, ascendant, options?) → Profection
firdaria(birthJd, sect, options?) → FirdariaPeriod[]
firdariaAt(birthJd, sect, jd, options?) → FirdariaAt | null
```

Year length: `TROPICAL_YEAR` (default), `JULIAN_YEAR`, `EGYPTIAN_YEAR`.
Sequences: `FIRDARIA_DIURNAL`, `FIRDARIA_NOCTURNAL`; `LORD_BODY` maps a lord to
a body constant, and is `null` for the south node, which has none.

---

## Constants

| | |
|---|---|
| `Body` | Sun…Pluto, nodes, apogees, Chiron, the four main asteroids |
| `Flag` | Calculation flags; OR them together |
| `HouseSystem` | 26 systems, plus `HOUSE_SYSTEM_NAMES` and `HOUSE_SYSTEM_ALIASES` |
| `Ayanamsa` | 48 sidereal modes |
| `RiseTransit` | Rise/set/culmination events and their modifier bits |
| `EclipseFlag` | Eclipse types and visibility bits |
| `HeliacalEvent`, `HeliacalFlag` | Heliacal event types and search options |
| `Calendar` | `Julian`, `Gregorian` |
| `SIGNS` | Zodiac names, 0 = Aries |
| `ASCMC` | Index positions in the angles array |
| `Asteroid` | MPC numbers for 20 popular bodies |
| `AsteroidOffset` | 10000 — but use `asteroidBody()` |

All numeric values are generated from `swephexp.h`; CI fails if they drift.

### `asteroidBody(mpcNumber) → number`

```ts
swe.calc(jd, asteroidBody(Asteroid.Eris));
```

Use this rather than `AsteroidOffset + number`. Swiss Ephemeris only remaps MPC
numbers 1–4 onto its built-in bodies, so `AsteroidOffset + 2060` goes looking
for a `se02060s.se1` file and throws even though Chiron is in the main
ephemeris.

Asteroids differ from planets twice over: **missing files throw** rather than
falling back (there is no analytic theory), and coverage is 1500–2100 CE.

### Three meanings of "Lilith"

```ts
Body.BlackMoonLilithMean   // mean lunar apogee — not a body
Body.BlackMoonLilithTrue   // osculating apogee — measured up to 29.96° away
asteroidBody(Asteroid.Lilith)   // asteroid 1181 — an actual rock
```

For 1990-05-15 the asteroid sits at 309.09° and Black Moon Lilith at 231.48°:
**77° apart.**

---

## Errors

`SwissEphError` carries `message` and `fn` (the C function that failed).

Genuine failures throw. Degradations do not: a missing planetary file reports
`ephemeris: 'moshier'`, a substituted house system reports `substituted: true`,
and a missing ephemeris file in `loadEphemeris` appears in `missing`.
