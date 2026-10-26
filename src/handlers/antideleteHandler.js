// src/handlers/antideleteHandler.js — wrapper local pour lib/antidelete.js (NE PAS TOUCHER lib/*)
'use strict';

const { handleAntidelete } = require('../../lib/antidelete');

function attachAntideleteHandler(session) {
    const { socket, logger, store: waStore } = session;

    socket.ev.on('messages.update', async (updates) => {
        try {
            const effectiveConfig = session.getEffectiveConfig();
            if (effectiveConfig.ANTIDELETE === 'true') {
                await handleAntidelete(socket, updates, waStore, session.number);
            }
        } catch (err) {
            logger.error(`Antidelete error: ${err.message}`);
        }
    });
}

module.exports = { attachAntideleteHandler };
