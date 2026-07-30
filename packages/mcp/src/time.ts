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

/**
 * Takvim reformu: 1582-10-15, ilk Gregoryen gün. Ondan önceki tarihler
 * JÜLYEN takvimindedir.
 *
 * Bunu atlamak sessiz ve büyük bir hata veriyordu. `swe_julday` takvim
 * bayrağını parametre alıyor ve varsayılanı Gregoryen; MÖ 44'ün 15 Mart'ını
 * proleptik Gregoryen okumak Jülyen gününü 2 gün kaydırıyor, 1000 CE'de 5 gün.
 * Ölçtük: MÖ 44 için Ay 23.9 derece — neredeyse tam bir burç — yanlış çıkıyor,
 * yani harita başka bir haritaya dönüşüyor. Üstelik hiçbir şey yanlış
 * görünmüyor, çünkü tarih kullanıcının yazdığı gibi geri yazdırılıyor.
 *
 * "15 Mart MÖ 44" diyen biri tarihsel tarihi kastediyor; Sezar o gün
 * Jülyen takvimine göre öldürüldü — takvimin adını taşıyan adam olarak.
 */
const GREGORIAN_REFORM_JD = 2299160.5;

export const Calendar = { Julian: 0, Gregorian: 1 } as const;

/** Verilen takvim tarihinin hangi takvimde okunması gerektiği. */
export function calendarFor(year: number, month: number, day: number): number {
  const beforeReform = year < 1582
    || (year === 1582 && (month < 10 || (month === 10 && day < 15)));
  return beforeReform ? Calendar.Julian : Calendar.Gregorian;
}

/** Bir Jülyen gününün hangi takvimde gösterilmesi gerektiği. */
export function calendarForJulianDay(jd: number): number {
  return jd < GREGORIAN_REFORM_JD ? Calendar.Julian : Calendar.Gregorian;
}

/**
 * Ayın gün sayısı, doğru takvimin artık yıl kuralıyla.
 *
 * Jülyen takviminde her 4 yıl artık; Gregoryen'de yüzyıllar 400'e bölünmezse
 * değil. Reform öncesi bir tarihte Gregoryen kuralını uygulamak 1500-02-29'u
 * yok sayardı, oysa o gün Jülyen takviminde vardı.
 */
function daysInMonth(year: number, month: number): number {
  if (month !== 2) return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const leap = calendarFor(year, month, 29) === Calendar.Julian
    ? ((year % 4) + 4) % 4 === 0
    : (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 29 : 28;
}

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

/**
 * Sabit ofset yazımları: `+03:00`, `-0530`, `+3` ve `UTC+3` / `GMT+03:00`.
 *
 * `UTC`/`GMT` öneki bilerek kabul ediliyor: LLM'ler bu biçimi sıklıkla
 * üretiyor ve anlamı tartışmasız — burada işaret POSIX değil ISO yönünde,
 * yani `UTC+3` gerçekten UTC+3. Anlaşılır bir hata vermek yerine doğru
 * cevabı vermek daha iyi.
 */
const FIXED_OFFSET = /^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/i;

/**
 * `Etc/GMT+3` gibi ofset bölgeleri POSIX işaret kuralını izler ve TERSİNE
 * çalışır: `Etc/GMT+3` = UTC−3.
 *
 * `Intl` bunu sessizce kabul ediyor, dolayısıyla İstanbul doğumuna `Etc/GMT+3`
 * yazmak 6 saatlik bir UT hatası, o enlemde ~90° Yükselen sapması demek.
 * İşin can alıcı yanı: `GMT+3` ve `UTC+3` gibi biçimler zararsız olanlardı;
 * sessizce kabul edilen biçim tam olarak tehlikeli olanıydı. Ve `Etc/GMT+3`,
 * bir LLM'e "UTC+3'ü IANA adı olarak yaz" dendiğinde üreteceği en olası
 * string.
 *
 * Her İKİ işareti de reddediyoruz. `Etc/GMT-3`'ün UTC+3 vermesi doğru
 * sonucun tesadüfü: onu UTC−3 kastederek yazan biri yine 6 saat yanılır.
 */
const POSIX_OFFSET_ZONE = /^Etc\/GMT[+-]\d/i;

/**
 * The zone's offset from UTC at a given instant, in milliseconds.
 *
 * Formats the instant in the target zone, reads the wall-clock fields back,
 * and treats them as if they were UTC. The difference is the offset. This is
 * the standard technique and it is correct across DST transitions and
 * historical offset changes, because `Intl` consults the tz database.
 */
function zoneOffsetMs(utcMs: number, zone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utcMs))) {
    parts[part.type] = part.value;
  }

  // hour12:false yields "24" for midnight in some ICU versions; normalise.
  const hour = Number(parts.hour) % 24;
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second),
  );
  return asIfUtc - utcMs;
}

/**
 * Wall-clock time in a zone to the UTC instant.
 *
 * Two passes. The first guess treats the wall clock as UTC and measures the
 * offset there; the second re-measures at the corrected instant, which
 * matters when the guess and the answer sit on opposite sides of a DST
 * transition.
 *
 * Times inside a spring-forward gap do not exist. Rather than reject them,
 * the offset before the transition is used, which maps the input to the
 * instant the clock jumped to — the same thing every civil registry does with
 * a birth recorded in a nonexistent hour.
 *
 * The autumn case is the opposite: the repeated hour of a fall-back happens
 * **twice**, at two different offsets, and both are valid answers. Which one
 * the two passes land on depends on which side of the transition the initial
 * UTC guess falls, so it varies by zone — measured: Istanbul 2015-11-08 03:30
 * resolves to the later (+02) occurrence, New York 2020-11-01 01:30 to the
 * earlier (−04) one. The selection is left exactly as it was; what is new is
 * that it no longer happens silently. `alternativeOffsetHours` carries the
 * offset of the occurrence **not** chosen, so a caller can report both without
 * having to know which way the algorithm leaned.
 */
function wallClockToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  zone: string,
): { utcMs: number; offsetMs: number; alternativeOffsetMs: number | null } {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = guess - zoneOffsetMs(guess, zone);
  const offsetMs = zoneOffsetMs(firstPass, zone);
  const utcMs = guess - offsetMs;

  /*
   * Tekrarlanan saati OLMAYAN saatten ayırıyoruz.
   *
   * "İki geçiş farklı ofset ölçtü" demek yetmiyor: ilkbahar boşluğu da öyle
   * görünüyor, oysa orada belirsizlik YOK — o saat hiç yaşanmadı, dolayısıyla
   * seçenek de yok. İkisini karıştırmak uyarıyı anlamsızlaştırırdı.
   *
   * Doğru sınama aday ofsetler üzerinden: geçişin iki yanındaki ofsetleri al
   * ve her biri için "bu ofsetle hesaplanan ana geri dönüp ofseti yeniden
   * ölçersem aynısını bulur muyum" diye sor. Kendini doğrulayan her aday,
   * duvar saatinin gerçek bir karşılığı demek.
   *
   *   iki aday da doğrulanıyor → saat İKİ KEZ yaşandı (belirsiz)
   *   hiçbiri doğrulanmıyor    → saat hiç yaşanmadı (ilkbahar boşluğu)
   *   tek aday                 → sıradan saat
   */
  const DAY_MS = 86_400_000;
  const candidates = new Set([
    zoneOffsetMs(guess - DAY_MS, zone),
    zoneOffsetMs(guess + DAY_MS, zone),
  ]);
  const valid = [...candidates].filter((o) => zoneOffsetMs(guess - o, zone) === o);

  const alternativeOffsetMs = valid.length > 1
    ? valid.find((o) => o !== offsetMs) ?? null
    : null;

  return { utcMs, offsetMs, alternativeOffsetMs };
}

/** Formats hours east of Greenwich as `"+03:00"`. */
export function formatOffset(hours: number): string {
  const sign = hours < 0 ? '-' : '+';
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Formats a decimal hour as `HH:MM:SS`. */
export function formatClock(decimalHour: number): string {
  const total = Math.round(decimalHour * 3600);
  return `${two(Math.floor(total / 3600) % 24)}:${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
}

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
export function resolveTime(
  input: TimeInput,
  julday: (year: number, month: number, day: number, hour: number) => number,
): ResolvedTime {
  const dateMatch = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(input.date.trim());
  if (!dateMatch) {
    throw new Error(
      `date "${input.date}" was not understood. Expected YYYY-MM-DD ` +
      '(astronomical year numbering for BCE: -0043 = 44 BCE).');
  }
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input.time.trim());
  if (!timeMatch) {
    throw new Error(
      `time "${input.time}" was not understood. Expected HH:MM or HH:MM:SS.`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);

  if (month < 1 || month > 12) throw new Error(`Month must be 1-12: ${month}`);

  /*
   * Ayın gerçek gün sayısına karşı doğrula, sabit 31'e karşı değil.
   *
   * `day <= 31` kontrolü 1990-02-31'i geçiriyordu ve swe_julday şikâyet
   * etmeden 3 Mart'a taşıyordu. Sonuç bu modülün tam olarak engellemek için
   * var olduğu şey: YANLIŞ bir tarih, kullanıcının yazdığı hâliyle geri
   * yazılıyor. 1900-02-29 kabul ediliyordu — Gregoryen'de olmayan bir gün,
   * ve "plausible-looking guess"in ders kitabı örneği.
   *
   * daysInMonth() reform öncesi Jülyen artık yıl kuralını kullandığından
   * 1500-02-29 (Jülyen'de vardı) doğru biçimde kabul edilmeye devam eder.
   */
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    const calendarName = calendarFor(year, month, 1) === Calendar.Julian
      ? 'Julian' : 'Gregorian';
    throw new Error(
      `"${input.date}" is not a real date: month ${month} of ${year} has ` +
      `${maxDay} days in the ${calendarName} calendar.`);
  }
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Time out of range: ${input.time}`);
  }

  const zone = input.timezone.trim();
  const localLabel = `${input.date} ${formatClock(hour + minute / 60 + second / 3600)}`;
  const localDecimal = hour + minute / 60 + second / 3600;

  let offsetHours: number;
  let source: ResolvedTime['source'];
  let alternativeOffsetHours: number | null = null;

  // IANA yoluna GİRMEDEN reddet: Intl bu bölgeyi sessizce kabul eder.
  if (POSIX_OFFSET_ZONE.test(zone)) {
    const [, sign, hours] = /([+-])(\d{1,2})/.exec(zone)!;
    const asWritten = `${sign}${hours.padStart(2, '0')}:00`;
    const actualMeaning = `${sign === '-' ? '+' : '-'}${hours.padStart(2, '0')}:00`;
    throw new Error(
      `"${zone}" uses the inverted POSIX sign convention: it means ` +
      `UTC${actualMeaning}, not UTC${asWritten}. If you meant UTC${asWritten}, ` +
      `pass "${asWritten}" as a fixed offset; otherwise pass a real zone name ` +
      'like "Europe/Istanbul", which also gets historical DST right.');
  }

  if (/^(utc|gmt|z)$/i.test(zone)) {
    offsetHours = 0;
    source = 'utc';
  } else if (FIXED_OFFSET.test(zone)) {
    const [, sign, h, m] = FIXED_OFFSET.exec(zone)!;
    offsetHours = (Number(h) + Number(m ?? 0) / 60) * (sign === '-' ? -1 : 1);
    source = 'fixed';
  } else {
    /*
     * IANA yolu JS Date'e dayanıyor ve o proleptik Gregoryen takvim kullanıyor.
     * 1582 öncesi tarihlerde takvim reformu ve LMT belirsizliği devreye girer;
     * orada sabit ofset istemek, sessizce yanlış bir sonuç vermekten iyi.
     */
    if (year < 1583) {
      throw new Error(
        `An IANA timezone ("${zone}") cannot be used for the year ${year}: ` +
        'local time before the calendar reform is undefined. Pass a fixed ' +
        'offset instead (e.g. "+02:00"), or "UTC" if the time is already UT.');
    }
    try {
      const resolved = wallClockToUtc(year, month, day, hour, minute, second, zone);
      offsetHours = resolved.offsetMs / 3_600_000;
      alternativeOffsetHours = resolved.alternativeOffsetMs === null
        ? null : resolved.alternativeOffsetMs / 3_600_000;
      source = 'iana';
    } catch {
      throw new Error(
        `timezone "${zone}" was not recognised. Pass an IANA name ` +
        '("Europe/Istanbul"), a fixed offset ("+03:00"), or "UTC".');
    }
  }

  // UT saati 0-24 dışına taşabilir; taşma günü kaydırıyor ve swe_julday
  // bunu kendisi doğru ele alıyor (kesirli gün eklemekle aynı şey).
  const utDecimal = localDecimal - offsetHours;
  const julianDay = julday(year, month, day, utDecimal);

  const shiftedDays = Math.floor(utDecimal / 24);
  const utClock = formatClock(((utDecimal % 24) + 24) % 24);
  const dayWord = Math.abs(shiftedDays) === 1 ? 'day' : 'days';
  const dayNote = shiftedDays === 0 ? ''
    : shiftedDays > 0 ? ` (+${shiftedDays} ${dayWord})` : ` (${shiftedDays} ${dayWord})`;

  return {
    julianDay,
    offsetHours,
    offsetLabel: formatOffset(offsetHours),
    localLabel,
    utcLabel: `${utClock} UT${dayNote}`,
    source,
    zone,
    ...(alternativeOffsetHours !== null
      ? { ambiguous: true, alternativeOffsetHours }
      : {}),
  };
}
