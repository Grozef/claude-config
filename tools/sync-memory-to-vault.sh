#!/usr/bin/env bash
# Copie ~/.claude/projects/<slug>/memory/ vers $CLAUDE_VAULT/claude/memory/<slug>/.
# La source RESTE en place : c'est Claude Code qui la lit. Le vault n'est qu'une sauvegarde
# versionnee (depot prive), la memoire projet n'ayant pas sa place dans le depot public.
# Usage : sync-memory-to-vault.sh [--dry-run]
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
vault="${CLAUDE_VAULT:-}"
[ -n "$vault" ] && [ -d "$vault" ] || { echo "sync-memory: CLAUDE_VAULT absent ou introuvable (voir ~/.claude/vault.conf)" >&2; exit 1; }

dry=0; [ "${1:-}" = "--dry-run" ] && dry=1
dest="$vault/claude/memory"
n=0

for dir in "$HOME"/.claude/projects/*/memory; do
  [ -d "$dir" ] || continue
  slug=$(basename "$(dirname "$dir")")
  if [ "$dry" -eq 1 ]; then
    echo "  $slug ($(find "$dir" -type f | wc -l) fichiers)"
  else
    mkdir -p "$dest/$slug"
    cp -r "$dir"/. "$dest/$slug"/
  fi
  n=$((n + 1))
done

[ "$dry" -eq 1 ] && echo "sync-memory: $n projet(s) — rien ecrit (--dry-run)" || echo "sync-memory: $n projet(s) -> $dest"
