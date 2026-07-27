---
name: summarize-session
description: |
  Resume de fin de session ou log d'une decision ponctuelle. Ecrit dans DECISIONS.md.
  TRIGGER when: "summarize-session", "resume la session", "decision-log", "log cette decision", "note ce choix", fin de session
allowed-tools: Read, Edit, Bash
model: claude-haiku-4-5-20251001
---

# Skill : summarize-session
# Invocation : /summarize-session [theme] ou /decision-log [decision]

**Contexte :** $ARGUMENTS

## Mode

- Si invoque comme `/decision-log` ou avec une decision specifique → mode **decision** (etape 2b)
- Sinon → mode **resume** (etape 2a)

## Etapes

1. **Collecter** (ne pas afficher) :
   - `git diff --name-only 2>/dev/null` + `git log --oneline -5 2>/dev/null`
   - Lire `documentation_claude/SESSION.md` (fallback `SESSION.md`) si present

2a. **Mode resume** :
```
## Session [DATE] -- [theme]
### Fait
- [actions]
### Decisions
- [decision + raison en 1 ligne]
### Prochaine session
- [prochaine etape]
```

2b. **Mode decision** — construire l'entree :
```
## [DATE] -- [titre court 5-8 mots]
Decision : [ce qui a ete choisi]
Raison : [pourquoi]
Impact : [ce que ca change]
```

3. **Ecrire en tete de `documentation_claude/DECISIONS.md`** (fallback `DECISIONS.md` si le projet a encore le trio à la racine ; creer dans `documentation_claude/` si absent). Garder max 5 entrees.

4. **Confirmer** : `Session resumee → DECISIONS.md [N lignes]` ou `Decision enregistree -- [titre]`
