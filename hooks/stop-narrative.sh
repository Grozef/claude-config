#!/bin/bash
# Garde de projet (2026-09-04) : ce hook est declare sur le Stop GLOBAL mais ne concerne
# que les depots portant un corpus narratif. Sans cette sortie anticipee il lancait deux
# commandes git a chaque fin de tour dans tous les projets, pour un resultat toujours nul.
[ -d src/data/arcs ] || exit 0
MODIFIED=$(git diff --name-only 2>/dev/null | grep -c "src/data/arcs/" 2>/dev/null)
NEUFS=$(git status --porcelain -uall 2>/dev/null | grep -c "^?? src/data/arcs/.*\.ts" 2>/dev/null)
TOUCHES=$(( MODIFIED + NEUFS ))

if [ "$TOUCHES" -gt 0 ]; then
  # Gate bloquant : uniquement sur les noeuds que CETTE session a touches (--changed).
  # Le corpus herite porte de la dette ; on ne bloque pas dessus, on bloque sur ce qu'on vient d'ecrire.
  if [ -f tools/lint-narrative.ts ]; then
    RAPPORT=$(npx tsx tools/lint-narrative.ts --changed --errors-only 2>/dev/null)
    if [ $? -ne 0 ]; then
      printf 'INCOHERENCE NARRATIVE INTRODUITE (hook lint-narrative) :\n\n%s\n\n' "$RAPPORT" >&2
      printf 'Corrige ces erreurs avant de conclure, ou dis explicitement pourquoi elles sont acceptables.\n' >&2
      printf 'Detail complet : npx tsx tools/lint-narrative.ts --changed\n' >&2
      exit 2
    fi
  fi
  echo "${TOUCHES} fichier(s) narratif(s) modifies -- /update-canon recommande"
fi

DEC=DECISIONS.md; [ -f documentation_claude/DECISIONS.md ] && DEC=documentation_claude/DECISIONS.md; [ -f docs/documentation_claude/DECISIONS.md ] && DEC=docs/documentation_claude/DECISIONS.md
if [ -f "$DEC" ]; then
  DLINES=$(wc -l < "$DEC" 2>/dev/null || echo 0)
  if [ "$DLINES" -gt 50 ]; then
    echo "WARNING: DECISIONS.md volumineux ($DLINES lignes) -- lance /clean-context pour alleger"
  fi
fi
