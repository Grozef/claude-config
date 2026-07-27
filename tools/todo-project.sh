#!/usr/bin/env bash
# Liste les items toDo NON coches du TODO global tagues pour le PROJET COURANT.
# Tag projet = basename du cwd, minuscule, tronque au premier _ ou -.
# Extrait dans un script pour que /session-start n'ait pas de $(...) inline
# (le verificateur de permissions refuse la substitution de commande dans les `!` du skill).
[ -f "$HOME/.claude/vault.conf" ] && . "$HOME/.claude/vault.conf"
TODO="${CLAUDE_VAULT:-}/TODO.md"
[ -f "$TODO" ] || { echo "(TODO.md introuvable)"; exit 0; }
tag=$(basename "$PWD" | tr 'A-Z' 'a-z' | sed 's/[_-].*//')
grep -in "^- \[ \].*\[\[$tag" "$TODO" 2>/dev/null || echo "(aucun item toDo tagué pour ce projet)"
