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

# Un journal = son fichier actif + ses archives (entrees anterieures au mois precedent,
# sorties par /review-meta). Une entree archivee compte autant qu'une autre : sans elles
# le classement ne porterait que sur deux mois.
shopt -s nullglob
err=("$meta/erreurs.md" "$meta"/archive-erreurs-[0-9]*.md)
lea=("$meta/learnings.md" "$meta"/archive-[0-9]*.md)
dec="$meta/decisions-recurrentes.md"

# Tags de navigation / structurels exclus du classement cause-racine.
EXCLUDE='claude|obsidian|INDEX'

tags() { grep -ohE '\[\[[^]]+\]\]' "$@" 2>/dev/null | sed 's/^\[\[//; s/\]\]$//'; }
rank() { grep -viE "^($EXCLUDE)$" | sort | uniq -c | sort -rn | head -n "$topN"; }

echo "== META-TALLY : $meta =="
echo "-- volumétrie (entrées ##) --"
count() { [ $# -gt 0 ] || { echo 0; return; }; cat "$@" 2>/dev/null | grep -cE '^## ' || true; }
[ -f "${err[0]}" ] && printf "  %-26s %s entrées (dont %s archivées)\n" "erreurs.md" "$(count "${err[@]}")" "$(count "${err[@]:1}")"
[ -f "${lea[0]}" ] && printf "  %-26s %s entrées (dont %s archivées)\n" "learnings.md" "$(count "${lea[@]}")" "$(count "${lea[@]:1}")"
[ -f "$dec" ] && printf "  %-26s %s entrées\n" "decisions-recurrentes.md" "$(count "$dec")"

echo
echo "-- TOP $topN causes-racines dans erreurs.md + archives (signal de défaillance -> prochain gate) --"
if [ -f "${err[0]}" ]; then tags "${err[@]}" | rank | sed 's/^/  /'; else echo "  (erreurs.md absent)"; fi

echo
echo "-- TOP $topN tags toutes sources (erreurs+learnings+decisions, archives comprises) --"
tags "${err[@]}" "${lea[@]}" "$dec" | rank | sed 's/^/  /'

echo
echo "-- WIKILINKS ORPHELINS (tag sans note .md NULLE PART dans le vault) --"
# Obsidian resout un [[lien]] vers n'importe quel <lien>.md du vault (pas seulement concepts/).
vault_root="$(dirname "$meta")"
allnotes="$(find "$vault_root" -name '*.md' -not -path '*/node_modules/*' -printf '%f\n' | sed 's/\.md$//' | sort -u)"
orph=0
while read -r t; do
  [ -z "$t" ] && continue
  printf '%s\n' "$allnotes" | grep -qixF "$t" || { echo "  [ORPHELIN] $t"; orph=$((orph+1)); }
done < <(tags "${err[@]}" "${lea[@]}" "$dec" | grep -viE "^($EXCLUDE)$" | sort -u)
[ "$orph" -eq 0 ] && echo "  (aucun)"
echo "== fin tally =="
