<div align="center">

# 👑 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃 v4.0 👑

### 🚀 Moteur WhatsApp Multi-Session Ultra-Léger, Évolutif & Haute Résilience
**Développé par GoldenBoy Dev™**

</div>

---

## 🌟 À Propos de la Version 4.0

**ANOS VOLDIGOAD MINI MD v4.0** est une refonte complète du moteur de bot WhatsApp Baileys multi-session. Conçu pour concilier performance extrême, empreinte mémoire minimale et fiabilité sans compromis, il résout l'ensemble des problématiques de concurrence, de fuites mémoire et de gestion de sessions.

### Points Clés v4.0
- **Suppression automatique obligatoire des sessions déconnectées définitivement :** Dès qu'un compte est déconnecté par WhatsApp (code 401, `loggedOut`, `badSession` ou demande utilisateur), ses credentials et son sous-dossier de session sont effacés de manière sécurisée et vérifiée (procédure stricte en 18 étapes).
- **Préservation absolue des credentials sur coupure réseau :** Une simple interruption internet, un timeout ou un redémarrage du serveur ne supprime JAMAIS les credentials. En cas de dépassement des tentatives de reconnexion, la session est mise en pause (`paused`) sur le disque sans perte de données.
- **Restauration par lots (Batch Restore) :** Au boot, les sessions valides sont restaurées progressivement (lots configurables de 20 avec délai) pour éviter les pics de charge CPU et RAM.
- **Nettoyage automatique au boot :** Reprise et finalisation des suppressions interrompues par un arrêt inopiné du processus grâce aux marqueurs `.deleting`.
- **Backoff exponentiel avec Jitter :** Évite l'effet de ruée (*thundering herd*) lors d'une reconnexion générale.
- **Sécurité Path Traversal :** Vérification canonique stricte garantissant qu'aucune opération fichier ne peut s'échapper du dossier autorisé `sessions/`.
- **Panneau d'administration responsive :** Observabilité temps réel (utilisateurs enregistrés, sessions sur disque, connexions actives, RAM RSS, CPU, Event Loop Lag et journal d'audit des suppressions).

---

## ⚙️ Prérequis & Installation

- **Node.js :** 20.x ou 22.x
- **Système :** Linux (Ubuntu/Debian recommandé), macOS ou conteneur Docker.
- **RAM recommandée :**
  - Jusqu'à 50 connexions actives : 1 Go à 2 Go de RAM
  - Jusqu'à 200 connexions actives : 4 Go de RAM
  - Jusqu'à 500 connexions actives : 8 Go à 16 Go de RAM

### Installation Rapide

```bash
# 1. Cloner ou extraire le projet
cd anos-voldigoad-mini-md-v4.0

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env

# 4. Lancer la vérification de syntaxe et les tests automatisés
npm run check
npm test

# 5. Démarrer le serveur
npm start
```

---

## 🔐 Variables d'Environnement Principales

| Variable | Description | Valeur par défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur HTTP / API | `20338` |
| `API_KEY` | Clé d'authentification des routes `/admin/*` | `anos-admin-secret-key-2026` |
| `MAX_SESSIONS` | Limite logique maximale de sessions enregistrées | `1000` |
| `MAX_ACTIVE_CONNECTIONS` | Limite de connexions WhatsApp actives simultanées | `500` |
| `MAX_RESTART_ATTEMPTS` | Nombre max de tentatives de reconnexion avant pause | `8` |
| `INITIAL_RECONNECT_DELAY_MS` | Délai initial du backoff (ms) | `2000` |
| `MAX_RECONNECT_DELAY_MS` | Plafond maximal du délai de reconnexion (ms) | `60000` |
| `RECONNECT_JITTER_RATIO` | Ratio de variation aléatoire du délai ($\pm$) | `0.3` |
| `AUTO_DELETE_ON_LOGOUT` | Suppression auto des fichiers si 401/loggedOut | `true` |
| `BATCH_RESTORE_SIZE` | Taille des lots de restauration au boot | `20` |
| `BATCH_RESTORE_DELAY_MS` | Intervalle entre chaque lot de restauration (ms) | `300` |
| `MEDIA_CONCURRENCY_LIMIT` | Limite de traitement média simultané | `5` |

---

## 🔄 Cycle de Vie d'une Session

```text
[ Nouvel Utilisateur ]
         │
         ▼
  pending_pairing ──(Code généré)──► WhatsApp Web
         │                                  │
         │ (Appairage réussi)               │
         ▼                                  ▼
      connecting ─────────────────────►   open ◄────────┐
         │                                  │           │
         │ (Erreur réseau temporaire)       │           │
         ▼                                  ▼           │
    reconnecting ◄──────────────────────────┘           │
         │                                              │
         ├─► Backoff avec Jitter (2s → 60s) ────────────┘
         │
         ├─► Max tentatives atteintes
         │          │
         │          ▼
         │       paused (Credentials conservés sur disque)
         │
         ▼ (Déconnexion définitive : 401 / loggedOut / badSession / /disconnect)
      deleting (Procédure en 18 étapes : arrêt timers, purge listeners, purge RAM, fs.remove)
         │
         ▼
     [ DÉTRUITE ] (Dossier effacé, audit consigné)
```

---

## 🌐 Endpoints API

### Routes Publiques
- `GET /` — Interface web de pairing avec navigation par étapes
- `GET /code?number=509XXXXXXXX` — Génération d'un code de pairing (avec rate limit)
- `GET /ping` — Sonde de santé minimale
- `GET /admin` — Panneau d'administration web

### Routes Privées (Header `x-api-key: VOTRE_CLE`)
- `GET /admin/health` — Métriques système complètes (utilisateurs, connexions, RAM, CPU, Event Loop Lag)
- `GET /admin/sessions` — Liste détaillée de toutes les sessions connues
- `GET /admin/sessions/:number` — Détail d'une session
- `POST /admin/sessions/:number/restart` — Redémarrage d'une session
- `DELETE /admin/sessions/:number` — Suppression définitive et purge des fichiers
- `GET /admin/logs/:number` — Dernières lignes de journalisation de la session
- `GET /admin/deletions` — Journal d'audit des sessions supprimées

---

## 🧪 Tests & Benchmark

```bash
# Vérification de syntaxe JavaScript
npm run check

# Suite de tests automatisée (16 tests unitaires et d'intégration)
npm test

# Benchmark de charge progressive (10 à 1000 sessions)
npm run benchmark
```

---

## 📜 Licence
Projet distribué sous licence MIT. Développé par **GoldenBoy DEV™**.
