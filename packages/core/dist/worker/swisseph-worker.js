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
import { createSwissEph } from '../index.js';
let sweInstance = null;
/**
 * Initialize the Swiss Ephemeris instance in the worker.
 */
async function initializeWorker() {
    if (!sweInstance) {
        sweInstance = await createSwissEph();
    }
}
/**
 * Send a response back to the main thread.
 */
function sendResponse(type, id, data, error) {
    const response = {
        type,
        id,
        data,
        error,
    };
    self.postMessage(response);
}
/**
 * Handle natal chart calculation.
 */
async function handleNatalChart(payload, id) {
    try {
        if (!sweInstance) {
            throw new Error('SwissEph instance not initialized');
        }
        const { config } = payload;
        // Use the builder pattern from chart-builder
        const { NatalChartBuilder } = await import('../derived/chart-builder.js');
        const chart = NatalChartBuilder.builder()
            .date(config.date.year, config.date.month, config.date.day, config.date.hour ?? 0)
            .location(config.location.latitude, config.location.longitude, config.location.altitude)
            .houseSystem(config.houseSystem ?? 'P')
            .ayanamsa(config.ayanamsa ?? 0)
            .build(sweInstance);
        sendResponse('RESULT', id, chart);
    }
    catch (error) {
        sendResponse('ERROR', id, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
}
/**
 * Handle transit chart calculation.
 */
async function handleTransitChart(payload, id) {
    try {
        if (!sweInstance) {
            throw new Error('SwissEph instance not initialized');
        }
        const { natalConfig, transitDate, options } = payload;
        const { TransitChartBuilder } = await import('../derived/chart-builder.js');
        const transits = TransitChartBuilder.builder()
            .natalDate(natalConfig.date.year, natalConfig.date.month, natalConfig.date.day, natalConfig.date.hour ?? 0)
            .transitDate(transitDate.year, transitDate.month, transitDate.day, transitDate.hour ?? 0)
            .location(natalConfig.location.latitude, natalConfig.location.longitude, natalConfig.location.altitude)
            .build(sweInstance, options);
        sendResponse('RESULT', id, transits);
    }
    catch (error) {
        sendResponse('ERROR', id, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
}
/**
 * Handle return chart calculation.
 */
async function handleReturnChart(payload, id) {
    try {
        if (!sweInstance) {
            throw new Error('SwissEph instance not initialized');
        }
        const { natalJd, returnType, body, targetYear, options } = payload;
        let returnResult;
        if (returnType === 'sun') {
            returnResult = sweInstance.solarReturn(natalJd, options);
        }
        else if (returnType === 'moon') {
            returnResult = sweInstance.lunarReturn(natalJd, options);
        }
        else if (returnType === 'generic' && body !== undefined) {
            returnResult = sweInstance.returnOf(body, natalJd, options);
        }
        else {
            throw new Error('Invalid return type or missing body for generic return');
        }
        // If targetYear is specified and we need a specific year's return
        if (targetYear !== undefined && returnType !== 'generic') {
            const afterJd = sweInstance.julianDay(targetYear, 1, 1);
            returnResult = sweInstance.solarReturn(natalJd, { ...options, after: afterJd });
        }
        sendResponse('RESULT', id, returnResult);
    }
    catch (error) {
        sendResponse('ERROR', id, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
}
// Main message handler
self.onmessage = async (event) => {
    const { type, id, payload } = event.data;
    try {
        switch (type) {
            case 'INIT':
                await initializeWorker();
                sendResponse('RESULT', id, { initialized: true });
                break;
            case 'CALC_NATAL':
                await handleNatalChart(payload, id);
                break;
            case 'CALC_TRANSIT':
                await handleTransitChart(payload, id);
                break;
            case 'CALC_RETURN':
                await handleReturnChart(payload, id);
                break;
            case 'TERMINATE':
                if (sweInstance) {
                    sweInstance.dispose();
                    sweInstance = null;
                }
                self.close();
                break;
            default:
                sendResponse('ERROR', id, undefined, `Unknown message type: ${type}`);
        }
    }
    catch (error) {
        sendResponse('ERROR', id, undefined, error instanceof Error ? error.message : 'Unknown error');
    }
};
//# sourceMappingURL=swisseph-worker.js.map