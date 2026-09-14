#!/usr/bin/env bash
# Liste les items toDo NON coches du TODO global tagues pour le PROJET COURANT.
#
# Le tag n'est PLUS derive du basename. L'ancienne heuristique (minuscule, tronquee au
# premier _ ou -) avait deux defauts muets : un dossier dont le nom ne prefixe pas son
# tag rendait 0 item — "rien a faire" alors qu'il en portait une vingtaine — et un
# dossier au prefixe court captait les items d'un AUTRE projet partageant ce prefixe.
# Constate le 2026-09-08 sur trois projets a la fois. Une liste vide se lisant
# "rien a faire", c'est exactement l'incident que ce script est cense empecher.
#
# Correspondance dossier -> tag(s) : ~/.claude/todo-map.conf (non versionne,
# voir todo-map.conf.example). Extrait dans un script pour que /context-update
# n'ait pas de $(...) inline (le verificateur de permissions refuse la
# substitution de commande dans les `!` du skill).

[ -f "$HOME/.claude/vault.conf" ] && . "$HOME/.claude/vault.conf"
TODO="${CLAUDE_VAULT:-}/TODO.md"
[ -f "$TODO" ] || { echo "(TODO.md introuvable)"; exit 0; }

MAPCONF="$HOME/.claude/todo-map.conf"
if [ ! -f "$MAPCONF" ]; then
  echo "(todo-map.conf absent — aucune correspondance dossier -> tag, le toDo projet n'est PAS charge ; copier todo-map.conf.example)"
  exit 0
fi
declare -A TODO_MAP=()
. "$MAPCONF"

# Dossier courant, puis son parent (front/, backend/, app/... d'un monorepo).
here=$(basename "$PWD")
tags="${TODO_MAP[$here]}"
if [ -z "$tags" ]; then
  parent=$(basename "$(dirname "$PWD")")
  tags="${TODO_MAP[$parent]}"
  here="$parent"
fi

if [ -z "$tags" ]; then
  echo "(aucune correspondance pour « $(basename "$PWD") » dans todo-map.conf — le toDo projet n'est PAS charge, ce n'est pas une absence de taches)"
  exit 0
fi

# Tag cherche EN ENTIER : [[tag]], jamais en prefixe.
# grep -E obligatoire : en BRE le | de l'alternance est un caractere LITTERAL, donc un
# dossier declarant plusieurs tags ne remontait que le premier et pouvait rendre 0 item
# alors qu'un de ses autres tags en portait. Constate le 2026-09-08.
alt=""
for t in $tags; do alt="${alt:+$alt|}\[\[$t\]\]"; done
grep -Ein "^- \[ \].*($alt)" "$TODO" 2>/dev/null \
  || echo "(aucun item toDo non coche pour [$tags])"
