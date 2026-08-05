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

import type {
  WorkerMessage,
  WorkerResponse,
  NatalChartPayload,
  TransitChartPayload,
  ReturnChartPayload,
  WorkerMessageType,
} from './swisseph-worker.js';

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

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class SwissEphWorker {
  private worker: Worker | null = null;
  private initialized = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private readonly debug: boolean;
  private readonly timeout: number;

  constructor(options: SwissEphWorkerOptions = {}) {
    this.debug = options.debug ?? false;
    this.timeout = options.timeout ?? 30000;
    
    if (options.workerPath) {
      this.worker = new Worker(options.workerPath, { type: 'module' });
    } else {
      // Auto-detect worker path based on environment
      if (typeof window !== 'undefined') {
        // Browser environment
        const workerUrl = new URL('./swisseph-worker.js', import.meta.url);
        this.worker = new Worker(workerUrl, { type: 'module' });
      } else {
        throw new Error(
          'In Node.js environment, you must provide workerPath explicitly. ' +
          'Example: new SwissEphWorker({ workerPath: "./dist/worker/swisseph-worker.js" })'
        );
      }
    }

    this.setupMessageHandler();
  }

  /**
   * Initialize the worker and load Swiss Ephemeris.
   * Must be called before any calculations.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      this.log('Worker already initialized');
      return;
    }

    return this.sendCommand('INIT', {});
  }

  /**
   * Calculate a natal chart.
   */
  async calculateNatalChart(config: NatalChartConfig): Promise<any> {
    const payload: NatalChartPayload = { config };
    return this.sendCommand('CALC_NATAL', payload);
  }

  /**
   * Calculate transit chart.
   */
  async calculateTransits(
    natalConfig: NatalChartConfig,
    transitDate: {
      year: number;
      month: number;
      day: number;
      hour?: number;
    },
    options?: { aspects?: number[]; orb?: number }
  ): Promise<TransitChart> {
    const payload: TransitChartPayload = { natalConfig, transitDate, options };
    return this.sendCommand('CALC_TRANSIT', payload);
  }

  /**
   * Calculate solar or lunar return chart.
   */
  async calculateReturn(
    natalJd: number,
    returnType: 'sun' | 'moon' | 'generic' = 'sun',
    options?: { after?: number; precessionCorrected?: boolean; body?: number; targetYear?: number }
  ): Promise<ReturnResult> {
    const payload: ReturnChartPayload = { 
      natalJd, 
      returnType, 
      body: options?.body,
      targetYear: options?.targetYear,
      options: { after: options?.after, precessionCorrected: options?.precessionCorrected }
    };
    return this.sendCommand('CALC_RETURN', payload);
  }

  /**
   * Terminate the worker and clean up resources.
   */
  terminate(): void {
    if (this.worker) {
      // Send terminate message to allow cleanup
      this.postMessage({ type: 'TERMINATE', id: 'terminate' });
      
      // Force terminate after a short delay
      setTimeout(() => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
      }, 100);
    }

    // Reject any pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Worker terminated'));
      this.pendingRequests.delete(id);
    }

    this.initialized = false;
    this.log('Worker terminated');
  }

  /**
   * Check if the worker is initialized and ready.
   */
  isReady(): boolean {
    return this.initialized && this.worker !== null;
  }

  /**
   * Send a command to the worker and wait for response.
   */
  private sendCommand<T>(type: WorkerMessageType, payload: unknown): Promise<T> {
    if (!this.worker) {
      throw new Error('Worker not initialized. Call init() first.');
    }

    const id = `${type}-${++this.requestCounter}`;
    
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve: resolve as (data: unknown) => void, reject, timeoutId });
      
      const message: WorkerMessage = { type, id, payload };
      this.postMessage(message);
      
      this.log(`Sent ${type} request with id ${id}`);
    });
  }

  /**
   * Post a message to the worker with error handling.
   */
  private postMessage(message: WorkerMessage): void {
    if (!this.worker) {
      throw new Error('Worker is not available');
    }

    try {
      this.worker.postMessage(message);
    } catch (error) {
      throw new Error(`Failed to post message to worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up the message handler for worker responses.
   */
  private setupMessageHandler(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, id, data, error } = event.data;
      
      this.log(`Received ${type} response for id ${id}`);

      if (type === 'RESULT') {
        const request = this.pendingRequests.get(id);
        if (request) {
          clearTimeout(request.timeoutId);
          this.pendingRequests.delete(id);
          request.resolve(data);
          
          if (id.startsWith('INIT')) {
            this.initialized = true;
            this.log('Worker initialized successfully');
          }
        }
      } else if (type === 'ERROR') {
        const request = this.pendingRequests.get(id);
        if (request) {
          clearTimeout(request.timeoutId);
          this.pendingRequests.delete(id);
          request.reject(new Error(error ?? 'Unknown worker error'));
        }
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('Worker error:', error.message);
      
      // Reject all pending requests
      for (const request of this.pendingRequests.values()) {
        clearTimeout(request.timeoutId);
        request.reject(new Error(`Worker error: ${error.message}`));
      }
      this.pendingRequests.clear();
    };
  }

  /**
   * Debug logging helper.
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[SwissEphWorker]', ...args);
    }
  }
}
