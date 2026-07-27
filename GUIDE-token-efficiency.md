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

- `SESSION.md` — l'état actuel du projet (où on en est, prochaine étape)
- `CONTEXT.md` — la structure du projet (stack, conventions, points d'entrée)
- `DECISIONS.md` — les décisions importantes prises (pour ne pas re-débattre)

Ces fichiers sont chargés automatiquement au démarrage. Claude reprend exactement où il s'était arrêté.

**Commandes :**
- `/context-update` — initialise ou met à jour ces fichiers dans un projet
- `/session-start` — charge le contexte en début de session
- `/checkpoint` — sauvegarde l'état actuel (à faire régulièrement)
- `/summarize-session` — résumé dense en fin de session pour la prochaine

**Gain estimé :** -20 à -40% de tokens au démarrage de chaque session sur un projet complexe.

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

Les hooks sont des scripts qui s'exécutent automatiquement avant/après chaque action de Claude. Ils servent à prévenir les erreurs coûteuses.

#### Hook : lecture de fichier volumineux
Avant de lire un fichier, Claude vérifie sa taille.
- Si > 200 lignes → avertissement : "précise la plage à lire"
- Évite de charger 800 lignes pour trouver une fonction de 10 lignes

#### Hook : écriture sur fichier volumineux
Avant de réécrire un fichier, Claude vérifie s'il est gros.
- Si > 500 lignes → avertissement : "utilise Edit plutôt que réécrire entièrement"
- Écraser 600 lignes pour modifier 5 lignes = gaspillage massif

#### Hook : commandes bash verbeuses
Avant d'exécuter certaines commandes, Claude vérifie si elles risquent de produire trop de texte.
- `git log` sans limite → avertissement (peut retourner des milliers de lignes)
- `find` sans profondeur maximale → avertissement
- `composer show`, `npm list` sans filtre → avertissement

#### Hook : gitignore automatique
Quand Claude crée `SESSION.md`, `CONTEXT.md` ou `DECISIONS.md`, il met à jour `.gitignore` automatiquement. Ces fichiers sont personnels et ne doivent pas être committés.

#### Hook : alerte de contexte saturé
Claude compte les réponses échangées dans la session.
- Toutes les 10 réponses → suggère `/checkpoint`
- À partir de 15 réponses, tous les 5 → suggère `/compact` (allège le contexte)
- Si `DECISIONS.md` dépasse 50 lignes → suggère `/clean-context`

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
| `/clean-context` | Archiver les vieilles décisions, alléger les fichiers |
| `/compact` | Compresser le contexte de la conversation en cours |

#### Pour économiser des tokens
| Commande | Usage | Gain |
|----------|-------|------|
| `/ask-haiku` | Question mécanique courte | 10-20x moins cher (modèle Haiku) |
| `haiku "question"` | Même chose en ligne de commande | Idem |
| `/quick [question]` | Confirmer une intuition en 3 lignes max | Évite une réponse longue non nécessaire |
| `/pre-task [tâche]` | Liste les fichiers avant de les lire, demande confirmation | Évite les lectures en cascade |
| `/diff-review` | Review basée sur `git diff` uniquement | 10x moins cher qu'une review de fichier complet |
| `/audit-claude-md` | Vérifie que les CLAUDE.md < 30 lignes | Réduit le contexte chargé à chaque échange |

**Exemple d'usage de haiku :**
```bash
haiku "quel est le nom exact de la méthode qui gère l'auth dans Laravel Sanctum ?"
```
→ Réponse immédiate, 10x moins cher qu'avec Sonnet.

**Exemple d'usage de pre-task :**
```
/pre-task refactoriser le système de paiement
```
→ Claude liste les fichiers concernés et leur taille estimée, attend ta validation avant de lire.

**Exemple d'usage de diff-review :**
```
/diff-review
```
→ Review uniquement sur ce qui a changé depuis le dernier commit. Pas de relecture de fichiers entiers.

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
| SESSION.md présent | Contexte rechargé automatiquement |

---

## Pour les projets littéraires

Le même système existe pour l'écriture créative.

```
mon-roman/
└── creation/
    ├── VOIX.md        ← voix et caractérisation des personnages
    ├── STYLE.md       ← style d'écriture, format
    ├── CONTINUITE.md  ← faits établis (canon)
    ├── SCENES.md      ← scènes prévues
    └── NSFW.md        ← progression et catalogue (si applicable)
```

**Commandes :**
- `/init-creation` — initialise cette structure dans un projet
- `/write-scene` — génère une scène en respectant voix et continuité
- `/review-scene` — vérifie la cohérence d'une scène
- `/update-canon` — met à jour les faits établis après une scène

L'optimisation : les fichiers lourds (STYLE.md, SCENES.md) ne sont chargés que si nécessaires pour la tâche demandée.

---

## En résumé : ce qu'on a mis en place

```
~/.claude/
├── CLAUDE.md                    ← règles globales (mode compact, format)
├── settings.json                ← hooks automatiques
├── skills/                      ← toutes les commandes spécialisées
│   ├── checkpoint/
│   ├── context-update/          ← déploie les CLAUDE.md locaux
│   ├── summarize-session/
│   ├── clean-context/
│   ├── ask-haiku/
│   └── ... (20+ skills)
├── creation-templates/          ← templates pour nouveaux projets
│   ├── CLAUDE-project.md
│   ├── CLAUDE-app.md            ← règles Laravel
│   └── CLAUDE-resources-js.md   ← règles Vue
└── profile_aliases.sh           ← alias shell (haiku, claude-project)
```

**Ce que ça change concrètement :**
- Tu ouvres Claude dans un projet → il sait immédiatement ce que c'est et quoi faire
- Tu travailles sur du Vue → seules les règles Vue sont chargées
- Tu poses une question simple → `/ask-haiku` te coûte 10x moins cher
- La session dure longtemps → Claude te rappelle de compresser le contexte
- Tu fermes → le contexte est sauvegardé, la prochaine session repart de là

**Ce que tu n'as pas à faire :**
- Ré-expliquer le projet à chaque session
- Surveiller manuellement la taille des fichiers
- Penser à mettre à jour `.gitignore`
- Choisir le bon modèle pour chaque tâche
- Créer `.claudeignore` manuellement (déployé par `/context-update`)
- Surveiller si DECISIONS.md grossit (le hook Stop le détecte et suggère `/clean-context`)
- Penser à confirmer les fichiers lus avant une grosse tâche (utilise `/pre-task`)

---

## Référence rapide — toutes les commandes

| Commande | Quand l'utiliser |
|----------|-----------------|
| `/context-update` | Nouveau projet ou changement d'architecture |
| `/session-start` | Reprendre le contexte en début de session |
| `/checkpoint` | Sauvegarder l'état (toutes les 10 réponses) |
| `/summarize-session` | Fin de session longue |
| `/compact` | Contexte trop lourd (suggéré auto après 15 réponses) |
| `/clean-context` | DECISIONS.md trop volumineux (suggéré auto) |
| `/pre-task` | Avant toute tâche multi-fichiers |
| `/diff-review` | Review de ce qui vient d'être modifié |
| `/audit-claude-md` | Vérifier que les CLAUDE.md restent légers |
| `/ask-haiku` | Question factuelle courte |
| `/review` | Revue de code sans bug signalé |
| `/debug` | Bug avec message d'erreur |
| `/refactor` | Réécriture de code |
