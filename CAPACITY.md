# Analyse de Capacité & Montée en Charge — ANOS VOLDIGOAD MINI MD v4.0

---

## 1. Distinction Fondamentale des Trois Métriques

Pour concevoir et exploiter une infrastructure de bots WhatsApp à grande échelle, il est obligatoire de distinguer rigoureusement trois mesures distinctes :

1. **Utilisateurs enregistrés (`registeredUsers`) :**
   - Nombre de numéros connus dans le registre (`registry.json`).
   - L'empreinte mémoire pour 1 000 utilisateurs enregistrés est inférieure à 5 Mo en mémoire vive et 500 Ko sur le disque.
2. **Sessions conservées sur le disque (`storedSessions`) :**
   - Nombre de dossiers de sessions présents dans le répertoire `sessions/<number>/` contenant `creds.json`, clés Signal et `state.json`.
   - L'accès est instantané (indexation O(1) par Map). Le scan disque de 1 000 dossiers prend moins de 3 ms.
3. **Connexions WhatsApp actives simultanément (`activeSimultaneousConnections`) :**
   - Nombre de sockets Baileys connectés en WebSocket à WhatsApp avec chiffrement Signal actif et échange d'événements temps réel.
   - **Chaque connexion active consomme entre 15 et 35 Mo de RAM.**
   - Ne prétendez jamais qu'une machine avec 1 Go de RAM peut maintenir 1 000 connexions actives simultanées !

---

## 2. Résultats Réels du Benchmark de Charge (scripts/benchmark.js)

Tests réels exécutés sur environnement Linux avec 2 CPUs :

| Palier (Sessions) | Stockées | Disque total | Heap Utilisé | RAM RSS | Latence Event Loop | Temps de Scan |
|---|---|---|---|---|---|---|
| **10** | 10 | 0.01 MB | 22.89 MB | 115.95 MB | 0 ms | 0 ms |
| **25** | 25 | 0.01 MB | 25.54 MB | 116.54 MB | 0 ms | 0 ms |
| **50** | 50 | 0.03 MB | 24.73 MB | 116.70 MB | 0 ms | 0 ms |
| **100** | 100 | 0.05 MB | 23.65 MB | 117.70 MB | 0 ms | 1 ms |
| **200** | 200 | 0.10 MB | 23.68 MB | 118.26 MB | 0 ms | 1 ms |
| **300** | 300 | 0.16 MB | 29.88 MB | 119.11 MB | 0 ms | 1 ms |
| **500** | 500 | 0.26 MB | 25.62 MB | 143.13 MB | 0 ms | 2 ms |
| **750** | 750 | 0.39 MB | 45.59 MB | 166.63 MB | 0 ms | 2 ms |
| **1000** | 1000 | 0.52 MB | 41.44 MB | 168.09 MB | 0 ms | 2 ms |

### Observations Clés :
- La gestion jusqu'à **1 000 sessions stockées et enregistrées** est validée avec une empreinte Heap inférieure à 50 MB et une latence de boucle d'événements nulle (0 ms).
- Le scan de 1 000 répertoires s'exécute en seulement 2 millisecondes.

---

## 3. Dimensionnement Matériel Recommandé

Pour les connexions WhatsApp actives en production :

| Connexions Actives Simultanées | CPU Recommandé | RAM Recommandée | Configuration Conseillée |
|---|---|---|---|
| **1 à 25** | 1 vCPU | 1 Go | VPS Débutant |
| **25 à 100** | 2 vCPUs | 2 à 4 Go | VPS Standard |
| **100 à 250** | 4 vCPUs | 4 à 8 Go | VPS Haute Performance |
| **250 à 500** | 8 vCPUs | 8 à 16 Go | Serveur Dédié / Instance Cloud C5 |
| **500 à 1 000+** | Multi-serveurs | 16 à 32 Go | Architecture distribuée par partitionnement |

---

## 4. Stratégie d'Évolution Multi-Serveurs (Scale-Out)

Lorsque le volume dépasse 500 connexions actives simultanées, la stratégie recommandée consiste à partitionner horizontalement les sessions :
1. **Partitionnement par plage d'indicatifs pays :**
   - Instance 1 : Indicatifs Amérique (`+1`, `+509`, etc.)
   - Instance 2 : Indicatifs Afrique (`+221`, `+225`, `+243`, etc.)
   - Instance 3 : Indicatifs Asie & Europe (`+92`, `+91`, `+33`, etc.)
2. **Reverse Proxy Load Balancer :**
   - NGINX ou HAProxy aiguille les requêtes API `/code` et `/status` vers l'instance responsable en fonction du numéro de téléphone.
   - Chaque instance reste un processus indépendant 100% local avec son propre disque SSD dédié.
