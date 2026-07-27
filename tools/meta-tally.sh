#!/usr/bin/env bash
# meta-tally.sh — tally DÉTERMINISTE de récurrence des causes-racines dans meta/.
# Classe les tags [[...]] par fréquence pour cibler objectivement le prochain GATE à construire.
# Le signal de défaillance = erreurs.md (+ learnings) ; on ignore les tags de navigation.
#
# Usage : meta-tally.sh [dossier-meta] [topN]
#   défaut dossier : $CLAUDE_VAULT/meta (voir vault.conf)   défaut topN : 15
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
meta="${1:-${CLAUDE_VAULT:-}/meta}"
topN="${2:-15}"
[ -d "$meta" ] || { echo "meta-tally: dossier introuvable: $meta" >&2; exit 1; }

err="$meta/erreurs.md"
lea="$meta/learnings.md"
dec="$meta/decisions-recurrentes.md"

# Tags de navigation / structurels exclus du classement cause-racine.
EXCLUDE='claude|obsidian|INDEX'

tags() { grep -ohE '\[\[[^]]+\]\]' "$@" 2>/dev/null | sed 's/^\[\[//; s/\]\]$//'; }
rank() { grep -viE "^($EXCLUDE)$" | sort | uniq -c | sort -rn | head -n "$topN"; }

echo "== META-TALLY : $meta =="
echo "-- volumétrie (entrées ##) --"
for f in "$err" "$lea" "$dec"; do
  [ -f "$f" ] && printf "  %-26s %s entrées\n" "$(basename "$f")" "$(grep -cE '^## ' "$f")"
done

echo
echo "-- TOP $topN causes-racines dans erreurs.md (signal de défaillance -> prochain gate) --"
if [ -f "$err" ]; then tags "$err" | rank | sed 's/^/  /'; else echo "  (erreurs.md absent)"; fi

echo
echo "-- TOP $topN tags toutes sources (erreurs+learnings+decisions) --"
tags "$err" "$lea" "$dec" | rank | sed 's/^/  /'

echo
echo "-- WIKILINKS ORPHELINS (tag sans note .md NULLE PART dans le vault) --"
# Obsidian resout un [[lien]] vers n'importe quel <lien>.md du vault (pas seulement concepts/).
vault_root="$(dirname "$meta")"
allnotes="$(find "$vault_root" -name '*.md' -not -path '*/node_modules/*' -printf '%f\n' | sed 's/\.md$//' | sort -u)"
orph=0
while read -r t; do
  [ -z "$t" ] && continue
  printf '%s\n' "$allnotes" | grep -qixF "$t" || { echo "  [ORPHELIN] $t"; orph=$((orph+1)); }
done < <(tags "$err" "$lea" "$dec" | grep -viE "^($EXCLUDE)$" | sort -u)
[ "$orph" -eq 0 ] && echo "  (aucun)"
echo "== fin tally =="
