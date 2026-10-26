// src/handlers/messageHandler.js — messages.upsert : dispatch des commandes
'use strict';

const crypto = require('crypto');
const { getContentType, jidNormalizedUser } = require('@whiskeysockets/baileys');
const { sms } = require('../../lib/msg');
const events = require('../../arslan');
const { handleStatusMessage } = require('./statusHandler');
const { resolveGroupContext } = require('./groupHandler');
const { isGroupJid } = require('../utils/jid');

const createSerial = (size) => crypto.randomBytes(size).toString('hex').slice(0, size);

function attachMessageHandler(session) {
    const { socket, logger, config, store: waStore } = session;

    socket.ev.on('messages.upsert', async (msgUpdate) => {
        try {
            let mek = msgUpdate.messages[0];
            if (!mek.message) return;

            const effectiveConfig = session.getEffectiveConfig();

            mek.message =
                getContentType(mek.message) === 'ephemeralMessage'
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

            if (effectiveConfig.READ_MESSAGE === 'true') await socket.readMessages([mek.key]);

            // Réaction newsletter (best-effort, ne bloque jamais le reste)
            try {
                const newsletterJids = [effectiveConfig.NEWSLETTER_JID].filter(Boolean);
                const newsEmojis = ['❤️', '👍', '😮', '😎', '💀', '💫', '🔥', '👑'];
                if (mek.key && newsletterJids.includes(mek.key.remoteJid) && mek.newsletterServerId) {
                    const emoji = newsEmojis[Math.floor(Math.random() * newsEmojis.length)];
                    await socket.newsletterReactMessage(mek.key.remoteJid, mek.newsletterServerId.toString(), emoji);
                }
            } catch (_) { /* ignore */ }

            if (await handleStatusMessage(session, mek)) return;

            const m = sms(socket, mek);
            const type = getContentType(mek.message);
            const from = mek.key.remoteJid;
            const body =
                type === 'conversation'
                    ? mek.message.conversation
                    : type === 'extendedTextMessage'
                    ? mek.message.extendedTextMessage.text
                    : '';

            const activePrefix = effectiveConfig.PREFIX || config.PREFIX;
            const isCmdMsg = body.startsWith(activePrefix);
            const command = isCmdMsg ? body.slice(activePrefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');
            const text = q;
            const isGroup = isGroupJid(from);

            const sender = mek.key.fromMe
                ? socket.user.id.split(':')[0] + '@s.whatsapp.net'
                : mek.key.participant || mek.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const botNumber = socket.user.id.split(':')[0];
            const botNumber2 = jidNormalizedUser(socket.user.id);
            const pushname = mek.pushName || 'User';

            const isMe = botNumber.includes(senderNumber);
            const ownerList = Array.isArray(effectiveConfig.OWNER_NUMBER) ? effectiveConfig.OWNER_NUMBER : config.OWNER_NUMBER || [];
            const isOwner = ownerList.includes(senderNumber) || isMe;
            const isCreator = isOwner;

            const groupCtx = isGroup ? await resolveGroupContext(session, from, botNumber2, sender) : {};

            if (effectiveConfig.AUTO_TYPING === 'true') await socket.sendPresenceUpdate('composing', from);
            if (effectiveConfig.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate('recording', from);

            const botName = effectiveConfig.BOT_NAME || config.BOT_NAME;
            const myquoted = {
                key: {
                    remoteJid: 'status@broadcast',
                    participant: '13135550002@s.whatsapp.net',
                    fromMe: false,
                    id: createSerial(16).toUpperCase(),
                },
                message: {
                    contactMessage: {
                        displayName: `© ${botName}`,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName} BOY\nORG:${botName} BOY;\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
                        contextInfo: {
                            stanzaId: createSerial(16).toUpperCase(),
                            participant: '0@s.whatsapp.net',
                            quotedMessage: { conversation: `© ${botName}` },
                        },
                    },
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                status: 1,
                verifiedBizName: 'Meta',
            };

            const reply = (t) => socket.sendMessage(from, { text: t }, { quoted: myquoted });

            const ctx = {
                from,
                l: reply,
                quoted: mek,
                body,
                isCmd: isCmdMsg,
                command,
                args,
                q,
                text,
                isGroup,
                sender,
                senderNumber,
                botNumber2,
                botNumber,
                pushname,
                isMe,
                isOwner,
                isCreator,
                ...groupCtx,
                reply,
                config: effectiveConfig,
                myquoted,
            };

            if (isCmdMsg) {
                await session.trackStat('commandsUsed');
                const cmd =
                    events.commands.find((c) => c.pattern === command) ||
                    events.commands.find((c) => c.alias && c.alias.includes(command));
                if (cmd) {
                    if ((effectiveConfig.WORK_TYPE || config.WORK_TYPE) === 'private' && !isOwner) return;
                    if (cmd.react) socket.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                    try {
                        cmd.function(socket, mek, m, ctx);
                    } catch (err) {
                        logger.error(`Plugin error [${command}]: ${err.message}`);
                    }
                }
            }

            await session.trackStat('messagesReceived');
            if (isGroup) await session.trackStat('groupsInteracted');

            events.commands.forEach((evCmd) => {
                if (body && evCmd.on === 'body') evCmd.function(socket, mek, m, ctx);
                else if (mek.q && evCmd.on === 'text') evCmd.function(socket, mek, m, ctx);
                else if ((evCmd.on === 'image' || evCmd.on === 'photo') && mek.type === 'imageMessage') evCmd.function(socket, mek, m, ctx);
                else if (evCmd.on === 'sticker' && mek.type === 'stickerMessage') evCmd.function(socket, mek, m, ctx);
            });
        } catch (err) {
            logger.error(`Message handler error: ${err.message}`);
        }
    });
}

module.exports = { attachMessageHandler };
