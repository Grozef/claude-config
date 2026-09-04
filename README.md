# claude-config

Configuration globale de [Claude Code](https://claude.com/claude-code) : règles, hooks de
vérification, skills et outils. Le contenu de ce dépôt se place dans `~/.claude/`.

L'axe de cette config est la **vérification** : des hooks bloquants empêchent d'annoncer
« c'est fait » sans avoir produit l'artefact correspondant, et de modifier un fichier sans
l'avoir lu. Le reste (skills, tools) sert à limiter la consommation de tokens.

Aucun contenu de projet réel n'est versionné ici : mémoire par projet, archives et kits de
marque vivent dans un dépôt privé séparé.

---

## Installation

```sh
git clone https://github.com/Grozef/claude-config ~/.claude
cd ~/.claude
cp vault.conf.example vault.conf            # optionnel — voir « Vault Obsidian »
cp vault-map.conf.example vault-map.conf    # optionnel
```

`settings.json` déclare les hooks et est repris tel quel. Les préférences propres à la machine
vont dans `settings.local.json` (non versionné).

Sur Windows, les hooks shell tournent sous Git Bash ; les hooks `.js` sous Node.

---

## Contenu

### `CLAUDE.md`

Les règles globales appliquées à toutes les sessions. Les principales :

| Règle | Effet |
|-------|-------|
| Jamais de supposition | interdit de coder contre une forme de payload / schéma non observé dans le code ou une réponse réelle |
| Nomme l'artefact | interdit de dire « fait / vert / absent » sans nommer l'artefact regardé — un build ou un grep est un proxy, pas un artefact |
| Changements chirurgicaux | ne modifier que ce que la demande impose ; le scope-creep est signalé, pas exécuté |
| Simplicité d'abord | code minimal, rien de spéculatif |
| Mode compact | pas de reformulation, pas de préambule, pas d'alternatives non demandées |
| Pas d'emoji ni de gras | remplacements ASCII (`[OK]`, `[x]`, `->`, `/!\`) |

### `hooks/`

Câblés dans `settings.json`.

| Hook | Événement | Rôle |
|------|-----------|------|
| `session-start.js` | SessionStart | détecte le type de projet, injecte `SESSION.md`, affiche le compteur du toDo global et les items liés au projet courant |
| `pre-bash.sh` | PreToolUse/Bash | alerte sur les commandes non bornées (`git log` sans `-n`, `find` sans `-maxdepth`…) |
| `pre-read.sh` / `pre-write.sh` | PreToolUse | alerte au-delà d'un seuil de lignes, oriente vers `offset`/`limit` ou Edit |
| `pre-edit-write.sh` | PreToolUse/Write\|Edit | **bloque** une modification de fichier non lu dans la session |
| `post-write.sh` | PostToolUse/Write | met à jour le `.gitignore` du projet après création du trio de contexte |
| `user-prompt-submit.js` | UserPromptSubmit | rappel never-assume à chaque tour |
| `stop-verify.js` / `.sh` | Stop | **bloque** une complétion affirmée sans tool, une négation d'existence non qualifiée, un aveu de scope-creep |
| `stop-counter.js` | Stop | compteur de réponses, déclenche checkpoint et `/compact` |
| `stop-vault-sync.sh` | Stop | synchronise fiche / infra / session vers le vault Obsidian |
| `stop-capture-reminder.sh` | Stop | rappelle de consigner erreurs / learnings / décisions |
| `test-gates.sh` | — | suite de tests des gates ci-dessus (`bash hooks/test-gates.sh`) |

`hooks/hooks-healthcheck.sh` (dans `tools/`) vérifie que tout ce que déclare `settings.json`
existe et est exécutable.

### `skills/`

Invocables en `/<nom>`.

- Contexte de session : `session-start`, `checkpoint`, `context-update`, `summarize-session`, `clean-context`
- Code : `review`, `refactor`, `debug`, `gendoc`, `laravel`, `vue3ionic`, `linux`
- Documentation : `cdc` (cahier des charges, 5 variantes), `update-fiche`
- Vault : `todo`, `review-meta`
- Écriture : `redac`, `write-scene`, `review-scene`, `update-brief`, `update-canon`, `init-creation`
- Divers : `ask-haiku` (délègue une question mécanique à un modèle moins cher), `quick`

### `tools/`

Scripts appelés par les skills ou à la main : `cdc.sh`, `md2html.sh`, `md2docx.sh`,
`docx-brand.sh` (injecte header/footer dans un `.docx` sans toucher aux styles du corps),
`review-files.sh`, `review2html.sh`, `review2md.js`, `meta-tally.sh`, `todo-project.sh`,
`hooks-healthcheck.sh`, `sync-memory-to-vault.sh` (sauvegarde la mémoire par projet dans le
vault — la source reste en place, c'est Claude Code qui la lit).

`audit-public.sh` est à lancer avant tout push : il vérifie qu'aucun nom de projet réel,
chemin machine, identité ou secret n'est indexé. La liste des noms recherchés est dérivée du
vault à l'exécution, jamais écrite dans le dépôt. Il désaccentue les fichiers avant de les
lire — sans ça, un nom accentué échappe à un motif non accentué.

### `project-templates/`, `creation-templates/`, `templates/`

Gabarits déployés par `context-update` (projets de code) et `init-creation` (projets
littéraires), plus le thème CSS utilisé par `md2html.sh`.

---

## Vault Obsidian

Plusieurs skills et hooks écrivent dans un vault Obsidian : toDo global, journal, fiches
projet, captures d'erreurs et de leçons. C'est **optionnel** — sans configuration, les
composants concernés sortent en silence.

`vault.conf` (non versionné) :

```sh
CLAUDE_VAULT="/chemin/vers/mon-vault"
CLAUDE_BRAND_DIR="$CLAUDE_VAULT/claude/assets/brand"   # optionnel, pour docx-brand.sh
```

`vault-map.conf` (non versionné) associe un dossier de travail au nom du projet dans le
vault, pour que `stop-vault-sync.sh` sache où synchroniser :

```sh
declare -A MAP=(
  ["mon_projet"]="mon-projet"
  ["mon_projet_back"]="mon-projet"
)
```

Le chemin du vault n'est jamais écrit en dur : les hooks shell sourcent `vault.conf`, les
hooks Node passent par `hooks/lib/vault-conf.js`, et `session-start` injecte la valeur résolue
dans le contexte (`Vault : <chemin>`) pour que les skills en prose puissent la référencer sous
la forme `$CLAUDE_VAULT`.

---

## Documentation

- `GUIDE-token-efficiency.md` — pourquoi et comment cette config réduit la consommation
- `bilan.md` — inventaire détaillé des hooks et skills
- `ACTIONS-MANUELLES.md` — mise en place sur un projet existant
