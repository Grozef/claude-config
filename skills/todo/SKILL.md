---
name: todo
description: |
  Gere le toDo global du vault ($CLAUDE_VAULT/TODO.md) depuis n'importe quel projet : add / list / done / verif, organise par projet avec tags [op]/[idee]/[revue] et [moi]/[toi]. Option `local` : toDo du poste (~/.claude/TODO.md).
  TRIGGER when: "/todo", "ajoute au todo", "mes taches en attente", "coche", "todo global", "todo local"
allowed-tools: Read, Edit, Bash
effort: low
---

# Skill : todo
# Invocation : /todo [add|list|done|verif] [args]  ·  /todo local [add|list|done] [args]

**Arguments fournis :** $ARGUMENTS

Fichier cible (chemin ABSOLU, jamais relatif au projet courant) :
`$CLAUDE_VAULT/TODO.md` — `$CLAUDE_VAULT` est injecté au démarrage par le hook `session-start`
(ligne `Vault : <chemin>`). Sans cette ligne, aucun vault n'est configuré : le dire et s'arrêter,
ne jamais inventer de chemin.

## Structure du fichier (depuis 2026-07-15 : organisation PAR PROJET)

- Un bloc `## Projets (index + chemins)` en tête : liste TOUS les projets + chemin réel (incl. hors-www). Reference, pas des taches.
- Puis un titre `## <projet>` par projet ayant des taches (ex `## projet-a`, `## projet-b`, `## carte / libelle-compose`).
- Item : `- [ ] [type] [qui] (YYYY-MM-DD) texte [[projet]] [verif YYYY-MM-DD]` — `type` ∈ {op, idee, revue},
  placé juste après la case (le hook de démarrage le lit à cette place) ; `qui` juste après le type :
  `[toi]` = la suite dépend de l'utilisateur (observation écran / appareil / prod / AWS, tiers, décision,
  commit, push ou déploiement qu'il lance), `[moi]` = faisable par Claude depuis le poste (code, doc, tests).
- `texte` = l'ACTION RESTANTE, une phrase, 200 caractères au plus. PAS d'annotation inline `[maj ...]` /
  `[verif ... : texte]` (2026-10-19 : 38 lignes devenues des journaux, jusqu'à 2 257 car., toDo invérifiable
  en un passage). Quand un item avance, sa ligne est RÉÉCRITE (nouvelle action restante) ; le détail va dans
  `$CLAUDE_VAULT/sessions/<repo>/<date>.md`. `[verif YYYY-MM-DD]` = date de la dernière vérification RÉELLE
  (artefact regardé), absent si jamais vérifié ; ne jamais le redater sans artefact.
- Plus récent en haut de chaque bloc projet. Les faits (`- [x]`) vivent dans `$CLAUDE_VAULT/TODO-archive.md`,
  sous le même titre `## <projet>` (depuis 2026-10-05 : les cochés pesaient 102 Ko sur 139).

## Règle commune

Toujours lire le **bloc concerné** avant tout Edit (never-assume : on agit sur la donnée réelle, pas sur
une structure supposée), jamais le fichier entier : `grep -n '^## ' TODO.md` (Bash) pour borner le bloc
`## <projet>`, puis **Read** avec offset/limit sur ce seul intervalle. Confirmer en UNE ligne dense. Pas de fioriture.

## Sous-commandes

### `add <projet> <type> <moi|toi> "<texte>"`
`<type>` ∈ {op, idee, revue}. Exemple : `/todo add projet-a op moi "corriger le récap"`
`<qui>` absent : le déduire de la définition ci-dessus et le dire dans la confirmation. Texte > 200 car. : le raccourcir.
1. Date du jour : `date +%Y-%m-%d` (Bash).
2. Lister les titres (règle commune). Chercher le titre `## <projet>` (insensible casse ; le projet peut avoir un
   libellé composé comme `## carte / libelle-compose` — matcher sur le mot-clé).
3. Si le titre existe : Edit, insérer `- [ ] [<type>] [<qui>] (YYYY-MM-DD) <texte> [[<projet>]]`
   **juste après** la ligne de titre (= plus récent en haut du projet).
4. Si le titre n'existe PAS : créer `## <projet>` + l'item, inséré **avant** la ligne `---` finale
   qui précède `#todo` (ou avant `## global` s'il existe). Vérifier au passage que le projet figure
   dans l'index en tête ; l'y ajouter (ligne `- <projet> — <chemin>`) s'il manque.
5. Confirmer : `Ajouté [projet-a/op] : corriger le récap`.

### `list [projet|toi|moi]`
Les chiffres et la numérotation sortent de `bash ~/.claude/tools/todo-summary.sh`, jamais d'un comptage à la main
(2026-10-19 : le compteur « op » du démarrage recopié comme total). Afficher sa sortie TELLE QUELLE, sans commentaire.
- Sans argument → `todo-summary.sh` : une ligne par projet (ouverts, plus ancien, à toi / à moi, sans tag). PAS le
  détail des items : la liste complète (90+ items) n'est jamais affichée d'un bloc.
- Avec un nom de projet → `todo-summary.sh <projet>` : items du bloc numérotés (c'est la numérotation de `done`).
- `toi` ou `moi` → `todo-summary.sh toi|moi` : items de ce tag, tous projets.

### `verif <projet>`
Confronte les items d'UN projet à leur source. Jamais plusieurs projets dans le même appel.
1. `todo-summary.sh <projet>` pour la liste numérotée.
2. Pour CHAQUE item : l'artefact qui établit son état (git du dépôt, fichier:ligne lu dans son contexte, base locale,
   run CI). Un `git log` de dépôt n'établit pas l'état d'un item ; une ligne de grep se lit avec ses voisines.
3. Rendre un tableau `n | item (court) | artefact regardé | constat` ; sans artefact possible (écran, appareil,
   prod, tiers) : `non vérifié — <ce qui manque>`, jamais « inchangé ».
4. Items établis faits : proposer `done` ; items avancés : proposer la ligne réécrite avec `[verif <aujourd'hui>]`.
   Appliquer après accord de l'utilisateur.

### `done <projet> <n>`
Coche le n-ième item NON coché du projet. Exemple : `/todo done projet-b 1`
1. Lire le bloc du projet (règle commune).
2. `n` = numérotation de `todo-summary.sh <projet>` (items `- [ ]` et `- [~]`) ; cibler le n-ième.
3. Edit de TODO.md : retirer la ligne de l'item.
4. Edit de `TODO-archive.md` : insérer l'item juste après le titre `## <projet>` (le créer en fin de fichier
   s'il manque), `- [ ]` -> `- [x]`, texte + tag de type inchangés, suffixe ` — fait YYYY-MM-DD`.
5. Confirmer : `Fait [projet-b] 1 : rebasculer cypress.yml`.

### sans argument
Équivaut à `list` (tous les projets).

## Option `local` (premier argument = `local`)

Cible `~/.claude/TODO.md` (toDo propre au poste, hors vault, hors dépôt) au lieu du toDo du vault.
Fichier absent : le dire et s'arrêter, ne pas le créer. Sans `local`, tout ce qui précède s'applique inchangé.

Structure : pas de blocs projet, deux sections `## A faire` et `## Fait`.
Item : `- [ ] [type] (YYYY-MM-DD) texte` — `type` ∈ {essai, op, idee}, sans tag `[[projet]]`. Plus récent en haut.
Même règle commune : Read avant tout Edit, confirmation en une ligne.

- `local add <type> "<texte>"` : insérer l'item juste après la ligne `## A faire`. Confirmer : `Ajouté [local/op] : texte`.
- `local list` (ou `local` seul) : items `- [ ]` de `## A faire`, numérotés à partir de 1, format `1. [op] (date) texte`.
- `local done <n>` : retirer le n-ième item de `## A faire` et l'insérer juste après `## Fait`, `- [ ]` -> `- [x]`,
  suffixe ` — fait YYYY-MM-DD`. Confirmer : `Fait [local] n : texte`.
- Un essai (`[essai]`) lancé ou fini se trace aussi dans `$CLAUDE_VAULT/infra/pc-msi-essais-config.md` : le rappeler
  dans la confirmation.

## Notes
- Ne jamais réécrire tout le fichier : Edit ciblé uniquement (préserve frontmatter, index, ordre).
- Le compteur au démarrage (`session-start.js`) et `todo-summary.sh` lisent les tags `[type]` puis `[qui]`
  inline, pas les titres de section — ne pas retirer ni intervertir ces tags.
- `TODO-archive.md` ne se purge pas sans demande explicite.
