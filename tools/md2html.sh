#!/usr/bin/env bash
# md2html.sh — convertit du markdown en HTML autonome stylé (thème doc-theme.css inliné).
# Usage :
#   md2html.sh [--open] <input.md> [output.html] [title]
#   md2html.sh [--open] -          [output.html] [title]   # lit le markdown sur stdin
# Options :
#   --open   ouvre le .html généré dans le navigateur par défaut (Windows)
# Sortie : chemin du .html écrit (affiché sur stdout).
set -euo pipefail

open=0
brand=""
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --open)  open=1; shift ;;
    --brand) brand="${2:?--brand requiert un dossier}"; shift 2 ;;
    *)       args+=("$1"); shift ;;
  esac
done
set -- "${args[@]}"

in="${1:?usage: md2html.sh [--open] [--brand <dir>] <input.md|-> [output.html] [title]}"
theme="$HOME/.claude/templates/doc-theme.css"

brand_args=()
if [ -n "$brand" ]; then
  [ -f "$brand/html-brand.css" ]  && brand_args+=(--css "$brand/html-brand.css")
  [ -f "$brand/html-brand.html" ] && brand_args+=(--include-before-body "$brand/html-brand.html")
fi

if [ "$in" = "-" ]; then
  src="-"; out="${2:-output.html}"; title="${3:-Document}"
else
  src="$in"; out="${2:-${in%.md}.html}"; title="${3:-$(basename "${in%.md}")}"
fi

mkdir -p "$(dirname "$out")"

pandoc "$src" -o "$out" \
  --standalone --embed-resources \
  --css "$theme" \
  "${brand_args[@]}" \
  --metadata pagetitle="$title" \
  --toc --toc-depth=3

echo "$out"

if [ "$open" -eq 1 ]; then
  win=$(cygpath -w "$out" 2>/dev/null || echo "$out")
  powershell.exe -NoProfile -Command "Start-Process '$win'" >/dev/null 2>&1 || true
fi
