// src/api/routes/health.js — GET /ping (public, préservé) + alias santé
'use strict';

const express = require('express');
const config = require('../../../config');

function healthRoutes({ manager }) {
    const router = express.Router();

    router.get('/ping', (req, res) => {
        res.json({
            status: 'active',
            message: `${config.BOT_NAME} is running 🔥`,
            activeSessions: manager.sessions.size,
        });
    });

    return router;
}

module.exports = healthRoutes;
