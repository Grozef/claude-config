---
name: update-canon
model: claude-haiku-4-5-20251001
description: |
  Met à jour creation/CONTINUITE.md avec les nouveaux faits établis après une session d'écriture.
  TRIGGER when: "update-canon", "mets à jour le canon", "j'ai écrit une scène", fin de session d'écriture
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# Skill : update-canon
# Invocation : /update-canon [résumé optionnel des changements]

!`cat creation/CONTINUITE.md 2>/dev/null || echo "⚠ creation/CONTINUITE.md absent — lancer /init-creation d'abord"`

---

**Contexte fourni :** $ARGUMENTS

## Étapes

1. **Identifie les fichiers narratifs modifiés récemment.**
   ```
   git diff --name-only HEAD~1 HEAD 2>/dev/null || git status --short 2>/dev/null
   ```
   Lis les fichiers narratifs modifiés pour en extraire les nouveaux faits.

2. **Repère ce qui est nouveau** par rapport à ce qui est déjà dans CONTINUITE.md :
   - Nouveaux faits établis sur les personnages
   - Nouvelles phrases canoniques (formules importantes dites dans les scènes)
   - Nouveaux flags ou variables d'état activés
   - Évolutions de relations entre personnages
   - Nouveaux éléments de chronologie
   - Nouveaux assets ou médias référencés

3. **Ne supprime rien** de l'existant sauf si un fait est explicitement contredit.
   En cas de contradiction : `~~ancien fait~~ → nouveau fait (référence scène)`.

4. **Présente un résumé** de ce qui va être ajouté. Attendre confirmation si les ajouts sont importants.

5. **Mets à jour `creation/CONTINUITE.md`** :
   - Ajouter dans la section du personnage concerné
   - Ajouter les phrases canoniques
   - Mettre à jour la date en tête de fichier
   - Ajouter une entrée dans le journal des sessions
