/**
 * Rate Limiting Middleware for MCP Server
 *
 * DDoS ve kötüye kullanım koruması için basit token bucket algoritması.
 * Her IP için dakikada 30 istek limiti (varsayılan).
 *
 * @package @kuntay/swisseph-mcp
 */
export class RateLimiter {
    clients = new Map();
    config;
    constructor(config = {}) {
        this.config = {
            windowMs: 60 * 1000, // 1 dakika
            maxRequests: 30, // 30 istek/dakika
            message: 'Too many requests. Please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            ...config
        };
        // Her dakika eski kayıtları temizle
        setInterval(() => this.cleanup(), this.config.windowMs);
    }
    /**
     * İstek kontrolü
     * @returns { allowed: boolean, remaining: number, resetTime: number }
     */
    checkLimit(identifier) {
        const now = Date.now();
        let client = this.clients.get(identifier);
        if (!client || now > client.resetTime) {
            // Yeni pencere
            client = {
                count: 1,
                resetTime: now + this.config.windowMs
            };
            this.clients.set(identifier, client);
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetTime: client.resetTime
            };
        }
        // Mevcut pencere
        if (client.count >= this.config.maxRequests) {
            // Limit aşıldı
            return {
                allowed: false,
                remaining: 0,
                resetTime: client.resetTime,
                retryAfter: Math.ceil((client.resetTime - now) / 1000)
            };
        }
        // İsteğe izin ver
        client.count++;
        return {
            allowed: true,
            remaining: this.config.maxRequests - client.count,
            resetTime: client.resetTime
        };
    }
    /**
     * Express middleware olarak kullan
     */
    middleware() {
        return (req, res, next) => {
            // IP adresini al (proxy arkasındaysa X-Forwarded-For)
            const identifier = this.getIdentifier(req);
            const result = this.checkLimit(identifier);
            // Header'ları ekle
            if (this.config.standardHeaders) {
                res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
                res.setHeader('X-RateLimit-Remaining', result.remaining);
                res.setHeader('X-RateLimit-Reset', result.resetTime);
            }
            if (!result.allowed) {
                if (this.config.standardHeaders) {
                    res.setHeader('Retry-After', result.retryAfter);
                }
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: this.config.message,
                    retryAfter: result.retryAfter
                });
            }
            next();
        };
    }
    /**
     * MCP JSON-RPC middleware olarak kullan
     */
    mcpMiddleware() {
        return async (request, next) => {
            const identifier = this.getMCPIdentifier(request);
            const result = this.checkLimit(identifier);
            if (!result.allowed) {
                throw {
                    code: -32000,
                    message: this.config.message,
                    data: {
                        retryAfter: result.retryAfter,
                        resetTime: result.resetTime
                    }
                };
            }
            return next();
        };
    }
    /**
     * HTTP isteğinden identifier çıkar
     */
    getIdentifier(req) {
        // X-Forwarded-For header'ını kontrol et (proxy/CDN arkasındaysa)
        const forwarded = req.headers?.['x-forwarded-for'];
        if (forwarded) {
            // İlk IP'yi al (client IP)
            return forwarded.split(',')[0].trim();
        }
        // Doğrudan IP
        return req.ip || req.socket?.remoteAddress || 'unknown';
    }
    /**
     * MCP JSON-RPC isteğinden identifier çıkar
     */
    getMCPIdentifier(request) {
        // Session ID veya client info'dan identifier oluştur
        const sessionId = request.params?.sessionId;
        const clientId = request.params?.clientId;
        if (sessionId)
            return `session:${sessionId}`;
        if (clientId)
            return `client:${clientId}`;
        return 'default';
    }
    /**
     * Eski kayıtları temizle
     */
    cleanup() {
        const now = Date.now();
        for (const [identifier, client] of this.clients.entries()) {
            if (now > client.resetTime) {
                this.clients.delete(identifier);
            }
        }
    }
    /**
     * Belirli bir identifier'ı manuel olarak sıfırla
     */
    reset(identifier) {
        this.clients.delete(identifier);
    }
    /**
     * Tüm limiter'ı sıfırla
     */
    resetAll() {
        this.clients.clear();
    }
    /**
     * İstatistikleri al
     */
    getStats() {
        const now = Date.now();
        let activeClients = 0;
        for (const client of this.clients.values()) {
            if (now <= client.resetTime) {
                activeClients++;
            }
        }
        return {
            totalClients: this.clients.size,
            activeClients
        };
    }
}
/**
 * Varsayılan rate limiter instance
 * 30 istek/dakika
 */
export const defaultRateLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30
});
/**
 * Katı rate limiter (DDoS koruması için)
 * 10 istek/dakika
 */
export const strictRateLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'You are sending requests too quickly. Please slow down.'
});
/**
 * Esnek rate limiter (premium kullanıcılar için)
 * 100 istek/dakika
 */
export const relaxedRateLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100
});
//# sourceMappingURL=rate-limiter.js.map