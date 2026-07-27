---
name: pre-task
description: |
  Avant une tâche complexe, liste les fichiers qu'il compte lire et demande confirmation avant de consommer des tokens. Évite les lectures exploratoires en cascade.
  TRIGGER when: "pre-task", tâche complexe impliquant plusieurs fichiers inconnus, "quels fichiers tu vas lire ?", avant un refactor ou debug multi-fichiers
allowed-tools: Glob, Grep, Bash
---

# Skill : pre-task
# Invocation : /pre-task [description de la tâche]

**Tâche :** $ARGUMENTS

## Étapes

1. **Explorer sans lire** — identifier les fichiers probablement nécessaires :
   - Glob sur les patterns liés à la tâche
   - Grep sur les noms de classes/fonctions mentionnés
   - Lister les fichiers trouvés avec leur taille estimée (`wc -l`)

2. **Présenter le plan de lecture** :
```
Fichiers prévus pour cette tâche :
- path/to/file.php (~120 lignes) — [raison]
- path/to/other.vue (~80 lignes) — [raison]

Total estimé : ~200 lignes (~3 000 tokens)

Confirme pour démarrer, ou précise ce que tu veux exclure.
```

3. **Attendre confirmation** avant toute lecture.

## Règles
- Ne jamais lire un fichier dans cette phase — Glob/Grep uniquement
- Si > 5 fichiers identifiés : regrouper par module et demander lesquels prioriser
- Estimation tokens : lignes × 15
