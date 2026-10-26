// src/session/Session.js — 1 session = 1 objet, isolée des autres
'use strict';

const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestWaWebVersion,
    downloadContentFromMessage,
} = require('@whiskeysockets/baileys');
const FileType = require('file-type');
const pino = require('pino');

const config = require('../../config');
const { sanitizeNumber } = require('../utils/numbers');
const { decodeJid } = require('../utils/jid');
const { createSessionLogger, cleanupSessionLogger } = require('../core/logger');
const { classifyDisconnection } = require('../core/backoff');
const { attachConnectionHandler } = require('../handlers/connectionHandler');
const { attachCallHandler } = require('../handlers/callHandler');
const { attachAntideleteHandler } = require('../handlers/antideleteHandler');
const { attachMessageHandler } = require('../handlers/messageHandler');
const { attachGroupHandler } = require('../handlers/groupHandler');

const PAIRING_CODE_TTL_MS = 300_000; // 5 minutes
const STATS_FLUSH_INTERVAL_MS = Number(process.env.STATS_FLUSH_INTERVAL_MS || 15_000);
const GROUP_CACHE_TTL_MS = Number(process.env.GROUP_METADATA_CACHE_TTL_MS || 60_000);
const WA_VERSION_CACHE_TTL_MS = Number(process.env.WA_VERSION_CACHE_TTL_MS || 1_800_000); // 30 min
let waVersionCache = { version: null, fetchedAt: 0, source: null };

function normalizeWaVersion(value) {
    if (Array.isArray(value) && value.length === 3 && value.every((n) => Number.isInteger(n) && n >= 0)) {
        return value;
    }
    if (typeof value === 'string') {
        const parts = value.trim().replace(/\s+/g, '').split(/[.,]/).map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0)) return parts;
    }
    return null;
}

async function fetchLiveWaWebVersionDirect() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    timer.unref?.();
    try {
        const response = await fetch('https://web.whatsapp.com/sw.js', {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-dest': 'empty',
            },
        });
        if (!response.ok) throw new Error(`sw.js HTTP ${response.status}`);
        const body = await response.text();
        const match = body.match(/client_revision[^0-9]*(\d+)/);
        if (!match) throw new Error('client_revision introuvable dans sw.js');
        //debug par WENS DEV 
        throw new Error('live-direct version fetch disabled');
    } finally {
        clearTimeout(timer);
    }
}

async function getBaileysVersion() {
    const envVersion = normalizeWaVersion(process.env.WA_VERSION);
    if (envVersion) {
        return envVersion;
    }

    if (waVersionCache.version && Date.now() - waVersionCache.fetchedAt < WA_VERSION_CACHE_TTL_MS) {
        return waVersionCache.version;
    }

    // 1) Essayer fetchLatestWaWebVersion de Baileys
    try {
        const result = await fetchLatestWaWebVersion();
        const version = normalizeWaVersion(result?.version);
        if (version) {
            waVersionCache = { version, fetchedAt: Date.now(), source: 'baileys-live' };
            return version;
        }
    } catch (err) {
        // En cas de coupure internet temporaire ou DNS
    }

    // 2) Fallback sécurisé vers une version WhatsApp Web vérifiée
    const fallbackVersion = [2, 3000, 1015901307];
    waVersionCache = { version: fallbackVersion, fetchedAt: Date.now(), source: 'fallback-stable' };
    return fallbackVersion;
}

function createInMemoryStore() {
    const messages = Object.create(null);
    const order = [];
    const maxMessages = Math.max(100, Number(process.env.MESSAGE_CACHE_MAX || 500));
    let total = 0;

    function addMessage(jid, msg) {
        if (!messages[jid]) messages[jid] = [];
        messages[jid].push(msg);
        order.push({ jid, id: msg.key?.id });
        total++;

        while (total > maxMessages) {
            const oldest = order.shift();
            if (!oldest) break;
            const bucket = messages[oldest.jid];
            if (!bucket) continue;
            const index = bucket.findIndex((item) => item.key?.id === oldest.id);
            if (index !== -1) bucket.splice(index, 1);
            if (!bucket.length) delete messages[oldest.jid];
            total--;
        }
    }

    return {
        messages,
        bind(ev) {
            ev.on('messages.upsert', ({ messages: msgs }) => {
                for (const msg of msgs) {
                    const jid = msg.key && msg.key.remoteJid;
                    if (jid) addMessage(jid, msg);
                }
            });
        },
        async loadMessage(jid, id) {
            if (!messages[jid]) return null;
            return messages[jid].find((m) => m.key && m.key.id === id) || null;
        },
    };
}

class Session {
    /**
     * @param {string} number
     * @param {{ store: import('./SessionStore'), registry: import('./SessionRegistry'), manager: import('./SessionManager') }} deps
     */
    constructor(number, { store, registry, manager, generation }) {
        this.number = sanitizeNumber(number);
        this.store = createInMemoryStore(); // store de messages Baileys (nom conservé pour compat handlers)
        this.fsStore = store;               // SessionStore (persistance disque)
        this.registry = registry;
        this.manager = manager;
        this.generation = generation;
        this.config = config;

        this.socket = null;
        this.status = 'idle'; // idle | pairing | open | reconnecting | dead | stopped
        this.createdAt = null;
        this.lastSeen = null;
        this.restartAttempts = 0;
        this.stats = null;
        this.userConfig = {};
        this.isFreshPairing = false;
        this.logger = null;
        this._pairingExpiryTimer = null;
        this._statsFlushTimer = null;
        this._statsDirty = false;
        this._stopping = false;
        this.groupMetadataCache = new Map();
    }

    decodeJid(jid) {
        return decodeJid(jid);
    }

    getEffectiveConfig() {
        return { ...this.config, ...this.userConfig };
    }

    trackStat(key, by = 1) {
        if (!this.stats) this.stats = this.fsStore.defaultStats();
        this.stats[key] = (this.stats[key] || 0) + by;
        this._statsDirty = true;
        this._scheduleStatsFlush();
        return this.stats;
    }

    _scheduleStatsFlush() {
        if (this._statsFlushTimer || !this._statsDirty) return;
        this._statsFlushTimer = setTimeout(() => {
            this._statsFlushTimer = null;
            this.flushStats().catch((err) => this.logger?.warn(`Stats flush error: ${err.message}`));
        }, STATS_FLUSH_INTERVAL_MS);
        this._statsFlushTimer.unref?.();
    }

    async flushStats() {
        if (!this._statsDirty || !this.stats) return this.stats;
        await this.fsStore.writeStats(this.number, this.stats);
        this._statsDirty = false;
        return this.stats;
    }

    invalidateGroupCache(jid = null) {
        if (jid) this.groupMetadataCache.delete(jid);
        else this.groupMetadataCache.clear();
    }

    async getGroupMetadata(jid) {
        const cached = this.groupMetadataCache.get(jid);
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        try {
            const value = await this.socket.groupMetadata(jid);
            this.groupMetadataCache.set(jid, { value, expiresAt: Date.now() + GROUP_CACHE_TTL_MS });
            return value;
        } catch (err) {
            this.groupMetadataCache.delete(jid);
            throw err;
        }
    }

    /** Démarre la session : pairing (nouveau numéro) ou restore (creds existants) */
    async start({ requestPairingCode = false, res = null } = {}) {
        await this.fsStore.ensureSessionDir(this.number);
        this.logger = createSessionLogger(this.number, this.fsStore.getSessionDir(this.number));

        const state = await this.fsStore.readState(this.number);
        this.userConfig = state.userConfig || {};
        this.stats = await this.fsStore.readStats(this.number);
        this.createdAt = state.createdAt || new Date().toISOString();

        const hasCreds = await this.fsStore.credsExist(this.number);
        this.isFreshPairing = !hasCreds;

        await this.connect();

        if (!this.socket.authState.creds.registered) {
            this.status = 'pairing';
            await this._persistState({ status: 'pairing' });
            if (requestPairingCode) {
                return this._requestPairingCode(res);
            }
            return { status: 'pairing_ready' };
        }

        this.status = 'reconnecting';
        await this._persistState({ status: 'reconnecting' });
        return { status: 'reconnecting' };
    }

    async connect() {
        const credsDir = this.fsStore.getCredsDir(this.number);
        const { state, saveCreds } = await useMultiFileAuthState(credsDir);
        this._saveCreds = saveCreds;

        const bailLogger = pino({ level: 'silent' });
        const version = await getBaileysVersion();

        this.socket = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, bailLogger) },
            printQRInTerminal: false,
            logger: bailLogger,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            fireInitQueries: false,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            // WhatsApp a récemment rejeté les identités Desktop/DARWIN dans certains flux de pairing.
            // Chrome annonce une identité WEB_BROWSER compatible avec le pairing par numéro.
            browser: Browsers.ubuntu('Chrome'),
            getMessage: async (key) => {
                const msg = await this.store.loadMessage(key.remoteJid, key.id);
                return msg && msg.message ? msg.message : { conversation: this.config.BOT_NAME };
            },
        });

        this.store.bind(this.socket.ev);

        this.socket.decodeJid = (jid) => this.decodeJid(jid);
        this.socket.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            const quoted = message.msg ? message.msg : message;
            const mime = (message.msg || message).mimetype || '';
            const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            const type = await FileType.fromBuffer(buffer);
            const trueFileName = attachExtension ? `${filename}.${type.ext}` : filename;
            await require('fs-extra').writeFile(trueFileName, buffer);
            return trueFileName;
        };

        this.socket.ev.on('creds.update', async () => {
            await this._saveCreds();
        });

        attachConnectionHandler(this);
        attachCallHandler(this);
        attachAntideleteHandler(this);
        attachGroupHandler(this);
        attachMessageHandler(this);
    }

    async _requestPairingCode(res) {
        try {
            
            const code = await this.socket.requestPairingCode(this.number);
            this.logger.info(`Code de pairing généré`);
            if (res && !res.headersSent) res.json({ code, status: 'new_pairing' });

            this._pairingExpiryTimer = setTimeout(async () => {
                if (this.socket && !this.socket.authState.creds.registered) {
                    this.logger.warn('Code de pairing expiré sans utilisation — nettoyage');
                    await this.manager.stop(this.number, { reason: 'pairing_expired', keepFiles: false });
                }
            }, PAIRING_CODE_TTL_MS);

            return { code, status: 'new_pairing' };
        } catch (err) {
            this.logger.error(`Échec requestPairingCode: ${err.message}`);
            if (res && !res.headersSent) res.status(500).json({ error: 'Failed to get pairing code', message: err.message });
            throw err;
        }
    }

    onOpen() {
        if (!this.manager.isCurrent(this) || this._stopping) return;
        clearTimeout(this._pairingExpiryTimer);
        this.status = 'open';
        this.restartAttempts = 0;
        this.lastSeen = new Date().toISOString();
        this.lastConnected = this.lastSeen;
        this.manager.backoff.reset(this.number);
        this._persistState({ status: 'open', lastConnected: this.lastSeen }).catch(() => {});
    }

    /** Décide quoi faire à la fermeture : suppression automatique si logout définitif / reconnexion si temporaire */
    async onClose({ statusCode, errorMessage, loggedOut }) {
        if (this._stopping || !this.manager.isCurrent(this)) return;
        this.lastSeen = new Date().toISOString();

        const classification = classifyDisconnection(statusCode, errorMessage, loggedOut);

        // 1. Déconnexion définitive (Exigence 5 : SUPPRESSION AUTOMATIQUE OBLIGATOIRE)
        if (classification.shouldDelete) {
            this.logger.warn(`Déconnexion définitive détectée (${classification.reason}) : suppression automatique des credentials et fichiers pour le compte ${this.number}`);
            this.status = 'deleting';
            await this.manager.destroy(this.number, { reason: classification.reason, permanent: true });
            return;
        }

        // 2. Client WhatsApp obsolète (405)
        if (classification.type === 'version_rejected') {
            this.logger.error(`WhatsApp a rejeté la version du client (405). Arrêt de la reconnexion automatique pour éviter une boucle.`);
            this.status = 'failed';
            await this._persistState({ status: 'failed', lastDisconnected: this.lastSeen, stopReason: 'version_rejected_405' });
            return;
        }

        // 3. Délai de pairing dépassé sans utilisation
        if (classification.type === 'pairing_timeout') {
            this.logger.warn(`Timeout de pairing (${this.number}) — session mise en attente.`);
            this.status = 'failed';
            await this._persistState({ status: 'failed', lastDisconnected: this.lastSeen, stopReason: 'pairing_timeout' });
            return;
        }

        // 4. Coupure réseau / erreur transitoire (Exigence 5.2 : CONSERVER LES CREDENTIALS SUR DISQUE)
        this.logger.info(`Interruption temporaire (${classification.desc}) — credentials conservés sur disque.`);
        this.status = 'reconnecting';
        await this._persistState({ status: 'reconnecting', lastDisconnected: this.lastSeen, stopReason: classification.reason });
        await this.manager.scheduleReconnect(this.number);
    }

    async _persistState(patch) {
        const extra = { userConfig: this.userConfig };
        if (patch.status === 'reconnecting') {
            const current = await this.fsStore.readState(this.number);
            extra.totalReconnects = (current.totalReconnects || 0) + 1;
        }
        const state = await this.fsStore.patchState(this.number, { ...patch, ...extra });
        this.status = state.status;
        await this.registry.upsertFromState(this.number, state);
        return state;
    }

    async saveState(patch = {}) {
        return this._persistState({ status: this.status, ...patch });
    }

    /** Nettoyage exhaustif des ressources mémoire et socket pour éviter les fuites */
    async cleanup() {
        this._stopping = true;
        if (this._pairingExpiryTimer) {
            clearTimeout(this._pairingExpiryTimer);
            this._pairingExpiryTimer = null;
        }
        if (this._statsFlushTimer) {
            clearTimeout(this._statsFlushTimer);
            this._statsFlushTimer = null;
        }
        this.groupMetadataCache.clear();
        try {
            this.socket?.ev?.removeAllListeners();
            await this.socket?.ws?.close?.();
        } catch (_) {}
        this.socket = null;
        try {
            await cleanupSessionLogger(this.number, this.fsStore.getSessionDir(this.number));
        } catch (_) {}
    }

    /** Fermeture propre du socket, sans supprimer les fichiers de session */
    async stop(reason = 'manual') {
        this.status = 'closing';
        await this.flushStats().catch(() => {});
        await this.cleanup();
        this.status = 'closed';
        await this._persistState({ status: 'closed', lastDisconnected: new Date().toISOString(), stopReason: reason }).catch(() => {});
    }

    getInfo() {
        return {
            number: this.number,
            status: this.status,
            createdAt: this.createdAt,
            lastSeen: this.lastSeen,
            restartAttempts: this.manager.backoff.get(this.number),
            stats: this.stats,
            uptimeSeconds: this.lastConnected && this.status === 'open'
                ? Math.floor((Date.now() - new Date(this.lastConnected).getTime()) / 1000)
                : 0,
        };
    }
}

module.exports = Session;