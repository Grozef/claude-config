---
name: update-brief
description: |
  Met a jour ou genere creation/BRIEF.md en extrayant voix, canon et etat narratif depuis le corpus du projet (chemins lus dans la section Integration du BRIEF, ou detectes). Remplace la lecture des guides detailles.
  TRIGGER when: "update-brief", "fill-brief", "mets a jour le brief", "genere le brief", apres une session d'ecriture, BRIEF.md avec "[a remplir]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Skill : update-brief
# Invocation : /update-brief [personnage optionnel] ou /fill-brief (alias)

**Demande :** $ARGUMENTS

## Mode

- BRIEF.md absent ou majoritairement "[a remplir]" → mode **fill** (scan du corpus initial)
- Sinon → mode **update** (diff recent uniquement)

## Pipeline

### Etape 1 — Localiser le corpus

Lire la section **Integration** de `creation/BRIEF.md` (arborescence du contenu, commande list).
Si BRIEF absent ou section vide : detecter le corpus (glob `src/data/**/*.ts`, `drafts/**`,
fichiers prose) et **confirmer les chemins avec l'utilisateur** avant de scanner ; reporter
les chemins valides dans la section Integration.

Mode fill : inventaire des personnages depuis le premier arc/chapitre du corpus, puis lire
2 unites (chapitre/thread) par perso (150 lignes max/fichier).

Mode update : `git diff --name-only HEAD~5 -- '<arborescence>' 2>/dev/null | head -10`.
Si pas de diff, globber les 5 fichiers les plus recents du corpus.

### Etape 2 — Extraire les patterns de voix

Pour chaque personnage :
1. Lire 2-3 fichiers representatifs (100 premieres lignes)
2. Extraire : format messages, emojis, ponctuation, tournures
3. Formuler 3-4 patterns concis (exemple / contre-exemple)

### Etape 3 — Extraire le canon

1. Lire `creation/CONTINUITE.md` (section "Journal" uniquement si > 100 lignes)
2. 5-10 derniers faits etablis + fils ouverts

### Etape 4 — Ecrire/mettre a jour BRIEF.md

Format cible : template `~/.claude/creation-templates/BRIEF.md` (pivot ~120 lignes max,
sections voix / format technique / Integration / canon / assets / regles absolues).

Mode fill : remplir toutes les sections, format dense.
Mode update : remplacer uniquement les sections "[a remplir]" ou obsoletes. Garder l'existant
intact sauf contradictions. Ne jamais ecraser la section Integration sans confirmation.

### Etape 5 — Confirmer

Diff compact des sections modifiees. Signaler sections necessitant verification manuelle.
