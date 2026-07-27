#!/bin/bash
# PreToolUse Write : warning si fichier cible volumineux (>500 lignes) -> prefere Edit.
# Lit stdin (readFileSync 0, pas /dev/stdin).
FILE=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).file_path||'')}catch(e){}")
if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  LINES=$(wc -l < "$FILE" 2>/dev/null || echo 0)
  if [ "$LINES" -gt 500 ]; then
    echo "WARNING: $FILE contient $LINES lignes. Prefere Edit pour modifier plutot que reecrire entierement."
  fi
fi
