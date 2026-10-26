// src/utils/numbers.js — normalisation des numéros WhatsApp
'use strict';

/** Garde uniquement les chiffres (ex: "+509 5630 0796" -> "50956300796") */
function sanitizeNumber(number) {
    return String(number || '').replace(/[^0-9]/g, '');
}

/** Valide qu'un numéro sanitizé est plausible (6 à 15 chiffres, format E.164 sans +) */
function isValidNumber(number) {
    const n = sanitizeNumber(number);
    return /^[0-9]{6,15}$/.test(n);
}

function toJid(number) {
    return `${sanitizeNumber(number)}@s.whatsapp.net`;
}

module.exports = { sanitizeNumber, isValidNumber, toJid };
