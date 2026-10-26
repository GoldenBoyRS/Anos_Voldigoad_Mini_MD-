// src/session/SessionAdmin.js — actions admin & observabilité v4.0
'use strict';

const os = require('os');
const { NotFoundError } = require('../utils/errors');
const { sanitizeNumber } = require('../utils/numbers');

function measureEventLoopLag() {
    return new Promise((resolve) => {
        const start = Date.now();
        setImmediate(() => {
            resolve(Date.now() - start);
        });
    });
}

class SessionAdmin {
    constructor(manager) {
        this.manager = manager;
    }

    async listAll() {
        const live = new Map(this.manager.list().map((s) => [s.number, s]));
        const registryEntries = this.manager.registry.list();

        const merged = registryEntries.map((entry) => {
            const liveInfo = live.get(entry.number);
            return liveInfo || { ...entry, uptimeSeconds: 0, stats: null, restartAttempts: 0 };
        });

        for (const [number, info] of live) {
            if (!merged.find((m) => m.number === number)) merged.push(info);
        }
        return merged;
    }

    async detail(number) {
        const sanitized = sanitizeNumber(number);
        const session = this.manager.get(sanitized);
        if (session) return session.getInfo();

        const state = await this.manager.store.readState(sanitized);
        const exists = await this.manager.store.credsExist(sanitized);
        if (!exists && state.status === 'pending_pairing') throw new NotFoundError(`Session ${sanitized} introuvable`);
        const stats = await this.manager.store.readStats(sanitized);
        return { number: sanitized, ...state, stats, uptimeSeconds: 0 };
    }

    async restart(number) {
        return this.manager.restart(number);
    }

    async remove(number) {
        return this.manager.destroy(number, { reason: 'admin_delete' });
    }

    async logs(number, lines = 100) {
        return this.manager.store.tailLogs(number, lines);
    }

    async getDeletions() {
        return this.manager.store.getDeletionAudits();
    }

    async globalHealth() {
        const sessions = await this.listAll();
        const storedDirs = await this.manager.store.listSessionDirs();
        const eventLoopLagMs = await measureEventLoopLag();
        const mem = process.memoryUsage();

        const counts = {
            totalRegistered: sessions.length,
            storedOnDisk: storedDirs.length,
            open: 0,
            connecting: 0,
            pending_pairing: 0,
            reconnecting: 0,
            paused: 0,
            dead: 0,
            stopped: 0,
            deleting: 0,
            totalDeletedHistorical: this.manager.deletedCount,
        };

        for (const s of sessions) {
            if (counts[s.status] !== undefined) counts[s.status]++;
            else if (s.status === 'pairing') counts.pending_pairing++;
        }

        counts.open = this.manager.sessions.size;

        return {
            status: 'operational',
            uptimeSeconds: Math.floor(process.uptime()),
            metrics: {
                registeredUsers: counts.totalRegistered,
                storedSessions: counts.storedOnDisk,
                activeSimultaneousConnections: counts.open,
                reconnectingSessions: counts.reconnecting,
                pausedSessions: counts.paused,
                deletedSessionsCount: counts.totalDeletedHistorical,
                maxAllowedSessions: this.manager.maxSessions,
                maxSimultaneousConnections: this.manager.maxActiveConnections,
            },
            memory: {
                rssBytes: mem.rss,
                heapTotalBytes: mem.heapTotal,
                heapUsedBytes: mem.heapUsed,
                externalBytes: mem.external,
                rssMB: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
                heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
            },
            performance: {
                eventLoopLagMs,
                cpuLoadAvg: os.loadavg(),
                cpuCount: os.cpus().length,
            },
            sessions: counts,
        };
    }
}

module.exports = SessionAdmin;
