// src/session/SessionStore.js — persistance FS sécurisée & isolée pour chaque session
// 1 session = 1 sous-dossier : sessions/<number>/
'use strict';

const path = require('path');
const fs = require('fs-extra');
const {
    atomicWriteJSON,
    readJSON,
    ensureDir,
    pathExists,
    tailLines,
    assertSafeSubdirectory,
    safeRemoveDir,
} = require('../utils/files');
const { sanitizeNumber } = require('../utils/numbers');

class SessionStore {
    constructor(sessionsRootDir) {
        this.root = path.resolve(sessionsRootDir);
    }

    getSessionDir(number) {
        const clean = sanitizeNumber(number);
        const target = path.join(this.root, clean);
        return assertSafeSubdirectory(this.root, target);
    }

    /** Dossier passé à useMultiFileAuthState — creds.json + clés Signal */
    getCredsDir(number) {
        return path.join(this.getSessionDir(number), 'creds');
    }

    getStatePath(number) {
        return path.join(this.getSessionDir(number), 'state.json');
    }

    getStatsPath(number) {
        return path.join(this.getSessionDir(number), 'stats.json');
    }

    getLogsDir(number) {
        return path.join(this.getSessionDir(number), 'logs');
    }

    getMarkerPath(number) {
        return path.join(this.getSessionDir(number), '.deleting');
    }

    getAuditPath() {
        return path.join(this.root, 'deletions_audit.json');
    }

    async ensureSessionDir(number) {
        const dir = this.getSessionDir(number);
        await ensureDir(dir);
        await ensureDir(this.getCredsDir(number));
        await ensureDir(this.getLogsDir(number));
        return dir;
    }

    async credsExist(number) {
        try {
            return await pathExists(path.join(this.getCredsDir(number), 'creds.json'));
        } catch (_) {
            return false;
        }
    }

    // ---- state.json : métadonnées et état de la machine d'état ----
    defaultState(number) {
        return {
            number: sanitizeNumber(number),
            status: 'pending_pairing', // pending_pairing | connecting | open | reconnecting | paused | logged_out | failed | closing | closed | deleting
            createdAt: new Date().toISOString(),
            lastConnected: null,
            lastDisconnected: null,
            totalReconnects: 0,
            banned: false,
            stopReason: null,
            userConfig: {},
        };
    }

    async readState(number) {
        try {
            const state = await readJSON(this.getStatePath(number), null);
            return state || this.defaultState(number);
        } catch (_) {
            return this.defaultState(number);
        }
    }

    async writeState(number, state) {
        await ensureDir(this.getSessionDir(number));
        await atomicWriteJSON(this.getStatePath(number), state);
        return state;
    }

    async patchState(number, patch) {
        const current = await this.readState(number);
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
        await this.writeState(number, next);
        return next;
    }

    // ---- stats.json ----
    defaultStats() {
        return { messagesReceived: 0, commandsUsed: 0, groupsInteracted: 0 };
    }

    async readStats(number) {
        try {
            const stats = await readJSON(this.getStatsPath(number), null);
            return stats || this.defaultStats();
        } catch (_) {
            return this.defaultStats();
        }
    }

    async writeStats(number, stats) {
        await ensureDir(this.getSessionDir(number));
        await atomicWriteJSON(this.getStatsPath(number), stats);
        return stats;
    }

    async updateStats(number, deltaKey, incrementBy = 1) {
        const stats = await this.readStats(number);
        stats[deltaKey] = (stats[deltaKey] || 0) + incrementBy;
        await this.writeStats(number, stats);
        return stats;
    }

    // ---- Markers de suppression pour atomicité et reprise sur crash ----
    async setDeletingMarker(number, reason = 'unknown') {
        const markerPath = this.getMarkerPath(number);
        await atomicWriteJSON(markerPath, {
            number: sanitizeNumber(number),
            markedAt: new Date().toISOString(),
            reason,
        });
    }

    async isDeletingMarked(number) {
        try {
            return await pathExists(this.getMarkerPath(number));
        } catch (_) {
            return false;
        }
    }

    // ---- Journal d'audit de suppression (ne contient AUCUN secret) ----
    async recordDeletionAudit(number, reason = 'unspecified') {
        try {
            await ensureDir(this.root);
            const auditFile = this.getAuditPath();
            const list = await readJSON(auditFile, []);
            list.unshift({
                number: sanitizeNumber(number),
                reason,
                timestamp: new Date().toISOString(),
            });
            // Plafonné à 500 entrées pour limiter la mémoire/disque
            const capped = list.slice(0, 500);
            await atomicWriteJSON(auditFile, capped);
        } catch (_) { /* best-effort non bloquant */ }
    }

    async getDeletionAudits() {
        try {
            return await readJSON(this.getAuditPath(), []);
        } catch (_) {
            return [];
        }
    }

    // ---- SUPPRESSION STRICTE, ISOLÉE & VÉRIFIÉE (Exigence 5) ----
    async deleteSession(number, { reason = 'permanent_disconnection' } = {}) {
        const clean = sanitizeNumber(number);
        const sessionDir = this.getSessionDir(clean);

        // 1. Marquer l'état deleting sur disque
        try {
            await this.setDeletingMarker(clean, reason);
            await this.patchState(clean, { status: 'deleting', stopReason: reason });
        } catch (_) { /* dossier peut déjà être partiellement manquant */ }

        // 2. Suppression avec vérification de périmètre
        let error = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (await pathExists(sessionDir)) {
                    await safeRemoveDir(this.root, sessionDir);
                }
                break;
            } catch (err) {
                error = err;
                await new Promise((r) => setTimeout(r, 100 * attempt));
            }
        }

        // 3. Vérifier rigoureusement que le dossier n'existe plus
        const stillExists = await pathExists(sessionDir);
        if (stillExists) {
            throw new Error(`Échec de la suppression définitive du dossier ${clean}: ${error?.message || 'accès refusé'}`);
        }

        // 4. Enregistrer dans l'audit des suppressions
        await this.recordDeletionAudit(clean, reason);
        return { number: clean, deleted: true, reason };
    }

    // ---- REPRISE AU DÉMARRAGE (Exigence 5.7) ----
    async cleanupPendingDeletions() {
        const numbers = await this.listSessionDirs();
        const cleaned = [];

        for (const number of numbers) {
            try {
                const marked = await this.isDeletingMarked(number);
                const state = await this.readState(number);

                if (marked || state.status === 'deleting' || state.status === 'logged_out') {
                    await this.deleteSession(number, { reason: 'startup_cleanup_pending_deletion' });
                    cleaned.push(number);
                }
            } catch (_) { /* ignore and continue */ }
        }

        return cleaned;
    }

    // ---- Scan disque sécurisé ----
    async listSessionDirs() {
        await ensureDir(this.root);
        const entries = await fs.readdir(this.root, { withFileTypes: true });
        return entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .filter((name) => /^[0-9]{6,15}$/.test(name));
    }

    async tailLogs(number, lines = 100) {
        const date = new Date().toISOString().slice(0, 10);
        const logFile = path.join(this.getLogsDir(number), `${date}.log`);
        return tailLines(logFile, lines);
    }
}

module.exports = SessionStore;
