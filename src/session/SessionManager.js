// src/session/SessionManager.js — orchestrateur multi-session isolé & sécurisé v4.0
'use strict';

const Session = require('./Session');
const SessionStore = require('./SessionStore');
const SessionRegistry = require('./SessionRegistry');
const { BackoffTracker } = require('../core/backoff');
const { sanitizeNumber, isValidNumber } = require('../utils/numbers');
const { ConflictError, ValidationError, NotFoundError } = require('../utils/errors');
const config = require('../../config');

const HEALTHCHECK_INTERVAL_MS = 30_000;
const BATCH_RESTORE_SIZE = config.BATCH_RESTORE_SIZE || 20;
const BATCH_RESTORE_DELAY_MS = config.BATCH_RESTORE_DELAY_MS || 300;

class SessionManager {
    constructor({
        sessionsDir,
        maxSessions = config.MAX_SESSIONS || 1000,
        maxActiveConnections = config.MAX_ACTIVE_CONNECTIONS || 500,
        logger
    }) {
        this.sessionsDir = sessionsDir;
        this.maxSessions = maxSessions;
        this.maxActiveConnections = maxActiveConnections;
        this.logger = logger;

        this.store = new SessionStore(sessionsDir);
        this.registry = new SessionRegistry(sessionsDir, this.store);
        this.backoff = new BackoffTracker({
            maxAttempts: config.MAX_RESTART_ATTEMPTS || 8,
            baseDelay: config.INITIAL_RECONNECT_DELAY_MS || 2000,
            maxDelay: config.MAX_RECONNECT_DELAY_MS || 60000,
            jitter: config.RECONNECT_JITTER_RATIO || 0.3,
        });

        this.sessions = new Map();     // number -> Session (instances en mémoire)
        this.generations = new Map();  // number -> id de génération incrémental
        this.locks = new Set();        // verrous d'opérations par numéro (anti-race condition)
        this.deletingLocks = new Set();// verrous stricts pour opérations de suppression
        this._reconnectTimers = new Map();
        this._healthTimer = null;
        this.deletedCount = 0;
    }

    /** Scanne sessions/ au démarrage, finalise les suppressions interrompues puis restaure les sessions valides par lots */
    async init() {
        // 1. Reprise des suppressions interrompues par un crash précédent (Exigence 5.7)
        const cleaned = await this.store.cleanupPendingDeletions();
        if (cleaned.length > 0) {
            this.logger.warn(`Nettoyage au démarrage: ${cleaned.length} session(s) en cours de suppression finalisée(s): ${cleaned.join(', ')}`);
            this.deletedCount += cleaned.length;
        }

        // 2. Charger le registre
        await this.registry.load();
        const numbers = await this.store.listSessionDirs();
        this.logger.info(`${numbers.length} dossier(s) de session trouvé(s) sur disque`);

        let restoredCount = 0;
        let skippedCount = 0;

        // 3. Restauration par lots (Batch restore) pour préserver la RAM et le CPU
        for (let i = 0; i < numbers.length; i += BATCH_RESTORE_SIZE) {
            const batch = numbers.slice(i, i + BATCH_RESTORE_SIZE);
            const promises = batch.map(async (number) => {
                const state = await this.store.readState(number);
                // Ne JAMAIS restaurer une session marquée logged_out, dead, deleting ou bannie
                if (state.status === 'logged_out' || state.status === 'dead' || state.status === 'deleting' || state.banned) {
                    skippedCount++;
                    this.logger.info(`Session ${number} ignorée au démarrage (status=${state.status}, banned=${state.banned})`);
                    return;
                }

                // Vérifier que les creds existent bien sur disque
                const hasCreds = await this.store.credsExist(number);
                if (!hasCreds) {
                    skippedCount++;
                    this.logger.warn(`Session ${number} ignorée au démarrage: credentials absents`);
                    return;
                }

                // Vérifier la limite de connexions actives
                if (this.sessions.size >= this.maxActiveConnections) {
                    this.logger.warn(`Limite de connexions actives atteinte (${this.maxActiveConnections}), session ${number} mise en attente.`);
                    return;
                }

                try {
                    await this.restore(number);
                    restoredCount++;
                } catch (err) {
                    this.logger.error(`Échec restore ${number}: ${err.message}`);
                }
            });

            await Promise.allSettled(promises);
            if (i + BATCH_RESTORE_SIZE < numbers.length) {
                await new Promise((resolve) => setTimeout(resolve, BATCH_RESTORE_DELAY_MS));
            }
        }

        this._startHealthLoop();
        this.logger.info(`SessionManager prêt : ${restoredCount} restaurée(s), ${skippedCount} ignorée(s), total=${numbers.length}`);
        return { restored: restoredCount, skipped: skippedCount, total: numbers.length };
    }

    _startHealthLoop() {
        if (this._healthTimer) clearInterval(this._healthTimer);
        this._healthTimer = setInterval(() => this.healthCheck().catch((e) => this.logger.error(`HealthCheck error: ${e.message}`)), HEALTHCHECK_INTERVAL_MS);
        this._healthTimer.unref?.();
    }

    async healthCheck() {
        for (const [number, session] of this.sessions) {
            if (session.status === 'dead' || session.status === 'closed' || session.status === 'deleting') continue;
            if (session.status === 'open' && !session.socket?.user) {
                this.logger.warn(`Session ${number} marquée open sans socket.user — incohérence détectée`);
            }
        }
    }

    _nextGeneration(number) {
        const next = (this.generations.get(number) || 0) + 1;
        this.generations.set(number, next);
        return next;
    }

    isCurrent(session) {
        return this.sessions.get(session.number) === session && this.generations.get(session.number) === session.generation;
    }

    _cancelReconnect(number) {
        const timer = this._reconnectTimers.get(number);
        if (timer) clearTimeout(timer);
        this._reconnectTimers.delete(number);
    }

    /** Création d'une nouvelle session avec demande de pairing code */
    async create(number, res = null) {
        const sanitized = sanitizeNumber(number);
        if (!isValidNumber(sanitized)) throw new ValidationError('Numéro WhatsApp invalide (format international requis)');

        if (this.deletingLocks.has(sanitized)) {
            throw new ConflictError('Suppression de session en cours pour ce numéro, réessayez dans quelques secondes');
        }

        if (this.sessions.has(sanitized) && this.sessions.get(sanitized).status === 'open') {
            throw new ConflictError('Ce numéro est déjà connecté');
        }
        if (this.locks.has(sanitized)) {
            throw new ConflictError('Une opération de connexion est déjà en cours pour ce numéro');
        }
        if (!this.sessions.has(sanitized) && this.sessions.size >= this.maxSessions) {
            throw new ConflictError(`Limite de capacité atteinte (${this.maxSessions} sessions max)`);
        }

        this.locks.add(sanitized);
        try {
            this._cancelReconnect(sanitized);
            if (this.sessions.has(sanitized)) {
                const old = this.sessions.get(sanitized);
                this.sessions.delete(sanitized);
                this._nextGeneration(sanitized);
                await old.stop('superseded');
            }

            const generation = this._nextGeneration(sanitized);
            const session = new Session(sanitized, {
                store: this.store,
                registry: this.registry,
                manager: this,
                generation
            });
            this.sessions.set(sanitized, session);
            return await session.start({ requestPairingCode: true, res });
        } finally {
            this.locks.delete(sanitized);
        }
    }

    /** Restauration d'une session existante depuis les credentials sur disque */
    async restore(number) {
        const sanitized = sanitizeNumber(number);
        if (this.deletingLocks.has(sanitized)) return null;
        if (this.locks.has(sanitized)) return this.sessions.get(sanitized);

        this.locks.add(sanitized);
        try {
            this._cancelReconnect(sanitized);
            const old = this.sessions.get(sanitized);
            if (old) {
                this.sessions.delete(sanitized);
                this._nextGeneration(sanitized);
                await old.stop('superseded');
            }

            const generation = this._nextGeneration(sanitized);
            const session = new Session(sanitized, {
                store: this.store,
                registry: this.registry,
                manager: this,
                generation
            });
            this.sessions.set(sanitized, session);
            try {
                await session.start({ requestPairingCode: false });
                return session;
            } catch (err) {
                if (this.isCurrent(session)) this.sessions.delete(sanitized);
                throw err;
            }
        } finally {
            this.locks.delete(sanitized);
        }
    }

    /** Planification d'une reconnexion avec backoff exponentiel & jitter */
    async scheduleReconnect(number) {
        const sanitized = sanitizeNumber(number);
        if (this.deletingLocks.has(sanitized)) return;

        const { attempt, delayMs, exhausted } = this.backoff.bump(sanitized);

        // Si épuisé : CONSERVER LA SESSION SUR DISQUE (Exigence 5.2) — NE PAS DÉTRUIRE !
        if (exhausted) {
            this.logger.warn(`${sanitized}: max tentatives de reconnexion atteintes (${attempt}). Session mise en pause sur disque sans suppression des credentials.`);
            this._cancelReconnect(sanitized);
            this.backoff.reset(sanitized);

            const session = this.sessions.get(sanitized);
            if (session) {
                this.sessions.delete(sanitized);
                this._nextGeneration(sanitized);
                await session.stop('reconnect_exhausted');
            }

            await this.store.patchState(sanitized, {
                status: 'paused',
                stopReason: 'reconnect_exhausted_paused'
            });
            await this.registry.upsertFromState(sanitized, await this.store.readState(sanitized));
            return;
        }

        this.logger.warn(`${sanitized}: reconnexion dans ${delayMs}ms (tentative ${attempt})`);
        this._cancelReconnect(sanitized);
        const timer = setTimeout(async () => {
            this._reconnectTimers.delete(sanitized);
            try {
                await this.restore(sanitized);
            } catch (err) {
                this.logger.error(`Reconnexion ${sanitized} échouée: ${err.message}`);
            }
        }, delayMs);
        timer.unref?.();
        this._reconnectTimers.set(sanitized, timer);
    }

    /** Ferme proprement une session en gardant les credentials sur disque */
    async stop(number, { reason = 'manual', keepFiles = true } = {}) {
        const sanitized = sanitizeNumber(number);
        this._cancelReconnect(sanitized);

        const session = this.sessions.get(sanitized);
        if (session) {
            this.sessions.delete(sanitized);
            this._nextGeneration(sanitized);
            await session.stop(reason);
        } else {
            await this.store.patchState(sanitized, { status: 'closed', stopReason: reason });
            const st = await this.store.readState(sanitized);
            await this.registry.upsertFromState(sanitized, st);
        }

        if (!keepFiles) {
            await this.destroy(sanitized, { reason });
        }

        return { number: sanitized, stopped: true };
    }

    /**
     * SUPPRESSION AUTOMATIQUE & DÉFINITIVE (Procédure obligatoire en 18 étapes - Exigence 5.3)
     * Supprime les credentials et le dossier de la session sans toucher aux autres sessions.
     */
    async destroy(number, { reason = 'permanent_logout' } = {}) {
        const sanitized = sanitizeNumber(number);
        if (!sanitized) throw new ValidationError('Numéro requis');

        // Idempotence : si une suppression est déjà en cours pour ce numéro, retourner immédiatement
        if (this.deletingLocks.has(sanitized)) {
            return { number: sanitized, destroyed: true, reason: 'already_deleting' };
        }

        // 1 & 2. Verrouillage strict anti-concurrence
        this.deletingLocks.add(sanitized);
        this.locks.add(sanitized);

        try {
            // 3. Désactiver reconnexions automatiques et timers
            this._cancelReconnect(sanitized);

            // 4. Invalider la génération pour ignorer tout événement asynchrone tardif
            this._nextGeneration(sanitized);

            // 5. Retirer la session de la liste active en mémoire
            const session = this.sessions.get(sanitized);
            if (session) {
                this.sessions.delete(sanitized);
                // 6, 7, 8, 9, 10. Fermer socket, supprimer listeners, timers, vider caches & buffers
                await session.cleanup().catch(() => {});
            }

            // 11. Marquer et supprimer physiquement le dossier et les credentials (Exigence 5.4)
            await this.store.deleteSession(sanitized, { reason });

            // 12. Retirer du registre
            await this.registry.remove(sanitized);

            // 13. Réinitialiser le tracker de backoff
            this.backoff.reset(sanitized);

            this.deletedCount++;
            this.logger.warn(`Session ${sanitized} définitivement supprimée (${reason}) — dossier et credentials effacés avec succès.`);
            return { number: sanitized, destroyed: true, reason };
        } finally {
            this.locks.delete(sanitized);
            this.deletingLocks.delete(sanitized);
        }
    }

    async restart(number) {
        const sanitized = sanitizeNumber(number);
        if (this.sessions.has(sanitized)) {
            await this.stop(sanitized, { keepFiles: true, reason: 'restart_request' });
        }
        return this.restore(sanitized);
    }

    list() {
        return Array.from(this.sessions.values()).map((s) => s.getInfo());
    }

    get(number) {
        return this.sessions.get(sanitizeNumber(number));
    }

    async stopAll({ persist = true } = {}) {
        for (const number of this._reconnectTimers.keys()) {
            this._cancelReconnect(number);
        }
        const jobs = Array.from(this.sessions.values()).map((s) => s.stop('shutdown').catch(() => {}));
        await Promise.allSettled(jobs);
        this.sessions.clear();
        if (this._healthTimer) clearInterval(this._healthTimer);
    }
}

module.exports = SessionManager;
