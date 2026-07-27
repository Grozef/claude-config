#!/bin/bash
# Lance une session Claude Haiku 4.5 pour tâches mécaniques
# Usage : bash ~/.claude/haiku.sh
# Ou avec une question directe : bash ~/.claude/haiku.sh "ajoute X au gitignore"

exec claude --model claude-haiku-4-5-20251001 "$@"
