# Mode diagram — diagrammes d'un CDC

Lu par `SKILL.md` (garde-fous communs) ; appelé seul (`/cdc diagram <type> <cdc.md> [cible]`) ou par `modes/generate.md` (Étape 3bis, type `cdc`, sauf `--no-diagrams`).

Un diagramme ne se dessine QUE depuis des faits déjà écrits dans le CDC, ou lus dans la source qu'il cite (base, code) : pas de faits -> pas de diagramme, et le dire dans la confirmation finale. `<dir>` = dossier du .md, `<stem>` = son nom sans .md, `D=<dir>/<stem>-diagrams`.

| Type | Moteur | Faits requis | Inséré sous |
|---|---|---|---|
| `db` (schéma de la base) | dbschema `all` | migrations, script SQL ou base de dev (sortie `source bdd` de `cdc.sh state`) | 9.1 Modèle de données |
| `class` | dbschema `diagram` | classes et relations lues dans le code (modèles, entités) ou décrites en 8 / A.4 | 8. Contraintes techniques et architecture, ou A.4 d'une fiche (vue partielle) |
| `architecture` | archify | lignes Architecture / Technologies / Intégrations de 8 | 8. Contraintes techniques et architecture |
| `workflow` (processus cible) | archify | étapes de 6.1 | 6.1 Processus cible |
| `sequence` (UN flux clé) | archify | routes A.5 de la fiche concernée | A.5 de cette fiche |
| `lifecycle` (UNE entité à statut) | archify | statuts réels (migration, enum, doc) | 9.1 Modèle de données |

`architecture`, `workflow`, `sequence`, `lifecycle` passent à dbschema au fur et à mesure de leur livraison (plan du 2026-11-19) ; en attendant, archify.

## Type `db` — dbschema `all`
1. Source : `--laravel <repo>` (DEMANDER à l'utilisateur si le dépôt est de confiance avant `--trust-repo` : garde-fou 1 de dbschema), `--sql <f.sql>`, ou `--db <base>` pour un autre framework (migrations lancées par l'utilisateur, jamais par l'agent).
2. `bash ~/.claude/skills/dbschema/dbschema.sh all <source> --out "$D" --name bdd --title "<Projet> — base de données"` ; domaines métier connus (doc, CDC) -> `--groups`, jamais inventés.
3. Sortie : chaque vue `-> OK` et la ligne `[texte] debordements` `OK` ; sinon ne pas insérer, le signaler. LIRE `$D/bdd.png`.
4. `cp "$D/_build/model.json" "$D/bdd.model.json"` (entrée des tests BDD de `/cdc tests`).
5. Insérer sous 9.1 : `![Schéma de la base de données](<stem>-diagrams/bdd.png)` + `[Version interactive](<stem>-diagrams/bdd.html)`. Le tableau 9.1 garde les principes (le schéma porte le détail : consigne 9 du modèle).
6. `bash ~/.claude/tools/cdc.sh manifest <cdc.md> bdd db <stem>-diagrams/bdd.model.json "9.1" <stem>-diagrams/bdd.png <stem>-diagrams/bdd.html`.

## Type `class` — dbschema `diagram`
1. Écrire `$D/<nom>.json` selon `~/.claude/skills/uml/types/class.md` (format, sens des relations, lecture du code). Chaque classe, attribut, méthode, relation et multiplicité vient du code lu ou du CDC : rien d'inventé ; dans le doute, l'omettre.
2. `bash ~/.claude/skills/dbschema/dbschema.sh diagram --model "$D/<nom>.json" --out "$D" --name <nom> --title "<Titre>"`. Code 2 = modèle invalide (corriger le JSON) ; code 1 = contrôles en échec (lire `$D/_build/check.json`, simplifier la vue) ; ne pas insérer sans `-> OK`.
3. LIRE `$D/<nom>.png`, puis insérer `![<Titre>](<stem>-diagrams/<nom>.png)` + `[Version interactive](<stem>-diagrams/<nom>.html)`.
4. `bash ~/.claude/tools/cdc.sh manifest <cdc.md> <nom> class <stem>-diagrams/<nom>.json "<section>" <stem>-diagrams/<nom>.png <stem>-diagrams/<nom>.html`.

## Types archify (`architecture`, `workflow`, `sequence`, `lifecycle`)
`A=~/.claude/skills/archify` :
1. Écrire `$D/<nom>.json` selon le « Fast authoring path » de `$A/SKILL.md` (`meta.quality_profile: "showcase"`, libellés et `meta.legend.entries` dans la langue du CDC).
2. `node $A/bin/archify.mjs validate <type> <json> --quality showcase --json` (9 contrôles sur 9), réparer selon les diagnostics, puis `node $A/bin/archify.mjs deliver <type> <json> $D/<nom>.html --quality showcase --json`. Exit != 0 -> ne pas insérer, le signaler.
3. `node ~/.claude/tools/archify-snap.mjs $D/<nom>.html $D/<nom>.png`.
4. Lire le PNG (Read), puis insérer : `![<Titre>](<stem>-diagrams/<nom>.png)` + `[Version interactive](<stem>-diagrams/<nom>.html)`.
5. `bash ~/.claude/tools/cdc.sh manifest <cdc.md> <nom> <type> <stem>-diagrams/<nom>.json "<section>" <stem>-diagrams/<nom>.png <stem>-diagrams/<nom>.html`.

## Appelé seul (`/cdc diagram <type> <cdc.md> [cible]`)
`cible` : nom du diagramme, ou fiche (`F3`) pour une vue partielle. Un diagramme de même nom déjà présent est remplacé (même lien, entrée du manifeste remplacée). Puis `cdc.sh check <cdc.md>` (lien présent, manifeste lisible) et, si le CDC était déjà rendu, `cdc.sh render` + contrôle visuel de la page du diagramme (`modes/generate.md` Étape 4).
