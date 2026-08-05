/**
 * Chart computation and rendering.
 *
 * Everything a model needs about one moment and place, gathered in a single
 * pass and rendered as aligned text. The shape of this output is the whole
 * point of the server: a model given ten separate tools would call them in
 * sequence, burn tokens, and derive the interesting parts — aspects above
 * all — by itself, badly. Handing it the finished analysis removes the
 * opportunity.
 */
import { type AspectPoint, type OrbScheme, type SwissEph } from '@kuntay/swisseph';
export declare const ORB_SCHEMES: Record<string, OrbScheme>;
export interface ChartPlace {
    latitude: number;
    longitude: number;
    label?: string;
}
export interface BodyPosition {
    name: string;
    /**
     * The Swiss Ephemeris body constant. **Absent for derived points**: the
     * south node has no constant because it is not an object, it is the point
     * opposite the north node.
     */
    body?: number;
    longitude: number;
    speed: number;
    retrograde: boolean;
    declination: number;
    /**
     * Points that are not independent of one another, passed straight through
     * to {@link AspectPoint.group} so they are never aspected together. The
     * two lunar nodes are the case: they are 180° apart by construction, so
     * "north node opposition south node, orb 0°00'" is guaranteed in every
     * chart and sorts to the top of every aspect list.
     */
    group?: string;
    /** Set when the body needed a data file that is not present. */
    unavailable?: string;
}
export interface Chart {
    jd: number;
    place: ChartPlace;
    positions: BodyPosition[];
    houses: ReturnType<SwissEph['houses']>;
    sect: ReturnType<SwissEph['lots']>['sect'];
    lots: ReturnType<SwissEph['lots']>['lots'];
    houseSystem: string;
    /** True when at least one body fell back to Moshier. */
    anyMoshier: boolean;
}
export declare function computeChart(swe: SwissEph, jd: number, place: ChartPlace, houseSystem?: string): Chart;
/** Chart bodies as aspect points, optionally with the angles included. */
export declare function aspectPoints(chart: Chart, includeAngles?: boolean): AspectPoint[];
export declare function renderPositions(chart: Chart): string;
export declare function renderHouses(chart: Chart): string;
/**
 * Sıralamayı açıkça yazmamız gerekiyor.
 *
 * `findAspects()` GÜCE göre sıralıyor: (1 - orb/izin) × açının ağırlığı.
 * Sextile'ın ağırlığı 0.7 olduğu için 1°33'lük bir sextile, 3°39'lük bir
 * kavuşumun ALTINA düşüyor. Bu çekirdeğin bilinçli tercihi ve doğru.
 *
 * Ama görünen sütun `orb`. Sıralamayı söylemezsek "bu haritadaki en sıkı
 * açılar" diye sorulan model listenin başını okur ve yanlış cevap verir —
 * kendi hatası değil, bizim metnimizin hatası olur.
 */
export declare const ASPECT_ORDER_NOTE: string;
export declare function renderAspects(points: AspectPoint[], schemeName: string, heading?: string): string;
export declare function renderDignities(swe: SwissEph, chart: Chart): string;
export declare function renderLots(chart: Chart): string;
export declare function renderSect(chart: Chart): string;
//# sourceMappingURL=chart.d.ts.map