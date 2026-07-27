#!/bin/bash
MODIFIED=$(git diff --name-only 2>/dev/null | grep -c "src/data/arcs/" 2>/dev/null)
if [ "$MODIFIED" -gt 0 ]; then
  echo "${MODIFIED} fichier(s) narratif(s) modifies -- /update-canon recommande"
fi

DEC=DECISIONS.md; [ -f documentation_claude/DECISIONS.md ] && DEC=documentation_claude/DECISIONS.md; [ -f docs/documentation_claude/DECISIONS.md ] && DEC=docs/documentation_claude/DECISIONS.md
if [ -f "$DEC" ]; then
  DLINES=$(wc -l < "$DEC" 2>/dev/null || echo 0)
  if [ "$DLINES" -gt 50 ]; then
    echo "WARNING: DECISIONS.md volumineux ($DLINES lignes) -- lance /clean-context pour alleger"
  fi
fi
