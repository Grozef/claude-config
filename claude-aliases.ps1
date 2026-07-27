# Equivalents PowerShell de profile_aliases.sh (Windows)
# A charger depuis le profil PowerShell : . "$HOME\.claude\claude-aliases.ps1"

# Session Haiku 4.5 pour taches mecaniques (10-20x moins cher que Sonnet/Opus)
function haiku { claude --model claude-haiku-4-5-20251001 @args }

# Session Sonnet 4.6
function claude-sonnet { claude --model claude-sonnet-4-6 @args }

# Ouvrir Claude Code dans un repertoire projet specifique
# Usage : claude-project C:\chemin\vers\projet
function claude-project {
    param([string]$Path)
    if ($Path) { Set-Location $Path; claude }
    else { Write-Host "Usage: claude-project <chemin-projet>" }
}

# Convertir un markdown en HTML autonome stylé (pandoc + thème doc-theme.css)
# Usage : md2html [--open] <fichier.md> [sortie.html] [titre]
function md2html {
    bash "$HOME/.claude/tools/md2html.sh" @args
}
