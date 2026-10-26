// src/api/routes/sessions.js — routes legacy préservées + nouvelles routes /admin/sessions*
'use strict';

const express = require('express');
const { sanitizeNumber } = require('../../utils/numbers');
const { ValidationError, NotFoundError } = require('../../utils/errors');

function sessionRoutes({ manager, admin }) {
    const router = express.Router();

    // ---- Routes legacy (contrat préservé) ----
    router.get('/status', (req, res) => {
        const { number } = req.query;
        if (!number) {
            const list = manager.list().map((s) => ({ number: s.number, status: s.status, uptime: `${s.uptimeSeconds} seconds` }));
            return res.json({ totalActive: manager.sessions.size, connections: list });
        }
        const session = manager.get(number);
        if (!session) return res.json({ number: sanitizeNumber(number), isConnected: false, uptime: '0 seconds' });
        const info = session.getInfo();
        res.json({ number: info.number, isConnected: info.status === 'open', uptime: `${info.uptimeSeconds} seconds` });
    });

    router.get('/disconnect', async (req, res, next) => {
        try {
            const { number } = req.query;
            if (!number) throw new ValidationError('Number required');
            if (!manager.get(sanitizeNumber(number))) throw new NotFoundError('Not found');
            await manager.destroy(number, { reason: 'api_disconnect' });
            res.json({ status: 'success', message: 'Disconnected and session files deleted' });
        } catch (err) {
            next(err);
        }
    });

    router.get('/active', (req, res) => {
        const numbers = manager.list().filter((s) => s.status === 'open').map((s) => s.number);
        res.json({ count: numbers.length, numbers });
    });

    router.get('/connect-all', async (req, res, next) => {
        try {
            const numbers = await manager.store.listSessionDirs();
            if (!numbers.length) return res.status(404).json({ error: 'No numbers found' });
            const results = [];
            for (const number of numbers) {
                if (manager.get(number)?.status === 'open') {
                    results.push({ number, status: 'already_connected' });
                    continue;
                }
                try {
                    await manager.restore(number);
                    results.push({ number, status: 'connection_initiated' });
                } catch (err) {
                    results.push({ number, status: 'error', message: err.message });
                }
            }
            res.json({ status: 'success', total: numbers.length, connections: results });
        } catch (err) {
            next(err);
        }
    });

    // ---- Nouvelles routes admin (protégées par x-api-key, montées sur /admin) ----
    router.get('/admin/sessions', async (req, res, next) => {
        try {
            res.json({ sessions: await admin.listAll() });
        } catch (err) {
            next(err);
        }
    });

    router.get('/admin/sessions/:number', async (req, res, next) => {
        try {
            res.json(await admin.detail(req.params.number));
        } catch (err) {
            next(err);
        }
    });

    router.post('/admin/sessions/:number/restart', async (req, res, next) => {
        try {
            await admin.restart(req.params.number);
            res.json({ status: 'restarting', number: sanitizeNumber(req.params.number) });
        } catch (err) {
            next(err);
        }
    });

    router.delete('/admin/sessions/:number', async (req, res, next) => {
        try {
            const result = await admin.remove(req.params.number);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    router.get('/admin/logs/:number', async (req, res, next) => {
        try {
            const lines = Number(req.query.lines) || 100;
            res.json({ number: sanitizeNumber(req.params.number), lines: await admin.logs(req.params.number, lines) });
        } catch (err) {
            next(err);
        }
    });

    router.get('/admin/health', async (req, res, next) => {
        try {
            res.json(await admin.globalHealth());
        } catch (err) {
            next(err);
        }
    });

    router.get('/admin/deletions', async (req, res, next) => {
        try {
            res.json({ deletions: await admin.getDeletions() });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

module.exports = sessionRoutes;
