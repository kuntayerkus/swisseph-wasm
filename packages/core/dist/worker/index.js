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
export class SwissEphWorker {
    worker = null;
    initialized = false;
    pendingRequests = new Map();
    requestCounter = 0;
    debug;
    timeout;
    constructor(options = {}) {
        this.debug = options.debug ?? false;
        this.timeout = options.timeout ?? 30000;
        if (options.workerPath) {
            this.worker = new Worker(options.workerPath, { type: 'module' });
        }
        else {
            // Auto-detect worker path based on environment
            if (typeof window !== 'undefined') {
                // Browser environment
                const workerUrl = new URL('./swisseph-worker.js', import.meta.url);
                this.worker = new Worker(workerUrl, { type: 'module' });
            }
            else {
                throw new Error('In Node.js environment, you must provide workerPath explicitly. ' +
                    'Example: new SwissEphWorker({ workerPath: "./dist/worker/swisseph-worker.js" })');
            }
        }
        this.setupMessageHandler();
    }
    /**
     * Initialize the worker and load Swiss Ephemeris.
     * Must be called before any calculations.
     */
    async init() {
        if (this.initialized) {
            this.log('Worker already initialized');
            return;
        }
        return this.sendCommand('INIT', {});
    }
    /**
     * Calculate a natal chart.
     */
    async calculateNatalChart(config) {
        const payload = { config };
        return this.sendCommand('CALC_NATAL', payload);
    }
    /**
     * Calculate transit chart.
     */
    async calculateTransits(natalConfig, transitDate, options) {
        const payload = { natalConfig, transitDate, options };
        return this.sendCommand('CALC_TRANSIT', payload);
    }
    /**
     * Calculate solar or lunar return chart.
     */
    async calculateReturn(natalJd, returnType = 'sun', options) {
        const payload = {
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
    terminate() {
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
    isReady() {
        return this.initialized && this.worker !== null;
    }
    /**
     * Send a command to the worker and wait for response.
     */
    sendCommand(type, payload) {
        if (!this.worker) {
            throw new Error('Worker not initialized. Call init() first.');
        }
        const id = `${type}-${++this.requestCounter}`;
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${id} timed out after ${this.timeout}ms`));
            }, this.timeout);
            this.pendingRequests.set(id, { resolve: resolve, reject, timeoutId });
            const message = { type, id, payload };
            this.postMessage(message);
            this.log(`Sent ${type} request with id ${id}`);
        });
    }
    /**
     * Post a message to the worker with error handling.
     */
    postMessage(message) {
        if (!this.worker) {
            throw new Error('Worker is not available');
        }
        try {
            this.worker.postMessage(message);
        }
        catch (error) {
            throw new Error(`Failed to post message to worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Set up the message handler for worker responses.
     */
    setupMessageHandler() {
        if (!this.worker)
            return;
        this.worker.onmessage = (event) => {
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
            }
            else if (type === 'ERROR') {
                const request = this.pendingRequests.get(id);
                if (request) {
                    clearTimeout(request.timeoutId);
                    this.pendingRequests.delete(id);
                    request.reject(new Error(error ?? 'Unknown worker error'));
                }
            }
        };
        this.worker.onerror = (error) => {
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
    log(...args) {
        if (this.debug) {
            console.log('[SwissEphWorker]', ...args);
        }
    }
}
//# sourceMappingURL=index.js.map