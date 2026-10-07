# Optimiser son usage de Claude Code — Guide pour débutants

## C'est quoi le problème ?

Claude Code facture à la consommation de **tokens** — les tokens sont l'unité de mesure du texte traité (lu + généré). Plus Claude lit de fichiers, plus il génère de texte long, plus ça coûte.

Le problème par défaut :
- Claude relit les mêmes fichiers à chaque session
- Il génère des réponses longues même quand une courte suffit
- Il charge des règles ou des informations qui ne servent pas pour la tâche en cours
- Les commandes bash peuvent retourner des milliers de lignes sans que personne ne le demande

**L'objectif de ce guide** : expliquer comment on a configuré Claude pour qu'il soit plus économe, sans perdre en qualité.

---

## Les 4 leviers d'optimisation

### 1. Le contexte de session (mémoire entre sessions)

**Le problème :** par défaut, Claude repart de zéro à chaque nouvelle session. Tu dois ré-expliquer le projet, la stack, les conventions. Ça prend du temps et des tokens.

**La solution :** des fichiers de contexte dans chaque projet.

- `SESSION.md` — l'état du projet au dernier checkpoint (où on en est, prochaine étape)
- `CONTEXT.md` — la structure du projet (stack, conventions, points d'entrée)
- `DECISIONS.md` — les décisions importantes prises (pour ne pas re-débattre)

`SESSION.md` est injecté au démarrage par le hook `session-start.js`, avec sa date de dernière modification : c'est un souvenir, à confronter à `git status` avant d'affirmer quoi que ce soit. `CONTEXT.md` et `DECISIONS.md` se chargent avec `/context-update`.

**Commandes :**
- `/context-update` — sans argument : charge le contexte en début de session ; avec `init` ou un
  changement décrit : initialise ou met à jour ces fichiers dans un projet
- `/checkpoint` — sauvegarde l'état actuel (fin d'étape, fin de session)
- `/summarize-session` — résumé dense en fin de session pour la prochaine

---

### 2. Les règles par contexte (CLAUDE.md)

**Le problème :** si Claude charge les règles Laravel quand tu travailles sur du Vue, et les règles Vue quand tu travailles sur du Laravel, tu paies pour du contexte inutile.

**La solution :** des fichiers `CLAUDE.md` à plusieurs niveaux.

```
mon-projet/
├── CLAUDE.md              ← règles globales du projet (stack, conventions)
├── app/
│   └── CLAUDE.md          ← règles Laravel uniquement (chargé quand tu travailles dans app/)
└── resources/js/
    └── CLAUDE.md          ← règles Vue uniquement (chargé quand tu travailles en front)
```

Claude charge automatiquement le `CLAUDE.md` le plus proche du fichier sur lequel il travaille.

**Comment les créer :** lancer `/context-update` dans le projet — Claude détecte la structure et copie les templates adaptés.

---

### 3. Les hooks (gardes-fous automatiques)

Les hooks sont des scripts qui s'exécutent automatiquement avant/après chaque action de Claude.

Un hook n'agit sur Claude que s'il BLOQUE (code de sortie 2) ou s'il INJECTE du contexte (SessionStart, UserPromptSubmit, ou le champ JSON `additionalContext`). Un simple `echo` en PreToolUse, PostToolUse ou Stop part dans le log de debug, et un hook `async` ne renvoie rien (doc hooks). Les anciennes alertes « fichier > 200 lignes », « git log sans limite » et le compteur de réponses fonctionnaient ainsi : jamais lus par Claude, ils ont été retirés le 2026-09-13.

#### Hook : modification sans lecture préalable
`pre-edit-write.js` bloque un Edit/Write sur un fichier que Claude n'a pas lu dans la session.

#### Hook : affirmations non prouvées
`stop-verify.js` bloque en fin de tour une réponse qui annonce « fait / vert / n'existe pas / rendu correct » sans l'artefact correspondant dans le tour (commandes Bash et PowerShell comprises). Chaque blocage est journalisé dans `~/.claude/.gate-blocks.log`, chaque contournement `[NO-VERIFY: raison]` dans `~/.claude/.no-verify.log` ; `/review-meta` dépouille les deux.

Depuis le 2026-09-14 (gate 2h, TODO 197), un tour qui écrit un fichier `.md` (note, TODO, doc ; hors `~/.claude/plans/`) ne se termine qu'après une relecture de ce fichier (Read, ou Grep/Bash qui le nomme) postérieure à sa dernière écriture et un bloc `REVERIF :` en fin de message : une ligne `- affirmation -> artefact` par affirmation de fait, `-> NO-VERIFY: ...` sinon. `[NO-VERIFY:]` ne neutralise pas ce gate. Coût assumé : quelques lignes de sortie par livraison.

Depuis le 2026-10-05 (gate 2i), un tour qui écrit du code par Edit/Write (hors `.md`, `~/.claude/plans/` et scratchpad) est bloqué à l'arrêt qui suit chaque série d'écritures de code : le message liste les fichiers écrits et les surfaces de `verification-protocol.md` à réfuter (`changement-partage`, `valeur-limite`, `test-probant`, `visuel`, `feature-runtime` selon le type de fichier). Le tour se termine dès qu'une vérification suit ce message, sauf si du code est encore écrit ensuite : il lui faut alors une nouvelle passe. Aucun bloc de forme n'est exigé. Le gate 1 n'accepte plus que les vérifications postérieures à la dernière production. Coût assumé : une passe de plus par tour de code, à juger sur le taux d'échappement de `tools/meta-tally.sh`.

#### Hook : rappel du vault
`user-prompt-submit.js` joint à une demande de production les 2 notes du vault les plus proches ; `post-fail-vault.js` fait de même quand un outil échoue.

#### Hook : gitignore automatique
Quand Claude crée `SESSION.md`, `CONTEXT.md` ou `DECISIONS.md`, il met à jour `.gitignore` automatiquement. Ces fichiers sont personnels et ne doivent pas être committés.

---

### 4. Les skills (commandes spécialisées)

Les skills sont des commandes préconçues qui chargent uniquement ce dont elles ont besoin.

#### Pour le code
| Commande | Usage | Avantage |
|----------|-------|----------|
| `/review` | Revue de code | Format compact : issues uniquement, pas de louanges |
| `/debug` | Diagnostiquer un bug | Hypothèses par probabilité, fix minimal |
| `/refactor` | Réécrire du code | Blocs modifiés uniquement, pas tout le fichier |
| `/laravel` | Générer du code Laravel | Conventions PSR-12 pré-chargées |
| `/vue3ionic` | Générer du code Vue/Ionic | Composition API, TypeScript |

#### Pour le contexte
| Commande | Usage |
|----------|-------|
| `/checkpoint` | Sauvegarder l'état de la session |
| `/summarize-session` | Résumé dense en fin de session → DECISIONS.md |
| `/clean-context` | Archiver les vieilles décisions, alléger les fichiers, auditer les CLAUDE.md |
| `/compact` | Compresser la conversation. Rarement utile sur Opus 5 : contexte de 1M tokens, compaction automatique vers 967K ; compacter tôt fait perdre du détail |

#### Pour économiser des tokens
| Commande | Usage |
|----------|-------|
| `/review --diff` | Review limitée à `git diff`, sans relire les fichiers entiers |
| `/quick [question]` | Confirmer une intuition en 3 lignes max |
| `/effort medium` (ou `low`) | Tâche mécanique (checkpoint, todo, renommage). Défaut Opus 5 : `high` ; `xhigh` pour le code difficile |

`/effort` règle la quantité de réflexion, pas la longueur des réponses : pour des réponses courtes, c'est la section « Mode compact » de CLAUDE.md qui agit.

Les skills mécaniques `checkpoint`, `todo`, `summarize-session`, `update-canon` et `quick` portent `effort: low` dans leur frontmatter depuis le 2026-09-14. La doc skills dit seulement « Effort level when this skill is active. Overrides the session effort level. » : le moment où l'effort de session reprend n'y est pas documenté pour ce champ (pour `model:`, c'est au prompt suivant).

#### Hygiène de session (le vrai poste de dépense)
Chaque appel renvoie tout l'historique. Mesure du 2026-09-14 (`tools/transcript-metrics.js`) : 167k tokens de contexte moyen par appel et 12,4M lus en cache sur 3 sessions, contre ~4,8k pour tout le socle de config (`tools/token-budget.sh`). Alléger CLAUDE.md fait gagner des centaines de tokens ; vider le contexte en fait gagner des millions.
- `/checkpoint` puis `/clear` entre deux items du TODO sans lien entre eux.
- Après deux corrections ratées sur le même point : `/clear` et un prompt réécrit avec ce qu'on a appris (doc best-practices).
- Le cache dure 1 h sur abonnement : le premier message après une pause plus longue relit tout le contexte sans cache. Reprendre plutôt depuis le checkpoint.

Session Haiku manuelle : `haiku.sh` ou l'alias `haiku` (`profile_aliases.sh`), pour une tâche mécanique sans enjeu d'exactitude. Le skill `/ask-haiku` a été retiré le 2026-09-13 : il relayait sans vérification la réponse d'un autre modèle sur l'existence d'un fichier ou d'une fonction, et son gain n'avait jamais été mesuré.

Les skills qui écrivent l'état de session (`checkpoint`, `todo`, `review-meta`…) ne forcent plus Haiku : un `model:` de skill vaut pour tout le reste du tour (doc skills), réponse finale comprise.

#### Router un plan vers des modèles adaptés : `/dispatch`
Mesure du 2026-10-05 (`tools/transcript-metrics.js`, 29 sessions) : 3995 appels Opus à 227,8k de contexte moyen ; la relecture du contexte en cache fait environ 60 % du coût pondéré. La lecture de cache coûte le même prix sur Opus 5.5 et Sonnet 5.5 (0,20 $/MTok), moitié moins sur Haiku : le gain d'une délégation vient d'abord du contexte neuf du sous-agent (26,6k par appel sur le lot de sonde), ensuite du prix de sortie.

`/dispatch`, lancé à la main sur un plan approuvé, découpe en lots, confie les lots mécaniques à `exec-simple` (Haiku) et les lots de code bornés à `exec-code` (Sonnet), garde pour Opus ce qui demande une décision, et ne tient un lot pour fait qu'après avoir relancé lui-même sa commande d'acceptation. Un lot à risque (sécurité, auth, migration, données, suppression) passe en plus devant `relecteur`. En dessous de 3 lots délégables, il exécute directement.

Un agent ajouté en cours de session n'est pas disponible tout de suite (constaté : refusé juste après création, disponible plus tard dans la même session). Le rapport d'un exécutant est refusé par `stop-verify.js` tant qu'aucune vérification ne suit sa dernière production. La ligne « par modèle » de `transcript-metrics.js` donne les appels, le contexte moyen et le coût pondéré de chaque modèle, sous-agents à part.

Compteur d'économie : la section « ECONOMIE DE LA DELEGATION » du même outil compare, sur 30 et 180 jours glissants (`--periodes 30,180`), le coût réel au coût qu'auraient eu les appels des sous-agents s'ils avaient relu le contexte de la session principale. C'est une borne haute, pas une facture. Elle s'appuie sur `backups/usage.jsonl`, un journal d'une ligne par appel (date, session, modèle, quatre compteurs de tokens, aucun contenu de conversation) mis à jour à chaque démarrage de session par `--archive` : 800 Ko pour 4056 appels au 2026-10-05, là où l'archive des transcripts complets pèse 117 Mo. Le compteur tient donc 6 mois même si `backups/transcripts/` est vidé ; les autres sections de l'outil (outils, blocages) ont toujours besoin des transcripts.

**Tâche multi-fichiers :** passer par le plan mode. Le skill `pre-task` a été supprimé le 2026-09-04 — demander l'autorisation de lire coûtait plus cher que les lectures évitées.

#### Alléger les skills chargés au démarrage
La description de chaque skill est injectée dans le contexte à chaque session, qu'on s'en serve ou non (doc skills). Claude Code livre une quinzaine de skills « natifs » (dataviz, verify, code-review, run…) : depuis 2026-07-15, ils sont réglés en `skillOverrides: "user-invocable-only"` dans `~/.claude/settings.json`. Ils disparaissent du contexte envoyé au modèle mais restent tapables à la main via `/nom`. Les skills perso (`/review`, `/debug`, `/laravel`…) ne sont pas touchés.

---

## Le démarrage intelligent

Au lieu d'afficher un message générique, Claude détecte maintenant le type de projet au démarrage et suggère la bonne action :

| Projet détecté | Message |
|----------------|---------|
| `composer.json` + `"vue"` dans package.json | `Laravel+Vue détecté → /context-update` |
| `composer.json` seul | `Laravel/PHP détecté → /context-update` |
| `package.json` avec Vue | `Vue détecté → /context-update` |
| Dossier `creation/` | `Projet littéraire détecté → /context-update` |
| Fichiers `.md`/`.txt` sans `creation/` | `Fichiers narratifs détectés → /init-creation` |
| SESSION.md présent | SESSION.md injecté, bannière « souvenir du <date> » |

---

## Pour les projets littéraires

Le même système existe pour l'écriture créative.

```
mon-roman/
└── creation/
    ├── BRIEF.md       ← pivot : voix, canon, état narratif (lu en premier par les skills)
    ├── CONTINUITE.md  ← faits établis (canon)
    └── ...            ← autres templates de ~/.claude/creation-templates/, copiés seulement si utiles
```

**Commandes :**
- `/init-creation` — initialise cette structure dans un projet
- `/write-scene` — génère une scène en respectant voix et continuité
- `/review-scene` — vérifie la cohérence d'une scène
- `/polish-scene` — passe d'édition anti-tics sur une scène rédigée
- `/update-canon` — met à jour les faits établis après une scène
- `/update-brief` — régénère BRIEF.md depuis le corpus

L'optimisation : `BRIEF.md` remplace la lecture des guides détaillés.

---

## En résumé : ce qu'on a mis en place

```
~/.claude/
├── CLAUDE.md                    ← règles globales (mode compact, format)
├── verification-protocol.md     ← quel artefact prouver pour quelle surface
├── settings.json                ← hooks automatiques
├── hooks/                       ← gardes-fous (section 3)
├── skills/                      ← toutes les commandes spécialisées (20+)
├── project-templates/           ← CLAUDE.md locaux, trio de contexte, .claudeignore
│   ├── CLAUDE-project.md
│   ├── CLAUDE-app.md            ← règles Laravel
│   └── CLAUDE-resources-js.md   ← règles Vue
├── creation-templates/          ← templates des projets littéraires
└── profile_aliases.sh           ← alias shell (haiku, claude-project)
```

**Ce que ça change concrètement :**
- Tu ouvres Claude dans un projet → il sait immédiatement ce que c'est et quoi faire
- Tu travailles sur du Vue → seules les règles Vue sont chargées
- Claude annonce « fait » sans preuve → le tour est bloqué
- Tu lances `/checkpoint` → la prochaine session repart de là

**Ce que tu n'as pas à faire :**
- Ré-expliquer le projet à chaque session
- Penser à mettre à jour `.gitignore`
- Créer `.claudeignore` manuellement (déployé par `/context-update`)
- Passer par le plan mode avant une grosse tâche multi-fichiers

---

## Référence rapide — toutes les commandes

| Commande | Quand l'utiliser |
|----------|-----------------|
| `/context-update` | Sans argument : reprendre le contexte en début de session |
| `/context-update init\|<changement>` | Nouveau projet ou changement d'architecture |
| `/checkpoint` | Sauvegarder l'état (fin d'étape, fin de session) |
| `/summarize-session` | Fin de session longue |
| `/clear` | Entre deux tâches sans lien, après `/checkpoint` |
| `/compact` | Rarement : Opus 5 compacte seul vers 967K tokens |
| `/clean-context` | DECISIONS.md ou CLAUDE.md trop volumineux |
| `/review --diff` | Review de ce qui vient d'être modifié |
| `/effort medium` | Tâche mécanique |
| `/review` | Revue de code sans bug signalé |
| `/debug` | Bug avec message d'erreur |
| `/refactor` | Réécriture de code |
