# Guide de Migration — ANOS VOLDIGOAD MINI MD v3.4 vers v4.0

---

## 1. Changements Majeurs

| Composant | Comportement en v3.4 | Nouveau Comportement en v4.0 |
|---|---|---|
| **Déconnexion Définitive (401 / loggedOut)** | Conservée sur disque avec statut `dead` | **Supprimée automatiquement** : purge des fichiers et credentials (18 étapes) |
| **Coupure Réseau Prolongée** | Credentials supprimés si max tentatives atteintes | **Credentials strictement conservés** : mise en pause (`paused`) |
| **Crash pendant suppression** | Fichiers orphelins pouvant être réactivés | **Markers `.deleting`** avec reprise et nettoyage automatique au boot |
| **Backoff de Reconnexion** | Déterministe ($2^n$) sans variation | **Exponentiel avec Jitter pseudo-aléatoire** ($\pm 30\%$) |
| **Résolution Version Baileys** | Exception fatale bloquante si réseau offline | **Fallback 4 niveaux** avec version stable vérifiée |
| **Sécurité Chemins** | Aucun contrôle de périmètre | **Validation canonique `assertSafeSubdirectory`** (anti-traversal) |
| **Fuite Logger** | Buffers Map conservés indéfiniment | **Méthode `cleanupSessionLogger`** appelée à la fermeture de session |
| **Limiteur Concurrence Médias** | Non plafonné | **Plafond configurable `MEDIA_CONCURRENCY_LIMIT=5`** + try/finally |
| **Restauration au Démarrage** | Chargement simultané brutal | **Restauration par lots (Batch Restore)** avec temporisation |
| **Journal d'Audit** | Inexistant | **Fichier `sessions/deletions_audit.json`** et route `/admin/deletions` |

---

## 2. Procédure de Migration depuis v3.4

1. **Sauvegarde :**
   ```bash
   cp -r sessions/ sessions_backup_v34/
   ```
2. **Remplacement des fichiers source :**
   Déployez le code de la v4.0.
3. **Mise à jour des variables d'environnement (`.env`) :**
   Ajoutez les nouvelles options de résilience :
   ```env
   MAX_SESSIONS=1000
   MAX_ACTIVE_CONNECTIONS=500
   AUTO_DELETE_ON_LOGOUT=true
   RECONNECT_JITTER_RATIO=0.3
   BATCH_RESTORE_SIZE=20
   BATCH_RESTORE_DELAY_MS=300
   ```
4. **Vérification et Tests :**
   ```bash
   npm run check
   npm test
   ```
5. **Démarrage :**
   ```bash
   npm start
   ```
   Au démarrage, le moteur exécutera `cleanupPendingDeletions()`, chargera le registre existant et restaurera vos sessions valides par lots successifs.
