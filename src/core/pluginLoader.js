// src/core/pluginLoader.js — charge dynamiquement plugins/*.js (inchangé
// fonctionnellement par rapport à l'ancien main.js, juste isolé ici).
'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Charge tous les plugins de plugins/. Chaque plugin s'enregistre lui-même
 * dans arslan.js (events.commands) via cmd(...) au require(). On ne fait
 * ici que le require + comptage/erreurs, sans toucher à plugins/.
 */
function loadPlugins(pluginsDir, logger) {
    fs.ensureDirSync(pluginsDir);
    const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.js'));
    let loaded = 0;
    const failed = [];

    for (const file of files) {
        try {
            require(path.join(pluginsDir, file));
            loaded++;
        } catch (err) {
            failed.push({ file, error: err.message });
            logger.error(`Plugin ${file} a échoué au chargement: ${err.message}`);
        }
    }

    logger.info(`${loaded}/${files.length} plugins chargés`);
    return { total: files.length, loaded, failed };
}

module.exports = { loadPlugins };
