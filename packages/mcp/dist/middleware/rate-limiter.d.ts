/**
 * Rate Limiting Middleware for MCP Server
 *
 * DDoS ve kötüye kullanım koruması için basit token bucket algoritması.
 * Her IP için dakikada 30 istek limiti (varsayılan).
 *
 * @package @kuntay/swisseph-mcp
 */
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
export declare class RateLimiter {
    private clients;
    private config;
    constructor(config?: Partial<RateLimitConfig>);
    /**
     * İstek kontrolü
     * @returns { allowed: boolean, remaining: number, resetTime: number }
     */
    checkLimit(identifier: string): {
        allowed: boolean;
        remaining: number;
        resetTime: number;
        retryAfter?: number;
    };
    /**
     * Express middleware olarak kullan
     */
    middleware(): (req: any, res: any, next: () => void) => any;
    /**
     * MCP JSON-RPC middleware olarak kullan
     */
    mcpMiddleware(): (request: any, next: () => Promise<any>) => Promise<any>;
    /**
     * HTTP isteğinden identifier çıkar
     */
    private getIdentifier;
    /**
     * MCP JSON-RPC isteğinden identifier çıkar
     */
    private getMCPIdentifier;
    /**
     * Eski kayıtları temizle
     */
    private cleanup;
    /**
     * Belirli bir identifier'ı manuel olarak sıfırla
     */
    reset(identifier: string): void;
    /**
     * Tüm limiter'ı sıfırla
     */
    resetAll(): void;
    /**
     * İstatistikleri al
     */
    getStats(): {
        totalClients: number;
        activeClients: number;
    };
}
/**
 * Varsayılan rate limiter instance
 * 30 istek/dakika
 */
export declare const defaultRateLimiter: RateLimiter;
/**
 * Katı rate limiter (DDoS koruması için)
 * 10 istek/dakika
 */
export declare const strictRateLimiter: RateLimiter;
/**
 * Esnek rate limiter (premium kullanıcılar için)
 * 100 istek/dakika
 */
export declare const relaxedRateLimiter: RateLimiter;
export {};
//# sourceMappingURL=rate-limiter.d.ts.map