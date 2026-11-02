#!/usr/bin/env bash
# trash.sh — corbeille des suppressions faites par Claude (hooks/pre-trash.js refuse rm/rmdir/del/Remove-Item
# et renvoie ici). Chaque appel cree un lot ; les lots de plus de 48 h sont purges au SessionStart.
# Usage : trash.sh <chemin>...   deplace vers $CLAUDE_TRASH/<horodatage>-<pid>/<chemin absolu>
#         trash.sh --list        lots presents et chemins d'origine (MANIFEST de chaque lot)
#         trash.sh --purge       supprime les lots de plus de 48 h
# Restaurer : mv "<chemin stocke>" "<chemin d'origine>" (les deux colonnes de --list).
# Corbeille HORS de ~/.claude : ce depot est public, un trash/ absent du .gitignore partirait au push.
set -u
TRASH="${CLAUDE_TRASH:-$HOME/.claude-trash}"

case "${1:-}" in
  --purge)
    [ -d "$TRASH" ] && find "$TRASH" -mindepth 1 -maxdepth 1 -type d -mmin +2880 -exec rm -rf {} +
    exit 0 ;;
  --list)
    for m in "$TRASH"/*/MANIFEST; do
      [ -f "$m" ] || continue
      echo "== $(basename "$(dirname "$m")")"
      cat "$m"
    done
    exit 0 ;;
  ''|-h|--help)
    echo "usage : trash.sh <chemin>... | --list | --purge" >&2; exit 2 ;;
esac

LOT="$TRASH/$(date +%Y%m%d-%H%M%S)-$$"
rc=0
for p in "$@"; do
  if [ ! -e "$p" ] && [ ! -L "$p" ]; then echo "trash : introuvable : $p" >&2; rc=1; continue; fi
  abs=$(cygpath -ua "$p" 2>/dev/null || realpath -s "$p")
  win=$(cygpath -ma "$p" 2>/dev/null || echo "$abs")
  dest="$LOT$abs"
  if mkdir -p "$(dirname "$dest")" && mv -- "$p" "$dest"; then
    printf '%s\t%s\n' "$win" "$dest" >> "$LOT/MANIFEST"
    echo "corbeille : $win"
  else
    echo "trash : echec : $p" >&2; rc=1
  fi
done
exit $rc
