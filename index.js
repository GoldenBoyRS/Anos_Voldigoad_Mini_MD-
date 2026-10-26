// index.js — Bootstrap Express + SessionManager. ~30 lignes, délègue tout.
'use strict';

require('dotenv').config();

const path = require('path');
const { rootLogger } = require('./src/core/logger');
const { loadPlugins } = require('./src/core/pluginLoader');
const SessionManager = require('./src/session/SessionManager');
const createServer = require('./src/api/server');
const { registerShutdown } = require('./src/core/shutdown');

const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 20338);

async function main() {
    loadPlugins(path.join(__dirname, 'plugins'), rootLogger);

    const manager = new SessionManager({
        sessionsDir: path.join(__dirname, 'sessions'),
        logger: rootLogger,
    });

    const { restored, total } = await manager.init();
    rootLogger.info(`SessionManager prêt : ${restored}/${total} session(s) restaurée(s)`);

    const app = createServer({ manager, logger: rootLogger });
    const httpServer = app.listen(PORT, () => rootLogger.info(`🚀 Serveur démarré sur le port ${PORT}`));

    registerShutdown({ sessionManager: manager, logger: rootLogger, httpServer });
}

main().catch((err) => {
    rootLogger.error(`Échec du démarrage: ${err.stack || err.message}`);
    process.exit(1);
});
