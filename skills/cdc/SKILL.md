---
name: cdc
description: |
  Genere un cahier des charges (--type fill|public|tech|full|cdcf), en retro depuis un repo ou en avant-projet depuis un brief. Sortie .md + .html + .pdf, user stories derivees des parcours, diagrammes archify (tech/full) ; --docx pandoc brut en option.
  TRIGGER when: "cahier des charges", "genere le CDC", "/cdc", "redige les specs"
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Skill : cdc
# Invocation : /cdc [--type fill|public|tech|full|cdcf] [--no-html] [--no-pdf] [--no-diagrams] [--docx] [chemin source | description du projet]

**Argument :** $ARGUMENTS

## Garde-fous (non négociables)

1. **docx via pandoc simple uniquement.** Utiliser `~/.claude/tools/md2docx.sh` (pandoc, style par défaut). JAMAIS de Word COM, JAMAIS de reference-doc stylé (voie qui a brûlé 3 sessions, 2026-06-04/05). Après génération `--docx` : ouvrir le fichier pour constater le rendu (cf. feedback-cdc-approach règle 4). Sans `--docx`, on ne touche pas au Word. Depuis le 2026-09-04, `--docx` produit du pandoc BRUT : la charte (header/footer via docx-brand.sh) ne s applique plus que sur `--brand <kit>` explicite, jamais par defaut.
2. **Zéro exigence inventée.** Chaque ligne doit tracer vers une source réelle (code lu, doc fournie, réponse utilisateur). Toute info non dérivable -> `[À COMPLÉTER]` ou question, jamais d'hallucination ni de présomption.
3. **La doc D'ABORD — interdiction de remplir sur des résumés.** Avant d'écrire une seule ligne, l'inventaire de doc de l'Étape 2.0 est OBLIGATOIRE pour CHAQUE source fournie. Remplir à partir des seuls `CONTEXT.md`/`README`/survol de code = supposition interdite (cause d'incident 2026-06-23 : demi-session perdue). Lire la doc réelle (`docs/`, `toDo/`, specs) ; le code ne fait que compléter. GATE déterministe : `cdc.sh inventory <repo>` — la sortie doit apparaître dans le contexte avant tout remplissage.
4bis. **Tout CDC généré est gitignoré, jamais committé.** `cdc.sh` ajoute automatiquement `<out>.md/.html/.docx` au `.gitignore` du repo englobant (scaffold et render). Ne pas committer ces livrables ni retirer ces entrées.
4. **Un CDC = des EXIGENCES, pas un audit.** Ne JAMAIS inclure dette technique, findings d'audit, vulnérabilités/failles, bugs connus ni limitations du code existant — même en rétro, même si la doc les contient. Ça appartient à un rapport d'audit. Exprimer la sécurité comme exigence (auth, RGPD), jamais comme liste de failles. Si l'utilisateur ne l'a pas demandé explicitement, c'est hors périmètre. GATE déterministe : `cdc.sh lint <fichier>.md` (auto avant rendu) signale tout vocabulaire de dette/audit/WIP à corriger.

## Étape 0 — Parser les arguments

- `--type` : `fill` | `public` | `tech` | `full` | `cdcf`. Défaut = `full`.
- HTML : généré par défaut pour TOUS les types. `--no-html` pour le couper (.md seul).
- PDF : généré par défaut avec le HTML (depuis le .html, Chrome headless). `--no-pdf` pour le couper ; `--no-html` coupe aussi le PDF.
- Diagrammes archify : par défaut pour `tech` et `full` (Étape 3bis). `--no-diagrams` pour les couper. Jamais pour `fill`, `public`, `cdcf`.
- `--docx` : générer aussi le docx (opt-in).
- Reste de `$ARGUMENTS` = chemin source ou description du projet.

## Étape 1 — Détecter la/les source(s) (sauf type=fill)

PLUSIEURS sources possibles (ex : un repo front + un repo back) : toutes sont à traiter, aucune à ignorer.
1. Note / brief / doc de cadrage fournie -> mode **AVANT-PROJET**.
2. Sinon repo / projet courant présent (`.git`, `composer.json`, `package.json`) -> mode **RÉTRO**.
3. Les deux -> mode **HYBRIDE** : socle technique depuis le code, objectifs/intentions depuis la doc.
4. Aucune source -> poser les questions de cadrage (objectif, acteurs, périmètre) en un seul message, puis rédiger.

`type=fill` n'a pas besoin de source : voir Étape 3. `type=cdcf` (expression de besoin amont) s'appuie surtout sur le brief / la doc ; pas de rétro code nécessaire.

## Étape 2 — Collecte

### Étape 2.0 — Inventaire de la doc (GATE OBLIGATOIRE, AVANT toute écriture)
Pour CHAQUE source/repo fourni, lancer le gate déterministe (sa sortie DOIT apparaître dans le contexte avant tout remplissage) :
`bash ~/.claude/tools/cdc.sh inventory <repo>`
(le tool fait le `find` des `*.md` hors vendor/node_modules + repère `docs/ doc/ toDo/ .scribe/`).
Puis LIRE cette doc — c'est la source de vérité fonctionnelle (objectifs, acteurs, user stories, workflows) ; déclarer explicitement quels fichiers sont lus. Ne JAMAIS se contenter de `CONTEXT.md`/`README` puis déduire le reste du code (garde-fou n°3). INTERDICTION de passer à l'Étape 3 sans la sortie `inventory` + la lecture de la doc réelle. Le code (Étape 2 RÉTRO) ne sert qu'à compléter/confirmer ce que la doc ne couvre pas.

### RÉTRO (depuis le code — APRÈS la doc)
- `composer.json` / `package.json` : nom, stack, dépendances.
- Arbo racine (`ls`) + points d'entrée.
- Routes / controllers -> fonctionnalités exposées.
- Migrations / models -> modèle de données.
- Repo volumineux : inventaire filtré (`git ls-files`, exclure vendor/node_modules/dist) avant de lire ; ne lire que ce qui alimente une section.
- Ne rien remonter de la dette/des failles/limitations trouvées dans le code (garde-fou n°4).

### AVANT-PROJET (depuis la doc)
- Lire intégralement la/les doc(s) fournie(s).
- Extraire objectifs, contraintes, acteurs, fonctionnalités attendues.
- Tout manque -> question groupée ou `[À COMPLÉTER]`.

## Étape 3 — Scaffold + remplissage

Tout le déterministe passe par l'outil `~/.claude/tools/cdc.sh` (mapping type->trame, copie, conversions) — ne pas réimplémenter ces étapes à la main.

1. Scaffold le squelette (le tool résout le type vers la bonne trame figée) :
   `bash ~/.claude/tools/cdc.sh scaffold --type <type> [--out <fichier>.md]`
   Défaut : `documentation_contractuelle/cahier-des-charges.md` (dossier créé au besoin). Refuse d'écraser sans `--force`.
2. `fill` : ne rien remplir — le squelette EST le livrable. Rendre quand même le HTML (HTML auto tous types, sauf `--no-html`) : `bash ~/.claude/tools/cdc.sh render --html <fichier>.md`. Signaler l'exemple de référence `~/.claude/skills/cdc/examples/exemple-app-mobile-saisie.md` comme modèle de remplissage.
3. `public|tech|full|cdcf` : REMPLIR le fichier scaffoldé (Edit) à partir des sources collectées. NE PAS inventer le plan ni ajouter/retirer de section du squelette. Tout champ non dérivable d'une source -> laisser `[À COMPLÉTER]`. En rétro, tracer la source entre parenthèses (ex : `(routes/api.php)`).
   - `public` : langage métier, zéro jargon (pas de stack/données/archi).
   - `tech` : dérivé code (rétro) + doc projet.
   - `full` : 2 parties (fonctionnel puis technique).
   - User stories (`public` §6, `full` §1.6, `tech` §8) : une US par item de « Parcours et fonctionnalités » (public/full) ou de « Besoins fonctionnels » (tech), jamais d'US sans item source ni d'item sans US. Rôle = un acteur de la table Acteurs. `Dérivée de` cite l'item et sa source. Priorité MoSCoW et critères d'acceptation : seulement s'ils sont dans la source, sinon `[À COMPLÉTER]` (garde-fou n°2).
   - `cdcf` : exprimer le besoin en FONCTIONS (le QUOI), JAMAIS la solution technique (le COMMENT). Respecter l'enchaînement de la trame : bête à cornes -> environnement (pieuvre/EME) -> fonctions de service (FP/FC) -> caractérisation (critère/niveau/flexibilité) -> hiérarchisation -> contraintes.

> Doc vierge sans dépenser de token modèle : `cdc.sh scaffold --type <type> --html --docx` produit directement le squelette structuré + ses conversions.

## Étape 3bis — Diagrammes archify (`tech` / `full`, sauf `--no-diagrams`)

Après le remplissage, avant le lint. Un diagramme ne se dessine QUE depuis des faits déjà écrits dans le CDC rempli (garde-fou n°2) : pas de faits -> pas de diagramme, et le dire dans la confirmation finale.

| Diagramme (type archify) | Faits requis | Inséré sous |
|---|---|---|
| `architecture` | composants de la section Architecture / Stack | 2.1 (full) / 1. (tech) Architecture |
| `workflow` (parcours principal) | items de Parcours (full) ou Besoins fonctionnels (tech) | 1.5 (full) / 7. (tech) |
| `sequence` (UN flux clé) | endpoints de la table API | 2.4 (full) / 4. (tech) API et intégrations |
| `lifecycle` (UNE entité à statut) | statuts réels (migration, enum, doc) | 2.3 (full) / 3. (tech) Modèle de données |

Par diagramme (`<dir>` = dossier du .md, `<stem>` = son nom sans .md, `A=~/.claude/skills/archify`) :
1. Écrire `<dir>/<stem>-diagrams/<nom>.json` en suivant le « Fast authoring path » de `$A/SKILL.md` (schéma + un exemple, `meta.quality_profile: "showcase"`, libellés dans la langue du CDC, `meta.locale` omis).
2. `node $A/bin/archify.mjs validate <type> <json> --quality showcase --json`, réparer selon ses diagnostics, puis `node $A/bin/archify.mjs deliver <type> <json> <dir>/<stem>-diagrams/<nom>.html --quality showcase --json`. Exit != 0 -> ne pas insérer le diagramme, le signaler.
3. `node ~/.claude/tools/archify-snap.mjs <dir>/<stem>-diagrams/<nom>.html <dir>/<stem>-diagrams/<nom>.png` (PNG du seul diagramme, thème clair).
4. Lire le PNG (Read) pour constater le rendu, puis insérer sous la section : `![<Titre>](<stem>-diagrams/<nom>.png)` + ligne `[Version interactive](<stem>-diagrams/<nom>.html)`. Chemin relatif au .md : md2html/md2docx l'incluent (image embarquée dans le HTML, le PDF et le docx).

Le dossier `<stem>-diagrams/` est gitignoré par `cdc.sh` (garde-fou 4bis).

## Étape 4 — Lint, conversions et confirmation

1. GATE anti-dette : `bash ~/.claude/tools/cdc.sh lint <fichier>.md`. Le `render` le relance automatiquement, mais l'observer ici et corriger toute ligne signalée (garde-fou n°4) — ou justifier un faux positif — AVANT le rendu final.
2. Rendu (HTML + PDF par défaut sauf `--no-html` / `--no-pdf`, `--docx` si demandé) :
   `bash ~/.claude/tools/cdc.sh render --html [--no-pdf] [--docx] --open <fichier>.md`
   Constater le PDF : `pdfinfo <fichier>.pdf` (pages) puis `pdftoppm -png -r 60` et Read d'au moins la 1re page et d'une page à diagramme.
   (le tool lint puis appelle md2html.sh / md2docx.sh ; `--open` ouvre le .docx pour vérifier le rendu, cf. garde-fou n°1). Si `--no-html` ET pas de `--docx` : pas de rendu, le `.md` est le livrable.
3. **Vault** (sauter si `$CLAUDE_VAULT` n'est pas défini) : référencer le CDC dans la fiche `projets/<fiche>/<fiche>.md`, `<fiche>` trouvée par le chemin du repo dans `## Projets (index + chemins)` de TODO.md (`Grep`). Section `## CDC` (la créer avant le bloc final tags / « Voir aussi » si absente), une ligne par CDC : `- v<version>[, <type>] (YYYY-MM-DD) : `<chemin absolu du .md>` (+ .html)` ; remplacer la ligne du même chemin si elle existe. Puis copier le CDC dans le vault : `bash ~/.claude/tools/rapatrie-livrables.sh --refresh <fiche>` (instantané daté sous `projets/<fiche>/livrables/` + ligne dans son `MANIFEST.md` ; décision du 2026-10-05 : un CDC gitignoré dans son repo ne vivait que sur un poste). Fiche absente : le signaler et demander. Raison : 2026-09-28, 7 CDC existants, un seul cité (en texte) dans sa fiche.
4. Confirmation finale en une ligne : chemin(s) produit(s) `.md` + `.html` + `.pdf` (+ `.docx` si demandé) + type + mode (rétro / avant-projet / hybride) + nombre d'US + diagrammes insérés / non produits (et pourquoi) + nombre de `[À COMPLÉTER]` + nombre de findings lint restants.
