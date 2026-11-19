# Mode generate — produire un CDC

Lu par `SKILL.md` (garde-fous communs la-bas, toujours applicables). Arguments : `$ARGUMENTS` sans le mot `generate`.

## Étape 0 — Parser les arguments

- `--type` : `auto` (défaut, Étape 1) | `cdc` (rempli) | `fill` (squelette vierge, consignes en place). Un ancien type (`public|tech|full|cdcf`) est refusé par `cdc.sh` : le signaler et proposer `cdc`.
- Rendu par défaut : .docx + .html + .pdf (le PDF vient du HTML). `--no-docx`, `--no-html` (coupe aussi le PDF), `--no-pdf`.
- Diagrammes : par défaut pour `cdc` (Étape 3bis, `modes/diagram.md` : base de données par dbschema et classes par `cdc.sh draw` quand la source existe, architecture / processus / séquence / cycle de vie). `--no-diagrams` pour les couper. Jamais pour `fill`.
- Reste de `$ARGUMENTS` = chemin source ou description du projet.

## Étape 1 — Détecter la/les source(s) (sauf type=fill)

PLUSIEURS sources possibles (ex : un repo front + un repo back, un monorepo) : toutes sont à traiter, aucune à ignorer.

`bash ~/.claude/tools/cdc.sh state <source>...` (chaque repo, chaque brief fourni ; sans chemin donné : le repo courant). Sa sortie doit apparaître dans le contexte. Avec `--type auto`, son MODE RECOMMANDÉ décide :
- `verify` (un CDC existe déjà) -> NE PAS scaffolder. Le dire, avec le chemin du CDC trouvé, et demander : vérifier (`/cdc verify`), ou nouvelle version du même fichier (ligne v0.N dans Suivi des versions, sections reprises une à une sur les sources).
- `fill` -> questions de cadrage (point 4 ci-dessous) ; sans réponse, squelette `fill`.
- `retro` / `avant-projet` / `hybride` -> type `cdc`, dans ce mode (points 1 à 3). La sortie `source bdd` sert au diagramme de la base (`modes/diagram.md`).
`--type cdc` ou `fill` explicite : `state` reste lancé (sources, stack), sa recommandation est seulement affichée.
1. Note / brief / doc de cadrage fournie -> mode **AVANT-PROJET**.
2. Sinon repo / projet courant présent (`.git`, `composer.json`, `package.json`) -> mode **RÉTRO**.
3. Les deux -> mode **HYBRIDE** : socle technique depuis le code, objectifs/intentions depuis la doc.
4. Aucune source -> poser les questions de cadrage (objectif, acteurs, périmètre) en un seul message, puis rédiger.

## Étape 2 — Collecte

### Étape 2.0 — Inventaire de la doc (GATE OBLIGATOIRE, AVANT toute écriture)
Pour CHAQUE source : `bash ~/.claude/tools/cdc.sh inventory <repo>` (tous les `*.md`, toute profondeur, hors vendor/node_modules/build/storage, + dossiers `docs/ doc/ toDo/ .scribe/`). Sa sortie doit apparaître dans le contexte.
Puis LIRE cette doc et déclarer les fichiers lus. Elle est la source de vérité fonctionnelle (objectifs, acteurs, workflows, décisions). INTERDICTION de passer à l'Étape 3 sans l'inventaire et la lecture. Les revues et rapports d'audit de l'inventaire ne se lisent pas pour remplir (garde-fou 4).

### RÉTRO (depuis le code — APRÈS la doc)
- `composer.json` / `package.json` : nom, stack, dépendances.
- Routes (`php artisan route:list` quand Laravel répond, sinon le fichier), contrôleurs, FormRequests, Policies / Gates -> fonctionnalités, entrées, erreurs, droits.
- Migrations / models -> modèle de données ; routeur et vues du front -> écrans.
- Repo volumineux : `git ls-files` filtré avant de lire ; ne lire que ce qui alimente une section.

### AVANT-PROJET (depuis la doc)
- Lire intégralement la/les doc(s) fournie(s) ; extraire objectifs, contraintes, acteurs, fonctionnalités.
- Tout manque -> question groupée ou `[À COMPLÉTER]`.

## Étape 3 — Scaffold + remplissage

1. Squelette : `cdc.sh scaffold [--type fill] [--out <fichier>.md]`. Défaut : `documentation_contractuelle/cahier-des-charges.md` (dossier créé au besoin). Refuse d'écraser sans `--force`.
2. `fill` : ne rien remplir, le squelette EST le livrable. Rendre : `cdc.sh render <fichier>.md`.
3. `cdc` : arrêter la liste des fonctionnalités (§6.2), puis générer leurs fiches : `cdc.sh fiches <fichier>.md "F1=Nom" "F2=Nom" …` (une fiche annexe A par F, dans l'ordre de §6.2, saut de page et largeurs compris). Ne jamais recopier le bloc annexe à la main.
4. Remplir (Edit) sans ajouter ni retirer de section ou de colonne :
   - YAML `title:` = nom du projet (reporté dans l'en-tête du docx). Identification : Version `v0.1 — <date du jour>`, Statut `Version de travail`, Auteurs et Destinataires `[À COMPLÉTER]` sauf source. Suivi des versions : une ligne v0.1, « Création ». Validation : cellules vides (à signer).
   - Chaque consigne `[*…*]{custom-style="Consigne"}` est REMPLACÉE par le contenu puis supprimée ; sans source, elle laisse place à `[À COMPLÉTER]`. Le lint refuse une consigne restante dans un CDC rempli.
   - Sans source (rétro) : planning et estimations (§11), gouvernance (§13), risques (§14), maintenance (§15), RACI (§5.1), validation -> `[À COMPLÉTER]`. Jamais d'estimation, de lettre RACI ni de droit déduit.
   - Lignes de séparation des tableaux (`|----|---------|`) : elles portent les largeurs du modèle, ne pas les modifier.
   - Le nombre de lignes des tableaux suit le contenu ; un tableau sans source garde une ligne `[À COMPLÉTER]`.
   - §3 Situation actuelle : le processus AVANT l'application (doc, brief), jamais les limites du code.
   - §5 et A.7 : un droit se lit dans la Policy, la Gate, le middleware de route ou le garde du routeur front ; une route ouverte à tout compte authentifié est ouverte à tous les rôles.
   - §6.2 : une ligne `F<n>` par fonctionnalité. Priorité Must / Should / Could et Livrable seulement si la source les donne.
   - §6.3 : au moins une US par F, jamais d'US sans F. Rôle = un acteur de §5, et seulement un rôle qui a le droit (§5). Critère d'acceptation tiré d'une source lue (doc, décision, test dont on a lu le contenu), sinon `[À COMPLÉTER]`.
   - §6.4 et A.3 : règles réelles (FormRequest, enum, contrôleur, décision), avec la F concernée.
   - A.4 / A.5 : tables, colonnes et routes réelles ; entrées = champs validés par la FormRequest ; erreurs = codes renvoyés par le code lu (422 de validation, 403 de Policy, 429 de throttle…), pas devinés.
   - Aucune référence de source dans le texte : ni chemin de fichier (`routes/api.php`, `DECISIONS.md`), ni `Classe::méthode`, ni date de décision interne. Le CDC décrit l'exigence ; ses preuves restent dans la contre-lecture. Le lint bloque les chemins de fichiers (extensions de code et de doc) et les `Classe::méthode` ; les dates de décision, `.env`, `Dockerfile` et noms de classe seuls ne sont écartés que par la contre-lecture. Les liens des diagrammes (`![…](<stem>-diagrams/…)`) ne sont pas des sources.

> Doc vierge sans dépenser de token modèle : `cdc.sh scaffold --type fill --html --docx`.

## Étape 3bis — Diagrammes

Suivre `modes/diagram.md` (type `cdc`, sauf `--no-diagrams` ; jamais pour `fill`).

## Étape 3ter — Contre-lecture (OBLIGATOIRE avant le rendu)

Relire le CDC rempli EN ENTIER (Read, pas un résumé) et, pour chaque affirmation de fait, rouvrir sa source :
- cellule de droits, rôle d'une US, entrée / sortie / erreur d'API, règle de gestion, chiffre (limite, durée, débit) -> la ligne de code ou de doc qui la prouve ;
- formulation ajoutée de mémoire (contexte, matériel, public, « seul », « aucun ») -> trouvée dans une source, sinon retirée ;
- ce qui n'a pas de source -> `[À COMPLÉTER]`.
Corriger avant le lint. Annoncer le nombre de corrections dans la confirmation finale.

## Étape 4 — Lint, conversions et confirmation

1. Lint BLOQUANT : `cdc.sh lint <fichier>.md` (dette / audit / WIP, référence de source dans le texte, consigne restante, mot entre chevrons hors backticks — pandoc l'efface : écrire `[mot]`). `render` le relance et s'arrête s'il échoue. Corriger, ou justifier un faux positif par `<!-- lint-ok -->`.
2. Rendu : `cdc.sh render [--no-docx] [--no-html] [--no-pdf] <fichier>.md`. Constater :
   - PDF : `pdfinfo` (pages), `pdftoppm -png -r 60`, Read de la 1re page et d'une page à diagramme ;
   - docx (garde-fou 1) : `cdc.sh docx2pdf <fichier>.docx`, `pdftoppm`, Read de la page de titre, d'une page de section, d'une fiche annexe A. Sans Word ni LibreOffice : `[NO-VERIFY: rendu docx]`.
3. **Vault** (sauter si `$CLAUDE_VAULT` n'est pas défini) : fiche `projets/<fiche>/<fiche>.md`, `<fiche>` = 1er mot de la valeur de `$CLAUDE_VAULT/claude/projets-map.conf` pour la clé basename du repo (sinon de son parent) ; clé absente : chemin du repo dans `## Projets (index + chemins)` de TODO.md. Section `## CDC` (la créer avant le bloc final tags / « Voir aussi » si absente), une ligne par CDC qui cite le .md ET le .docx entre backticks : ``- v<version> (YYYY-MM-DD) : `<chemin absolu du .md>` ; `<chemin absolu du .docx>` (+ .html, .pdf)`` ; remplacer la ligne du même chemin si elle existe ; rien d'autre entre backticks sur cette ligne. Puis `bash ~/.claude/tools/rapatrie-livrables.sh --refresh <fiche>` : instantané daté des deux fichiers sous `projets/<fiche>/livrables/` (décision du 2026-10-05 : un CDC gitignoré ne vivait que sur un poste). Fiche absente : le signaler et demander.
4. Confirmation finale en une ligne : chemins `.md` + `.docx` + `.html` + `.pdf`, type, mode (rétro / avant-projet / hybride), nombre de F / fiches / US / RG, diagrammes insérés ou non (et pourquoi), corrections de la contre-lecture, `[À COMPLÉTER]`, résultat du lint, `.gitignore` modifié ou non.

