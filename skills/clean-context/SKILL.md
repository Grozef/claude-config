---
name: clean-context
description: |
  Nettoie DECISIONS.md, CONTEXT.md et audite les CLAUDE.md du projet. Garde les fichiers de contexte legers.
  TRIGGER when: "clean-context", "audit-claude-md", "nettoie le contexte", "verifie les CLAUDE.md", DECISIONS.md > 50 lignes
allowed-tools: Read, Edit, Bash
model: claude-haiku-4-5-20251001
---

# Skill : clean-context
# Invocation : /clean-context ou /audit-claude-md (alias)

## Etapes

> Le trio de contexte vit dans `documentation_claude/` (reorg 2026-07-17), fallback racine
> si non migré. `DECISIONS.md`/`CONTEXT.md` ci-dessous = `documentation_claude/<fichier>` s'il
> existe, sinon `<fichier>` à la racine. Les `CLAUDE.md` restent à la racine (ne pas déplacer).

1. **Nettoyer DECISIONS.md** si > 20 lignes :
   - Garder les 5 entrees les plus recentes
   - Comprimer les anciennes en 1 ligne : `- [DATE] [titre] : [decision en 10 mots]`
   - Limite finale : 40 lignes max

2. **Nettoyer CONTEXT.md** si > 40 lignes :
   - Supprimer sections vides ou redondantes
   - Limite finale : 40 lignes max

3. **Auditer les CLAUDE.md** du projet :
   ```bash
   find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/vendor/*" | xargs wc -l 2>/dev/null
   ```
   - <= 30 lignes : OK
   - 31-50 lignes : WARN — proposer compression
   - > 50 lignes : CRITIQUE — compresser (supprimer regles deja dans CLAUDE.md global, listes > 5 items, commentaires)

4. **Confirmer** : `Contexte nettoye — DECISIONS: X->Y, CONTEXT: X->Y, CLAUDE.md: N fichiers (X warns)`
