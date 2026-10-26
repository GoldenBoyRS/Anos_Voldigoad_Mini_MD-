// src/core/backoff.js — backoff exponentiel avec jitter & classification des déconnexions
'use strict';

const { DisconnectReason } = require('@whiskeysockets/baileys');

const BASE_DELAY_MS = Number(process.env.INITIAL_RECONNECT_DELAY_MS || 2000);
const MAX_DELAY_MS = Number(process.env.MAX_RECONNECT_DELAY_MS || 60000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.MAX_RESTART_ATTEMPTS || 8);
const JITTER_RATIO = Number(process.env.RECONNECT_JITTER_RATIO || 0.3); // +/- 30% jitter

/**
 * Calcule le délai avec jitter pour éviter les reconnexions synchrones (thundering herd).
 */
function nextDelay(attempt, base = BASE_DELAY_MS, max = MAX_DELAY_MS, jitter = JITTER_RATIO) {
    const raw = base * Math.pow(2, Math.max(0, attempt - 1));
    const capped = Math.min(raw, max);
    // Jitter aléatoire borné
    const delta = capped * jitter * (Math.random() * 2 - 1);
    return Math.max(500, Math.floor(capped + delta));
}

/**
 * Types de classification des déconnexions :
 * - 'permanent_logout': session invalidée par WhatsApp ou utilisateur -> suppression automatique des fichiers
 * - 'version_rejected': client 405 -> arrêt boucle de reconnexion, fichiers conservés
 * - 'temporary_network': coupure internet, timeout, 515 -> session conservée sur disque, reconnexion programmée
 * - 'clean_shutdown': arrêt normal du serveur -> session conservée sur disque
 */
function classifyDisconnection(statusCode, errorMessage, isLoggedOut) {
    const msg = String(errorMessage || '').toLowerCase();

    // 1. Déconnexion définitive
    if (isLoggedOut || statusCode === DisconnectReason?.loggedOut || statusCode === 401) {
        return {
            type: 'permanent_logout',
            permanent: true,
            shouldDelete: true,
            reason: 'whatsapp_logged_out_401',
            desc: 'Session invalidée par WhatsApp (401 / loggedOut)'
        };
    }

    if (statusCode === DisconnectReason?.badSession || statusCode === 500 && msg.includes('bad session')) {
        return {
            type: 'permanent_logout',
            permanent: true,
            shouldDelete: true,
            reason: 'bad_session_corrupt',
            desc: 'Clés ou session corrompues irrécupérables'
        };
    }

    // 2. Client obsolète / rejet de version (405)
    if (statusCode === 405 || msg.includes('405') || msg.includes('client version rejected')) {
        return {
            type: 'version_rejected',
            permanent: false,
            shouldDelete: false,
            reason: 'version_rejected_405',
            desc: 'Version WhatsApp Web rejetée (405)'
        };
    }

    // 3. Fermeture normale / QR expired
    if (statusCode === 408 && msg.includes('qr refs attempts ended')) {
        return {
            type: 'pairing_timeout',
            permanent: false,
            shouldDelete: false,
            reason: 'pairing_timeout',
            desc: 'Délai d’attente pairing expiré'
        };
    }

    // 4. Erreurs réseau et temporaires : CONSERVER LA SESSION SUR DISQUE
    return {
        type: 'temporary_network',
        permanent: false,
        shouldDelete: false,
        reason: `temporary_${statusCode || 'network'}`,
        desc: `Coupure ou perturbation réseau temporaire (${statusCode || errorMessage || 'inconnu'})`
    };
}

class BackoffTracker {
    constructor({ maxAttempts = DEFAULT_MAX_ATTEMPTS, baseDelay = BASE_DELAY_MS, maxDelay = MAX_DELAY_MS, jitter = JITTER_RATIO } = {}) {
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
        this.jitter = jitter;
        this.attempts = new Map();
    }

    reset(key) {
        this.attempts.delete(key);
    }

    bump(key) {
        const attempt = (this.attempts.get(key) || 0) + 1;
        this.attempts.set(key, attempt);
        return {
            attempt,
            delayMs: nextDelay(attempt, this.baseDelay, this.maxDelay, this.jitter),
            exhausted: attempt > this.maxAttempts,
        };
    }

    get(key) {
        return this.attempts.get(key) || 0;
    }
}

module.exports = {
    nextDelay,
    classifyDisconnection,
    BackoffTracker,
    BASE_DELAY_MS,
    MAX_DELAY_MS,
    DEFAULT_MAX_ATTEMPTS,
};
