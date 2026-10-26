# ANOS VOLDIGOAD MINI MD v3 — durcissement P0

Cette version ne cherche pas à ajouter des commandes. Elle durcit le moteur multi-session avant les tests de charge.

## Changements

- lifecycle de session protégé par génération d'instance ;
- anciennes connexions invalidées avant remplacement ;
- timers de reconnexion annulables ;
- destruction réelle après épuisement des reconnexions ;
- `/disconnect` supprime maintenant la session locale ;
- pairing expiré nettoyé ;
- version Baileys mise en cache au niveau du processus ;
- métadonnées de groupe mises en cache avec TTL et invalidées lors des changements de participants ;
- statistiques comptées en RAM puis écrites périodiquement ;
- cache de messages plafonné par session ;
- rate-limit pairing par IP et par numéro ;
- comparaison de clé API en temps constant ;
- CORS fermé par défaut et configurable via `CORS_ORIGINS` ;
- README/CAPACITY corrigés pour ne plus présenter 500 sessions comme une capacité garantie ;
- `npm run check` ajouté pour vérifier toute la syntaxe JavaScript ;
- dépendances Node natives inutiles retirées de `package.json`.

## Ce qui reste à faire avant une vraie validation 500

Le code est maintenant mieux préparé, mais **500 sessions ne sont toujours pas certifiées**. Il faut un benchmark réel avec plusieurs comptes WhatsApp, puis mesurer RAM, CPU, event-loop lag, trafic, reconnexions et erreurs.

## V3.1 — Lightweight + KataBump

- Suppression des dépendances directes non utilisées par le code actuel.
- Remplacement de `body-parser` par les parseurs natifs d'Express.
- Suppression de `node-fetch` inutile avec Node.js 20.
- Port par défaut : `20338` (allocation KataBump actuelle), avec priorité à `SERVER_PORT` puis `PORT`.
- Les fonctionnalités réellement utilisées (Baileys, Axios, FFmpeg/stickers, yt-search, file-type, etc.) restent présentes.

## v3.4 — pairing 405
- Résolution WA Web live via `web.whatsapp.com/sw.js`.
- Cache de version de 30 minutes par processus.
- `WA_VERSION` optionnel pour override manuel.
- Aucun fallback silencieux vers une version Baileys périmée.
- Navigateur Baileys `Browsers.ubuntu('Chrome')`.
- Un HTTP 405 arrête la boucle de reconnexion automatique.
