// src/api/middleware/auth.js — authentification x-api-key pour les API privées
'use strict';

const crypto = require('crypto');
const config = require('../../../config');

const PUBLIC_PATHS = new Set(['/', '/code', '/ping', '/admin']);

function safeEqual(a, b) {
    if (!a || !b) return false;
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function apiKeyAuth(req, res, next) {
    if (PUBLIC_PATHS.has(req.path) || req.path.startsWith('/pair.html') || req.path.startsWith('/admin.html')) {
        return next();
    }

    const expected = config.API_KEY || process.env.API_KEY || 'anos-admin-secret-key-2026';

    const provided = req.header('x-api-key');
    if (!safeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Clé API invalide ou manquante (header x-api-key)' });
    }
    return next();
}

module.exports = { apiKeyAuth, PUBLIC_PATHS };
