// src/api/server.js — assemble l'app Express complète (legacy + admin)
'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');

const SessionAdmin = require('../session/SessionAdmin');
const PairingService = require('../pairing/PairingService');
const { apiKeyAuth } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');

const pairRoutes = require('./routes/pair');
const sessionRoutes = require('./routes/sessions');
const statsRoutes = require('./routes/stats');
const configRoutes = require('./routes/config');
const healthRoutes = require('./routes/health');

/**
 * @param {{ manager: import('../session/SessionManager'), logger: import('pino').Logger }} deps
 * @returns {import('express').Express}
 */
function createServer({ manager, logger }) {
    const app = express();
    const admin = new SessionAdmin(manager);
    const pairingService = new PairingService(manager);

    const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
    app.use(cors({
        origin: allowedOrigins.length ? allowedOrigins : false,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-key'],
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Fichiers statiques — inchangés, servis tels quels
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../../pair.html')));
    app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../../admin.html')));

    const pairRateLimit = createRateLimiter({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_PAIR || 3) });
    const pairNumberRateLimit = createRateLimiter({
        windowMs: 10 * 60_000,
        max: Number(process.env.RATE_LIMIT_PAIR_PER_NUMBER || 5),
        keyFn: (req) => String(req.query.number || 'missing').replace(/[^0-9]/g, '').slice(0, 20) || 'missing',
    });
    app.use('/code', pairRateLimit, pairNumberRateLimit);

    app.use(apiKeyAuth);

    app.use(pairRoutes({ pairingService }));
    app.use(sessionRoutes({ manager, admin }));
    app.use(statsRoutes({ manager }));
    app.use(configRoutes({ manager }));
    app.use(healthRoutes({ manager }));

    app.use(errorHandler(logger));

    return app;
}

module.exports = createServer;
