// src/utils/jid.js — helpers JID Baileys, partagés par toutes les sessions
'use strict';

const { jidDecode } = require('@whiskeysockets/baileys');

/** Décode un JID "device" (xxx:12@s.whatsapp.net) vers sa forme normalisée */
function decodeJid(jid) {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid) || {};
        return (decoded.user && decoded.server && `${decoded.user}@${decoded.server}`) || jid;
    }
    return jid;
}

function isGroupJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@g.us');
}

function isStatusJid(jid) {
    return jid === 'status@broadcast';
}

function isNewsletterJid(jid) {
    return typeof jid === 'string' && jid.endsWith('@newsletter');
}

module.exports = { decodeJid, isGroupJid, isStatusJid, isNewsletterJid };
