---
name: update-canon
description: |
  Met à jour creation/CONTINUITE.md avec les nouveaux faits établis après une session d'écriture.
  TRIGGER when: "update-canon", "mets à jour le canon", "j'ai écrit une scène", fin de session d'écriture
allowed-tools: Read, Edit, Glob, Grep, Bash
effort: low
---

# Skill : update-canon — `/update-canon [résumé]`

!`cat creation/CONTINUITE.md 2>/dev/null || echo "⚠ creation/CONTINUITE.md absent — lancer /init-creation d'abord"`

**Contexte fourni :** $ARGUMENTS

1. **Repérer les fichiers narratifs modifiés** : `git diff --name-only HEAD~1 HEAD 2>/dev/null || git status --short 2>/dev/null`, puis les lire pour en extraire les faits.
2. **Isoler ce qui est NOUVEAU** par rapport à CONTINUITE.md : faits établis sur les personnages, phrases canoniques, flags ou variables d'état activés, évolutions de relations, chronologie, assets et médias référencés.
3. **Ne rien supprimer** de l'existant sauf contradiction explicite. En cas de contradiction : `~~ancien fait~~ → nouveau fait (référence scène)`.
4. **Présenter un résumé** des ajouts. Attendre confirmation s'ils sont importants.
5. **Écrire dans `creation/CONTINUITE.md`** : ajouts dans la section du personnage concerné, phrases canoniques, date en tête de fichier, entrée au journal des sessions.
