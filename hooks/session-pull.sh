#!/bin/bash
# SessionStart : git pull du vault et de ~/.claude (strategie deux machines, TODO vault 2026-09-29).
# Repose sur pull.rebase + rebase.autoStash en config locale de chaque depot.
# Ne bloque jamais le demarrage : timeout reseau, rebase en conflit annule, exit 0.

[ -f "$HOME/.claude/vault.conf" ] && . "$HOME/.claude/vault.conf"

pull_repo() {
  local dir="$1" name="$2" out before
  [ -d "$dir/.git" ] || return 0
  # HEAD avant/apres plutot que le texte de git, traduit selon la locale
  before=$(git -C "$dir" rev-parse HEAD 2>/dev/null)
  out=$(timeout 20 git -C "$dir" pull 2>&1)
  if [ $? -eq 0 ]; then
    if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" = "$before" ]; then
      echo "git pull $name : a jour"
    else
      echo "git pull $name : mis a jour -> $(git -C "$dir" log -1 --format='%h %s')"
    fi
    return 0
  fi
  [ -d "$dir/.git/rebase-merge" ] || [ -d "$dir/.git/rebase-apply" ] && git -C "$dir" rebase --abort >/dev/null 2>&1
  echo "/!\\ git pull $name ECHOUE (rebase annule si en cours, autostash eventuel dans git stash list) :"
  echo "$out" | tail -3
}

[ -n "$CLAUDE_VAULT" ] && pull_repo "$CLAUDE_VAULT" "vault"
pull_repo "$HOME/.claude" "~/.claude"
exit 0
