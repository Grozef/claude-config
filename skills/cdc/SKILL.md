---
name: cdc
description: |
  Genere un cahier des charges sur le modele unique Modele_CDC.docx (17 sections + annexe A par fonctionnalite), en retro depuis un repo ou en avant-projet depuis un brief. Sortie .md + .docx (styles du modele) + .html + .pdf, diagrammes archify ; --type fill = squelette vierge.
  TRIGGER when: "cahier des charges", "genere le CDC", "/cdc", "redige les specs"
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Skill : cdc
# Invocation : /cdc [--type cdc|fill] [--no-html] [--no-pdf] [--no-docx] [--no-diagrams] [chemin source | description du projet]

**Argument :** $ARGUMENTS

Modèle unique depuis le 2026-10-16 (décision utilisateur : uniformiser les CDC de tous les projets) : `templates/Modele_CDC.docx` (original), calqué en `trames/trame-modele.md` ; `templates/reference-cdc.docx` en est la reference-doc pandoc. Les anciennes trames `public|tech|full|cdcf` sont retirées. Mise à jour du modèle : section finale.

Outils (tous via `bash ~/.claude/tools/cdc.sh <commande>`) : `inventory`, `scaffold`, `fiches`, `lint`, `render`, `docx2pdf`. Le déterministe passe par eux, jamais à la main.

## Garde-fous (non négociables)

1. **docx sur le modèle.** Le .docx sort par défaut de `cdc.sh render` (reference-doc du modèle : styles, en-tête au titre du YAML, pied « Page X / Y », largeurs de colonnes). Constater le rendu avant livraison : `cdc.sh docx2pdf <f.docx>` (Word sous Windows, LibreOffice ailleurs), `pdftoppm`, puis regarder les images (cf. feedback-cdc-approach).
2. **Zéro exigence inventée.** Chaque ligne trace vers une source réelle (code lu, doc fournie, réponse utilisateur). Toute info non dérivable -> `[À COMPLÉTER]` ou question. Le contrôle est la contre-lecture (Étape 3ter, obligatoire) : elle rouvre chaque source, qui n'est PAS citée dans le CDC (remis au client, qui ne peut pas les vérifier : décision du 2026-10-21 ; le lint bloque les chemins de fichiers et les `Classe::méthode` restés dans le texte, la contre-lecture le reste). Raison : 2026-10-16, CDC Inspection livré avec 20 erreurs (RACI inventée, droits faux, formes d'API de tête), vues seulement à la relecture demandée.
3. **La doc D'ABORD — interdiction de remplir sur des résumés.** Avant d'écrire une ligne, l'inventaire de l'Étape 2.0 est OBLIGATOIRE pour CHAQUE source. Remplir à partir des seuls `CONTEXT.md` / `README` / survol de code = supposition interdite (incident 2026-06-23 : demi-session perdue). Le code ne fait que compléter la doc.
4. **Un CDC = des EXIGENCES, pas un audit.** Jamais de dette technique, findings d'audit, vulnérabilités, bugs connus ni limitations du code existant, même en rétro, même si la doc les contient. La sécurité s'exprime en exigences (auth, RGPD). Le lint bloque ce vocabulaire ; un faux positif se justifie par `<!-- lint-ok -->` en fin de ligne.
5. **CDC généré hors git, sauf s'il est déjà versionné.** `cdc.sh` ajoute `<out>.md/.html/.docx/.pdf` et `<stem>-diagrams/` au `.gitignore` du repo englobant, et le dit (« .gitignore MODIFIÉ ») : le signaler à l'utilisateur. Un CDC déjà suivi par git (choix du projet, ex. LumiSafe) n'est pas touché.

## Étape 0 — Parser les arguments

- `--type` : `cdc` (rempli, défaut) | `fill` (squelette vierge, consignes en place). Un ancien type (`public|tech|full|cdcf`) est refusé par `cdc.sh` : le signaler et proposer `cdc`.
- Rendu par défaut : .docx + .html + .pdf (le PDF vient du HTML). `--no-docx`, `--no-html` (coupe aussi le PDF), `--no-pdf`.
- Diagrammes archify : par défaut pour `cdc` (Étape 3bis). `--no-diagrams` pour les couper. Jamais pour `fill`.
- Reste de `$ARGUMENTS` = chemin source ou description du projet.

## Étape 1 — Détecter la/les source(s) (sauf type=fill)

PLUSIEURS sources possibles (ex : un repo front + un repo back, un monorepo) : toutes sont à traiter, aucune à ignorer.
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

## Étape 3bis — Diagrammes archify (`cdc`, sauf `--no-diagrams`)

Après le remplissage. Un diagramme ne se dessine QUE depuis des faits déjà écrits dans le CDC : pas de faits -> pas de diagramme, et le dire dans la confirmation finale.

| Diagramme (type archify) | Faits requis | Inséré sous |
|---|---|---|
| `architecture` | lignes Architecture / Technologies / Intégrations de §8 | 8. Contraintes techniques et architecture |
| `workflow` (processus cible) | étapes de §6.1 | 6.1 Processus cible |
| `sequence` (UN flux clé) | routes A.5 de la fiche concernée | A.5 de cette fiche |
| `lifecycle` (UNE entité à statut) | statuts réels (migration, enum, doc) | 9.1 Modèle de données |

Par diagramme (`<dir>` = dossier du .md, `<stem>` = son nom sans .md, `A=~/.claude/skills/archify`) :
1. Écrire `<dir>/<stem>-diagrams/<nom>.json` selon le « Fast authoring path » de `$A/SKILL.md` (`meta.quality_profile: "showcase"`, libellés et `meta.legend.entries` dans la langue du CDC).
2. `node $A/bin/archify.mjs validate <type> <json> --quality showcase --json` (9 contrôles sur 9), réparer selon les diagnostics, puis `node $A/bin/archify.mjs deliver <type> <json> <dir>/<stem>-diagrams/<nom>.html --quality showcase --json`. Exit != 0 -> ne pas insérer, le signaler.
3. `node ~/.claude/tools/archify-snap.mjs <dir>/<stem>-diagrams/<nom>.html <dir>/<stem>-diagrams/<nom>.png`.
4. Lire le PNG (Read), puis insérer : `![<Titre>](<stem>-diagrams/<nom>.png)` + `[Version interactive](<stem>-diagrams/<nom>.html)`.

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
3. **Vault** (sauter si `$CLAUDE_VAULT` n'est pas défini) : fiche `projets/<fiche>/<fiche>.md`, `<fiche>` trouvée par le chemin du repo dans `## Projets (index + chemins)` de TODO.md. Section `## CDC` (la créer avant le bloc final tags / « Voir aussi » si absente), une ligne par CDC qui cite le .md ET le .docx entre backticks : ``- v<version> (YYYY-MM-DD) : `<chemin absolu du .md>` ; `<chemin absolu du .docx>` (+ .html, .pdf)`` ; remplacer la ligne du même chemin si elle existe ; rien d'autre entre backticks sur cette ligne. Puis `bash ~/.claude/tools/rapatrie-livrables.sh --refresh <fiche>` : instantané daté des deux fichiers sous `projets/<fiche>/livrables/` (décision du 2026-10-05 : un CDC gitignoré ne vivait que sur un poste). Fiche absente : le signaler et demander.
4. Confirmation finale en une ligne : chemins `.md` + `.docx` + `.html` + `.pdf`, type, mode (rétro / avant-projet / hybride), nombre de F / fiches / US / RG, diagrammes insérés ou non (et pourquoi), corrections de la contre-lecture, `[À COMPLÉTER]`, résultat du lint, `.gitignore` modifié ou non.

## Mettre à jour le modèle

Quand `Modele_CDC.docx` change (le comparer par `sha256sum` à l'original de l'utilisateur) :
1. Copier le nouveau modèle dans `templates/Modele_CDC.docx`.
2. `python3 templates/build-reference.py templates/Modele_CDC.docx templates/reference-cdc.docx` (styles dédoublonnés, style de tableau, Title / Subtitle et Consigne tirés de la mise en forme directe du modèle).
3. Reporter les changements de plan dans `trames/trame-modele.md` (mêmes niveaux de titres, consignes en `[*…*]{custom-style="Consigne"}`), puis `python3 templates/apply-widths.py templates/Modele_CDC.docx trames/trame-modele.md` (largeurs des 31 tableaux ; un tableau sans correspondance est listé).
4. Contrôler : `cdc.sh scaffold --type fill --docx`, `cdc.sh docx2pdf`, et comparer les images au modèle exporté de la même façon.
