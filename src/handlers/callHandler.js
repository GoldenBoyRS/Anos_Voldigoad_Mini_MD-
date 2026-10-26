// src/handlers/callHandler.js — anti-call automatique par session
'use strict';

function attachCallHandler(session) {
    const { socket, logger } = session;

    socket.ev.on('call', async (calls) => {
        try {
            const effectiveConfig = session.getEffectiveConfig();
            if (effectiveConfig.ANTI_CALL !== 'true') return;

            for (const call of calls) {
                if (call.status !== 'offer') continue;
                await socket.rejectCall(call.id, call.from);
                await socket.sendMessage(call.from, { text: effectiveConfig.REJECT_MSG });
                logger.info(`Appel rejeté (${call.from})`);
            }
        } catch (err) {
            logger.error(`Anti-call error: ${err.message}`);
        }
    });
}

module.exports = { attachCallHandler };
