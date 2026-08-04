#!/usr/bin/env node
/**
 * Swiss Ephemeris as a Model Context Protocol server.
 *
 * A language model cannot compute an ephemeris. Asked for a chart it will
 * produce something well-shaped and wrong, because the arithmetic — a
 * multi-thousand-term series, ΔT, nutation, aberration — is not something
 * that can be reasoned out. This server hands the work to a WebAssembly build
 * of Swiss Ephemeris and returns finished text.
 *
 * Two principles shape the tool surface.
 *
 * **Coarse tools, not a mirror of the API.** One `natal_chart` call returns
 * positions, houses, aspects, dignities and lots together. A model given
 * twelve fine-grained tools would chain them, spend tokens, and — worse —
 * derive the parts that were not returned by itself.
 *
 * **Text, not floats.** Positions come back as `24°30'12" Taurus` with the
 * decimal alongside. Given only `54.5033` a model converts it itself and
 * rounds, while astrology software truncates; that difference alone produced
 * a phantom one-arcminute error on four of ten bodies in this project's own
 * demo.
 *
 * Licence note: this server links AGPL-3.0 code. Running it locally for
 * yourself carries no obligation. Exposing it as a hosted service does —
 * see the README.
 */
export {};
//# sourceMappingURL=index.d.ts.map