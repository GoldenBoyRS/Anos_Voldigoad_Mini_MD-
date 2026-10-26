# Rapport d'Audit Technique — ANOS VOLDIGOAD MINI MD v3.4 vers v4.0

**Projet :** ANOS VOLDIGOAD MINI MD — GoldenBoy DEV  
**Auteur :** Ingénieur Logiciel Senior  
**Date :** 2026-10-26  
**Version cible :** v4.0.0  

---

## 1. Synthèse de l'Audit

L'analyse approfondie du code source issu de l'archive `anos-voldigoad-mini-md-v3.4.zip` a révélé plusieurs problèmes architecturaux critiques, des inversions de logique quant au cycle de vie des sessions, des fuites de mémoire potentielles et des points de blocage au démarrage.

---

## 2. Problèmes Critiques Identifiés & Corrigés

### 2.1. Inversion Critique de la Règle de Suppression (Priorité P0)
- **Anomalie observée dans la v3.4 :**
  - Dans `src/session/Session.js` (lignes 360-374), un commentaire `// debug par WENS DEV` désactivait purement et simplement la suppression automatique lors d'une déconnexion définitive 401 (`loggedOut`), laissant les sessions invalides s'accumuler indéfiniment sur le disque avec le statut `dead`.
  - À l'inverse, dans `src/session/SessionManager.js` (lignes 150-157), lorsque le nombre maximal de tentatives de reconnexion était atteint (`exhausted`), le code appelait `await this.destroy(sanitized, { reason: 'reconnect_exhausted' })`, effaçant définitivement le dossier et les credentials valides de l'utilisateur suite à une simple coupure réseau prolongée !
- **Correction v4.0 :**
  - Respect strict des exigences 5.1 et 5.2 :
    - Déconnexion définitive (`DisconnectReason.loggedOut`, `badSession`, code 401, action `/disconnect`) $\rightarrow$ déclenchement de la procédure obligatoire de suppression en 18 étapes (`destroy`), effaçant de manière vérifiée les credentials et le sous-dossier de session.
    - Perturbation temporaire (`connectionLost`, `timedOut`, `restartRequired`, code 408/515, échec de socket réseau) $\rightarrow$ les fichiers et credentials restent strictement préservés sur le disque. Lorsque les tentatives de reconnexion sont épuisées, la session passe en statut `paused` sur disque sans jamais détruire les credentials.

### 2.2. Échec au Démarrage et Résolution de Version Baileys
- **Anomalie observée :**
  - Dans `Session.js`, la méthode `fetchLiveWaWebVersionDirect()` contenait un `throw new Error('live-direct version fetch disabled')`.
  - La fonction `getBaileysVersion()` levait une exception fatale non rattrapée si `fetchLatestWaWebVersion()` échouait (ex: pas d'accès internet au boot, timeout réseau), empêchant toute initialisation des sockets.
- **Correction v4.0 :**
  - Résolution résiliente à 4 niveaux :
    1. Variable d'environnement `WA_VERSION` (priorité absolue).
    2. Cache mémoire de processus (TTL 30 minutes).
    3. Appel direct `fetchLatestWaWebVersion()` avec protection try/catch.
    4. Fallback vers une version WhatsApp Web stable vérifiée `[2, 3000, 1015901307]`, empêchant tout crash au démarrage.

### 2.3. Absence de Jitter dans le Backoff Exponentiel
- **Anomalie observée :**
  - La v3.4 calculait un délai déterministe `base * 2^(attempt - 1)`. Lors d'une interruption générale du serveur ou du réseau, toutes les sessions déclenchaient leur reconnexion exactement à la même milliseconde (phénomène de *thundering herd*), saturant l'Event Loop et provoquant des rejets de connexion côté WhatsApp.
- **Correction v4.0 :**
  - Implémentation d'un jitter pseudo-aléatoire proportionnel ($\pm 30\%$) borné, étalant les reconnexions de façon harmonieuse dans le temps.

### 2.4. Fuite de Mémoire dans le Logger Partagé
- **Anomalie observée :**
  - Dans `src/core/logger.js`, la table `buffers = new Map()` enregistrait un buffer de logs pour chaque session créée avec la clé `sessionDir + ':' + sessionId`, mais ne supprimait jamais cette entrée lors de la destruction d'une session.
- **Correction v4.0 :**
  - Ajout de la fonction `cleanupSessionLogger(sessionId, sessionDir)` appelée lors du `cleanup()` de chaque session, assurant un flush final puis la suppression immédiate de l'entrée dans la Map.

### 2.5. Concurrence et Expiration du Pairing
- **Anomalie observée :**
  - `PairingQueue.js` utilisait un `Set` simple sans aucun TTL. En cas d'erreur asynchrone non interceptée pendant le pairing, le numéro restait bloqué indéfiniment dans `inFlight`.
- **Correction v4.0 :**
  - Intégration d'un timestamp d'expiration TTL (60s) avec nettoyage automatique des verrous périmés.

### 2.6. Vulnérabilité de Sécurité Path Traversal
- **Anomalie observée :**
  - Aucune vérification stricte du chemin canonique résolu avant d'effectuer un `removeDir` ou `deleteSession`.
- **Correction v4.0 :**
  - Ajout de la fonction `assertSafeSubdirectory(rootDir, targetDir)` qui résout canoniquement les chemins et bloque immédiatement toute tentative sortant du répertoire autorisé `sessions/`.

### 2.7. Bug d'Authentification sur les Routes Admin
- **Anomalie observée :**
  - `config.js` n'exportait pas la clé `API_KEY`. Par conséquent, le middleware `auth.js` retournait une erreur HTTP 500 sur toutes les routes `/admin/*`.
- **Correction v4.0 :**
  - Export propre de `API_KEY` dans `config.js` avec fallback automatique sécurisé.

---

## 3. Matrice de Validation

| Exigence | v3.4 | v4.0 | Validation |
|---|---|---|---|
| Isolation totale des sessions | Partielle | Complète (Instance Generations) | ✅ Test 5 & 12 |
| Suppression auto sur déconnexion définitive | ❌ Désactivée | ✅ Active (18 étapes) | ✅ Test 6 |
| Préservation des credentials sur coupure réseau | ❌ Supprimés si max backoff | ✅ Préservés (statut paused) | ✅ Test 7 & 8 |
| Idempotence des suppressions simultanées | ❌ Erreur renommage | ✅ Verrou strict & idempotent | ✅ Test 9 |
| Reprise après crash au démarrage | ❌ Absente | ✅ Markers `.deleting` | ✅ Test 11 |
| Sécurité Path Traversal | ❌ Absente | ✅ Canonical path check | ✅ Test 3 |
| Jitter sur Backoff de reconnexion | ❌ Absent | ✅ Implémenté ($\pm 30\%$) | ✅ Test 2 |
| Tests automatisés | 1 seul script de syntaxe | 16 tests unitaires & intégration | ✅ 16/16 Pass |
| Panneau d'administration responsive | Basique | Métriques complètes & Journal d'Audit | ✅ Validé |
