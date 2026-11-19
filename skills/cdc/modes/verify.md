# Mode verify — vérifier et corriger un CDC existant

Lu par `SKILL.md` (garde-fous communs, toujours applicables). Invocation : `/cdc verify <cdc.md> [--report-only]`.
`--report-only` : rien n'est écrit, le rapport seul est livré.

## Étape 1 — Contrôle déterministe
`bash ~/.claude/tools/cdc.sh check <cdc.md>` : sa sortie doit apparaître dans le contexte.
- `ERREUR` (exit 1) : structure hors trame, références F / US / RG / R / fiches cassées, F sans US ou sans fiche, ID en double, plan de tests `T-F<n>-<k>` incomplet, lien de diagramme absent ; puis le lint (dette, sources citées, consignes, chevrons).
- `AVERT` : rôle d'US absent de la table 5, nom de fiche différent de 6.2, section hors trame, diagramme périmé (source changée depuis `manifest.json`).
- `INFO` : `[À COMPLÉTER]` par section.

## Étape 2 — Sources
Les sources du CDC sont celles de son projet : `cdc.sh state <repo>` (repo qui contient le CDC ; demander s'il en existe d'autres, ex. front et back séparés), puis l'inventaire et la lecture de la doc comme dans `modes/generate.md` Étape 2.0 (garde-fou 3). Un CDC sans source accessible : seule l'Étape 1 est faite, le dire.

## Étape 3 — Contre-lecture
`modes/generate.md` Étape 3ter, sur le CDC ENTIER : chaque affirmation de fait est confrontée à sa source rouverte. Noter chaque écart (ligne, ce qui est écrit, ce que dit la source).

## Étape 4 — Corrections (sauf `--report-only`)
Une correction trace vers une source lue ou vers la trame, jamais vers une supposition (garde-fou 2).
- Structure : titre, en-tête ou séparateur repris À L'IDENTIQUE de `trames/trame-modele.md`.
- F sans fiche : `cdc.sh fiches <cdc.md> --append "F<n>=Nom"` (jamais de fiche recopiée à la main), puis la remplir sur les sources.
- F sans US : une US tirée d'une source ; sinon une ligne `US-<n> | [À COMPLÉTER] | F<n> | [À COMPLÉTER]`. Si le CDC a un plan de tests (`T-F<n>-<k>` en A.9), ajouter dans la fiche de F<n> la ligne `T-F<n>-<k> | [À COMPLÉTER] (US-<n>) | [À COMPLÉTER] | [À COMPLÉTER]`, sinon l'US reste « couverte par aucun test ».
- RG ou R sans F (AVERT) : la F tirée de la source ; « Toutes » si la source la donne transverse ; sinon `[À COMPLÉTER]` reste, l'AVERT aussi.
- Référence vers une F inexistante, US ou RG de fiche mal rattachée : la source tranche ; sans source, `[À COMPLÉTER]` dans la cellule.
- ID en double : le second reçoit le premier numéro libre, et ses mentions (fiches, A.9, 12) suivent.
- Écart de contre-lecture : la valeur de la source, ou retrait vers `[À COMPLÉTER]`.
- Diagramme absent ou périmé : `modes/diagram.md` pour le régénérer (même nom, même section).
- Lint : retirer la référence de source ou le vocabulaire d'audit (garde-fou 4) ; `<!-- lint-ok -->` seulement sur un faux positif justifié.
- Le CDC a changé : nouvelle ligne dans Suivi des versions (`v<suivante>`, date du jour, Auteur `[À COMPLÉTER]` sauf nom donné par l'utilisateur, « Vérification : N corrections »), Version / date de l'identification à l'identique. Statut et Validation : inchangés.
Relancer `cdc.sh check` jusqu'à 0 `ERREUR`. Une erreur qui ne peut pas être levée sans source est listée telle quelle dans le rapport, jamais masquée.

## Étape 5 — Rendu et vault (si le CDC a changé)
`modes/generate.md` Étape 4, points 2 et 3 : `cdc.sh render` (le lint bloque encore), contrôle visuel du PDF et du docx, ligne `## CDC` de la fiche vault et `rapatrie-livrables.sh --refresh`.

## Étape 6 — Rapport (une ligne, puis le détail si demandé)
Chemin du CDC, `ERREUR` avant / après, corrections faites (nombre, par type : structure, références, contre-lecture, lint, diagrammes), erreurs restantes et pourquoi, `AVERT` restants, `[À COMPLÉTER]` avant / après, rendu refait ou non. En `--report-only` : constats seuls, « aucune écriture ».
