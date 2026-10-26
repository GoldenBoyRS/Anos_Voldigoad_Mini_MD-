// tests/run-tests.js — Suite de tests automatisée complète v4.0
// Couvre l'ensemble des 15 exigences de suppression et de multi-session
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const { DisconnectReason } = require('@whiskeysockets/baileys');

const SessionStore = require('../src/session/SessionStore');
const SessionRegistry = require('../src/session/SessionRegistry');
const SessionManager = require('../src/session/SessionManager');
const { BackoffTracker, nextDelay, classifyDisconnection } = require('../src/core/backoff');
const PairingQueue = require('../src/pairing/PairingQueue');
const { sanitizeNumber, isValidNumber, toJid } = require('../src/utils/numbers');
const { assertSafeSubdirectory } = require('../src/utils/files');
const { loadPlugins } = require('../src/core/pluginLoader');

const TEST_DIR = path.join(__dirname, '__test_sessions__');

const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => mockLogger,
};

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        results.push({ name, status: 'PASSED' });
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        failed++;
        results.push({ name, status: 'FAILED', error: err.message });
        console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
}

async function runAllTests() {
    console.log('\n===============================================================');
    console.log('🧪 LANCEMENT DE LA SUITE DE TESTS ANOS VOLDIGOAD MINI MD v4.0');
    console.log('===============================================================\n');

    await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);

    // TEST 1 : Normalisation et validation des numéros WhatsApp
    await test('1. Normalisation et validation stricte des numéros WhatsApp', () => {
        assert.strictEqual(sanitizeNumber('+509 5630 0796'), '50956300796');
        assert.strictEqual(sanitizeNumber('(509) 56-30-07-96'), '50956300796');
        assert.strictEqual(isValidNumber('50956300796'), true);
        assert.strictEqual(isValidNumber('123'), false); // trop court
        assert.strictEqual(isValidNumber('abc123456789'), true); // après sanitize: 123456789 -> valide
        assert.strictEqual(isValidNumber(''), false);
        assert.strictEqual(toJid('50956300796'), '50956300796@s.whatsapp.net');
    });

    // TEST 2 : Backoff exponentiel avec jitter & classification des déconnexions
    await test('2. Backoff exponentiel avec jitter et classification d’erreurs', () => {
        // Déconnexion définitive
        const c1 = classifyDisconnection(DisconnectReason.loggedOut, 'logged out', true);
        assert.strictEqual(c1.shouldDelete, true);
        assert.strictEqual(c1.permanent, true);

        // Erreur 401 directe
        const c401 = classifyDisconnection(401, 'Unauthorized', false);
        assert.strictEqual(c401.shouldDelete, true);

        // badSession
        const cBad = classifyDisconnection(DisconnectReason.badSession, 'bad session', false);
        assert.strictEqual(cBad.shouldDelete, true);

        // Coupure temporaire (timeout / connectionLost / restartRequired)
        const cLost = classifyDisconnection(DisconnectReason.connectionLost, 'connection lost', false);
        assert.strictEqual(cLost.shouldDelete, false);
        assert.strictEqual(cLost.permanent, false);

        const cRestart = classifyDisconnection(DisconnectReason.restartRequired, 'restart required', false);
        assert.strictEqual(cRestart.shouldDelete, false);

        // Version rejetée 405
        const c405 = classifyDisconnection(405, 'version rejected', false);
        assert.strictEqual(c405.type, 'version_rejected');
        assert.strictEqual(c405.shouldDelete, false);

        // Backoff avec Jitter (non déterministe mais borné)
        const tracker = new BackoffTracker({ maxAttempts: 5, baseDelay: 1000, maxDelay: 10000, jitter: 0.2 });
        const b1 = tracker.bump('test_num');
        assert.strictEqual(b1.attempt, 1);
        assert.ok(b1.delayMs >= 700 && b1.delayMs <= 1300, `Delay ${b1.delayMs} hors des bornes 800-1200`);
        assert.strictEqual(b1.exhausted, false);
    });

    // TEST 3 : Protection anti-traversée de chemin (Path Traversal Security)
    await test('3. Protection anti-traversée de chemin (Path Traversal)', () => {
        const root = path.resolve(TEST_DIR);
        // Chemin autorisé à l'intérieur de root
        const safe = assertSafeSubdirectory(root, path.join(root, '50956300796'));
        assert.ok(safe.startsWith(root));

        // Tentative d'évasion vers /etc ou parent ..
        assert.throws(() => {
            assertSafeSubdirectory(root, path.join(root, '../evil'));
        }, /Accès interdit/);

        assert.throws(() => {
            assertSafeSubdirectory(root, root); // ne peut pas supprimer root lui-même
        }, /Accès interdit/);
    });

    // TEST 4 : Concurrence du PairingQueue avec expiration TTL
    await test('4. File d’attente PairingQueue et verrou anti-concurrence', () => {
        const queue = new PairingQueue();
        const num = '50956300796';

        assert.strictEqual(queue.isBusy(num), false);
        queue.acquire(num);
        assert.strictEqual(queue.isBusy(num), true);

        // Deuxième tentative concurrente -> doit lever ConflictError
        assert.throws(() => {
            queue.acquire(num);
        }, /demande de pairing est déjà en cours/);

        queue.release(num);
        assert.strictEqual(queue.isBusy(num), false);
        // Ré-acquisition immédiate possible
        queue.acquire(num);
        queue.release(num);
    });

    // TEST 5 : Création de session, persistance sur disque et isolation
    await test('5. Création, isolation et persistance disque de deux sessions distinctes', async () => {
        const store = new SessionStore(TEST_DIR);
        const numA = '50911111111';
        const numB = '50922222222';

        await store.ensureSessionDir(numA);
        await store.ensureSessionDir(numB);

        // Écriture de creds factices pour test
        await fs.writeFile(path.join(store.getCredsDir(numA), 'creds.json'), JSON.stringify({ me: { id: numA } }));
        await fs.writeFile(path.join(store.getCredsDir(numB), 'creds.json'), JSON.stringify({ me: { id: numB } }));

        await store.writeState(numA, { number: numA, status: 'open', userConfig: { PREFIX: '!' } });
        await store.writeState(numB, { number: numB, status: 'open', userConfig: { PREFIX: '.' } });

        const stateA = await store.readState(numA);
        const stateB = await store.readState(numB);

        assert.strictEqual(stateA.userConfig.PREFIX, '!');
        assert.strictEqual(stateB.userConfig.PREFIX, '.');
        assert.strictEqual(await store.credsExist(numA), true);
        assert.strictEqual(await store.credsExist(numB), true);
    });

    // TEST 6 : Suppression automatique d’une session définitivement déconnectée (Exigence 5.1 & 5.3)
    await test('6. Suppression automatique sur déconnexion définitive (credentials effacés)', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        await manager.registry.load();
        const num = '50933333333';

        await manager.store.ensureSessionDir(num);
        await fs.writeFile(path.join(manager.store.getCredsDir(num), 'creds.json'), '{"test":"credentials"}');
        await manager.store.writeState(num, { number: num, status: 'open' });
        await manager.registry.upsertFromState(num, { number: num, status: 'open' });

        assert.strictEqual(await manager.store.credsExist(num), true);
        assert.ok(manager.registry.get(num));

        // Déclenchement de destroy() pour déconnexion définitive (ex: 401 / loggedOut)
        const res = await manager.destroy(num, { reason: 'whatsapp_logged_out_401' });
        assert.strictEqual(res.destroyed, true);

        // Vérification absolue : le dossier et les credentials N'EXISTENT PLUS sur disque
        const dirExists = await fs.pathExists(manager.store.getSessionDir(num));
        assert.strictEqual(dirExists, false, 'Le dossier de session doit être totalement supprimé');

        const credsExist = await manager.store.credsExist(num);
        assert.strictEqual(credsExist, false, 'Les credentials doivent être effacés');

        // Retiré du registre
        assert.strictEqual(manager.registry.get(num), undefined, 'Doit être retiré du registre');

        // Audit log enregistré
        const audits = await manager.store.getDeletionAudits();
        const entry = audits.find((a) => a.number === num);
        assert.ok(entry, 'Une entrée dans l’audit de suppression doit être consignée');
        assert.strictEqual(entry.reason, 'whatsapp_logged_out_401');
    });

    // TEST 7 : Conservation des credentials en cas de déconnexion temporaire (Exigence 5.2)
    await test('7. Conservation stricte des credentials en cas de déconnexion temporaire', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const num = '50944444444';

        await manager.store.ensureSessionDir(num);
        const credsPath = path.join(manager.store.getCredsDir(num), 'creds.json');
        await fs.writeFile(credsPath, '{"signal":"secret_keys"}');
        await manager.store.writeState(num, { number: num, status: 'open' });

        // Simuler une coupure réseau : arrêt avec keepFiles=true
        await manager.stop(num, { reason: 'network_drop', keepFiles: true });

        // Le fichier de session et les credentials DOIVENT TOUJOURS EXISTER
        assert.strictEqual(await fs.pathExists(credsPath), true, 'Les credentials ne doivent jamais être supprimés lors d’une simple coupure');
        const state = await manager.store.readState(num);
        assert.strictEqual(state.status, 'closed');
    });

    // TEST 8 : Pas de suppression si reconnexion épuisée (mise en pause sans perte de credentials)
    await test('8. Reconnexion épuisée = mise en pause sans suppression des credentials', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        manager.backoff.maxAttempts = 2; // configurer à 2 tentatives pour tester rapidement l'épuisement
        const num = '50955555555';

        await manager.store.ensureSessionDir(num);
        const credsPath = path.join(manager.store.getCredsDir(num), 'creds.json');
        await fs.writeFile(credsPath, '{"important":"user_tokens"}');
        await manager.store.writeState(num, { number: num, status: 'reconnecting' });

        // Bump 1
        manager.backoff.bump(num);
        // Bump 2
        manager.backoff.bump(num);
        // Appel scheduleReconnect -> doit constater l'épuisement et METTRE EN PAUSE sans détruire
        await manager.scheduleReconnect(num);

        // Vérification : les credentials sont ENCORE PRÉSENTS
        assert.strictEqual(await fs.pathExists(credsPath), true, 'Les credentials doivent être conservés après épuisement des tentatives');
        const state = await manager.store.readState(num);
        assert.strictEqual(state.status, 'paused', 'Le statut doit être paused et non deleted');
    });

    // TEST 9 : Idempotence de la suppression et gestion des appels concurrents (Exigence 5.5)
    await test('9. Idempotence de la suppression et exécutions concurrentes', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const num = '50966666666';

        await manager.store.ensureSessionDir(num);
        await fs.writeFile(path.join(manager.store.getCredsDir(num), 'creds.json'), '{"data":1}');

        // Lancement de deux destructions simultanées
        const [r1, r2] = await Promise.all([
            manager.destroy(num, { reason: 'concurrent_1' }),
            manager.destroy(num, { reason: 'concurrent_2' }),
        ]);

        assert.strictEqual(r1.destroyed, true);
        assert.strictEqual(r2.destroyed, true);
        assert.strictEqual(await manager.store.credsExist(num), false);
    });

    // TEST 10 : Non-résurrection après redémarrage (Exigence 5.7)
    await test('10. Non-restauration des sessions supprimées au redémarrage', async () => {
        const manager1 = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const numValid = '50977777771';
        const numDeleted = '50977777772';

        // 1 session valide
        await manager1.store.ensureSessionDir(numValid);
        await fs.writeFile(path.join(manager1.store.getCredsDir(numValid), 'creds.json'), '{"valid":true}');
        await manager1.store.writeState(numValid, { number: numValid, status: 'open' });

        // 1 session détruite
        await manager1.store.ensureSessionDir(numDeleted);
        await fs.writeFile(path.join(manager1.store.getCredsDir(numDeleted), 'creds.json'), '{"valid":false}');
        await manager1.destroy(numDeleted, { reason: 'test_delete' });

        // Nouveau gestionnaire (simulant redémarrage du processus)
        const manager2 = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const listOnDisk = await manager2.store.listSessionDirs();

        assert.ok(listOnDisk.includes(numValid));
        assert.strictEqual(listOnDisk.includes(numDeleted), false, 'La session supprimée ne doit pas exister sur le disque');

        await manager2.registry.load();
        assert.strictEqual(manager2.registry.get(numDeleted), undefined, 'La session supprimée ne doit jamais réapparaître dans le registre');
    });

    // TEST 11 : Reprise des suppressions crashées via markers .deleting (Exigence 5.7)
    await test('11. Nettoyage au démarrage des suppressions interrompues (.deleting marker)', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const numOrphan = '50988888888';

        await manager.store.ensureSessionDir(numOrphan);
        await fs.writeFile(path.join(manager.store.getCredsDir(numOrphan), 'creds.json'), '{"orphan":true}');
        // Simuler un crash pendant une suppression : marker .deleting posé
        await manager.store.setDeletingMarker(numOrphan, 'crash_during_delete');

        // cleanupPendingDeletions doit détecter et effacer le dossier
        const cleaned = await manager.store.cleanupPendingDeletions();
        assert.ok(cleaned.includes(numOrphan));
        assert.strictEqual(await fs.pathExists(manager.store.getSessionDir(numOrphan)), false);
    });

    // TEST 12 : Isolation totale — la suppression d’une session n’affecte pas les autres (Exigence 5.9.15)
    await test('12. Isolation stricte : suppression d’un compte sans impact sur les autres', async () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const numStay = '50999999991';
        const numDelete = '50999999992';

        await manager.store.ensureSessionDir(numStay);
        await manager.store.ensureSessionDir(numDelete);

        await fs.writeFile(path.join(manager.store.getCredsDir(numStay), 'creds.json'), '{"keep":"me"}');
        await fs.writeFile(path.join(manager.store.getCredsDir(numDelete), 'creds.json'), '{"delete":"me"}');

        await manager.destroy(numDelete, { reason: 'user_leave' });

        // numStay doit être 100% intact
        assert.strictEqual(await manager.store.credsExist(numStay), true, 'L’autre compte doit rester totalement intact');
        assert.strictEqual(await manager.store.credsExist(numDelete), false);
    });

    // TEST 13 : Invalidation des anciens événements via générations d’instance (Exigence 4.3)
    await test('13. Invalidation des événements tardifs via identifiants de génération', () => {
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const num = '50912345678';

        const gen1 = manager._nextGeneration(num);
        assert.strictEqual(gen1, 1);

        const fakeSession1 = { number: num, generation: gen1 };
        manager.sessions.set(num, fakeSession1);
        assert.strictEqual(manager.isCurrent(fakeSession1), true);

        // Nouvelle génération (ex: reconnexion ou nouvelle instance)
        const gen2 = manager._nextGeneration(num);
        assert.strictEqual(gen2, 2);

        // L'ancienne session gen1 doit être rejetée immédiatement
        assert.strictEqual(manager.isCurrent(fakeSession1), false);
    });

    // TEST 14 : Chargement dynamique des plugins existants
    await test('14. Chargement sans erreur des plugins existants', () => {
        const pluginsDir = path.join(__dirname, '../plugins');
        const res = loadPlugins(pluginsDir, mockLogger);
        assert.ok(res.total > 15, `Au moins 15 plugins doivent être présents (trouvé: ${res.total})`);
        assert.strictEqual(res.failed.length, 0, `Aucun plugin ne doit échouer: ${JSON.stringify(res.failed)}`);
        assert.strictEqual(res.loaded, res.total);
    });

    // TEST 15 : Observabilité SessionAdmin & métadonnées complètes
    await test('15. Observabilité SessionAdmin (Registered, Stored, Active, Deletions)', async () => {
        const SessionAdmin = require('../src/session/SessionAdmin');
        const manager = new SessionManager({ sessionsDir: TEST_DIR, logger: mockLogger });
        const admin = new SessionAdmin(manager);
        const health = await admin.globalHealth();

        assert.strictEqual(health.status, 'operational');
        assert.strictEqual(typeof health.metrics.registeredUsers, 'number');
        assert.strictEqual(typeof health.metrics.storedSessions, 'number');
        assert.strictEqual(typeof health.metrics.activeSimultaneousConnections, 'number');
        assert.strictEqual(typeof health.metrics.deletedSessionsCount, 'number');
        assert.strictEqual(typeof health.memory.rssMB, 'number');
        assert.strictEqual(typeof health.performance.eventLoopLagMs, 'number');
    });

    // TEST 16 : Rate Limiter en mémoire
    await test('16. Middleware Rate Limiter (protection contre les requêtes abusives)', () => {
        const { createRateLimiter } = require('../src/api/middleware/rateLimit');
        const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
        let rejected = false;

        const fakeReq = { ip: '127.0.0.1' };
        const fakeRes = {
            set: () => {},
            status: (code) => {
                if (code === 429) rejected = true;
                return { json: () => {} };
            }
        };

        limiter(fakeReq, fakeRes, () => {}); // 1
        limiter(fakeReq, fakeRes, () => {}); // 2
        limiter(fakeReq, fakeRes, () => {}); // 3 -> doit être 429

        assert.strictEqual(rejected, true, 'Le rate limiter doit bloquer la 3ème requête');
    });

    // Nettoyage final du dossier de test
    await fs.remove(TEST_DIR);

    console.log('\n===============================================================');
    console.log(`📊 RÉSULTAT FINAL : ${passed} passés, ${failed} échoués sur ${passed + failed} tests`);
    console.log('===============================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runAllTests().catch((e) => {
        console.error('Erreur fatale test runner:', e);
        process.exit(1);
    });
}

module.exports = { runAllTests };
