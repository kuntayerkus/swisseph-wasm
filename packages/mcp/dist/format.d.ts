/**
 * Turning numbers into text an LLM reads correctly.
 *
 * This module exists because handing a model raw floats is a reliable way to
 * get wrong output. Given `54.5033` it will convert to degrees and minutes
 * itself, and it will **round** — while every piece of astrology software
 * **truncates**. That single difference produced a phantom one-arcminute
 * disagreement on four of ten bodies when this project's own demo rounded.
 *
 * So: format here, once, correctly, and give the model text it can quote
 * verbatim. The raw value goes alongside in parentheses for anything that
 * needs to compute rather than read.
 */
/**
 * Degrees, minutes and seconds within a sign — `15°23'44" Taurus`.
 *
 * Truncates, matching Solar Fire, Astro-Gold and the rest. Rounding would
 * show 29°59'60" as 30°00'00" of the *next* sign, which is a whole sign
 * wrong at the boundary.
 */
export declare function formatLongitude(longitude: number): string;
/** Signed degrees, minutes and seconds — used for declination and latitude. */
export declare function formatDeclination(declination: number): string;
/** A bare angle with no sign attached — orbs, aspect separations. */
export declare function formatAngle(degrees: number): string;
/**
 * A geographic coordinate, echoed as **both** decimal and degrees–minutes.
 *
 * The API takes decimal degrees, and the trap is that `40.18` reads as either
 * 40.18° or 40°18′ depending on who is typing. They are 12 arcminutes apart,
 * and the two readings of a full coordinate pair moved the Ascendant of a real
 * chart by 35′ — enough to argue with another program about, and nothing in
 * the output said which one had been used.
 *
 * Neither reading can be detected from the number: `40.18` is a perfectly
 * valid decimal latitude. So we do not guess. We print the interpretation that
 * was actually applied in the other notation as well, where a mistyped
 * coordinate is obvious at a glance.
 */
export declare function formatCoordinate(degrees: number, positive: string, negative: string): string;
/**
 * A Julian day as a readable UT timestamp.
 *
 * @param calendarDate the instance's `calendarDate()`, injected so this
 *                     module needs no live instance of its own
 */
export declare function formatJulianDay(jd: number, calendarDate: (jd: number) => {
    year: number;
    month: number;
    day: number;
    hour: number;
}): string;
/**
 * Rewrites a library error into something an MCP caller can act on.
 *
 * The core message is right for the audience it was written for and wrong for
 * this one. It tells the reader to call `mountEphemeris({ 'seas_18.se1':
 * bytes })` — correct advice for a developer holding the API, and an
 * instruction to *write code* when the reader is a language model holding
 * nothing but this tool. That is the exact failure this server exists to
 * prevent: handed a body it could not get, a model goes off and produces a
 * number some other way, and the answer stops being computed.
 *
 * So the tool surface says what the operator must install, and says plainly
 * that the missing body must be left missing. The rest of the chart is
 * unaffected and stays.
 *
 * Anything that is not a missing-file error passes through untouched; those
 * are genuine calculation failures and their wording is already correct.
 */
export declare function explainUnavailable(message: string): string;
/** Pads a label so columns line up — an LLM parses aligned text more reliably. */
export declare function pad(text: string, width: number): string;
/** Joins sections with a blank line, dropping the empty ones. */
export declare function sections(...parts: (string | null | undefined | false)[]): string;
//# sourceMappingURL=format.d.ts.map