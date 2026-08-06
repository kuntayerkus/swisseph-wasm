# Architecture

swisseph-wasm compiles Swiss Ephemeris 2.10.03 (C) to WebAssembly and wraps
it in a typed TypeScript API that runs in Node and the browser. This document
is the onboarding map: what lives where, how the layers fit together, and how
to verify a change. For the roadmap see [`ROADMAP.md`](ROADMAP.md); for the
public API surface see [`API.md`](API.md).

## Repository layout

```
vendor/swisseph/        Swiss Ephemeris 2.10.03 C sources (AGPL; see NOTICE)
tools/                  Build + verification scripts (Node, no framework)
  golden/golden.tsv.gz  12,930-row reference corpus produced by native gcc swetest
docs/                   This file, API.md, AYANAMSA.md, MEMOIZATION.md, ROADMAP.md
examples/
  browser/              Zero-build browser demo + static server (serve.mjs)
  react-demo/           Vite + React demo consuming @kuntay/swisseph-react-ui
packages/
  core/                 @kuntay/swisseph — WASM + typed API + derived layer
  mcp/                  @kuntay/swisseph-mcp — MCP server (stdio) for LLMs
  data/                 @kuntay/swisseph-data — .se1 files, 1800–2399
  asteroids/            @kuntay/swisseph-asteroids — 16 curated asteroid files
  advanced/             @kuntay/swisseph-advanced — Vedic (nakshatra) modules
  viz/                  @kuntay/swisseph-viz — D3-style chart rendering
  react-ui/             @kuntay/swisseph-react-ui — React components
  license/              @kuntay/swisseph-license — license compliance tooling
  geo/                  @kuntay/swisseph-geo — GeoNames city lookup + timezone
```

Published on npm: `core`, `mcp`, `data`, `asteroids` (0.2.x line). The other
five packages are in development (0.3.0-dev).

## Layering

```
Swiss Ephemeris C (vendor/)
        │  tools/build-wasm.mjs — emcc (native PATH or Docker emscripten/emsdk)
        ▼
packages/core/wasm/swisseph.{mjs,wasm}          ← build artifact, NOT committed
        │  instance.ts — one-time buffer allocation, pointer-based bindings
        ▼
Typed API: createSwissEph() → SwissEph instance (packages/core/src/instance.ts)
        │
        ├── ephemeris/  file naming, sources (Memory/NodeFs/Fetch/BrowserCache)
        ├── derived/    pure astronomy/astrology built on the API:
        │               aspects, antiscia, chart-builder, declination, dignities,
        │               eclipses, heliacal, houses, lots, parans, sect, stars,
        │               timelords
        ├── generated/  constants.ts, stars.ts — regenerated from C headers/data
        ├── cache/      LRU + memoize helpers
        └── worker/     Web Worker wrapper
        ▼
Consumers: packages/mcp · viz · react-ui · advanced · your app
```

Rules that keep the layers honest:

- **The WASM boundary is narrow.** `instance.ts` allocates each C output
  buffer once (`xx[6]`, `serr[256]`, name, cusps, ...) and reuses them. C
  writes into those buffers; TypeScript reads them back. Buffer sizes are
  pinned by `test/wasm-buffers.test.ts`, which measures how many doubles C
  actually writes.
- **One WASM instance per `createSwissEph()`.** Global C state
  (`swe_set_sid_mode`, `swe_set_topo`, loaded files) is per instance, so two
  charts with different settings never contaminate each other. Verified by
  `check:api` (instance isolation section).
- **Derived modules are pure functions over the API.** They receive positions
  or the instance and return typed results; they hold no state.

## Ephemeris data model

Three precision tiers, chosen per calculation via `CalcOptions.ephemeris`:

| Model    | Source                                   | Precision            |
|----------|------------------------------------------|----------------------|
| `moshier`| Built-in analytic theory, no files       | ~0.1″ (planets)      |
| `swiss`  | `.se1` chunk files (JPL DE441-derived)   | ~0.001″ — full       |
| `jpl`    | JPL DE binary (not shipped)              | reference            |

**The silent fallback is the central trap.** When Swiss Ephemeris cannot find
a `.se1` file it does not raise an error — it falls back to Moshier and only
changes the returned flag. Every `calc()` result therefore carries an
`ephemeris` field reporting the model that actually ran; checks and tests
assert on it. For bodies with no analytic theory (asteroids beyond the built-
ins, fixed stars) a missing file raises `SwissEphError` with an actionable
message naming the npm package and mount call.

File naming (`ephemeris/files.ts`): 600-year chunks, `sepl_18.se1` =
planets 1800–2399, `semo_18.se1` moon, `seas_18.se1` main asteroids, plus
`sefstars.txt` (star catalog) and `seorbel.txt` (fictitious bodies). The file
a date needs is computable from the date alone, which is what makes the
browser `FetchEphemeris` loader possible: compute the needed files, fetch only
those, verify against the data package manifest (SHA-256), mount, calculate.

Asteroids beyond the main ephemeris (`ephemeris/asteroids.ts`): file
`asteroidFile(433)` → `ast0/se00433s.se1`; body id `asteroidBody(433)` →
`SE_AST_OFFSET + 433`. Swiss Ephemeris also searches the plain file name in
the main ephemeris directory (sweph.c fallback chain), so flat mounting works
too. `mountEphemeris()` creates nested directories for `astN/` paths
(regression-tested in `test/ephemeris-mount.test.ts`).

Data packages:

- `@kuntay/swisseph-data` — the five files above, 1800–2399, ~2 MB, with a
  manifest of SHA-256 sums and coverage ranges.
- `@kuntay/swisseph-asteroids` — 16 curated short files (1500–2100), ~0.4 MB,
  hash-verified at build time against the canonical Astrodienst distribution.

## Key design decisions

- **Instance isolation over singletons** — see above; the MCP server creates
  one instance per session.
- **Language policy**: public JSDoc and every runtime-facing string are
  English; internal comments are Turkish. `tools/check-public-language.mjs`
  enforces this (locale maps like `i18n/index.ts` and `derived/lot-names-tr.ts`
  are allow-listed data, not code).
- **Errors carry context**: `SwissEphError` includes `fn` (the C function) and
  `detail` (raw C message), and `getErrorSuggestion()` maps error codes to
  problem/solution pairs.
- **No committed binaries**: the `.wasm` artifact and all `.se1` files are
  produced in CI (emsdk build; ephemeris downloaded from the canonical
  mirror). A fresh checkout needs either `npm run build:wasm` (emcc or Docker)
  or the artifacts extracted from the published npm package.

## Build pipeline

| Script | What it does |
|---|---|
| `npm run build:wasm` | emcc compile of the 9 library `.c` files; export list parsed from `swephexp.h` (no hand-maintained list) |
| `npm run build:ts` | `tsc` for core + mcp |
| `npm run build:data` | Copies `.se1` from `$SWISSEPH_EPHE_PATH` (or `../swiss/ephe`) into `packages/data/ephe/`, writes manifest |
| `npm run build:asteroids` | Downloads/verifies the 16 asteroid files into `packages/asteroids/ephe/` |
| `npm run check:*` | The eleven verification scripts below |
| `npm run check:release` | Publish rehearsal: versions, changelogs, pack dry-run |

CI (`.github/workflows/ci.yml`) runs: emsdk → `build:wasm` → constants
regeneration check → language → typecheck → `build:ts` → smoke → fetch
ephemeris → API check → tests → golden parity → pack.

## Verification system

Two complementary layers:

1. **Vitest** (`npm test`, 18 files): unit + integration tests. Integration
   tests import the compiled `dist/` — the artifact users actually get — and
   fail fast if `src/` is newer than `dist/`.
2. **Check scripts** (`npm run check`, twelve of them): language, smoke, API,
   **golden parity**, angles, **house-system invariants**, ephemeris loaders,
   sect exactness, browser paths, data-package spec, precision, pack.
   `check:browser-real` runs separately (needs a one-time
   `npx playwright install chromium`): the demo end to end in headless
   Chromium, including the city picker's historical-timezone resolution.

The golden corpus is the core of trust: 12,930 fixture rows generated by the
native gcc build of the same C source (`swetest`), replayed through the WASM
build. 89k+ numbers compared with per-column thresholds derived from physical
significance (angles 1e-9°, distances relative 1e-12, speeds looser because
they are numerical derivatives). Two compilers, two libm implementations, two
architectures agreeing at that level is the numerical soundness proof.

## Running locally

```bash
npm install                 # root workspace
npm run build:wasm          # needs emcc on PATH, or Docker (emscripten/emsdk)
npm test
set SWISSEPH_EPHE_PATH=<dir with .se1 files>   # Windows; export on POSIX
npm run check
npm run demo                # serves examples/browser
```

No emcc/Docker available? Extract `wasm/swisseph.mjs` + `wasm/swisseph.wasm`
from the published `@kuntay/swisseph` tarball into `packages/core/wasm/`, and
the `.se1` files from `@kuntay/swisseph-data` / `@kuntay/swisseph-asteroids`
into a directory pointed to by `SWISSEPH_EPHE_PATH`. Then run
`npm run build:data` and `npm run build:asteroids` to populate the package
directories. The golden check additionally needs the `_12` and `_24` century
chunks (official `aloistr/swisseph` distribution).

## Reading order for new contributors

1. `README.md` (or `README.tr.md`) — pitch and quickstart
2. `docs/ROADMAP.md` — phase history and deliberately open items
3. `packages/core/src/instance.ts` — the WASM binding and the whole API
4. `packages/core/src/ephemeris/{files,sources,asteroids}.ts` — data loading
5. One derived module, e.g. `derived/sect.ts` — house style for that layer
6. `tools/_harness.mjs` + one check script, e.g. `tools/check-golden.mjs`
7. `packages/mcp/src/index.ts` — how the API is exposed to LLMs

## Known gaps

Tracked openly in `ROADMAP.md` §4: Vedic nakshatra junction stars (needs a
citable source), an extended asteroid tier (~100 bodies with selective
loading), and automated testing in a real browser (current browser checks run
under Node).
