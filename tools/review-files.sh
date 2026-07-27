#!/usr/bin/env bash
# review-files.sh — inventaire des fichiers source d'une app, pour l'audit complet (/review --full).
# Sert de CHECKLIST : chaque fichier listé doit être passé au balayage 5 axes.
# Usage : review-files.sh [racine]   (defaut: repertoire courant)
#
# Sortie : "<lignes>\t<chemin>" trie par chemin, + un total. Respecte .gitignore si repo git
# (sinon find). Exclut vendor/node_modules/dist/build/min et fichiers non-source.
set -euo pipefail

root="${1:-.}"
cd "$root"

# Extensions source pertinentes (stack utilisateur + courant)
exts='php|js|jsx|ts|tsx|vue'
# Chemins/patterns a exclure du balayage
excl='/vendor/|/node_modules/|/dist/|/build/|/public/build/|/\.git/|\.min\.|\.d\.ts$|/coverage/'

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  list=$(git ls-files)
else
  list=$(find . -type f | sed 's|^\./||')
fi

files=$(printf '%s\n' "$list" \
  | grep -E "\.($exts)$" \
  | grep -Ev "$excl" \
  | sort)

total=0; count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  n=$(wc -l < "$f" 2>/dev/null || echo 0)
  printf '%6d\t%s\n' "$n" "$f"
  total=$((total + n)); count=$((count + 1))
done <<< "$files"

printf -- '---\n%d fichiers, %d lignes\n' "$count" "$total"
