#!/usr/bin/env bash
# Copie dans le vault les CDC que les fiches projet ne font que REFERENCER par un chemin
# absolu : une reference vers un fichier d'un autre poste est inutilisable ici, et un CDC
# gitignore dans son repo ne vit que sur un disque.
#
# CDC SEULEMENT (decision du 2026-10-05) : les revues et recaps de fixes listent des
# failles, ils restent dans leur repo et ne sont que references (section `## Revues`).
#
# La copie est un INSTANTANE date, octet pour octet ; le repo reste la source. Une copie
# existante n'est jamais ecrasee : si la source a change depuis, c'est signale.
#
# Lit les chemins entre backticks de la section `## CDC` des notes projets/<dossier>/*.md,
# copie vers projets/<dossier>/livrables/<chemin apres /www/> et tient
# projets/<dossier>/livrables/MANIFEST.md.
#
# Un chemin introuvable tel quel est recherche sous $CLAUDE_WWW (vault.conf : racine des
# repos sur CE poste), a partir de ce qui suit son composant `/www/`.
#
# --refresh : remplace une copie dont la source a change (nouvelle version du CDC) et
# ajoute une ligne au manifeste ; l'ancienne ligne reste, l'ancienne copie est dans git.
#
# Usage : rapatrie-livrables.sh [--dry-run|--refresh] [<dossier de projets/>]
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
vault="${CLAUDE_VAULT:-}"
[ -n "$vault" ] && [ -d "$vault/projets" ] || { echo "rapatrie-livrables: CLAUDE_VAULT absent ou sans projets/ (voir ~/.claude/vault.conf)" >&2; exit 1; }
www="${CLAUDE_WWW:-}"

dry=0; refresh=0
case "${1:-}" in --dry-run) dry=1; shift ;; --refresh) refresh=1; shift ;; esac
only="${1:-}"
today=$(date +%Y-%m-%d)
copied=0; same=0; changed=0; missing=0; relative=0

for dir in "$vault"/projets/*/; do
  proj=$(basename "$dir")
  [ -z "$only" ] || [ "$only" = "$proj" ] || continue
  dest="${dir%/}/livrables"
  manifest="$dest/MANIFEST.md"

  for note in "$dir"*.md; do
    [ -f "$note" ] || continue
    while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      case "$ref" in
        [A-Za-z]:/*|/*) ;;
        "~/"*) ref="$HOME/${ref#\~/}" ;;
        *) echo "[SANS CHEMIN ABSOLU] $proj : $ref"; relative=$((relative+1)); continue ;;
      esac
      # Chemin dans le vault : ce qui suit /www/, sinon le seul nom du fichier.
      src="$ref"
      case "$ref" in
        */www/*) rel="${ref#*/www/}"; if [ ! -f "$src" ] && [ -n "$www" ]; then src="$www/$rel"; fi ;;
        *) rel="_hors-www/$(basename "$ref")" ;;
      esac
      if [ ! -f "$src" ]; then echo "[INTROUVABLE] $proj : $ref"; missing=$((missing+1)); continue; fi

      copy="$dest/$rel"
      sum=$(sha256sum "$src" | cut -d' ' -f1)
      if [ -f "$copy" ]; then
        if [ "$(sha256sum "$copy" | cut -d' ' -f1)" = "$sum" ]; then
          echo "[DEJA A JOUR] $proj : $rel"; same=$((same+1)); continue
        elif [ "$refresh" -eq 0 ]; then
          echo "[SOURCE MODIFIEE DEPUIS LA COPIE, non ecrasee] $proj : $rel"; changed=$((changed+1)); continue
        fi
      fi

      if [ "$dry" -eq 1 ]; then
        echo "[A COPIER] $proj : $rel ($(wc -c < "$src") octets)"; copied=$((copied+1)); continue
      fi
      srcdir=$(dirname "$src")
      if git -C "$srcdir" ls-files --error-unmatch "$src" >/dev/null 2>&1; then
        commit=$(git -C "$srcdir" log -1 --format=%h -- "$src")
      else
        commit="non suivi"
      fi
      mkdir -p "$(dirname "$copy")"
      cp "$src" "$copy"
      if [ ! -f "$manifest" ]; then
        printf '# CDC rapatries — [[%s]]\n\n> Instantanes dates, copies octet pour octet par `~/.claude/tools/rapatrie-livrables.sh`. Le repo reste la source : confronter avant de citer un etat.\n\n| Copie | Source | Commit | sha256 | Copie le |\n|---|---|---|---|---|\n' "$proj" > "$manifest"
      fi
      printf '| [%s](%s) | `%s` | %s | `%s` | %s |\n' "$rel" "${rel// /%20}" "$ref" "$commit" "$sum" "$today" >> "$manifest"
      echo "[COPIE] $proj : $rel"; copied=$((copied+1))
    done < <(awk '/^## CDC[[:space:]]*$/{s=1;next} /^## /{s=0} s' "$note" | tr -d '\r' | grep -oE '`[^`]+`' | tr -d '`' | grep -E '/|\.[A-Za-z0-9]+$' | sort -u)
  done
done

label="copie(s)"; [ "$dry" -eq 1 ] && label="a copier (--dry-run, rien ecrit)"
echo "rapatrie-livrables : $copied $label, $same deja a jour, $changed source(s) modifiee(s), $missing introuvable(s), $relative sans chemin absolu"
