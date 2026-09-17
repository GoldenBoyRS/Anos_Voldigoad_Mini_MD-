// ═══════════════════════════════════════════════════════════════════════════
//  █████╗ ██████╗ ███████╗██╗      █████╗  ███╗   ██╗    ███╗   ███╗██████╗ 
// ██╔══██╗██╔══██╗██╔════╝██║     ██╔══██╗████╗  ██║    ████╗ ████║██╔══██╗
// ███████║██████╔╝███████╗██║     ███████║██╔██╗ ██║    ██╔████╔██║██║  ██║
// ██╔══██║██╔══██╗╚════██║██║     ██╔══██║██║╚██╗██║    ██║╚██╔╝██║██║  ██║
// ██║  ██║██║  ██║███████║███████╗██║  ██║██║  ████║     ██║ ╚═╝ ██║██████╔╝
// ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝   ╚═══╝    ╚═╝     ╚═╝╚═════╝ 
// ═══════════════════════════════════════════════════════════════════════════
//                    𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃 - BOT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const dotenv = require('dotenv');

// ────────────────────────────────────────────────────────────────────────────
//  🔄 ENVIRONMENT LOADER
// ────────────────────────────────────────────────────────────────────────────
if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

// ────────────────────────────────────────────────────────────────────────────
//  📦 CONFIGURATION EXPORT
// ────────────────────────────────────────────────────────────────────────────
module.exports = {

    // ═══════════════════════════════════════════════════════════════════════
    //  🔐 SESSION & DATABASE
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Session ID for bot authentication and persistence
     * @type {string}
     * @default "MINI BOT"
     */
    SESSION_ID: process.env.SESSION_ID || "MINI BOT",
    
    /** 
     * @description MongoDB Atlas connection string — DOIT être définie via
     * la variable d'environnement MONGODB_URI. Aucune valeur par défaut
     * n'est fournie : l'ancienne valeur par défaut pointait vers une base
     * PARTAGÉE (identifiants visibles dans le code source), donc n'importe
     * quel autre déploiement de ce template pouvait lire/écrire les mêmes
     * sessions WhatsApp que toi.
     * @type {string}
     */
    MONGODB_URI: process.env.MONGODB_URI || (() => {
        throw new Error(
            "MONGODB_URI n'est pas défini. Crée ta propre base MongoDB Atlas " +
            "(gratuite) et ajoute MONGODB_URI dans les variables d'environnement " +
            "de ton hébergeur. Ne réutilise jamais une chaîne de connexion trouvée " +
            "dans un template public."
        );
    })(),

    // ═══════════════════════════════════════════════════════════════════════
    //  🤖 BOT IDENTITY
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Command prefix for bot interactions
     * @type {string}
     * @default "."
     */
    PREFIX: process.env.PREFIX || '.',
    
    
    /** 
     * @description Display name of the bot
     * @type {string}
     * @default "𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃"
     */
    BOT_NAME: "𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃",
    
    /** 
     * @description Footer text for bot messages
     * @type {string}
     * @default "© ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃"
     */
    BOT_FOOTER: '© ᴘᴏᴡᴇʀᴇᴅ ʙʏ GoldenBoy Dev™',
    
    /** 
     * @description Bot work mode
     * @type {('public'|'private'|'group'|'inbox')}
     * @default "public"
     * @example
     * - public  : Responds to all messages
     * - private : Only responds in DMs
     * - group   : Only responds in groups
     * - inbox   : Only responds in DMs
     */
    WORK_TYPE: process.env.WORK_TYPE || "public",

    /**
     * @description Owner's WhatsApp number(s), without "+" (une seule déclaration —
     * il y en avait deux avant, la première était toujours écrasée par celle-ci)
     * @type {string[]}
     */
    OWNER_NUMBER: [
        '50956300796',  // Apna number yahan add karo
        '509563007970'   // Multiple owners add kar sakte ho
    ],
    ANTIDELETE: 'true',  // Global antidelete enable/disable

    // ═══════════════════════════════════════════════════════════════════════
    //  👁️ STATUS AUTOMATION
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Auto-view WhatsApp status updates
     * @type {string}
     * @default "true"
     */
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'true',
    
    /** 
     * @description Auto-like status updates with random emojis
     * @type {string}
     * @default "true"
     */
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'true',
    
    /** 
     * @description Emoji pool for auto-like feature
     * @type {string[]}
     */
    AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '🌹', '😍', '💞', '💕', '☺️', '🤗'],
    
    /** 
     * @description Auto-reply to status updates
     * @type {string}
     * @default "false"
     */
    AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || 'false',
    
    /** 
     * @description Default message for status reply
     * @type {string}
     * @default "🤗"
     */
    AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || '🤗',

    // ═══════════════════════════════════════════════════════════════════════
    //  💬 PRESENCE & CHAT SETTINGS
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Mark messages as read (blue ticks)
     * @type {string}
     * @default "false"
     */
    READ_MESSAGE: process.env.READ_MESSAGE || 'false',
    
    /** 
     * @description Show typing indicator in chat
     * @type {string}
     * @default "false"
     */
    AUTO_TYPING: process.env.AUTO_TYPING || 'false',
    
    /** 
     * @description Show recording indicator in chat
     * @type {string}
     * @default "false"
     */
    AUTO_RECORDING: process.env.AUTO_RECORDING || 'false',

    // ═══════════════════════════════════════════════════════════════════════
    //  👥 GROUP MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Send welcome message when new member joins
     * @type {string}
     * @default "true"
     */
    WELCOME_ENABLE: process.env.WELCOME_ENABLE || 'true',
    
    /** 
     * @description Send goodbye message when member leaves
     * @type {string}
     * @default "true"
     */
    GOODBYE_ENABLE: process.env.GOODBYE_ENABLE || 'true',
    
    /** 
     * @description Custom welcome message (null = use default)
     * @type {string|null}
     * @default null
     */
    WELCOME_MSG: process.env.WELCOME_MSG || null,
    
    /** 
     * @description Custom goodbye message (null = use default)
     * @type {string|null}
     * @default null
     */
    GOODBYE_MSG: process.env.GOODBYE_MSG || null,
    
    /** 
     * @description Custom welcome image URL (null = use default)
     * @type {string|null}
     * @default null
     */
    WELCOME_IMAGE: process.env.WELCOME_IMAGE || null,
    
    /** 
     * @description Custom goodbye image URL (null = use default)
     * @type {string|null}
     * @default null
     */
    GOODBYE_IMAGE: process.env.GOODBYE_IMAGE || null,
    
    /** 
     * @description WhatsApp group invite link
     * @type {string}
     */
    GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/Bccy7Hk6NIa8GG5liFstGM?s=cl&p=a&mlu=4&ilr=4',

    /**
     * @description Deuxième lien d'invitation de groupe WhatsApp (autojoin)
     * @type {string}
     */
    GROUP_INVITE_LINK_2: process.env.GROUP_INVITE_LINK_2 || 'https://chat.whatsapp.com/Bccy7Hk6NIa8GG5liFstGM?s=cl&p=a&mlu=4&ilr=4',

    /**
     * @description Troisième lien d'invitation de groupe WhatsApp (autojoin)
     * @type {string}
     */
    GROUP_INVITE_LINK_3: process.env.GROUP_INVITE_LINK_3 || 'https://chat.whatsapp.com/Bccy7Hk6NIa8GG5liFstGM?s=cl&p=a&mlu=4&ilr=4',

    // ═══════════════════════════════════════════════════════════════════════
    //  🛡️ SECURITY & ANTI-CALL
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Reject incoming calls automatically
     * @type {string}
     * @default "false"
     */
    ANTI_CALL: process.env.ANTI_CALL || 'false',
    
    /** 
     * @description Message sent when rejecting calls
     * @type {string}
     * @default "*CALL LATER PLEASE ☺️🌹*"
     */
    REJECT_MSG: process.env.REJECT_MSG || '*CALL LATER PLEASE ☺️🌹*',

    // ═══════════════════════════════════════════════════════════════════════
    //  🖼️ MEDIA & LINKS
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Default bot profile image path/URL
     * @type {string}
     */
    IMAGE_PATH: process.env.BOT_PP || process.env.IMAGE_PATH || 'https://d.uguu.se/mLRzDKPG.jpg',

    /**
     * @description Alias of IMAGE_PATH, used by setbotpp command
     * @type {string}
     */
    BOT_PP: process.env.BOT_PP || 'https://d.uguu.se/mLRzDKPG.jpg',
    
    /** 
     * @description WhatsApp channel link for updates
     * @type {string}
     */
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbC8KUk2kNFp2Fb0bF3J',

    /**
     * @description Deuxième channel (newsletter) WhatsApp — lien ou JID direct (xxx@newsletter)
     * @type {string}
     */
    CHANNEL_LINK_2: process.env.CHANNEL_LINK_2 || 'https://whatsapp.com/channel/0029VbC8KUk2kNFp2Fb0bF3J',

    /**
     * @description Troisième channel (newsletter) WhatsApp — lien ou JID direct (xxx@newsletter)
     * @type {string}
     */
    CHANNEL_LINK_3: process.env.CHANNEL_LINK_3 || 'https://whatsapp.com/channel/0029VbC8KUk2kNFp2Fb0bF3J',

    /**
     * @description JID de la newsletter de configuration, utilisé pour afficher
     * le bouton cliquable "channel" (forwardedNewsletterMessageInfo) dans les
     * messages comme .alive et .menu. Dérivé de CHANNEL_LINK.
     * @type {string}
     */
    NEWSLETTER_JID: process.env.NEWSLETTER_JID || '120363422530463919@newsletter',

    // ═══════════════════════════════════════════════════════════════════════
    //  📡 EXTERNAL API INTEGRATIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /** 
     * @description Telegram bot token for notifications
     * @type {string}
     * @default "7214172448:..."
     */
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    
    /** 
     * @description Telegram chat ID for sending notifications
     * @type {string}
     * @default "+923237045919"
     */
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''

};

// ────────────────────────────────────────────────────────────────────────────
//  📖 USAGE EXAMPLES
// ────────────────────────────────────────────────────────────────────────────

/**
 * @example
 * // Import configuration
 * const config = require('./config');
 * 
 * // Access bot settings
 * console.log(`Bot: ${config.BOT_NAME}`);
 * console.log(`Prefix: ${config.PREFIX}`);
 * console.log(`Owner: ${config.OWNER_NUMBER}`);
 * 
 * // Check if auto-view status is enabled
 * if (config.AUTO_VIEW_STATUS === 'true') {
 *     console.log('Auto-view status is active');
 * }
 * 
 * // Get random like emoji
 * const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
 */

// ────────────────────────────────────────────────────────────────────────────
//  🏷️ EXPORT METADATA
// ────────────────────────────────────────────────────────────────────────────

/**
 * @module config
 * @description 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃 Bot Configuration Module
 * @version 2.0.0
 * @author 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃
 * @license MIT
 */
