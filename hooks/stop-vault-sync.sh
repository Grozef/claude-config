#!/bin/bash
# Sync BIDIRECTIONNEL projet <-> vault Obsidian au stop de session
# 1. Vault -> projet : si vault plus recent
# 2. Projet -> vault : si projet plus recent

# Config locale non versionnee (voir vault.conf.example / vault-map.conf.example)
[ -f "$HOME/.claude/vault.conf" ] && . "$HOME/.claude/vault.conf"
VAULT="${CLAUDE_VAULT:-}"
[ -n "$VAULT" ] && [ -d "$VAULT" ] || exit 0

CWD=$(pwd)

# Ne rien faire si on est deja dans le vault.
# pwd rend la forme unix (/c/...) alors que la conf porte la forme Windows (C:/...) -> tester les deux.
VAULT_U="$VAULT"
command -v cygpath >/dev/null 2>&1 && VAULT_U=$(cygpath -u "$VAULT" 2>/dev/null || echo "$VAULT")
case "$CWD" in
  "$VAULT"*|"$VAULT_U"*) exit 0 ;;
esac

# Mapping dossier -> nom vault (declare -A MAP)
[ -f "$HOME/.claude/vault-map.conf" ] || exit 0
declare -A MAP=()
. "$HOME/.claude/vault-map.conf"

# Trouver le nom vault a partir du CWD
DIRNAME=$(basename "$CWD")
VAULT_NAME="${MAP[$DIRNAME]}"

# Si pas de mapping direct, essayer le parent
if [ -z "$VAULT_NAME" ]; then
  PARENT=$(basename "$(dirname "$CWD")")
  VAULT_NAME="${MAP[$PARENT]}"
fi

if [ -z "$VAULT_NAME" ]; then
  exit 0
fi

DEST="$VAULT/projets/$VAULT_NAME"
mkdir -p "$DEST"

SYNCED=0

# Sync SESSION.md vers sessions/<projet>/  (trio deplace dans documentation_claude/, fallback racine)
SESS_SRC="SESSION.md"; [ -f "documentation_claude/SESSION.md" ] && SESS_SRC="documentation_claude/SESSION.md"; [ -f "docs/documentation_claude/SESSION.md" ] && SESS_SRC="docs/documentation_claude/SESSION.md"
if [ -f "$SESS_SRC" ]; then
  SESS_DIR="$VAULT/sessions/$VAULT_NAME"
  mkdir -p "$SESS_DIR"
  DATE=$(date '+%Y-%m-%d')
  # Extraire un resume compact du SESSION.md
  head -30 "$SESS_SRC" > "$SESS_DIR/$DATE.md"
  SYNCED=$((SYNCED + 1))
fi

# Bidirectional sync for project fiche and infra
# Vault uses: <name>.md and <name>-infra.md
# Projects keep: FICHE.md and INFRA.md (local convention)
sync_file() {
  local LOCAL="$1"
  local REMOTE="$2"
  mkdir -p "$(dirname "$LOCAL")" 2>/dev/null
  if [ -f "$LOCAL" ] && [ -f "$REMOTE" ]; then
    if [ "$LOCAL" -nt "$REMOTE" ]; then
      cp "$LOCAL" "$REMOTE"
      SYNCED=$((SYNCED + 1))
    elif [ "$REMOTE" -nt "$LOCAL" ]; then
      cp "$REMOTE" "$LOCAL"
      SYNCED=$((SYNCED + 1))
    fi
  elif [ -f "$LOCAL" ] && [ ! -f "$REMOTE" ]; then
    cp "$LOCAL" "$REMOTE"
    SYNCED=$((SYNCED + 1))
  elif [ ! -f "$LOCAL" ] && [ -f "$REMOTE" ]; then
    cp "$REMOTE" "$LOCAL"
    SYNCED=$((SYNCED + 1))
  fi
}

# FICHE.md dans docs/documentation_claude/ (reorg 2026-07-17). INFRA.md reste racine (doc infra, hook inchange).
FICHE_SRC="./documentation_claude/FICHE.md"; [ -f "./docs/documentation_claude/FICHE.md" ] && FICHE_SRC="./docs/documentation_claude/FICHE.md"
sync_file "$FICHE_SRC" "$DEST/$VAULT_NAME.md"
sync_file "./INFRA.md" "$DEST/$VAULT_NAME-infra.md"

if [ "$SYNCED" -gt 0 ]; then
  echo "Vault sync: $SYNCED fichier(s) -> $DEST"
fi
