// src/api/routes/stats.js — GET /stats (contrat legacy préservé, lecture 100% locale)
'use strict';

const express = require('express');
const { ValidationError } = require('../../utils/errors');
const { sanitizeNumber } = require('../../utils/numbers');

function statsRoutes({ manager }) {
    const router = express.Router();

    router.get('/stats', async (req, res, next) => {
        try {
            const { number } = req.query;
            if (!number) throw new ValidationError('Number required');
            const sanitized = sanitizeNumber(number);
            const session = manager.get(sanitized);
            const stats = session?.stats || await manager.store.readStats(sanitized);
            const info = session ? session.getInfo() : null;
            res.json({
                number: sanitized,
                connectionStatus: info && info.status === 'open' ? 'Connected' : 'Disconnected',
                uptime: info ? info.uptimeSeconds : 0,
                stats,
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

module.exports = statsRoutes;
