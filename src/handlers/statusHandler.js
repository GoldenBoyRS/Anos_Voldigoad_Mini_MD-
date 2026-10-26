// src/handlers/statusHandler.js — auto-view / auto-like / auto-reply des statuts
'use strict';

/** @returns {boolean} true si le message a été traité comme un statut (appelant doit `return`) */
async function handleStatusMessage(session, mek) {
    if (!mek.key || mek.key.remoteJid !== 'status@broadcast') return false;

    const { socket, logger, config } = session;
    const effectiveConfig = session.getEffectiveConfig();

    try {
        if (effectiveConfig.AUTO_VIEW_STATUS === 'true') await socket.readMessages([mek.key]);

        if (effectiveConfig.AUTO_LIKE_STATUS === 'true') {
            const botJid = session.decodeJid(socket.user.id);
            const emojis = effectiveConfig.AUTO_LIKE_EMOJI || config.AUTO_LIKE_EMOJI;
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await socket.sendMessage(
                mek.key.remoteJid,
                { react: { text: randomEmoji, key: mek.key } },
                { statusJidList: [mek.key.participant, botJid] }
            );
        }

        if (effectiveConfig.AUTO_STATUS_REPLY === 'true') {
            const user = mek.key.participant;
            await socket.sendMessage(user, { text: effectiveConfig.AUTO_STATUS_MSG || config.AUTO_STATUS_MSG }, { quoted: mek });
        }
    } catch (err) {
        logger.error(`Status handler error: ${err.message}`);
    }

    return true;
}

module.exports = { handleStatusMessage };
