#!/bin/bash
CMD=$(node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log(((JSON.parse(d).tool_input)||{}).command||'')}catch(e){}")
if echo "$CMD" | grep -q 'content-editor'; then
  echo "Noeud insere -- /update-canon si nouveaux faits etablis"
fi
