// src/handlers/connectionHandler.js — connection.update pour une session
'use strict';

const { DisconnectReason, jidNormalizedUser } = require('@whiskeysockets/baileys');
const { autoJoin } = require('../../lib/autojoin');

/**
 * Branche connection.update sur le socket d'une Session. Gère :
 * - open  -> maj state, autojoin, message de bienvenue si nouvelle session
 * - close -> délègue la décision (reconnecter / mourir / logout) à session.onClose()
 */
function attachConnectionHandler(session) {
    const { socket, logger, config } = session;

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            logger.info('Connexion établie');
            session.onOpen();

            const userJid = jidNormalizedUser(socket.user.id);
            const effectiveConfig = session.getEffectiveConfig();

            autoJoin(socket, effectiveConfig, (msg) => logger.info(msg)).catch((err) =>
                logger.error(`Autojoin error: ${err.message}`)
            );

            if (session.isFreshPairing) {
                const botName = effectiveConfig.BOT_NAME || config.BOT_NAME;
                const p = effectiveConfig.PREFIX || config.PREFIX;
                const mode = effectiveConfig.WORK_TYPE || config.WORK_TYPE;
                try {
                    await socket.sendMessage(userJid, {
                        image: { url: effectiveConfig.BOT_PP || effectiveConfig.IMAGE_PATH },
                        caption:
                            `\n╭────────────────────◇\n│✦ *${botName} — CONNECTED* 🔥\n` +
                            `│✦ Type *${p}menu* to see all commands 💫\n` +
                            `│✦ Prefix 『 ${p} 』  Mode 〔${mode}〕\n╰────────────────────○\n` +
                            `*© Powered by ${botName}*`,
                    });
                } catch (err) {
                    logger.warn(`Message de bienvenue non envoyé: ${err.message}`);
                }
                session.isFreshPairing = false;
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message;
            logger.warn(`Connexion fermée: ${statusCode} - ${errorMessage}`);
            const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
            await session.onClose({ statusCode, errorMessage, loggedOut: isLoggedOut });
        }
    });
}

module.exports = { attachConnectionHandler };
