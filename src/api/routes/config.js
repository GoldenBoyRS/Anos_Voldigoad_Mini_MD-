// src/api/routes/config.js — lecture/écriture de la config PAR NUMÉRO (userConfig, 100% locale)
// Remplace l'ancien flow OTP par email/Mongo : ces routes sont déjà
// protégées par x-api-key, une confirmation OTP par message WhatsApp
// n'apporte plus rien et ajoutait une dépendance Mongo pour rien.
'use strict';

const express = require('express');
const { ValidationError, NotFoundError } = require('../../utils/errors');
const { sanitizeNumber } = require('../../utils/numbers');

function configRoutes({ manager }) {
    const router = express.Router();

    router.get('/admin/sessions/:number/config', async (req, res, next) => {
        try {
            const state = await manager.store.readState(req.params.number);
            res.json({ number: sanitizeNumber(req.params.number), userConfig: state.userConfig || {} });
        } catch (err) {
            next(err);
        }
    });

    router.put('/admin/sessions/:number/config', async (req, res, next) => {
        try {
            const sanitized = sanitizeNumber(req.params.number);
            const patch = req.body;
            if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
                throw new ValidationError('Le corps de la requête doit être un objet JSON de clés de config');
            }

            const session = manager.get(sanitized);
            const currentState = await manager.store.readState(sanitized);
            if (!currentState) throw new NotFoundError('Session introuvable');

            const nextUserConfig = { ...(currentState.userConfig || {}), ...patch };
            const newState = await manager.store.patchState(sanitized, { userConfig: nextUserConfig });
            await manager.registry.upsertFromState(sanitized, newState);

            if (session) session.userConfig = nextUserConfig; // applique à chaud, sans reconnexion
            res.json({ number: sanitized, userConfig: nextUserConfig });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

module.exports = configRoutes;
