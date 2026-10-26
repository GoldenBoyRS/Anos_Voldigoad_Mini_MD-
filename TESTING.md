# Guide d'Exécution des Tests & Procédures de Validation — v4.0

---

## 1. Exécution de la Suite Automatisée

La v4.0 inclut une suite de tests unitaires et d'intégration validant 16 points critiques :

```bash
npm test
```

### Détail des 16 Tests Exécutés :
1. **Normalisation et validation stricte des numéros WhatsApp :** format international, filtrage des caractères non numériques, dérivation JID.
2. **Backoff exponentiel avec jitter & classification d'erreurs :** vérification des statuts permanents vs temporaires.
3. **Protection anti-traversée de chemin (Path Traversal) :** blocage des chemins relatifs malveillants (`../`).
4. **File d’attente PairingQueue et verrou anti-concurrence :** vérification des verrous par numéro avec libération propre.
5. **Création, isolation et persistance disque de sessions distinctes :** vérification que les fichiers de deux comptes ne se croisent pas.
6. **Suppression automatique sur déconnexion définitive :** effacement réel et vérifié des fichiers et credentials sur déconnexion 401.
7. **Conservation stricte des credentials sur coupure réseau :** maintien des credentials sur interruption temporaire.
8. **Reconnexion épuisée = mise en pause sans suppression des credentials :** passage au statut `paused` sur disque sans perte de données.
9. **Idempotence de la suppression et exécutions concurrentes :** résistance à deux appels de suppression simultanés sur le même compte.
10. **Non-restauration des sessions supprimées au redémarrage :** vérification qu'une session effacée ne réapparaît jamais au boot.
11. **Nettoyage au démarrage des suppressions interrompues :** prise en charge des markers `.deleting` suite à un crash.
12. **Isolation stricte de la suppression :** la suppression d'un compte ne touche jamais aux credentials des autres utilisateurs.
13. **Invalidation des événements tardifs via identifiants de génération :** rejet des anciens événements socket après recréation.
14. **Chargement sans erreur des plugins existants :** vérification de l'intégrité de tous les plugins de commandes.
15. **Observabilité SessionAdmin :** validation des métriques de santé globale, mémoire et lag d'event loop.
16. **Middleware Rate Limiter :** validation du blocage des requêtes abusives sur `/code`.

---

## 2. Exécution du Benchmark de Montée en Charge

```bash
npm run benchmark
```
Mesure l'utilisation mémoire (RSS, Heap), la latence de la boucle d'événements et le débit d'I/O disque sur des paliers progressifs de 10, 25, 50, 100, 200, 300, 500, 750 et 1 000 sessions.

---

## 3. Tests Manuels Réels (Pairing WhatsApp)

1. Démarrez le serveur :
   ```bash
   npm start
   ```
2. Ouvrez le navigateur sur `http://localhost:20338/` ou l'interface d'administration sur `http://localhost:20338/admin`.
3. Saisissez votre numéro WhatsApp avec son indicatif pays.
4. Cliquez sur **Générer le code de pair**.
5. Ouvrez WhatsApp sur votre smartphone $\rightarrow$ **Appareils connectés** $\rightarrow$ **Connecter avec un numéro de téléphone**.
6. Entrez le code à 8 chiffres affiché à l'écran.
7. Dès l'association, la session passe en statut `open` et reçoit le message de bienvenue.
8. Pour tester la déconnexion définitive, déconnectez l'appareil depuis l'application mobile WhatsApp : constatez que la session disparaît automatiquement du panneau et que son dossier dans `sessions/` est effacé immédiatement.
