#!/usr/bin/env bash
# review2html.sh — transforme le texte d'une review (format /review) en HTML stylé.
# Usage :
#   review2html.sh [--open] [output.html] [title] < review-texte
# Le texte review est lu sur stdin (format [CRITIQUE]/[WARN]/[INFO] path:line -- msg).
set -euo pipefail

open=()
[ "${1:-}" = "--open" ] && { open=(--open); shift; }
out="${1:-review-$(date +%Y%m%d-%H%M).html}"
title="${2:-Code review}"

node "$HOME/.claude/tools/review2md.js" \
  | bash "$HOME/.claude/tools/md2html.sh" "${open[@]}" - "$out" "$title"
