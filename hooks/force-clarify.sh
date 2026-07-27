#!/bin/bash
# UserPromptSubmit : detecte taches de production et force CLARIFY-FIRST.
# Cible la regle never-assume : poser des questions au lieu de supposer.

INPUT=$(cat /dev/stdin)
PROMPT=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{console.log((JSON.parse(d).prompt||'').toLowerCase())}catch(e){}")

# Verbes d'action complexe (sans accents pour robustesse locale)
# Normalisation accents minimale via tr
PROMPT_NORM=$(echo "$PROMPT" | sed 's/[éèêë]/e/g; s/[àâä]/a/g; s/[îï]/i/g; s/[ôö]/o/g; s/[ûüù]/u/g; s/ç/c/g')

if echo "$PROMPT_NORM" | grep -qE '(ajoute|ajouter|fix|fixe|refactor|implement|corrige|corriger|modifie|modifier|debug|ecris|ecrire|cree |creer |reecris|nettoie|nettoyer|optimise|optimiser|migre |migrer|setup|configure|configurer|deploi|installe|installer|remplace|remplacer|supprime|supprimer|enleve|enlever|met [a]?\s*jour|update|integre|integrer|change la|change le|change les)'; then
  cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"PRODUCTION -> CLARIFY-FIRST : avant tout Edit/Write/Bash producteur, cite les fichiers lus pour le contexte et pose >=1 question si une info critique manque (forme de donnee, comportement, perimetre). Trivial (1 ligne, fichier deja lu) : cite juste le Read."}}
EOF
fi
