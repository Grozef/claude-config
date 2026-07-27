# Bilan session token_efficiency — 2026-03-27

## Ce qui a été fait

### Hooks (settings.json)

| Hook | Déclencheur | Effet |
|------|-------------|-------|
| `SessionStart` | Ouverture Claude | Détecte le type de projet (Laravel/Vue/littéraire/narratif) et suggère la bonne commande. Avertit si CLAUDE.md locaux manquants. |
| `PreToolUse/Bash` | Avant toute commande bash | Avertit si `git log/diff` sans `-n`, `find` sans `-maxdepth`, `composer show` / `npm list` sans filtre |
| `PreToolUse/Write` | Avant toute écriture | Avertit si fichier existant > 500 lignes → préfère Edit |
| `PreToolUse/Read` | Avant toute lecture | Avertit si fichier > 200 lignes → demande offset/limit |
| `PostToolUse/Write` | Après création SESSION/CONTEXT/DECISIONS.md | Met à jour `.gitignore` du repo automatiquement |
| `Stop` | Après chaque réponse | Incrémente compteur ; checkpoint à ×10 ; /compact suggéré à partir de 15 réponses tous les 5 ; /clean-context si DECISIONS.md > 50 lignes |

### Skills

| Skill | Type | Description |
|-------|------|-------------|
| `summarize-session` | Nouveau | Résumé dense fin de session → DECISIONS.md |
| `ask-haiku` | Nouveau | Question mécanique → haiku (10-20x moins cher) |
| `clean-context` | Nouveau | Archive DECISIONS.md, compresse CONTEXT.md. Auto-suggéré si > 50 lignes |
| `checkpoint` | Modifié | Estimation tokens chargés, alerte si > 50k |
| `review` | Modifié | DO NOT TRIGGER affiné : exclut les messages d'erreur |
| `debug` | Modifié | DO NOT TRIGGER affiné : exclut les demandes sans erreur |
| `write-scene-nsfw` | Modifié | STYLE.md chargé conditionnel (si "format/interactif/renpy" dans args) |
| `context-update` | Modifié | Déploie auto app/CLAUDE.md et resources/js/CLAUDE.md si projet Laravel/Vue |

### Aliases (profile_aliases.sh)

| Alias | Usage |
|-------|-------|
| `haiku "question"` | claude-haiku pour tâches mécaniques |
| `claude-sonnet` | claude-sonnet-4-6 |
| `claude-project <path>` | Ouvre Claude dans le bon répertoire projet |

### Templates

| Fichier | Description |
|---------|-------------|
| `CLAUDE-project.md` | Template CLAUDE.md projet Laravel/Vue avec marqueurs conditionnels |
| `CLAUDE-app.md` | Template pour `app/CLAUDE.md` (règles Laravel uniquement) |
| `CLAUDE-resources-js.md` | Template pour `resources/js/CLAUDE.md` (règles Vue uniquement) |

### Système mémoire

| Fichier | Description |
|---------|-------------|
| `memory/MEMORY.md` | Index des mémoires persistantes |
| `memory/user_profile.md` | Stack, projets, préférences utilisateur |
| `memory/feedback_style.md` | Mode compact, réponses directes |
| `memory/project_claude_config.md` | État complet de la config Claude |

---

## Impact estimé sur la consommation de tokens

| Amélioration | Gain estimé |
|-------------|-------------|
| Hook Bash | Évite les outputs bash non bornés (git log entier = 5-20k tokens selon le repo) |
| Hook Write > 500 lignes | Évite les réécritures totales coûteuses |
| Hook gitignore centralisé | Supprime logique dupliquée dans les skills |
| `summarize-session` | -20 à -40% de tokens au démarrage de la session suivante |
| `ask-haiku` | 10-20x moins cher pour les questions mécaniques |
| `clean-context` auto | Maintient DECISIONS.md < 50 lignes → contexte allégé à chaque session |
| Checkpoint + alerte tokens | Prévention proactive des contextes saturés |
| Auto-compact à 15 réponses | Évite de continuer avec un contexte saturé |
| CLAUDE.md par sous-dossier | Règles ciblées selon le contexte (front/back) — pas de chargement croisé |
| SessionStart intelligent | Suggestion immédiate de la bonne action → pas de tokens gaspillés à expliquer |
| Séparation review/debug | Évite les déclenchements croisés |
| write-scene-nsfw conditionnel | -25% tokens sur les appels sans contrainte de format |

---

## Pistes restantes à explorer

- **Modèle adaptatif natif** — non supporté par Claude Code actuellement. Le workaround `haiku` reste la seule option.
- **Métriques de tokens réelles** — si Claude Code expose le compteur via les hooks dans une future version.
- **`claude-project` avec sélection interactive** — si `fzf` disponible, liste les projets connus sans taper le chemin.
- **Action manuelle** — lancer `/context-update` dans chaque projet Laravel/Vue actif pour déployer les CLAUDE.md locaux (le hook SessionStart le rappelle automatiquement).
