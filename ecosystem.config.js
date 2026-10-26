// ecosystem.config.js — PM2, fork mode, restart auto, 512M max
module.exports = {
    apps: [
        {
            name: 'anos-voldigoad-mini-md',
            script: 'index.js',
            // Fork mode obligatoire : le Map des sessions vit en mémoire dans
            // UN process. Le mode cluster de PM2 créerait plusieurs process
            // qui ne partageraient pas les sockets Baileys entre eux (une
            // session pairée sur l'instance A serait invisible pour B) —
            // pour scaler horizontalement au-delà d'un seul serveur, il faut
            // partitionner les numéros entre plusieurs déploiements distincts
            // (ex: par préfixe pays) plutôt que le mode cluster.
            exec_mode: 'fork',
            instances: 1,
            // 500 sessions actives ~= 4-8 Go de RAM (dépend de l'activité).
            // Adapte cette valeur à la RAM réelle de la machine — PM2 relance
            // le process si ce seuil est dépassé, ce qui coupe TOUTES les
            // sessions d'un coup (elles se restaurent au reboot, mais évite
            // de fixer une valeur trop basse en prod).
            max_memory_restart: process.env.PM2_MAX_MEMORY || '6G',
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
            error_file: './sessions/_pm2/error.log',
            out_file: './sessions/_pm2/out.log',
            merge_logs: true,
            time: true,
        },
    ],
};
