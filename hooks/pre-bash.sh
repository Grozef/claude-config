#!/bin/bash
# PreToolUse Bash : warning si commande verbeuse sans bornage.
# Lit le JSON Claude Code via stdin (readFileSync 0, pas /dev/stdin cassse sur Windows).
CMD=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).command||'')}catch(e){}")

if echo "$CMD" | grep -qE '(^|\s)(git log|git diff)([^-]|$)' && ! echo "$CMD" | grep -qE '\-n[[:space:]]*[0-9]|--max-count'; then
  echo "WARNING: git log/diff sans limite. Ajoute -n 20 ou -- <fichier> pour borner la sortie."
fi

if echo "$CMD" | grep -qE '(^|\s)(find\s+\.?/)[^|]*$' && ! echo "$CMD" | grep -qE 'maxdepth|-l'; then
  echo "WARNING: find sans -maxdepth. Risque de sortie massive."
fi

if echo "$CMD" | grep -qE '(composer show|npm list|pip list|yarn list)([^|]|$)' && ! echo "$CMD" | grep -qE '\-\-'; then
  echo "WARNING: commande verbeuse sans filtre. Ajoute un grep ou un argument de filtrage."
fi
