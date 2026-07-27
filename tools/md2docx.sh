#!/usr/bin/env bash
# md2docx.sh — convertit du markdown en .docx via pandoc (style par défaut, SANS reference-doc).
# Choix délibéré : pas de Word COM, pas de reference-doc stylé (voie qui a brûlé 3 sessions, 2026-06-04/05).
# Usage :
#   md2docx.sh [--open] <input.md> [output.docx]
#   md2docx.sh [--open] -          [output.docx]   # lit le markdown sur stdin
# Options :
#   --open   ouvre le .docx généré dans l'app par défaut (Windows)
# Sortie : chemin du .docx écrit (affiché sur stdout).
set -euo pipefail

open=0
args=()
for a in "$@"; do
  if [ "$a" = "--open" ]; then open=1; else args+=("$a"); fi
done
set -- "${args[@]}"

in="${1:?usage: md2docx.sh [--open] <input.md|-> [output.docx]}"

if [ "$in" = "-" ]; then
  src="-"; out="${2:-output.docx}"
else
  src="$in"; out="${2:-${in%.md}.docx}"
fi

mkdir -p "$(dirname "$out")"

pandoc "$src" -o "$out" \
  --toc --toc-depth=3

echo "$out"

if [ "$open" -eq 1 ]; then
  win=$(cygpath -w "$out" 2>/dev/null || echo "$out")
  powershell.exe -NoProfile -Command "Start-Process '$win'" >/dev/null 2>&1 || true
fi
