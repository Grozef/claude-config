#!/usr/bin/env bash
# Copie ~/.claude/projects/<slug>/memory/ vers $CLAUDE_VAULT/claude/memory/<slug>/.
# La source RESTE en place : c'est Claude Code qui la lit. Le vault n'est qu'une sauvegarde
# versionnee (depot prive), la memoire projet n'ayant pas sa place dans le depot public.
# Une source vide est sautee (pas de dossier vide cree dans le vault).
# --prune retire du vault les slugs sans memoire non vide sur CE poste. Le vault est partage
# entre postes : ne pas l'utiliser depuis un poste qui n'a pas toutes les memoires.
# Usage : sync-memory-to-vault.sh [--dry-run] [--prune]
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
vault="${CLAUDE_VAULT:-}"
[ -n "$vault" ] && [ -d "$vault" ] || { echo "sync-memory: CLAUDE_VAULT absent ou introuvable (voir ~/.claude/vault.conf)" >&2; exit 1; }

dry=0; prune=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry=1 ;;
    --prune) prune=1 ;;
    *) echo "sync-memory: option inconnue : $arg" >&2; exit 1 ;;
  esac
done
dest="$vault/claude/memory"
n=0; skipped=0; pruned=0
kept=" "

for dir in "$HOME"/.claude/projects/*/memory; do
  [ -d "$dir" ] || continue
  slug=$(basename "$(dirname "$dir")")
  files=$(find "$dir" -type f | wc -l)
  if [ "$files" -eq 0 ]; then skipped=$((skipped + 1)); continue; fi
  kept="$kept$slug "
  if [ "$dry" -eq 1 ]; then
    echo "  $slug ($files fichiers)"
  else
    mkdir -p "$dest/$slug"
    cp -r "$dir"/. "$dest/$slug"/
  fi
  n=$((n + 1))
done

if [ "$prune" -eq 1 ] && [ -d "$dest" ]; then
  for d in "$dest"/*/; do
    [ -d "$d" ] || continue
    slug=$(basename "$d")
    case "$kept" in *" $slug "*) continue ;; esac
    if [ "$dry" -eq 1 ]; then echo "  a retirer : $slug"; else rm -rf "$d"; fi
    pruned=$((pruned + 1))
  done
fi

msg="$n projet(s), $skipped source(s) vide(s) sautee(s)"
[ "$prune" -eq 1 ] && msg="$msg, $pruned slug(s) retire(s) du vault"
[ "$dry" -eq 1 ] && echo "sync-memory: $msg — rien ecrit (--dry-run)" || echo "sync-memory: $msg -> $dest"
