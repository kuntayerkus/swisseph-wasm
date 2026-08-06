# swisseph-wasm

*English · [Türkçe](README.tr.md)*

**Swiss Ephemeris 2.10.03, compiled to WebAssembly.** High-precision planetary
positions, house systems, eclipses and fixed stars — in Node.js, browsers, Deno,
Bun and edge runtimes, from a single build.

The complete library is **230 KB brotli-compressed** and works with **no data
files at all**.

---

> ## ⚠️ License: AGPL-3.0 — read this before you use it
>
> Swiss Ephemeris is dual-licensed by Astrodienst AG: **AGPL-3.0** or a paid
> **Professional License**. This project chooses the AGPL, so the AGPL governs
> everything here.
>
> **The AGPL's network clause (section 13) is the part that surprises people.**
> If you use this package in a web service — not just distribute it, but merely
> let users interact with it over a network — you must make the complete source
> of *your* application available to those users under a compatible license.
>
> If your product is closed source, you need a
> [Swiss Ephemeris Professional License](https://www.astro.com/swisseph/) from
> Astrodienst. That license is between you and Astrodienst; it is not granted by
> this project and we cannot sublicense it.
>
> This is not a technicality we can waive. See [NOTICE](NOTICE) for detail.

---

## Status

**Published on npm.** The calculation engine, the typed API and the derived
layer are complete and verified; the first release wave is live (0.2.x):
[`@kuntay/swisseph`](https://www.npmjs.com/package/@kuntay/swisseph) ·
[`@kuntay/swisseph-data`](https://www.npmjs.com/package/@kuntay/swisseph-data) ·
[`@kuntay/swisseph-asteroids`](https://www.npmjs.com/package/@kuntay/swisseph-asteroids) ·
[`@kuntay/swisseph-mcp`](https://www.npmjs.com/package/@kuntay/swisseph-mcp).
The remaining packages (`advanced`, `viz`, `react-ui`, `license`) are in
development for the 0.3.0 wave.

| Phase | Scope | State |
|---|---|---|
| 0 | Toolchain, WASM build, size measurement, data-package spec | ✅ Done |
| 1 | Monorepo, licensing, CI | ✅ Done |
| 2 | Typed TypeScript API, `createSwissEph()` instance isolation | ✅ Done |
| 3 | Numerical parity against a native-compiled reference | ✅ Done |
| 4 | Ephemeris loaders and the data package | ✅ Done |
| 5 | Derived layer: lots, fixed-star curation, asteroid tiers | ✅ Done |
| 6 | Demo, API reference, release tooling | ✅ Done |
| 7 | MCP server: eight tools over stdio, verified end to end | ✅ Done |

Documentation: [API reference](docs/API.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Türkçe README](README.tr.md)

## Verified against a native build

The claim this library rests on is that compiling the reference C to
WebAssembly does not change the numbers. That is tested, not asserted.

A generator compiled with **gcc 13 for x86-64 Linux** runs a grid of 12,930
cases — 15 epochs from 1500 to 2500 CE, all 21 built-in bodies, six flag
combinations, 10 sidereal modes, all 26 house systems at 8 latitudes including
both polar circles, 20 fixed stars — and writes every result at full `%.17g`
precision. The WebAssembly build then replays the identical inputs and the two
are compared value by value.

Same C source, different compiler, different libm, different target
architecture. Results, 89,224 values compared:

| Quantity | Compared | Bit-identical | Worst difference |
|---|---|---|---|
| Angular positions | 79,830 | 92.3% | 1.25e-10° = **4.5e-7 arcsec** |
| Distances | 8,640 | 90.7% | 4.75e-13 relative |
| Angular speeds | 169 | — | 2.02e-8 °/day |
| Julian dates, ΔT | 540 | **100%** | exact |

For scale: 4.5e-7 arcseconds is roughly 200× finer than the best VLBI
astrometry ever achieved. The residual differences are last-bit rounding
disagreements between glibc's and Emscripten's `sin`/`cos`, accumulated over
long series summations.

**Osculating lunar elements are held to a separate, looser threshold** and
reported separately: the true node (`11`), osculating apogee (`13`) and the
interpolated apogee/perigee (`21`, `22`) are derived from the Moon's state
vector by computing Keplerian elements, which is inherently ill-conditioned —
the Moon's orbit is perturbed so strongly that these elements swing by degrees
within days. Their worst observed difference is 1.7e-4 arcsec. They are
excepted **by name** rather than by loosening the global tolerance, so a real
regression in an ordinary planet's position still fails the check.

Two behaviours the corpus locked down that are worth knowing about:

- Swiss Ephemeris **silently switches house system** above the polar circle
  (`"within polar circle, switched to Porphyry"`) rather than failing.
- `sefstars.txt` contains some stars twice with identical coordinates and
  differently spelled traditional names. Since `swe_fixstar2` sorts with
  `qsort`, which C does not require to be stable, the two builds can return
  different spellings of the same star. Positions are unaffected; the check
  compares the unambiguous nomenclature designation strictly.

```bash
npm run build:golden   # regenerate the corpus (needs Docker + ephemeris files)
npm run check:golden   # verify the WASM build against it
```

## Usage

```ts
import { createSwissEph, Body, HouseSystem } from '@kuntay/swisseph';

const swe = await createSwissEph();

const jd = swe.julianDay(1990, 5, 15, 14.5);   // 14:30 UT

const sun = swe.calcWithSign(jd, Body.Sun);
console.log(`${sun.degreeInSign.toFixed(2)}° ${sun.sign}`);  // 24.50° Taurus

const mercury = swe.calcWithSign(jd, Body.Mercury);
console.log(mercury.retrograde);                              // true

const { ascendant, midheaven, cusps } =
  swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);

swe.dispose();
```

Works with no data files at all. For full precision, mount the data package:

```ts
const swe = await createSwissEph({
  files: { 'sepl_18.se1': planetBytes, 'semo_18.se1': moonBytes },
});

const mars = swe.calc(jd, Body.Mars);
console.log(mars.ephemeris);   // 'swiss' — or 'moshier' if it fell back
```

### Three things that are easy to get wrong

**Check `result.ephemeris`.** Swiss Ephemeris does not error when a data file
is missing — it silently falls back to Moshier. Every result reports which
source was actually used, so you never claim precision you did not get.

**Use one instance per concurrent request.** See
[Design notes](#design-notes) — this is a correctness issue, not a style
preference.

**"Lilith" means three different things.** All three are exposed under
unambiguous names:

```ts
Body.BlackMoonLilithMean   // mean lunar apogee — not a body; what most software means
Body.BlackMoonLilithTrue   // osculating apogee — measured up to 29.96° away
asteroidBody(Asteroid.Lilith)   // asteroid 1181 — an actual rock
```

## Using it from an LLM

A language model cannot compute an ephemeris. Asked for a chart it produces
something confident and wrong, because the arithmetic is a series expansion
with thousands of terms corrected for ΔT, nutation and aberration — not
something that can be reasoned out or recalled.

`@kuntay/swisseph-mcp` exposes this library as a
[Model Context Protocol](https://modelcontextprotocol.io) server, so the model
calls out for the numbers instead of inventing them.

One command wires it into every MCP client it finds on the machine, with the
launch line each one needs:

```bash
npx -y @kuntay/swisseph-mcp install
```

`npx -y @kuntay/swisseph-mcp doctor` says what it found and what it would
write; `... config` prints the block to paste by hand.

Configuring it by hand on Windows needs `"command": "cmd"` with
`["/c", "npx", …]`, not `"command": "npx"`: clients spawn without a shell,
there is no `npx` executable to spawn, and Node refuses `npx.cmd` outright
since the BatBadBut fix. The measurements are in
[packages/mcp/README.md](packages/mcp/README.md).

Eight tools: `natal_chart`, `transits`, `synastry`, `return_chart`,
`eclipses`, `rise_set`, `time_lords`, `declinations`.

**Aspects come back computed.** That is the point of the design. Handed only
longitudes, a model would derive them itself — and it would have to get the
0/360 wrap right (355° and 85° are square), apply an orb scheme where the
allowance depends on which bodies are involved, and judge applying versus
separating for a retrograde planet. Three chances to fail, taken silently.
The same applies to dignities, lots, parallels and time lords.

Degrees arrive formatted (`24°30'11" Taurus`) with the decimal alongside,
because a model given a bare float converts it itself and **rounds**, while
astrology software **truncates**. Times are taken as local clock time with a
zone and the derived UT is echoed back, since passing a birth time through as
UT is the single most common way to produce a wrong chart.

See [packages/mcp/README.md](packages/mcp/README.md). The AGPL network clause
applies in full to a hosted server.

## Why WebAssembly and not a JavaScript rewrite

The upstream C is 56,083 lines, of which roughly 13,500 are dense numerical
tables. Hand-porting it would mean reimplementing bit-packed Chebyshev
coefficient decoding, pointer arithmetic and C `double` semantics — every line a
chance to introduce a silent fraction-of-an-arcsecond error that nobody notices
until an astrologer files a bug three years later. It would also fork
permanently from upstream: Astrodienst ships new versions, and a hand port
diverges the day it's written.

Compiling the reference C means the numbers are the reference numbers, and an
upstream upgrade is a rebuild. Every file access in `sweph.c` already funnels
through a single `swi_fopen()`, which Emscripten's virtual filesystem satisfies
transparently — the codebase happens to be unusually well suited to this.

## Size

Measured, not estimated — `-O3`, all 106 exported functions, no API trimming:

| | Raw | gzip | **brotli** |
|---|---|---|---|
| `swisseph.wasm` | 550 KB | 256 KB | **211 KB** |
| JS glue | 75 KB | 21 KB | 18 KB |
| **Total** | **624 KB** | **277 KB** | **230 KB** |

For context: that is the entire solar system — planets, Moon, asteroids,
eclipses, 20+ house systems, 1360 fixed stars, heliacal visibility — in roughly
the size of three.js.

Trimming the API surface from 106 functions to 12 saves only 53 KB brotli (23%),
which is why this ships as **one build with everything**. Two packages to
maintain was not worth 53 KB.

## Accuracy, honestly

Swiss Ephemeris can calculate from three sources. Two matter here:

**Moshier** — a semi-analytic theory compiled into the WASM binary. No data
files, works instantly, covers 3000 BCE – 3000 CE.

**Swiss (`.se1`)** — compressed tables derived from NASA/JPL's DE441
integration. Full reference precision, needs data files.

The difference between them, measured across the data-file range in
longitude arcseconds:

```
  year      Sun     Moon     Mars  Jupiter    Pluto
  1800    0.027    0.613    0.079    0.120    3.690
  1900    0.005    0.075    0.037    0.193    0.252
  2000    0.024    0.633    0.038    0.399    0.265
  2100    0.038    0.471    0.052    0.184    1.453
  2300    0.065    0.667    0.167    0.477    4.306
  2399    0.013    0.933    0.010    0.933    5.903
```

Moshier's fit is centred near 1900–1950 and degrades toward the edges, and the
degradation is almost entirely in the outer planets. The Sun stays under 0.07″
everywhere. The worst case in the whole table is Pluto at 5.9″ — **0.098 arc
minutes**.

What that means in practice:

- **For astrology, the difference is invisible.** Charts are drawn to
  arcminute precision at best, and the dominant error is birth time, not
  ephemeris: a one-minute uncertainty in birth time moves the Ascendant by
  roughly 900″, which is over two orders of magnitude larger than the worst
  number in that table.
- **For astronomy and for reference fidelity, it is real.** If you need to
  reproduce published ephemeris values digit for digit, use the data files.

So the data package is not an accuracy fix. It is exact agreement with the
reference implementation.

## Ephemeris data

The full upstream `ephe/` directory is **379 MB** — it covers 13000 BCE to
17000 CE plus 760,000+ asteroids. Nobody needs all of it.

For 1800–2399 CE, five files totalling **2.05 MB** cover everything most
applications use:

| File | Size | Contents |
|---|---|---|
| `sepl_18.se1` | 473 KB | Planets |
| `semo_18.se1` | 1274 KB | Moon |
| `seas_18.se1` | 218 KB | Ceres, Pallas, Juno, Vesta, Chiron, Pholus |
| `sefstars.txt` | 133 KB | Fixed star catalogue (1360 entries) |
| `seorbel.txt` | 6 KB | Orbital elements for hypothetical bodies |

These ship as a separate optional package. Publishing them to npm also makes
them available on jsDelivr and unpkg at no cost, so the browser loader gets a
CDN for free.

**Data files are purely optional.** Swiss Ephemeris does not fail when a file
is missing — it falls back to Moshier and reports a warning:

```
2500 CE  ->  fell back to Moshier   "sepl_24.se1 not found in PATH '/ephe/'"
2100 CE  ->  used full ephemeris
```

That means a failed download, a wrong date range or a user who simply never
installs the data package still gets correct results, just marginally less
precise. There is no error path to design around.

### Loading data

Swiss Ephemeris reads its files **synchronously** in C, so nothing can be
fetched in the middle of a calculation — data has to be in place beforehand.
That is workable because the archive is sliced into 600-year files whose names
are computable from the date, so the exact ~2 MB a calculation needs is known
in advance:

```ts
import { createSwissEph, FetchEphemeris, BrowserCache } from '@kuntay/swisseph';

const swe = await createSwissEph();

const { loaded, missing, bytes } = await swe.loadEphemeris(
  new FetchEphemeris({ cache: BrowserCache.create() }),
  { fromYear: 1900, toYear: 2100, fixedStars: true },
);
```

`FetchEphemeris` defaults to the data package's jsDelivr URL, so the CDN comes
free with publishing to npm. Three sources ship:

| Source | Use |
|---|---|
| `MemoryEphemeris` | You already have the bytes — bundler import, file upload, your own cache |
| `FetchEphemeris` | Browser; optional pluggable cache (`BrowserCache` uses the Cache API) |
| `NodeFsEphemeris` | Node, reading from a directory |

On a server, prefer `mountEphemerisDirectory()` over any of them:

```ts
swe.mountEphemerisDirectory('/var/lib/ephe');   // NODEFS, no copy
```

Because instances are isolated (each has its own linear memory), copying files
in would mean 2 MB per instance. NODEFS mounts the host directory directly, so
every instance shares it.

### Asteroids

Ceres, Pallas, Juno, Vesta, Chiron and Pholus come with the main ephemeris.
Sixteen more — Eris, Sedna, Quaoar, Makemake, Haumea, Orcus, Ixion, Varuna,
Gonggong, Chariklo, Nessus, Eros, Psyche, Hygiea, Astraea and asteroid Lilith —
ship as a separate **409 KB** package covering 1500–2100 CE.

```ts
import { Asteroid, asteroidBody } from '@kuntay/swisseph';

swe.calc(jd, asteroidBody(Asteroid.Eris));
```

**Use `asteroidBody()`, never `AsteroidOffset + number` directly.** Swiss
Ephemeris only remaps MPC numbers 1–4 onto its built-in bodies
(`sweph.c:1031`), so `AsteroidOffset + 2060` goes looking for a `se02060s.se1`
file and throws — even though Chiron is right there in the main ephemeris.
`asteroidBody()` resolves the six built-in bodies to their `Body` constants and
everything else to the offset.

Two behaviours differ from planets: **missing asteroid files throw** rather
than falling back to Moshier (there is no analytic theory to fall back to), and
coverage is 1500–2100 CE rather than 1800–2399.

And the naming trap is worth restating with numbers — for 1990-05-15, asteroid
Lilith sits at 309.09° while Black Moon Lilith is at 231.48°. **77° apart.**
Software that says only "Lilith" is telling you almost nothing.

### Asking what a range needs

You can also ask which files a range needs without loading anything:

```ts
requiredEphemerisFiles({ fromYear: 1750, toYear: 1850, kinds: ['planets'] });
// ['sepl_12.se1', 'sepl_18.se1'] — the range crosses the 1799/1800 boundary
```

The naming rule is verified empirically rather than trusted: the test suite
loads *only* the computed file for a given year and asserts that Swiss
Ephemeris used it instead of falling back to Moshier — because a wrong rule
produces no error, just silently reduced precision.

## Building

Requires Node 20+ and either Emscripten on `PATH` or Docker (the build script
picks whichever it finds).

```bash
npm install
npm run build          # WASM (~10 s) + constants codegen + TypeScript
npm run check:smoke    # physics sanity checks, no data files needed
```

For the checks that need real ephemeris files, point them at a directory
containing the five `.se1`/`.txt` files:

```bash
export SWISSEPH_EPHE_PATH=/path/to/ephe
npm run check:api         # API surface + instance isolation
npm run check:data        # verifies the data package spec
npm run check:precision   # reproduces the accuracy table above
npm run check             # all of the above
```

### Browser demo

```bash
npm run build && npm run build:data
npm run demo                    # http://127.0.0.1:8080
```

Computes a full chart — planets, houses, lots, royal stars — and has a button
that fetches the data package at runtime so you can watch the `ephemeris` field
flip from `moshier` to `swiss`. It exists to exercise the browser path
(WASM instantiation, the virtual filesystem, `FetchEphemeris`, `BrowserCache`),
not just to look like a chart.

A static server is required: browsers refuse to load ES modules and WebAssembly
over `file://`.

**Enter the birth time as local time and give the zone offset separately.** The
demo shows the UT it derived, the Julian day and ΔT, because a missed timezone
conversion is by far the most common reason a chart disagrees with other
software — and it is easy to misread as a precision problem. For Ankara on
1990-05-15, treating 14:30 local as 14:30 UT moves the planets by only a few
arcminutes but swings the Ascendant by 36° and the Midheaven by 42°.

### Releasing

```bash
npm run check:release           # blocks on anything that would break a release
```

npm publishes are irreversible — a version can be deprecated but never removed
— so the release workflow verifies before it publishes: a clean build, the
constants regenerated and diffed, all six checks, the full test suite, and a
`npm pack --dry-run` of every package. Publishing only happens on a `v*` tag,
through an environment that can be gated on manual approval, with npm
provenance via OIDC.

`check:release` refuses on stale artifacts, `-dev` version suffixes, packages
still marked `private`, versions that disagree with the tag or with each other,
missing LICENSE/NOTICE/README, and empty data manifests.

### Generated code

`packages/core/src/generated/constants.ts` is produced by
`tools/generate-constants.mjs` from two authoritative sources: the `#define`s in
`vendor/swisseph/swephexp.h`, and the compiled library itself (house system
names come from calling `swe_house_name()`). It is committed so that a fresh
checkout can typecheck before anything is built, and CI fails if it drifts out
of date. Values are never transcribed by hand — 288 constants is well past the
point where a human gets them all right.

## Beyond coordinates

Swiss Ephemeris gives you positions. It does not give you a chart. The gap
between the two is entirely arithmetic, and it is where this library adds
something the C code does not.

### Arabic lots

Not provided by Swiss Ephemeris at all, and poorly served in JavaScript. All
lots have the shape `A + B − C`; the difficulty is elsewhere.

```ts
const { sect, lots } = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });

lots.Fortune.degreeInSign;   // 12.34
lots.Fortune.sign;           // 'Scorpio'
lots.Fortune.source;         // 'Paulus Alexandrinus, Introduction 23'
```

The seven Hermetic lots plus nine commonly used ones ship with the library.
Every definition carries its `source`, and the ones where traditions genuinely
disagree carry a `note` saying so — Marriage in particular is not a settled
formula, and the library says that rather than picking one silently.

**Two things make this harder than the formulas suggest.**

*Sect.* Most lots have mirrored day and night formulas, so getting sect
backwards puts the point somewhere else entirely and raises no error.

```ts
const { sect, sunElevation, borderline } = swe.sect(jd, lat, lon);
```

The default uses the Sun's **true altitude**, which is correct at every
latitude. The traditional shortcut — "the Sun is above the horizon if it is
more than 180° past the Ascendant" — is available as `method: 'ascendant'`
and agrees exactly up to the polar circle, but **breaks beyond it**:

| Latitude | Disagreement with true altitude | Worst case |
|---|---|---|
| 0–66.5° | 0.00% | — |
| 67° | 6.25% | 4.2° |
| 70° | 18.40% | 11.2° |
| 80° | 36.46% | 19.5° |

Past the polar circle Swiss Ephemeris swaps the Ascendant and Descendant when
the Ascendant falls on the wrong side (`swehouse.c:998`), which inverts the
"houses 1–6 are below the horizon" assumption the shortcut rests on. At 70°N
it can call a chart nocturnal while the Sun stands 11° above the horizon.
This was found by testing the rule against `swe_azalt` over a grid of
latitudes, and the boundary lands exactly on the polar circle.

`borderline` flags charts where the Sun is within 1° of the horizon — there, a
minute of birth-time uncertainty can flip the answer, and downstream results
deserve a caveat.

*Dependencies.* Several lots reference other lots — Eros is built from Spirit,
Necessity from Fortune. Definitions are resolved in dependency order, and a
circular definition throws instead of looping.

*Not every lot is `A + B − C`.* The Lot of Basis takes the **shorter arc**
between Fortune and Spirit, which is a conditional decision rather than a
formula — implementations that treat it as a sect mirror put it in the wrong
place. Definitions may supply a `compute` function for cases like this, and
custom tables are first-class if you follow a different tradition.

### Houses: placement, and the angles the cusps do not give you

Which house a body falls in is not `floor((longitude − ascendant) / 30) + 1`.
That is right only for equal houses; a Placidus house can be 60° wide next to a
12° one, and the arithmetic has to cross 0° Aries without noticing:

```ts
import { houseOf, assignHouses } from '@kuntay/swisseph';

const { cusps, descendant, imumCoeli } = swe.houses(jd, 39.93, 32.86, 'P');
houseOf(swe.calc(jd, Body.Sun).longitude, cusps);   // 7
```

`descendant` and `imumCoeli` are computed rather than read off the seventh and
fourth cusps, because that identity holds only in quadrant systems. Under whole
sign the fourth cusp and the real IC can be a whole sign apart:

```ts
const w = swe.houses(jd, 39.93, 32.86, 'W');
w.cusps[3];     //  0°00' Capricorn — the fourth house begins here
w.imumCoeli;    //  1°11' Aquarius  — the lower meridian is here
```

Equal, Morinus, Vehlow and the meridian systems all behave the same way. So
does the Midheaven: in that chart it sits in the eleventh whole-sign house, not
the tenth.

`houseOf()` refuses Gauquelin sectors instead of returning a number for them —
there are 36 and they run clockwise, so no house number applies.

### House systems near the poles

Placidus, Koch, Gauquelin and Sunshine are mathematically undefined beyond the
polar circle. Swiss Ephemeris substitutes Porphyry there, returns `-1`, and
**still fills in valid cusps** — the `-1` is a warning, not a failure. Results
report it rather than throwing:

```ts
const { cusps, substituted, warning } = swe.houses(jd, 69.65, 18.96, 'P');
// substituted === true, warning === 'within polar circle, switched to Porphyry'
```

`cusps.length` is 12 for every house system **except `'G'`**, which returns the
36 Gauquelin sectors. Read the length rather than assuming twelve. The polar
substitution is the one case where `'G'` gives 12: the Porphyry cusps that
replace it are all Swiss Ephemeris computes there.

Treating that `-1` as an error makes the library unusable above 66.5°N, which
is around 4.9% of the cases in the reference corpus. Real failures are
distinguished from substitutions by whether the cusp buffer was actually
written, not by matching the message text.

### Fixed star curation

The catalogue already has 1360 entries. What was missing is which stars matter
in which tradition, and how to look them up unambiguously:

```ts
import { ROYAL_STARS, BEHENIAN_STARS, byDesignation } from '@kuntay/swisseph';

const regulus = swe.fixedStar(byDesignation('alLeo'), jd);
```

Search by **designation**, not by traditional name. `sefstars.txt` lists some
stars twice with different spellings of the same name, and since the lookup
sorts with `qsort` — which C does not require to be stable — which spelling
comes back can vary by platform. `,alLeo` always identifies exactly one record.

The four Persian Royal Stars and the fifteen Behenian stars ship as curated
lists, and the test suite verifies that every name in them actually resolves
against the real catalogue.

Regulus makes a good demonstration of precession being handled properly: in
1990 it sits at 29.7° Leo, and it crossed into Virgo around 2011–2012 after
roughly two millennia in the sign it rules.

### Aspects

Three orb schemes ship and custom ones are first-class. Most libraries hardcode
a single scheme; the traditions genuinely disagree. In the modern scheme the orb
belongs to the aspect, in the traditional moiety scheme each body carries half
an orb and the two halves are added:

```ts
import { findAspects, findAspectsBetween, TRADITIONAL_MOIETIES } from '@kuntay/swisseph';

const aspects = findAspects([
  { name: 'Sun', longitude: 54.5, body: Body.Sun, speed: 0.97 },
  { name: 'Moon', longitude: 296.9, body: Body.Moon, speed: 12.8 },
], { orbs: TRADITIONAL_MOIETIES });

aspects[0].applying;   // applying or separating
```

`findAspectsBetween()` handles synastry and transits — it compares across the
two sets only, never within them.

Applying and separating come from the derivative of the orb, not from stepping
the positions forward and re-measuring. A finite step overshoots: the Moon
covers 0.13° in a hundredth of a day, so a sampled reading calls a Moon aspect
inside about 0.06° of exact "separating" while it is still applying — precisely
the partile range that matters. Retrograde motion and the 0/360 boundary fall
out of the signed difference without special cases.

Points may declare a `group`, and `findAspects()` never pairs two points that
share one:

```ts
findAspects([
  { name: 'Ascendant', longitude: 0, group: 'angles' },
  { name: 'Midheaven', longitude: 89.98, group: 'angles' },
]);   // []
```

The Ascendant–Midheaven separation is a function of latitude and obliquity and
nothing else — at 20° it is 89.98°, so without this every chart at that latitude
reports a square with a one-arcminute orb, sorted to the top of the list. The
two lunar nodes are the same case. `findAspectsBetween()` ignores the group,
because one chart's angles against another's *are* a real contact.

### Antiscia

Reflection across the solstitial axis (0° Cancer – 0° Capricorn). Two points in
antiscion share the same declination and the same day length, which is the
physical basis of the technique:

```ts
import { findAntiscia, reflect } from '@kuntay/swisseph';
reflect('Sun', 75);   // 15° Gemini -> antiscion at 15° Cancer
```

### Declination, parallels, out-of-bounds

Longitude is only half of a position. Two bodies can be 90° apart in the zodiac
and still sit on the same circle of declination:

```ts
import { findDeclinationAspects, outOfBounds } from '@kuntay/swisseph';

const points = swe.declinations(jd, [Body.Sun, Body.Moon, Body.Venus]);
const ties = findDeclinationAspects(points);              // parallel / contraparallel
const oob = outOfBounds(points, swe.obliquity(jd).trueObliquity);
```

**Pass the obliquity for the date.** It decreases by roughly 47″ per century,
so a constant puts any body near the boundary on the wrong side.

Near the celestial equator a pair can be both parallel and contraparallel
(+0.3° and −0.3° differ by 0.6° and sum to 0°). That is the geometry, not a
bug, and both are reported.

### Returns

```ts
const { jd } = swe.solarReturn(natalJd, { after: swe.julianDay(2026, 1, 1) });
const chart = swe.houses(jd, 39.93, 32.86);
```

Precession-corrected returns are a separate option (`precessionCorrected:
true`) because which one is right is a live disagreement among practitioners.
After thirty years the two differ by about a day, so picking one silently would
be picking a side.

The Sun and Moon use Swiss Ephemeris's own crossing routines; other bodies use
a stepping-and-bisecting search, and the tests check the two against each other
to within a tenth of a second.

### Rise, set and parans

```ts
const contacts = swe.parans(jd, [Body.Sun, Body.Mars, 'Sirius'],
  { latitude: 39.93, longitude: 32.86 }, { orbMinutes: 20 });
```

Near the poles a body may never rise, or never set. That is not an error:
`riseTransit()` returns `occurs: false`, and `angleEvents()` marks the object
`circumpolar` or `neverRises` while still reporting its culminations — which is
what makes a paran with a circumpolar star possible at all.

Because each event recurs once a day, times are compared modulo one day: a rise
at 23:50 and a culmination at 00:10 the next day are twenty minutes apart, not
twenty-three hours.

### Eclipses

```ts
const eclipse = swe.solarEclipse(swe.julianDay(2017, 8, 1, 0));
eclipse.kind;                  // 'total'
eclipse.timings.totalityBegin;

const local = swe.solarEclipse(jd, { place: { latitude: 36.97, longitude: -76.29 } });
local.local!.magnitude;        // magnitude, visibility, the Sun's altitude
```

In the C API the timings are an unnamed array whose indices mean different
things depending on the call: `tret[4]` is the start of totality in a global
search and the fourth contact in a local one. Here they become named fields.

A local search takes no type filter, so passing `type` together with `place`
raises an error rather than being silently ignored.

### Heliacal risings

```ts
const { visibilityBegin } = swe.heliacal(
  swe.julianDay(-3000, 7, 1), 'Sirius',
  { latitude: 30.0, longitude: 31.2, altitude: 20 },
  HeliacalEvent.HeliacalRising,
);
```

The one calculation here that is not pure geometry: whether an object is
*visible* depends on the atmosphere and on the observer's eye. Those
assumptions are typed, with their defaults made explicit.

### Profections and firdaria

```ts
import { profection, firdariaAt, EGYPTIAN_YEAR } from '@kuntay/swisseph';

const p = profection(natalJd, jd, natalAscendant);
p.house;   // 1–12   p.lord;   // ruler of the profected sign

const lords = firdariaAt(natalJd, 'day', jd);
lords?.major.lord;   // 'Sun'   lords?.minor?.lord;   // sub-period
```

Year length is an explicit option — tropical, Julian or Egyptian. Over one
75-year firdaria cycle the tropical and Egyptian years drift 18 days apart,
enough to move a sub-period boundary.

## Design notes

**Instance isolation.** Swiss Ephemeris keeps all state in a single global
`swed` struct — `swe_set_topo`, `swe_set_sid_mode` and `swe_set_ephe_path` are
process-global in C. On a server handling concurrent requests, that state leaks
between them. The build is compiled with `-sMODULARIZE`, so `createSwissEph()`
can hand out a fresh WASM instance with its own linear memory per caller. This
is a correctness property, not a convenience.

**Binding strategy.** The API layer allocates its output buffers once and reads
them through `HEAPF64` rather than going through `ccall` per call.

**Return flags are checked.** Because Swiss Ephemeris silently degrades to
Moshier when a file is missing, calls report which ephemeris was actually used.
Ignoring the returned flag is how a library ends up quietly claiming precision
it did not deliver.

**Negative returns are not uniformly errors.** `swe_calc_ut`, `swe_fixstar2`
and `swe_get_ayanamsa_ex_ut` use a negative return for genuine failure, but
`swe_houses_ex2` uses `-1` to report that it substituted a house system while
returning perfectly good data. The two cases are handled differently, and the
corpus was used to confirm which functions do what rather than assuming.

**Asteroids do not fall back.** Planets degrade to Moshier when a file is
missing; asteroids have no analytic theory, so they throw. Code that relies on
the planetary fallback behaviour breaks here.

## Verification approach

Every claim in this README that could be wrong is checked by something that
would fail if it were:

| Claim | How it is verified |
|---|---|
| WASM matches the reference C | 89,224 values against a native gcc build |
| Ephemeris file naming is right | 306 computed names exist upstream; each year loads only its computed file and must not fall back |
| Sect determination is correct | Compared against `swe_azalt` over 4,608 latitude/time combinations |
| Lot formulas are entered correctly | Invariants — Fortune + Spirit = 2 × Ascendant, day Fortune = night Spirit |
| Curated star names are real | Every name resolved against the actual catalogue |
| Angles are right | Midheaven and Ascendant recomputed from spherical trigonometry, independent of Swiss Ephemeris — agree to 1.8″ and 8.7″ |
| Browser-only constraints hold | Node tests simulate the browser's stricter `fetch` receiver check |
| Constants match the header | Regenerated in CI and diffed against the committed file |

The pattern throughout: prefer a property that must hold over an assertion
about a number someone typed in. Several real bugs surfaced this way —
a sign error in sect, a broken house-system path above the polar circle, and a
Lot of Basis that used the wrong rule.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the derived-calculation layer:
Arabic lots, fixed-star curation (royal stars, Behenian stars, parans),
asteroid tiers, dignities and aspects.

## Credits

Swiss Ephemeris is the work of **Dieter Koch** and **Alois Treindl** at
Astrodienst AG, Zurich — decades of work, built on NASA/JPL's DE441. This
project is a packaging effort on top of theirs and claims no astronomical
originality.

- Upstream: <https://github.com/aloistr/swisseph>
- Documentation: <https://www.astro.com/swisseph>

This project is independent and not affiliated with or endorsed by Astrodienst
AG. Please do not send support requests for this package to the Swiss Ephemeris
mailing list.

## License

[AGPL-3.0-or-later](LICENSE). See [NOTICE](NOTICE) for attribution and the full
licensing explanation.
