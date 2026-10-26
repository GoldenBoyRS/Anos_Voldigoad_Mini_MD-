// src/core/shutdown.js — arrêt propre du process (toutes les sessions + flush)
'use strict';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Enregistre les handlers SIGINT/SIGTERM/uncaughtException. Sur signal, on
 * arrête proprement chaque session (avec timeout global), on flush leur
 * state.json, puis on quitte. Un seul appel par process (guard interne).
 */
function registerShutdown({ sessionManager, logger, httpServer = null }) {
    let shuttingDown = false;

    async function shutdown(reason) {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.warn(`Arrêt en cours (raison: ${reason})...`);

        const timeout = new Promise((resolve) =>
            setTimeout(() => {
                logger.warn(`Timeout de ${SHUTDOWN_TIMEOUT_MS}ms atteint, sortie forcée.`);
                resolve('timeout');
            }, SHUTDOWN_TIMEOUT_MS)
        );

        const work = (async () => {
            try {
                if (httpServer) await new Promise((res) => httpServer.close(res));
            } catch (_) { /* ignore */ }
            try {
                await sessionManager.stopAll({ persist: true });
            } catch (err) {
                logger.error(`Erreur pendant l'arrêt des sessions: ${err.message}`);
            }
            return 'clean';
        })();

        const result = await Promise.race([work, timeout]);
        logger.warn(`Arrêt terminé (${result}).`);
        process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', async (err) => {
        logger.error(`uncaughtException: ${err.stack || err.message}`);
        await shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
        logger.error(`unhandledRejection: ${reason instanceof Error ? reason.stack : reason}`);
    });

    return shutdown;
}

module.exports = { registerShutdown, SHUTDOWN_TIMEOUT_MS };
