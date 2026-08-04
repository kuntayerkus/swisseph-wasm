/**
 * High-level wrapper for the Swiss Ephemeris Web Worker.
 *
 * Provides a Promise-based API for non-blocking astrological calculations.
 * Automatically handles worker initialization, message passing, and cleanup.
 *
 * @example
 * ```typescript
 * import { SwissEphWorker } from '@kuntay/swisseph';
 *
 * const worker = new SwissEphWorker();
 *
 * try {
 *   await worker.init();
 *
 *   const chart = await worker.calculateNatalChart({
 *     date: { year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
 *     latitude: 39.93,
 *     longitude: 32.86,
 *     houseSystem: 'P',
 *   });
 *
 *   console.log(chart.sun);
 * } finally {
 *   worker.terminate();
 * }
 * ```
 */
import type { NatalChartConfig, TransitChart } from '../derived/chart-builder.js';
import type { ReturnResult } from '../instance.js';
export interface SwissEphWorkerOptions {
    /** Path to the worker script (default: auto-detected) */
    workerPath?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Timeout for calculations in milliseconds (default: 30000) */
    timeout?: number;
}
export declare class SwissEphWorker {
    private worker;
    private initialized;
    private pendingRequests;
    private requestCounter;
    private readonly debug;
    private readonly timeout;
    constructor(options?: SwissEphWorkerOptions);
    /**
     * Initialize the worker and load Swiss Ephemeris.
     * Must be called before any calculations.
     */
    init(): Promise<void>;
    /**
     * Calculate a natal chart.
     */
    calculateNatalChart(config: NatalChartConfig): Promise<any>;
    /**
     * Calculate transit chart.
     */
    calculateTransits(natalConfig: NatalChartConfig, transitDate: {
        year: number;
        month: number;
        day: number;
        hour?: number;
    }, options?: {
        aspects?: number[];
        orb?: number;
    }): Promise<TransitChart>;
    /**
     * Calculate solar or lunar return chart.
     */
    calculateReturn(natalJd: number, returnType?: 'sun' | 'moon' | 'generic', options?: {
        after?: number;
        precessionCorrected?: boolean;
        body?: number;
        targetYear?: number;
    }): Promise<ReturnResult>;
    /**
     * Terminate the worker and clean up resources.
     */
    terminate(): void;
    /**
     * Check if the worker is initialized and ready.
     */
    isReady(): boolean;
    /**
     * Send a command to the worker and wait for response.
     */
    private sendCommand;
    /**
     * Post a message to the worker with error handling.
     */
    private postMessage;
    /**
     * Set up the message handler for worker responses.
     */
    private setupMessageHandler;
    /**
     * Debug logging helper.
     */
    private log;
}
//# sourceMappingURL=index.d.ts.map