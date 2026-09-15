<div align="center">

# 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃

### 🤖 Bot WhatsApp Multi-Fonctions — Rapide, Stable, Personnalisable

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![License](https://img.shields.io/badge/Licence-MIT-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Statut-Actif-success?style=for-the-badge)

</div>

---

## 📋 À propos

**𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃** est un bot WhatsApp basé sur **Baileys**, conçu pour automatiser et enrichir la gestion de vos discussions et groupes : téléchargements multi-plateformes, stickers, outils d'administration de groupe, commandes système et bien plus, le tout piloté par un système de plugins simple à étendre.

👨‍💻 **Développeur :** GoldenBoy DEV

---

## ✨ Fonctionnalités

### 🛠️ Système & Général
| Commande | Description |
|---|---|
| `.ping` | Vérifie la vitesse de réponse du bot en temps réel |
| `.alive` / `.main-alive` | Vérifie que le bot est actif et affiche son statut/uptime |
| `.allmenu` | Affiche la liste complète des commandes disponibles |
| `.generale` | Vérifie la latence et les ressources système |
| `.online` | Affiche les membres en ligne dans le groupe (Admins & Owner) |

### 📥 Téléchargement
| Commande | Description |
|---|---|
| `.song` | Recherche et téléchargement de musique YouTube (MP3) |
| `.video` | Téléchargement rapide de vidéos YouTube |
| `.yts` | Recherche de vidéos sur YouTube |
| `.ig` | Téléchargement de vidéos/reels Instagram |
| `.fb` | Téléchargement de vidéos Facebook |
| `.apk` | Téléchargement d'applications via Aptoide |

### 🎨 Créatif
| Commande | Description |
|---|---|
| `.attp` | Convertit un texte en sticker animé |
| `.ss` | Capture d'écran HD d'un site web |

### 👥 Groupe
| Commande | Description |
|---|---|
| `.gc-setting` | Affiche les demandes d'adhésion en attente |
| `.groupstatus` | Publie un texte ou média dans les statuts WhatsApp |
| `.anticall` | Active/désactive les messages de bienvenue |

### ⚙️ Administration (Owner)
| Commande | Description |
|---|---|
| `.set-identity` | Change le nom du bot |
| `.autobio` | Active/désactive la mise à jour automatique de la bio |
| `.antidelete` | Active/désactive la récupération des messages supprimés |
| `.unblock` | Débloque un utilisateur |
| `.all-settings` | Gère les réglages globaux du bot |

---

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/) 18 ou supérieur
- Un compte WhatsApp dédié au bot
- (Optionnel) Une base MongoDB pour la persistance de session

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-utilisateur/ANOS_VOLDIGOAD_MINI_MD.git
cd ANOS_VOLDIGOAD_MINI_MD

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# → Renseignez SESSION_ID, OWNER_NUMBER, PREFIX, etc.

# 4. Démarrer le bot
npm start
```

Au premier démarrage, un QR code (ou pairing code) s'affiche dans le terminal : scannez-le depuis WhatsApp (**Appareils liés**) pour connecter le bot.

---

## ⚙️ Configuration

Les principales variables d'environnement (fichier `.env`) :

| Variable | Description |
|---|---|
| `SESSION_ID` | Identifiant de session pour l'authentification |
| `PREFIX` | Préfixe des commandes (par défaut `.`) |
| `OWNER_NUMBER` | Numéro WhatsApp du propriétaire du bot |
| `MONGODB_URI` | Chaîne de connexion MongoDB (persistance) |
| `WELCOME_ENABLE` / `WELCOME_MSG` | Message de bienvenue dans les groupes |
| `GOODBYE_ENABLE` / `GOODBYE_MSG` | Message d'au revoir dans les groupes |
| `AUTO_TYPING` | Simulation d'écriture automatique |
| `AUTO_VIEW_STATUS` / `AUTO_LIKE_STATUS` | Interaction automatique avec les statuts |
| `BOT_PP` | Photo de profil personnalisée du bot |

> ⚠️ Ne partagez jamais votre fichier `.env` ni votre `SESSION_ID` publiquement.

---

## ➕ Ajouter une nouvelle commande

Le bot charge automatiquement tous les fichiers `.js` du dossier `plugins/`. Il suffit donc de :

1. Créer un fichier dans `plugins/` (ex : `plugins/hello.js`)
2. Utiliser la structure `cmd({...}, async (conn, mek, m, { reply, args, from }) => {...})`
3. Redémarrer le bot

Aucune autre configuration n'est nécessaire.

---

## 📁 Structure du projet

```
ANOS_VOLDIGOAD_MINI_MD/
├── plugins/          # Toutes les commandes du bot
├── lib/              # Fonctions utilitaires internes
├── config/           # Configuration de l'identité du bot
├── data/             # Données persistantes
├── config.js         # Configuration principale
├── index.js          # Point d'entrée
├── main.js           # Chargement des plugins & logique du bot
└── package.json
```

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Pour proposer une amélioration :

1. Forkez le dépôt
2. Créez une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Committez vos changements
4. Ouvrez une Pull Request

---

## 📄 Licence

Ce projet est distribué sous licence **MIT** — libre d'utilisation, de modification et de distribution.

---

<div align="center">

**Développé avec ❤️ par GoldenBoy DEV — 𝐀𝐍𝐎𝐒_𝐕𝐎𝐋𝐃𝐈𝐆𝐎𝐀𝐃_𝐌𝐈𝐍𝐈_𝐌𝐃**

</div>
