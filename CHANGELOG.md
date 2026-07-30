# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Note that the vendored Swiss Ephemeris version (`2.10.03`) is independent of
this package's version; upstream changes are called out explicitly.

## [0.1.0] — 2026-07-31

First release. Everything below is the work leading up to it.

### Added

- Swiss Ephemeris 2.10.03 compiled to WebAssembly — 230 KB brotli, all 106
  exported functions, works with no data files via the built-in Moshier theory.
- Typed TypeScript API with `createSwissEph()`, which hands out an isolated
  WebAssembly instance per call. Swiss Ephemeris keeps all state in one global
  C struct, so sharing an instance leaks settings between concurrent requests.
- Numerical parity verification against a natively compiled reference: 89,224
  values, worst angular disagreement 4.5e-7 arcseconds.
- Independent verification of the angles: Midheaven and Ascendant recomputed
  from spherical trigonometry, agreeing to 1.8″ and 8.7″.
- Ephemeris loaders — `MemoryEphemeris`, `FetchEphemeris` (with a pluggable
  cache and a jsDelivr default), `NodeFsEphemeris` — plus
  `mountEphemerisDirectory()` for zero-copy NODEFS mounting on servers.
- Data packages: `@kuntay/swisseph-data` (2.05 MB, 1800–2399 CE) and
  `@kuntay/swisseph-asteroids` (409 KB, 16 bodies, 1500–2100 CE).
- Arabic lots: the seven Hermetic lots plus nine common ones, each carrying its
  source. Dependencies between lots resolve automatically; `LOT_VARIANTS`
  offers documented alternatives where traditions disagree.
- Sect determination with a documented method choice, defaulting to the Sun's
  true altitude.
- Essential dignities: domicile, exaltation, detriment, fall, triplicity,
  Egyptian bounds, Chaldean faces, and classical scoring.
- Fixed star curation: 72 stars in four groups, generated from the catalogue.
- Aspects with three orb schemes — modern by-aspect, traditional moieties, and
  a tight scheme — plus custom schemes, synastry via `findAspectsBetween()`,
  and applying/separating detection that handles retrograde motion.
- Antiscia and contra-antiscia.
- Declination work: `equatorial()`, `obliquity()`, parallels and
  contraparallels, and out-of-bounds detection against the obliquity of the
  date rather than a constant.
- Rise, set and culmination times via `riseTransit()`, reporting circumpolar
  objects as "does not occur" instead of throwing.
- Parans: `angleEvents()` produces the four angle times per object and
  `findParans()` matches them, comparing modulo one day so a contact across
  midnight is not missed.
- Returns — solar, lunar and arbitrary bodies — with an optional
  precession-corrected variant. `nextCrossing()` exposes the underlying
  search, which uses Swiss Ephemeris's own routines for the Sun and Moon.
- Eclipses: solar and lunar, global and local, with type filtering and
  backward search, and timings mapped to named fields.
- Heliacal risings and settings via `heliacal()`, with typed atmosphere and
  observer parameters.
- Profections (annual, monthly, daily) and Persian firdaria with sub-periods,
  both with an explicit year-length choice.
- Generated constants for rise/transit bits, eclipse flags and heliacal
  events, curated by name so the header's ambiguous groups cannot leak in.
- Browser demo exercising the WebAssembly path end to end.
- `@kuntay/swisseph-mcp`, a Model Context Protocol server over stdio, with
  eight coarse tools: `natal_chart`, `transits`, `synastry`, `return_chart`,
  `eclipses`, `rise_set`, `time_lords` and `declinations`. The tools are
  deliberately coarse rather than a mirror of the API — one `natal_chart` call
  returns positions, houses, aspects, dignities, lots and sect together,
  because a model handed twelve fine-grained tools chains them and then
  derives the parts it was not given.
- MCP output is formatted text, not floats. A model given `54.5033` converts
  it itself and **rounds**, while astrology software **truncates**; that
  difference alone produced a phantom one-arcminute error on four of ten
  bodies in this project's own demo. Positions come back as `24°30'11" Taurus`
  with the decimal alongside.
- MCP tools take local clock time plus a zone and echo the derived UT back.
  Passing a birth time through as UT is the single most common way to produce
  a wrong chart — for Ankara it moves the Ascendant about 36°. IANA zone names
  are preferred over fixed offsets so historical daylight saving is right.
- One Swiss Ephemeris instance per MCP tool call, disposed afterwards, since
  the library keeps all state in one global C struct. Measured at about 9 ms
  against 0.6 ms for a full chart.
- MCP end-to-end tests drive a real client over stdio as a child process
  rather than calling the handlers directly, because the protocol is the
  package's only job.
- Release tooling: `check:release` refuses to publish on stale artifacts,
  `-dev` versions, `private` packages, version mismatches or empty manifests.

### Fixed

These were found during development, before any release. They are recorded
because each represents a class of mistake the test suite now guards against.

- **Sect was inverted below the horizon.** A double negation made the rule
  report "day" while the Sun was below the horizon.
- **`houses()` threw above the polar circle.** Swiss Ephemeris returns `-1`
  when it substitutes Porphyry for an undefined house system, but still fills
  in valid cusps — that `-1` is a warning, not a failure. Treating it as an
  error made the library unusable above 66.5°N, which is 4.9% of the reference
  corpus. Results now report `substituted` instead.
- **The ascendant-based sect rule breaks beyond the polar circle.** It is exact
  up to 66.5° and then degrades sharply — at 70°N it can call a chart nocturnal
  while the Sun stands 11° above the horizon. The default is now the Sun's true
  altitude.
- **The Lot of Basis used the wrong rule.** It takes the shorter arc between
  Fortune and Spirit, not a sect mirror.
- **`FetchEphemeris` failed in browsers** with "Illegal invocation" — `fetch`
  requires its receiver to be the global object, a constraint Node does not
  enforce, so Node tests could not see it.
- **Curated star metadata was wrong** where it had been typed by hand
  (Betelgeuse's magnitude was 0.50 rather than 0.42), and galactic reference
  points leaked into the "bright" group because the catalogue records them with
  magnitude 0. Both tables are now generated from the catalogue.
- **Generated constants silently produced `undefined`** because the header
  writes `# define` with a space in places; ten constants were missing.
- **`HouseSystem` had a duplicate key.** Codes `A` and `E` are aliases for the
  same equal-house system, so one silently overwrote the other.
- **Reported build size was not deterministic** — the size report measured its
  own output file, so a rebuild reported 1 KB more than a clean build.
- **Profection could land a year early.** Asked for at the exact anniversary —
  which is the normal thing to do, since that is when the profection changes —
  the subtraction of two Julian days near 2.45e6 lost enough precision for
  `floor()` to return the previous year. A stated tolerance of 31 microseconds
  now absorbs it.
- **`OBLIQUITY_J2000` was the IAU 1976 value** (84381.448″) while Swiss
  Ephemeris returns the IAU 2006 one (84381.406″), so the library's own
  constant disagreed with the library by 0.042″.

Found by an independent audit of the green tree — every one of these passed
`typecheck` and the full suite, which is why each now has a test:

- **`HouseSystem.GauquelinSectors` returned 12 of its 36 sectors.** The cusp
  buffer was correctly sized at 37 (`swehouse.c:118`); the *read* was hard-coded
  to 13. The twelve values returned were real ones, so nothing looked broken and
  the truncation had made it into the documentation. `cusps.length` is now 36 for
  `'G'` — except beyond the polar circle, where Swiss Ephemeris drops to 12
  Porphyry cusps (`swehouse.c:665`) and returning 36 would have meant padding
  with zeros.
- **`COMMON_LOTS` could not be passed to `calculateLots()`.** Every call threw:
  `Basis` depends on `lot:Fortune` and `lot:Spirit`, which live in
  `HERMETIC_LOTS`, and dependency resolution only consulted the set it was
  handed. References outside the set now fall back to `ALL_LOTS`, and only the
  keys asked for are returned. Renamed to `NON_HERMETIC_LOTS`, which says what
  the set is; the old name remains as an alias.
- **Invalid calendar dates were accepted and silently moved.** `1990-02-31`
  passed a `day <= 31` check and `swe_julday` shifted it to 3 March while the
  server echoed the date back as written. `daysInMonth()` — already present and
  correct, never called — now validates it, keeping the pre-reform Julian leap
  rule so `1500-02-29` stays valid and `1900-02-29` does not.
- **`profection().month.house` and `.day.house` were not houses.** They were
  derived from the step count, which for the month means the position within the
  profection year and for the day the position within the month. All three units
  now count from the natal Ascendant; the sequence numbers remain in
  `month.index` and `day.index`.
- **`Etc/GMT+3` was accepted and means UTC−3.** These zones follow the inverted
  POSIX sign convention, so an Istanbul birth given `Etc/GMT+3` was off by six
  hours — roughly 90° of Ascendant. It is now rejected with an explanation, and
  the `UTC+3` / `GMT+03:00` spellings an LLM is likely to produce are accepted
  and interpreted the ISO way.
- **`calculateLots()` accepted any `sect` value.** Anything other than
  `'night'` — `'DAY'`, `'daytime'`, `''`, or the `SectResult` object itself —
  quietly took the day branch, making a missing value a default rather than an
  error. It now throws, and accepts `determineSect()`'s result directly.
- **73 Turkish strings reached the public surface.** Lot names, sources, notes,
  star meanings and error messages are data that leaves the process — into a
  caller's UI and into the MCP answers a model reads. They are now English;
  `check:language` keeps them that way. The Turkish lot names are preserved in
  `LOT_NAMES_TR` for callers who want them. Internal comments stay Turkish.
- **Missing-ephemeris errors pointed at a path that does not exist.** The
  library's own text names the virtual WebAssembly search path
  (`'.:/users/ephe/'`), sending the reader to look on their disk. The message now
  names the file, the package that ships it and how to mount it; the raw text is
  kept in `SwissEphError.detail`, with the file in `.missingFile`.
- **`.gitignore` ignored nothing it claimed to.** Git does not treat a trailing
  `#` as a comment, so three build-output rules were meaningless patterns and
  `packages/mcp/dist/` had no rule at all — the first `git add .` would have
  committed the WASM binary, every `dist/`, and a `sizes.json` containing an
  absolute home-directory path. The paths are now real rules and `sizes.json`
  records a repo-relative path.

### Changed

- `check:release` now also verifies what it was documented to verify: that
  cross-package dependency ranges match the version being published (a
  mismatch would publish the MCP server against a version that never exists,
  and npm publishes are irreversible), that `dist/` and `wasm/` are newer than
  their sources, and that every manifest `sha256` matches the bytes on disk.
- Asteroid downloads are verified against `tools/asteroid-hashes.json`. The
  hashes recorded in the manifest were self-referential — "this is the hash of
  what I downloaded", not "what I downloaded is the right file" — while the
  files come from a volunteer HTTP mirror.
- The published asteroid manifest names the canonical upstream source. The
  volunteer mirror is now only in the build script, so a manifest served from
  jsDelivr no longer advertises it as the place to fetch data from.
- `src/` is published alongside `dist/`. The 40 source maps pointed at a
  directory that was not in the package, so 139 KB shipped without working.
  `inlineSources` was measured as the alternative: it fixes `.js.map` but not
  `.d.ts.map`, and costs more (484 KB tarball versus 460 KB).
- `noUnusedLocals` and `noUnusedParameters` are on. The dead `daysInMonth()`
  behind the date bug was exactly what they catch.
- A skipped check group now says so loudly, and fails outright under `CI`. The
  asteroid numerical verification silently did not run whenever the mirror was
  unreachable, and CI stayed green; `continue-on-error` has been removed from
  that step, since the release workflow already depends on the mirror.

### Notes

- Licensed AGPL-3.0-or-later, following Swiss Ephemeris's dual-licence terms.
  Network use obliges you to release your application's source; see
  [NOTICE](NOTICE).
- The browser path is verified by simulating the browser's stricter constraints
  in Node. Automated testing in a real browser is still outstanding.
