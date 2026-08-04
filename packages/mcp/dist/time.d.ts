/**
 * Local civil time to Universal Time.
 *
 * This is the single largest source of wrong charts, and an LLM will get it
 * wrong by default — it will pass a birth time straight through as UT. A
 * birth in Ankara at 17:30 local is 14:30 UT, and using 17:30 moves the
 * Ascendant by about 36 degrees. Not a rounding error; a different chart.
 *
 * Historical offsets are the second trap. Türkiye observed daylight saving
 * until 2016 and has been at a fixed +03 since, so a May 1990 birth in Ankara
 * is +03 (summer time) while a January 1990 birth is +02. Anyone supplying a
 * fixed numeric offset from memory gets one of those wrong. Passing an IANA
 * zone name lets the platform's own tz database answer, which is why it is
 * the recommended form.
 */
export declare const Calendar: {
    readonly Julian: 0;
    readonly Gregorian: 1;
};
/** Verilen takvim tarihinin hangi takvimde okunması gerektiği. */
export declare function calendarFor(year: number, month: number, day: number): number;
/** Bir Jülyen gününün hangi takvimde gösterilmesi gerektiği. */
export declare function calendarForJulianDay(jd: number): number;
/** How the caller expressed the zone, and what it resolved to. */
export interface ResolvedTime {
    /** Julian day, Universal Time — what Swiss Ephemeris wants. */
    julianDay: number;
    /** Offset actually applied, in hours east of Greenwich. */
    offsetHours: number;
    /** Human-readable offset, e.g. `"+03:00"`. */
    offsetLabel: string;
    /** The local time as given, echoed back for confirmation. */
    localLabel: string;
    /** The derived UT, echoed back for confirmation. */
    utcLabel: string;
    /** How the offset was determined. */
    source: 'iana' | 'fixed' | 'utc';
    /** The zone as the caller gave it. */
    zone: string;
    /**
     * True when the local time occurs **twice** in the zone — the repeated hour
     * of a daylight-saving fall-back.
     *
     * The instant is genuinely ambiguous: 03:30 on 2015-11-08 in Istanbul
     * happened once at +03 and again an hour later at +02, and a birth record
     * that gives only the wall clock cannot distinguish them. One of the two is
     * used; `alternativeOffsetHours` gives the other.
     *
     * The mirror case, a nonexistent time inside a spring-forward gap, is **not**
     * flagged: there is no ambiguity there, only an hour that never happened, and
     * the input maps to the instant the clock jumped to — what every civil
     * registry does. See {@link wallClockToUtc}.
     */
    ambiguous?: boolean;
    /**
     * The offset of the occurrence that was **not** used, in hours. Present only
     * when `ambiguous` is true. An hour of difference in UT, which is roughly 15°
     * of Ascendant.
     */
    alternativeOffsetHours?: number;
}
/** Formats hours east of Greenwich as `"+03:00"`. */
export declare function formatOffset(hours: number): string;
/** Formats a decimal hour as `HH:MM:SS`. */
export declare function formatClock(decimalHour: number): string;
export interface TimeInput {
    /** Calendar date, `YYYY-MM-DD`. A leading `-` denotes a BCE year. */
    date: string;
    /** Local clock time, `HH:MM` or `HH:MM:SS`. */
    time: string;
    /**
     * IANA zone name (`Europe/Istanbul`), a fixed offset (`+03:00`), or `UTC`.
     */
    timezone: string;
}
/**
 * Resolves a local civil time to a Julian day in Universal Time.
 *
 * @param julday the instance's `julianDay()`, injected so this module stays
 *               free of any dependency on a live WebAssembly instance
 */
export declare function resolveTime(input: TimeInput, julday: (year: number, month: number, day: number, hour: number) => number): ResolvedTime;
//# sourceMappingURL=time.d.ts.map