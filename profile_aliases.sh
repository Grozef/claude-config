# Aliases Claude Code — à sourcer ou copier dans /etc/profile.d/claude.sh

# Session Haiku pour tâches mécaniques (10-20x moins cher que Sonnet/Opus)
# Cas d'usage : checkpoint, gitignore, recherche de fichier, questions courtes
alias haiku='claude --model claude-haiku-4-5-20251001'

# Session Sonnet (défaut)
alias claude-sonnet='claude --model claude-sonnet-4-6'

# Ouvrir Claude Code dans un répertoire projet spécifique
# Usage : claude-project /path/to/project
# Usage : claude-project (liste les sous-dossiers du répertoire courant)
claude-project() {
  if [ -n "$1" ]; then
    cd "$1" && claude
  else
    echo "Usage: claude-project <chemin-projet>"
    echo "Exemple: claude-project ~/code/mon-projet"
  fi
}
