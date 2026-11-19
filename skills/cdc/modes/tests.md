# Mode tests — plan de tests dans le CDC, puis code de test réel

Lu par `SKILL.md` (garde-fous communs). Invocation : `/cdc tests <cdc.md> --repo <chemin> [--stack pest,phpunit,vitest,playwright,k6] [--plan-only]`.
Principe : le CDC dit ce qui est attendu, le test le vérifie. Aucun résultat attendu n'est inventé ; un test rouge est un ÉCART (application ou CDC) rapporté à l'utilisateur, jamais un test à ajuster.

## Étape 1 — Préalables
1. `cdc.sh check <cdc.md>` : 0 `ERREUR`, sinon `/cdc verify` d'abord (un plan sur un CDC incohérent ne trace rien).
2. `cdc.sh state <repo>` : stacks et outillage de test présents (Pest, PHPUnit, Vitest, Playwright ; k6 n'est pas détecté : `command -v k6`). Outil absent : le proposer, ne rien installer sans accord (une image Docker tirée compte comme une installation) ; `--stack` restreint la génération.
3. Lire les tests existants du projet (convention de nommage, trait de base de données, factories, helpers d'authentification, config `vitest` / `playwright` : dossiers inclus, `baseURL`). Le code généré suit cette convention.
4. GARDE BASE DE TEST, avant TOUT test qui touche la base (BDD, API, E2E) : lire `phpunit.xml` puis `phpunit.xml.dist` (`DB_CONNECTION`, `DB_DATABASE`) et `.env.testing`. ARRÊT et question si : la base de test est absente ou égale au `DB_DATABASE` de `.env` (dev) ; `bootstrap/cache/config.php` existe (config en cache : les variables de `phpunit.xml` sont ignorées, la base de dev est visée) ; SQLite `:memory:` avec `DatabaseTransactions` (aucune table n'existe). `RefreshDatabase` vide la base qu'il touche.

## Étape 2 — Plan dans le CDC (A.9 de chaque fiche, et 12)
Une ligne A.9 par test : `T-F<n>-<k> | <scénario> (US-xx, RG-yy) | <résultat attendu> | <Type>`. Types : `Unitaire / BDD / API / Composant / E2E / Performance`.
| Type | Tiré de | Résultat attendu = |
|---|---|---|
| API | A.5 (route), A.7 (droits), A.8 (erreurs), A.3 (règles) | code HTTP et forme de réponse écrits dans le CDC |
| E2E | US et critère d'acceptation, 6.1, scénarios R de 12 | le critère d'acceptation |
| Composant | A.6 (comportements d'écran : filtres, validation de saisie) | le comportement décrit |
| Unitaire | règle de calcul ou de transformation (A.3, 6.4) | la valeur décrite |
| Performance | ligne Performance de 7 (chiffres) + route A.5 | le chiffre de 7 (temps, volume) |
- Chaque US et chaque RG est couverte par au moins un T (`cdc.sh check` le bloque sinon).
- Résultat attendu sans source -> `[À COMPLÉTER]` : la ligne reste, le test n'est pas généré (`generable: false`).
- Tests BDD : pas de ligne A.9 (ils viennent du schéma, ID `T-BDD-<table>-<k>`) ; en 12, une ligne R « Intégrité de la base » seulement si le schéma a été dessiné (`modes/diagram.md`, type `db`).
Puis `cdc.sh check <cdc.md>` (0 `ERREUR`) et `cdc.sh testplan <cdc.md> --print`. `--plan-only` : s'arrêter ici (rendu : `modes/verify.md` Étape 5).

## Étape 3 — Code
Règles communes : nom de chaque test = son ID en tête (`it('T-F2-03 ...')`, `test('T-F2-03 ...')`) ; fichiers dans des dossiers `cdc` dédiés ; AUCUN test existant modifié ; assertion = résultat attendu du CDC, mot pour mot quand c'est une valeur ; données de test par les factories du projet (ou `CdcRows` si les tests BDD sont générés), jamais de compte ou de mot de passe réel inventé (inconnu -> demander).
- BDD (déterministe, après la garde de l'Étape 1.4) : `cdc.sh dbtests <stem>-diagrams/bdd.model.json <repo_laravel> --trait <trait des tests existants ; aucun -> demander>`. Sortie : `tests/Cdc/Database/` ; les cas sautés et leur raison vont au rapport. Ces fichiers ne se modifient JAMAIS à la main : un défaut se corrige dans `cdc_dbtests.py`, puis `--force`.
- API : `tests/Cdc/Feature/F<n>Test.php` (Pest ou PHPUnit selon le projet), `actingAs` avec le rôle de A.7, requête A.5, assertions A.8 / A.3.
- Composant (Vitest) : dans un dossier couvert par l'`include` de la config Vitest, sous un sous-dossier `cdc` ; monter le composant réel lu, simuler l'action décrite en A.6.
- E2E (Playwright) : `<dossier testDir de playwright.config>/cdc/F<n>.spec.ts` ; `baseURL` et comptes de test lus dans la config ou l'environnement de test, sinon demander. Projet sous Cypress sans Playwright : demander lequel utiliser.
- Performance (k6) : `tests/perf/cdc/F<n>.js`, `thresholds` = chiffres de 7 (`http_req_duration: ['p(95)<X']`) ; cible = URL d'un environnement de test, JAMAIS la production sans accord écrit.

## Étape 4 — Exécution, une fois par stack
- Pest / PHPUnit : `php artisan test tests/Cdc` (ou `vendor/bin/pest tests/Cdc`).
- Vitest : `npx vitest run <dossier cdc>`. Playwright : `npx playwright test <dossier cdc>`.
- k6 : `k6 run <f.js>` ; k6 absent et Docker présent : `docker run --rm -i grafana/k6 run - < <f.js>` APRÈS accord (l'image est téléchargée) ; sinon `[NO-VERIFY: k6 absent]`.
Sortie de chaque run montrée. Vert : constaté. Rouge :
- test écrit à la main (API, Composant, E2E, Performance) en erreur de test (syntaxe, import, donnée de test) -> corriger le TEST ;
- test BDD généré : défaut du générateur -> corriger `cdc_dbtests.py` et régénérer ; table à contrainte CHECK (absente de `model.json`, dont le JSON de MariaDB) -> « limite du générateur » au rapport, pas un écart de l'application ;
- assertion fausse au regard du CDC ou du schéma -> NE PAS toucher l'assertion : écart rapporté (ID, attendu, obtenu).
Puis `cdc.sh testcov <cdc.md> <repo>` : planifiés sans code et ID hors plan (le champ `fichier` de `<stem>-tests.json` est mis à jour).

## Étape 5 — Rapport
Une ligne : CDC, nombre de T planifiés (par type, dont non générables), fichiers écrits, résultat par stack (verts / rouges / sautés), écarts application-CDC (ID + attendu + obtenu), tests BDD sautés et pourquoi, `testcov` (trous), outils manquants. Le CDC a changé (A.9, 12) : `modes/verify.md` Étape 5 (rendu, vault).
