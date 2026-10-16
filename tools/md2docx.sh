#!/usr/bin/env bash
# md2docx.sh — convertit du markdown en .docx via pandoc (style par défaut, ou --ref <docx>).
# Usage :
#   md2docx.sh [--open] [--ref <ref.docx>] <input.md> [output.docx]
#   md2docx.sh [--open] [--ref <ref.docx>] -          [output.docx]   # lit le markdown sur stdin
# Options :
#   --open   ouvre le .docx généré dans l'app par défaut (Windows)
#   --ref    reference-doc pandoc (styles, en-tête, pied de page), sans table des matières
# Sortie : chemin du .docx écrit (affiché sur stdout).
set -euo pipefail

open=0
ref=""
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --open) open=1; shift ;;
    --ref)  ref="${2:?--ref requiert un .docx}"; shift 2 ;;
    *)      args+=("$1"); shift ;;
  esac
done
set -- "${args[@]}"

in="${1:?usage: md2docx.sh [--open] [--ref <ref.docx>] <input.md|-> [output.docx]}"

if [ "$in" = "-" ]; then
  src="-"; out="${2:-output.docx}"
else
  src="$in"; out="${2:-${in%.md}.docx}"
fi

mkdir -p "$(dirname "$out")"

# Images relatives au .md (ex : diagrammes du skill cdc) : cherchées d'abord à côté du .md.
# Séparateur de chemins pandoc : ';' sous Windows, ':' ailleurs.
sep=":"; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) sep=";" ;; esac
respath="."; [ "$src" != "-" ] && respath="$(dirname "$src")${sep}."

if [ -n "$ref" ]; then
  [ -f "$ref" ] || { echo "md2docx.sh: reference-doc introuvable: $ref" >&2; exit 1; }
  # --columns=1 : pandoc ne lit les largeurs relatives (tirets du séparateur) que pour un
  # tableau dont une ligne dépasse --columns ; à 1, tous les tableaux les reçoivent.
  pandoc "$src" -o "$out" \
    --resource-path "$respath" \
    --columns=1 \
    --reference-doc "$(cygpath -w "$ref" 2>/dev/null || echo "$ref")"
else
  pandoc "$src" -o "$out" \
    --resource-path "$respath" \
    --toc --toc-depth=3
fi

echo "$out"

if [ "$open" -eq 1 ]; then
  win=$(cygpath -w "$out" 2>/dev/null || echo "$out")
  powershell.exe -NoProfile -Command "Start-Process '$win'" >/dev/null 2>&1 || true
fi
