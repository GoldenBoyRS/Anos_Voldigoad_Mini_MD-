/// ============================================================
// lib/autojoin.js  (Drac-systeme)
// Rejoint automatiquement jusqu'à 3 groupes WhatsApp et suit
// jusqu'à 3 channels (newsletters) à la connexion du bot.
// Code 100% lisible, aucune obfuscation.
// ============================================================

/**
 * Extrait le code d'invitation depuis un lien de groupe WhatsApp.
 * Ex: https://chat.whatsapp.com/ABCDEF123 -> ABCDEF123
 */
function extractGroupInviteCode(groupLink) {
    if (!groupLink) return null;

    const match = groupLink.match(
        /chat\.whatsapp\.com\/([a-zA-Z0-9]+)/
    );

    return match ? match[1] : null;
}

/**
 * Extrait le JID d'un channel depuis son lien.
 *
 * Ex:
 * https://whatsapp.com/channel/0029VarfjW04tRrmwfb8x306
 * ->
 * 0029VarfjW04tRrmwfb8x306@newsletter
 *
 * Accepte aussi directement un JID :
 * 123456789@newsletter
 */
function extractChannelJid(channelLinkOrJid) {
    if (!channelLinkOrJid) return null;

    // JID déjà au format newsletter
    if (channelLinkOrJid.endsWith('@newsletter')) {
        return channelLinkOrJid;
    }

    // Lien WhatsApp Channel
    const match = channelLinkOrJid.match(
        /whatsapp\.com\/channel\/([a-zA-Z0-9]+)/
    );

    return match
        ? `${match[1]}@newsletter`
        : null;
}

/**
 * Rejoint un groupe donné via son lien d'invitation.
 */
async function joinGroup(conn, groupLink, log) {
    const code = extractGroupInviteCode(groupLink);

    if (!code) return;

    try {
        await conn.groupAcceptInvite(code);

        log(
            `✅ Groupe rejoint avec succès (${code})`,
            'success'
        );

    } catch (err) {

        // Déjà membre, lien expiré, groupe plein, etc.
        log(
            `⚠️ Impossible de rejoindre le groupe (${code}) : ${err.message}`,
            'warn'
        );
    }
}

/**
 * Suit un channel (newsletter) donné via :
 * - un lien WhatsApp Channel
 * - ou directement un JID @newsletter
 */
async function followChannel(conn, channelLinkOrJid, log) {
    const channelJid = extractChannelJid(channelLinkOrJid);

    if (!channelJid) {
        log(
            `⚠️ Newsletter invalide : ${channelLinkOrJid}`,
            'warn'
        );
        return;
    }

    try {
        await conn.newsletterFollowChannel(channelJid);

        log(
            `✅ Channel suivi avec succès (${channelJid})`,
            'success'
        );

    } catch (err) {

        // Déjà suivi, erreur Baileys, JID invalide, etc.
        log(
            `⚠️ Impossible de suivre le channel (${channelJid}) : ${err.message}`,
            'warn'
        );
    }
}

/**
 * ============================================================
 * AUTOJOIN
 * ============================================================
 *
 * Rejoint le groupe WhatsApp configuré (GROUP_INVITE_LINK)
 * et suit le channel/newsletter configuré (CHANNEL_LINK).
 *
 * À appeler une fois après :
 *
 * connection === 'open'
 *
 * @param {object} conn
 * @param {object} config
 * @param {function} log
 */
async function autoJoin(conn, config, log = console.log) {

    // ========================================================
    // GROUPE
    // ========================================================

    if (config.AUTOJOIN_GROUP !== 'false' && config.GROUP_INVITE_LINK) {
        await joinGroup(conn, config.GROUP_INVITE_LINK, log);
    }


    // ========================================================
    // NEWSLETTER / CHANNEL
    // ========================================================

    if (config.AUTOJOIN_CHANNEL !== 'false' && config.CHANNEL_LINK) {
        await followChannel(conn, config.CHANNEL_LINK, log);
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    autoJoin,
    extractGroupInviteCode,
    extractChannelJid
};