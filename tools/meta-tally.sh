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
dec=("$meta/decisions-recurrentes.md" "$meta"/archive-decisions-[0-9]*.md)

# Tags de navigation / structurels exclus du classement cause-racine.
EXCLUDE='claude|obsidian|INDEX'

# Inline code (`...`) is skipped: Obsidian does not turn a [[link]] written as code into a link
# Fichiers absents ignores et grep sans resultat tolere : sinon sed (2) ou grep (1) sortaient en erreur
# et pipefail + set -e coupait le script (erreurs.md absent, meta/ vide, aucun tag)
tags() {
  local f a=(); for f in "$@"; do [ -f "$f" ] && a+=("$f"); done
  [ ${#a[@]} -gt 0 ] || return 0
  sed 's/`[^`]*`//g' "${a[@]}" | { grep -oE '\[\[[^]]+\]\]' || true; } | sed 's/^\[\[//; s/\]\]$//'
}
rank() { { grep -viE "^($EXCLUDE)$" || true; } | sort | uniq -c | sort -rn | head -n "$topN"; }

echo "== META-TALLY : $meta =="
echo "-- volumétrie (entrées ##) --"
count() { [ $# -gt 0 ] || { echo 0; return; }; cat "$@" 2>/dev/null | grep -cE '^## ' || true; }
[ -f "${err[0]}" ] && printf "  %-26s %s entrées (dont %s archivées)\n" "erreurs.md" "$(count "${err[@]}")" "$(count "${err[@]:1}")"
[ -f "${lea[0]}" ] && printf "  %-26s %s entrées (dont %s archivées)\n" "learnings.md" "$(count "${lea[@]}")" "$(count "${lea[@]:1}")"
[ -f "${dec[0]}" ] && printf "  %-26s %s entrées (dont %s archivées)\n" "decisions-recurrentes.md" "$(count "${dec[@]}")" "$(count "${dec[@]:1}")"

echo
echo "-- TOP $topN causes-racines dans erreurs.md + archives (signal de défaillance -> prochain gate) --"
if [ -f "${err[0]}" ]; then tags "${err[@]}" | rank | sed 's/^/  /'; else echo "  (erreurs.md absent)"; fi

echo
echo "-- TOP $topN tags toutes sources (erreurs+learnings+decisions, archives comprises) --"
tags "${err[@]}" "${lea[@]}" "${dec[@]}" | rank | sed 's/^/  /'

echo
echo "-- TAUX D'ECHAPPEMENT par quinzaine (ligne 'Detecte :' des erreurs, format : meta/INDEX.md) --"
# Echappe = trouve par la reverification demandee ou par l'utilisateur ; 'indetermine' sort du denominateur.
# Un mode hors de la liste de meta/INDEX.md (« moi », « suite »...) et une entree sans ligne Detecte
# sortent aussi du denominateur mais sont COMPTES : avant le 2026-10-24 ils etaient soit au denominateur
# sans jamais compter comme echappes, soit invisibles (41 des 61 erreurs du 16 au 24/10 sans Detecte).
if [ -f "${err[0]}" ]; then
  cat "${err[@]}" | tr -d '\r' | awk '
    BEGIN { split("avant-livraison gate relecteur apres-livraison reverif-demandee utilisateur indetermine", L, " "); for (k in L) ok[L[k]] = 1 }
    /^## [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] / { q = substr($2, 1, 7) (substr($2, 9, 2) + 0 <= 15 ? " 01-15" : " 16-fin"); c[q]++; seen[q] = 1; next }
    /^Detecte : / && q != "" { if ($3 in ok) { n[q, $3]++; if ($3 != "indetermine") t[q]++ } else h[q]++; d[q]++; q = "" }
    END {
      for (q in seen) {
        if (!d[q]) continue   # quinzaine anterieure a la ligne Detecte (posee depuis le 2026-09-14)
        e = n[q, "reverif-demandee"] + n[q, "utilisateur"]
        printf "  %s : %d/%d echappes (%.0f %%) | avant %d, gate %d, relecteur %d, apres %d, reverif %d, utilisateur %d, indetermine %d | hors liste %d, sans Detecte %d/%d\n", \
          q, e, t[q], (t[q] ? 100 * e / t[q] : 0), n[q, "avant-livraison"], n[q, "gate"], n[q, "relecteur"], \
          n[q, "apres-livraison"], n[q, "reverif-demandee"], n[q, "utilisateur"], n[q, "indetermine"], h[q], c[q] - d[q], c[q]
      }
    }' | sort
else echo "  (erreurs.md absent)"; fi

echo
echo "-- WIKILINKS ORPHELINS (tag sans note .md NULLE PART dans le vault) --"
# Obsidian resout un [[lien]] vers n'importe quel <lien>.md du vault (pas seulement concepts/).
vault_root="$(dirname "$meta")"
allnotes="$(find "$vault_root" -name '*.md' -not -path '*/node_modules/*' -printf '%f\n' | sed 's/\.md$//' | sort -u)"
orph=0
while read -r t; do
  [ -z "$t" ] && continue
  printf '%s\n' "$allnotes" | grep -qixF "$t" || { echo "  [ORPHELIN] $t"; orph=$((orph+1)); }
done < <(tags "${err[@]}" "${lea[@]}" "${dec[@]}" | grep -viE "^($EXCLUDE)$" | sort -u)
[ "$orph" -eq 0 ] && echo "  (aucun)"
echo "== fin tally =="
