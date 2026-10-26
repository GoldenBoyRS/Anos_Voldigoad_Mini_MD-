// src/pairing/PairingQueue.js — anti-conflit avec TTL & expiration automatique
'use strict';

const { ConflictError } = require('../utils/errors');

const LOCK_TTL_MS = 60_000; // 60 secondes max pour une tentative d'acquisition

class PairingQueue {
    constructor() {
        this.inFlight = new Map(); // number -> expiryTimestamp
    }

    _cleanup() {
        const now = Date.now();
        for (const [number, expiresAt] of this.inFlight) {
            if (now > expiresAt) this.inFlight.delete(number);
        }
    }

    acquire(number) {
        this._cleanup();
        if (this.inFlight.has(number)) {
            throw new ConflictError('Une demande de pairing est déjà en cours pour ce numéro. Patientez quelques instants.');
        }
        this.inFlight.set(number, Date.now() + LOCK_TTL_MS);
    }

    release(number) {
        this.inFlight.delete(number);
    }

    isBusy(number) {
        this._cleanup();
        return this.inFlight.has(number);
    }
}

module.exports = PairingQueue;
