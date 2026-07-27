---
name: review
description: |
  Revue de code token-efficiente. Issues uniquement, priorisees, localisees, classees par axe (clean/perf/refacto/bug/secu). Mode --diff (git diff), --full (audit systematique de toute l'app), --html (rapport navigateur).
  TRIGGER when: "review", "diff-review", "audit complet", "revue complete", "review toute l'app", "regarde mon code", "c'est bon ce code ?", "review le diff", "verifie mes modifs"
allowed-tools: Read, Bash, Glob, Grep
---

# Skill : Review de code
# Invocation : /review [fichier] ou /diff-review [branche/commit]

**Demande :** $ARGUMENTS

## Mode

- `--full` / "audit complet" / "revue complete" / "toute l'app" → mode **full** (balayage systematique des 5 axes sur tout le code source ; voir section dediee)
- `/diff-review` ou "diff", "modifs", "changes" → mode **diff** (git diff uniquement, pas de lecture de fichiers)
- Sinon → mode **fichier** (lecture du code fourni/indique)

## Mode diff — etape 1

```bash
git diff HEAD $ARGUMENTS 2>/dev/null || git diff --staged 2>/dev/null
```
Si vide → signaler et arreter. Analyser uniquement les lignes +/-.

## Mode fichier — contexte requis

Si manquant, demander en une seule fois :
1. Le code a analyser (fichier, extrait)
2. Le contexte d'usage (API ? UI ? service ?)

## Categories (chaque issue est rangee dans UNE categorie)

Ordre d'affichage dans le rapport (impose par le filtre review2md.js) : CLEAN, PERF, REFACTO, BUG, SECU.

| Tag | Categorie | Couvre |
|-----|-----------|--------|
| `CLEAN`   | Clean code  | nommage, duplication, lisibilite, dead code, fonctions trop longues |
| `PERF`    | Performance | N+1, requetes non paginees, boucles couteuses, gros payloads, re-renders |
| `REFACTO` | Refacto     | couplage, responsabilites melangees (SRP), abstraction manquante/excessive |
| `BUG`     | Bugs        | edge cases, null/undefined, async non gere, erreurs avalees, logique fausse |
| `SECU`    | Securite    | injections, auth/authz manquante, secrets, XSS/CSRF, validation entree |

## Format de sortie

Une ligne par issue, prefixee par `[CATEGORIE][SEVERITE]` :
```
[SECU][CRITIQUE] path/file:ligne -- probleme + pourquoi critique
  -> fix: correction minimale

[PERF][WARN]     path/file:ligne -- risque
[CLEAN][INFO]    path/file:ligne -- amelioration optionnelle
```

- Severite : `CRITIQUE` / `WARN` / `INFO`. Categorie : un des 5 tags ci-dessus.
- Une ligne par issue. Fix inline si evident (1-2 lignes), prefixe `  -> fix:`.
- Aucune issue : `Aucune issue detectee.`
- Pas de "Points positifs" ni "En resume".
- Ce MEME texte sert d'entree au mode --html (le filtre groupe par categorie puis fichier).

## Mode HTML (--html)
Declencheur : `--html` present dans `$ARGUMENTS` (ex `/review --html` ou `/diff-review --html`).
L'analyse interne ET le format de sortie sont identiques au mode normal : produire le MEME
texte `[CRITIQUE]/[WARN]/[INFO] path:line -- msg` (+ `-> fix:`), puis le piper dans le filtre.
Aucun formatage HTML/markdown a faire a la main (le filtre gere badges, groupage par fichier,
em-dash, blockquotes).

```bash
cat <<'TXT' | bash ~/.claude/tools/review2html.sh --open review-$(date +%Y%m%d-%H%M).html "Review <cible>"
[SECU][CRITIQUE] app/Foo.php:42 -- injection SQL sur $request->id
  -> fix: bindings PDO / Eloquent
[PERF][WARN]     app/Foo.php:88 -- N+1 dans la boucle
[CLEAN][INFO]    resources/Bar.vue:12 -- prop sans type explicite
TXT
```
Annoncer le chemin `.html` retourne (affiche sur stdout). `--open` ouvre le navigateur ;
retirer si non souhaite. allowed-tools Bash suffit (pas de Write).

## Mode full (--full) — audit complet d'app

Objectif : balayage SYSTEMATIQUE des 5 axes sur tout le code source. L'utilisateur n'a PAS a
preciser d'axe : les 5 sont toujours couverts pour CHAQUE fichier. C'est ce qui evite les oublis.

### Etape 1 — Inventaire (= checklist anti-oubli)
```bash
bash ~/.claude/tools/review-files.sh [racine] | tee /tmp/review-inventory.txt
```
Respecte .gitignore, exclut vendor/node_modules/dist/build/min/.d.ts. Le listing (fichier + nb
lignes) EST la checklist : chaque fichier doit etre passe. Regrouper par couche/module
(Laravel : Http/Controllers, Services, Models, Jobs, Policies... ; Vue/Ionic : views, components,
stores, composables, services). Prioriser le code applicatif ; tests/config en dernier.

### Etape 2 — Fichiers de suivi (sur disque, survivent a la session)
```bash
base="${PWD}/revue/audit-$(date +%Y%m%d-%H%M)"
acc="$base.txt"; cov="$base.covered.txt"; inv="$base.inventory.txt"
mkdir -p "$(dirname "$acc")"; : > "$acc"; : > "$cov"
bash ~/.claude/tools/review-files.sh | grep -E '\t' | sed 's/^ *[0-9]*\t//' | sort > "$inv"
```
- `acc` = findings (format canonique). `cov` = chemins deja audites. `inv` = liste de reference.
- Reprise inter-session OBLIGATOIRE avant de creer de nouveaux fichiers : chercher un audit en cours
  ```bash
  last=$(ls -1 revue/audit-*.covered.txt 2>/dev/null | sort | tail -1)
  ```
  Si `last` existe, REUTILISER ce triplet (`${last%.covered.txt}.txt/.covered.txt/.inventory.txt`)
  au lieu d'en creer : lire `cov` pour savoir quels fichiers restent (`comm -23 inv <(sort -u cov)`)
  et reprendre le balayage la ou il s'est arrete. Ne recreer un triplet que si aucun n'existe.

### Etape 3 — Plan de phases (annoncer AVANT de commencer)
Decouper `inv` en PHASES par couche (stores, services, db, composables, vues, composants, tests),
budget ~2500 lignes par phase. Annoncer le plan : N phases, fichiers + lignes de chacune. Une phase
doit tenir confortablement dans le contexte restant — en cas de doute, reduire le budget.

### Etape 4 — Boucle par phase, AVEC GATE DE VALIDATION
L'audit doit etre COMPLET, jamais partiel. Pour eviter les fins de session, traiter UNE phase par
tour, puis s'arreter pour validation utilisateur avant la suivante.

Pour chaque phase :
1. Lire TOUS les fichiers de la phase. Appliquer les 5 axes DANS L'ORDRE a chaque fichier :
   1. CLEAN   : nommage, duplication, dead code, fonctions trop longues, complexite, magic numbers
   2. PERF    : N+1, requetes non paginees/non indexees, boucles couteuses, gros payloads, watch/re-render inutiles, imports lourds
   3. REFACTO : couplage fort, responsabilites melangees (SRP), abstraction manquante/excessive, logique a extraire
   4. BUG     : null/undefined, edge cases, async non await/non catch, catch vide, types any, etat partage, off-by-one
   5. SECU    : injections (SQL/cmd), authz/authn manquante, secrets en dur, XSS/CSRF, validation entree absente, donnees sensibles loggees
2. APPEND les findings dans `acc` (heredoc), et CHAQUE fichier traite dans `cov` :
   ```bash
   cat >> "$acc" <<'TXT'
   [CLEAN][INFO]  src/foo.ts:12 -- ...
   TXT
   printf '%s\n' src/foo.ts src/bar.ts >> "$cov"
   ```
3. Rapport de phase + GATE : afficher "Phase i/N terminee — couverture X/total fichiers, Y findings
   cumules". Puis poser via AskUserQuestion : continuer la phase suivante / generer le rapport
   intermediaire / arreter. NE PAS enchainer sans validation (c'est le garde-fou anti-fin-de-session).

### Etape 5 — Cloture (verification de completude OBLIGATOIRE)
Un audit n'est "complet" QUE si la couverture egale l'inventaire — verifie par diff, jamais a l'oeil :
```bash
manquants=$(comm -23 "$inv" <(sort -u "$cov"))
if [ -n "$manquants" ]; then echo "INCOMPLET — restent:"; echo "$manquants";
else echo "COMPLET — tous les fichiers de l'inventaire sont couverts"; fi
bash ~/.claude/tools/review2html.sh --open "$base.html" "Audit complet — <app>" < "$acc"
```
Annoncer "audit COMPLET" uniquement si `manquants` est vide (never-assume). Sinon, dire combien
restent et reprendre par une nouvelle phase.
