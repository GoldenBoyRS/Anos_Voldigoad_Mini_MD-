// src/api/routes/pair.js — GET /code (préservé, même contrat que l'ancien main.js)
'use strict';

const express = require('express');
const { ValidationError } = require('../../utils/errors');

function pairRoutes({ pairingService }) {
    const router = express.Router();

    router.get('/code', async (req, res, next) => {
        try {
            if (!req.query.number) throw new ValidationError('Number required');
            await pairingService.requestCode(req.query.number, res);
        } catch (err) {
            if (res.headersSent) return;
            next(err);
        }
    });

    return router;
}

module.exports = pairRoutes;
