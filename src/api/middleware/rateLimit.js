// src/api/middleware/rateLimit.js — rate limiter mémoire simple, borné et réutilisable
'use strict';

function createRateLimiter({ windowMs = 60_000, max = 3, keyFn = (req) => req.ip || req.connection?.remoteAddress || 'unknown' } = {}) {
    const hits = new Map();

    const cleanup = setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, timestamps] of hits) {
            const fresh = timestamps.filter((t) => t > cutoff);
            if (fresh.length === 0) hits.delete(key);
            else hits.set(key, fresh);
        }
    }, Math.min(windowMs, 60_000));
    cleanup.unref?.();

    return function rateLimit(req, res, next) {
        const key = String(keyFn(req) || 'unknown').slice(0, 256);
        const now = Date.now();
        const windowStart = now - windowMs;
        const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);

        if (timestamps.length >= max) {
            res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
            return res.status(429).json({ error: `Trop de requêtes, réessaie dans ${Math.ceil(windowMs / 1000)}s` });
        }
        timestamps.push(now);
        hits.set(key, timestamps);
        next();
    };
}

module.exports = { createRateLimiter };
