// src/pairing/PairingService.js — point d'entrée unique pour obtenir un pairing code
'use strict';

const PairingQueue = require('./PairingQueue');
const { sanitizeNumber, isValidNumber } = require('../utils/numbers');
const { ValidationError } = require('../utils/errors');

class PairingService {
    constructor(sessionManager) {
        this.manager = sessionManager;
        this.queue = new PairingQueue();
    }

    /**
     * @param {string} number
     * @param {import('express').Response} res - réponse HTTP à qui `Session` écrira { code, status }
     */
    async requestCode(number, res) {
        const sanitized = sanitizeNumber(number);
        if (!isValidNumber(sanitized)) throw new ValidationError('Number required / invalide');

        this.queue.acquire(sanitized);
        try {
            const existing = this.manager.get(sanitized);
            if (existing && existing.socket?.authState?.creds?.registered) {
                if (res && !res.headersSent) {
                    return res.json({
                        status: 'already_connected',
                        message: 'Number is already connected',
                        ...existing.getInfo(),
                    });
                }
                return;
            }
            return await this.manager.create(sanitized, res);
        } finally {
            this.queue.release(sanitized);
        }
    }
}

module.exports = PairingService;
