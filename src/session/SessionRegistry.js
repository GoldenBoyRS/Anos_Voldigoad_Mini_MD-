// src/session/SessionRegistry.js — index global : sessions/registry.json
// Permet de lister toutes les sessions connues sans scanner+lire chaque
// state.json à chaque requête API. Rebuild automatique si absent/incohérent.
'use strict';

const path = require('path');
const { atomicWriteJSON, readJSON } = require('../utils/files');
const { sanitizeNumber } = require('../utils/numbers');

const REGISTRY_VERSION = 1;

class SessionRegistry {
    constructor(sessionsRootDir, store) {
        this.root = sessionsRootDir;
        this.store = store;
        this.path = path.join(sessionsRootDir, 'registry.json');
        this._data = null; // cache mémoire, toujours ré-écrit sur disque au changement
    }

    _empty() {
        return { version: REGISTRY_VERSION, updatedAt: new Date().toISOString(), sessions: {} };
    }

    async load() {
        const onDisk = await readJSON(this.path, null);
        if (onDisk && onDisk.version === REGISTRY_VERSION && onDisk.sessions) {
            this._data = onDisk;
            return this._data;
        }
        // Absent ou incohérent -> rebuild depuis le disque (scan des dossiers + state.json)
        this._data = await this.rebuild();
        return this._data;
    }

    /** Reconstruit entièrement le registre à partir des state.json existants */
    async rebuild() {
        const data = this._empty();
        const numbers = await this.store.listSessionDirs();
        for (const number of numbers) {
            const state = await this.store.readState(number);
            data.sessions[number] = this._entryFromState(state);
        }
        await atomicWriteJSON(this.path, data);
        return data;
    }

    _entryFromState(state) {
        return {
            number: state.number,
            createdAt: state.createdAt,
            lastConnected: state.lastConnected,
            lastDisconnected: state.lastDisconnected,
            status: state.status,
            stopReason: state.stopReason || null,
            totalReconnects: state.totalReconnects || 0,
            banned: !!state.banned,
        };
    }

    async _persist() {
        this._data.updatedAt = new Date().toISOString();
        await atomicWriteJSON(this.path, this._data);
    }

    async upsertFromState(number, state) {
        if (!this._data) await this.load();
        this._data.sessions[sanitizeNumber(number)] = this._entryFromState(state);
        await this._persist();
    }

    async remove(number) {
        if (!this._data) await this.load();
        delete this._data.sessions[sanitizeNumber(number)];
        await this._persist();
    }

    list() {
        return this._data ? Object.values(this._data.sessions) : [];
    }

    get(number) {
        return this._data ? this._data.sessions[sanitizeNumber(number)] : undefined;
    }
}

module.exports = SessionRegistry;
