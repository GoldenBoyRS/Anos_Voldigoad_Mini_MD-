// src/handlers/groupHandler.js — métadonnées de groupe + wiring lib/group-config.js
'use strict';

let groupEvents = null;
try {
    // Optionnel : ne casse rien si le fichier n'exporte pas cette fonction
    ({ groupEvents } = require('../../lib/group-config'));
} catch (_) { /* lib/group-config.js absent ou incompatible -> ignoré */ }

function getGroupAdmins(participants = []) {
    return participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').map((p) => p.id);
}

/** Résout les métadonnées de groupe utiles au dispatch de commande (best-effort) */
async function resolveGroupContext(session, from, botNumber2, senderJid) {
    const { socket } = session;
    const ctx = {
        groupMetadata: null,
        groupName: null,
        participants: null,
        groupAdmins: null,
        isBotAdmins: null,
        isAdmins: null,
    };
    try {
        ctx.groupMetadata = await session.getGroupMetadata(from);
        ctx.groupName = ctx.groupMetadata.subject;
        ctx.participants = ctx.groupMetadata.participants;
        ctx.groupAdmins = getGroupAdmins(ctx.participants);
        const botJid = botNumber2.split('@')[0];
        const senderNum = senderJid.split('@')[0];
        ctx.isBotAdmins = ctx.groupAdmins.some((a) => a.split('@')[0] === botJid);
        ctx.isAdmins = ctx.groupAdmins.some((a) => a.split('@')[0] === senderNum);
    } catch (_) { /* pas admin / erreur réseau -> contexte partiel, on continue */ }
    return ctx;
}

/** Branche group-participants.update (bienvenue/au revoir) si lib/group-config.js l'expose */
function attachGroupHandler(session) {
    if (!groupEvents) return;
    const { socket, logger } = session;
    socket.ev.on('group-participants.update', async (update) => {
        session.invalidateGroupCache(update.id);
        try {
            await groupEvents(socket, update);
        } catch (err) {
            logger.error(`Group event error: ${err.message}`);
        }
    });
}

module.exports = { getGroupAdmins, resolveGroupContext, attachGroupHandler };
