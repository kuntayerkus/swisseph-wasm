/**
 * Web Worker for non-blocking astrological calculations.
 *
 * This worker handles expensive computations (ephemeris calculations,
 * multiple chart generations, asteroid positions) on a background thread
 * to prevent UI blocking.
 *
 * @example
 * ```typescript
 * const worker = new SwissEphWorker();
 *
 * const chart = await worker.calculateNatalChart({
 *   year: 1990,
 *   month: 5,
 *   day: 15,
 *   hour: 14,
 *   minute: 30,
 *   latitude: 39.93,
 *   longitude: 32.86,
 *   houseSystem: 'P',
 * });
 *
 * worker.terminate();
 * ```
 */
import type { NatalChartConfig } from '../derived/chart-builder.js';
export interface WorkerMessage {
    type: WorkerMessageType;
    id: string;
    payload?: unknown;
}
export type WorkerMessageType = 'INIT' | 'CALC_NATAL' | 'CALC_TRANSIT' | 'CALC_RETURN' | 'TERMINATE' | 'ERROR' | 'RESULT';
export interface WorkerResponse<T = unknown> {
    type: 'RESULT' | 'ERROR';
    id: string;
    data?: T;
    error?: string;
}
export interface NatalChartPayload {
    config: NatalChartConfig;
}
export interface TransitChartPayload {
    natalConfig: NatalChartConfig;
    transitDate: {
        year: number;
        month: number;
        day: number;
        hour?: number;
    };
    options?: {
        aspects?: number[];
        orb?: number;
    };
}
export interface ReturnChartPayload {
    natalJd: number;
    returnType: 'sun' | 'moon' | 'generic';
    body?: number;
    targetYear?: number;
    options?: {
        after?: number;
        precessionCorrected?: boolean;
    };
}
//# sourceMappingURL=swisseph-worker.d.ts.map