#!/bin/bash
# Pointeur court anti-supposition injecte a chaque prompt. Le DETAIL et l'enforcement
# vivent desormais dans le gate bloquant stop-verify.js (negation nue / completion sans
# preuve / production non verifiee) -> on ne paie plus le paragraphe complet chaque tour.
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"never-assume : verifie la source (Read/Grep/Bash) avant toute assertion ; negation d'existence -> jamais nue (scope explicite ou recherche home+www+Desktop). Gate Stop bloquant actif."}}
EOF
