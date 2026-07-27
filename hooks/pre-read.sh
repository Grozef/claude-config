#!/bin/bash
FILE=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).file_path||'')}catch(e){}")
if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  LINES=$(wc -l < "$FILE" 2>/dev/null || echo 0)
  if [ "$LINES" -gt 200 ]; then
    echo "WARNING: $FILE contient $LINES lignes. Precise les parametres offset/limit pour ne lire que la plage utile."
  fi
fi
