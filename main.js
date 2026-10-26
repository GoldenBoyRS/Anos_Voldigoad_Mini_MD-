// main.js — conservé pour compatibilité (require('./main') donnait le router
// Express). Toute la logique vit maintenant dans src/. Ce fichier ne fait
// plus que ré-exposer un router équivalent si quelque chose l'importe encore
// directement ; le point d'entrée normal est désormais index.js.
'use strict';

const path = require('path');
const { rootLogger } = require('./src/core/logger');
const SessionManager = require('./src/session/SessionManager');
const createServer = require('./src/api/server');

let _appPromise = null;

/** Construit (une seule fois) l'app Express complète, SessionManager inclus */
function getApp() {
    if (!_appPromise) {
        _appPromise = (async () => {
            const manager = new SessionManager({ sessionsDir: path.join(__dirname, 'sessions'), logger: rootLogger });
            await manager.init();
            return createServer({ manager, logger: rootLogger });
        })();
    }
    return _appPromise;
}

module.exports = getApp;
