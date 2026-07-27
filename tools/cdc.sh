#!/usr/bin/env bash
# cdc.sh — outil du skill cdc. DÉTERMINISTE uniquement : résout le type -> trame figée,
# copie le squelette, et/ou convertit en html/docx. Le REMPLISSAGE du contenu reste au modèle.
#
# Usage :
#   cdc.sh scaffold --type {fill|public|tech|full|cdcf} [--out <f.md>] [--force] [--html] [--docx] [--open]
#       Copie la trame figée vers <f.md> (défaut: documentation_contractuelle/cahier-des-charges.md).
#       --html/--docx : convertit immédiatement (cas "doc vierge structuré sans modèle").
#       Refuse d'écraser un fichier existant sauf --force.
#   cdc.sh render [--html] [--docx] [--open] [--brand <nom|dir>|--no-brand] <f.md>
#       Convertit un fichier déjà rempli (cas workflow : scaffold -> remplissage -> render).
#       Lint anti-dette auto avant conversion (garde-fou n4).
#       Branding : kit 'lab' (logo + pagination) appliqué PAR DÉFAUT.
#       --brand <autre> pour un autre kit, --no-brand pour désactiver.
#   cdc.sh inventory <path>
#       GATE doc : liste la doc (*.md hors vendor/node_modules) + dossiers docs/doc/toDo/.scribe.
#   cdc.sh lint <f.md>
#       GATE anti-dette : signale dette/audit/WIP/failles. Warn-only (exit 0).
#
# Mapping type -> trame (source unique de vérité) :
#   public|tech|full|cdcf -> skills/cdc/trames/trame-<type>.md
#   fill                  -> skills/cdc/templates/template-fill.md
set -euo pipefail

root="$HOME/.claude/skills/cdc"
md2html="$HOME/.claude/tools/md2html.sh"
md2docx="$HOME/.claude/tools/md2docx.sh"

die() { echo "cdc.sh: $*" >&2; exit 1; }

trame_for() {
  case "$1" in
    public|tech|full|cdcf) echo "$root/trames/trame-$1.md" ;;
    fill)                  echo "$root/templates/template-fill.md" ;;
    *) die "type inconnu: '$1' (attendu: fill|public|tech|full|cdcf)" ;;
  esac
}

placeholder_count() { grep -c '\[À COMPLÉTER\]' "$1" 2>/dev/null || echo 0; }

# Gitignore — tout CDC généré (.md/.html/.docx) ne doit JAMAIS être committé.
# Trouve le repo git englobant l'output et ajoute les entrées (idempotent).
gitignore_out() {
  local md="$1" dir base repo rel stem ext entry gi added=0
  dir="$(cd "$(dirname "$md")" && pwd)"
  if ! git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "gitignore: pas de repo git pour $md — ignoré (rien à gitignorer)"
    return 0
  fi
  # show-prefix : chemin de dir relatif à la racine du repo (slash final, vide si racine).
  # Évite tout mélange de formats Windows/POSIX dans le calcul du relatif.
  rel="$(git -C "$dir" rev-parse --show-prefix 2>/dev/null || true)"
  repo="$(cygpath -u "$(git -C "$dir" rev-parse --show-toplevel)" 2>/dev/null || git -C "$dir" rev-parse --show-toplevel)"
  base="$(basename "$md")"; stem="${base%.md}"
  gi="$repo/.gitignore"
  [ -f "$gi" ] || : > "$gi"
  for ext in md html docx; do
    entry="/${rel}${stem}.${ext}"
    if ! grep -qxF "$entry" "$gi" 2>/dev/null; then
      [ "$added" -eq 0 ] && printf '\n# CDC généré (skill cdc) — ne pas committer\n' >> "$gi"
      echo "$entry" >> "$gi"; added=1
    fi
  done
  if [ "$added" -eq 1 ]; then
    echo "gitignore: entrées CDC ajoutées dans $gi"
  else
    echo "gitignore: déjà couvert dans $gi"
  fi
}

# GATE doc — inventaire de la doc d'une source, sortie visible dans le contexte modèle.
inventory() {
  local path="${1:?inventory: chemin requis}"
  [ -e "$path" ] || die "inventory: introuvable: $path"
  echo "== INVENTAIRE DOC : $path =="
  echo "-- fichiers .md (maxdepth 3, hors vendor/node_modules) --"
  find "$path" -maxdepth 3 -iname '*.md' \
    -not -path '*/node_modules/*' -not -path '*/vendor/*' 2>/dev/null | sort || true
  echo "-- dossiers de doc --"
  find "$path" -maxdepth 3 -type d \
    \( -iname docs -o -iname doc -o -iname toDo -o -iname .scribe \) \
    -not -path '*/node_modules/*' -not -path '*/vendor/*' 2>/dev/null | sort || true
  echo "== fin inventaire =="
}

# GATE anti-dette — signale tout vocabulaire interdit (garde-fou n4). Warn-only (exit 0).
lint() {
  local file="${1:?lint: fichier .md requis}"
  [ -f "$file" ] || die "lint: introuvable: $file"
  local pat='dette technique|technical debt|\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b|\bWIP\b|en cours de dev|work in progress|à refactor|a refactor|à corriger|a corriger|faille|vulnérab|vulnerab|\bCVE\b|bug connu|known bug|deprecated|obsolèt|obsolet|code mort|dead code|workaround|contournement'
  local hits
  hits="$(grep -niE "$pat" "$file" || true)"
  if [ -n "$hits" ]; then
    echo "/!\\ LINT garde-fou n4 — lignes suspectes (dette/audit/WIP/failles) à revoir dans $file :" >&2
    echo "$hits" >&2
    echo "-> corriger ces lignes ou justifier un faux positif AVANT de finaliser." >&2
  else
    echo "[OK] lint: aucune mention de dette/audit/WIP dans $file"
  fi
}

render() {
  local html=0 docx=0 open=0 brand="" file=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --html)  html=1; shift ;;
      --docx)  docx=1; shift ;;
      --open)  open=1; shift ;;
      --brand) brand="${2:?--brand requiert un nom/dossier}"; shift 2 ;;
      --no-brand) brand="none"; shift ;;
      *)       file="$1"; shift ;;
    esac
  done
  [ -n "$file" ] || die "render: fichier .md manquant"
  [ -f "$file" ] || die "render: introuvable: $file"

  # GATE anti-dette avant toute conversion (warn-only).
  lint "$file" || true

  # Tout CDC généré reste hors versioning.
  gitignore_out "$file"

  # Branding par défaut : kit 'lab' (logo + pagination). --no-brand pour désactiver.
  [ -n "$brand" ] || brand="lab"
  local branddir=""
  if [ "$brand" != "none" ]; then
    if [ -d "$brand" ]; then branddir="$brand"; else branddir="$HOME/.claude/skills/cdc/assets/$brand"; fi
    if [ ! -d "$branddir" ]; then
      echo "render: kit brand introuvable: $branddir — rendu sans branding" >&2
      branddir=""
    fi
  fi
  local openflag=(); [ "$open" -eq 1 ] && openflag=(--open)
  local brandflag=(); [ -n "$branddir" ] && brandflag=(--brand "$branddir")

  if [ "$html" -eq 1 ]; then
    bash "$md2html" "${openflag[@]}" "${brandflag[@]}" "$file"
  fi
  if [ "$docx" -eq 1 ]; then
    if [ -n "$branddir" ]; then
      # docx d'abord SANS ouvrir, puis injection header/footer, puis ouverture du brandé
      local dx; dx="$(bash "$md2docx" "$file")"
      bash "$HOME/.claude/tools/docx-brand.sh" --brand "$branddir" "$dx"
      if [ "$open" -eq 1 ]; then
        powershell.exe -NoProfile -Command "Start-Process '$(cygpath -w "$dx")'" >/dev/null 2>&1 || true
      fi
      echo "$dx"
    else
      bash "$md2docx" "${openflag[@]}" "$file"
    fi
  fi
}

cmd="${1:-}"; shift || true
case "$cmd" in
  scaffold)
    type=""; out="documentation_contractuelle/cahier-des-charges.md"; force=0; html=0; docx=0; open=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --type) type="${2:?--type requiert une valeur}"; shift 2 ;;
        --out)  out="${2:?--out requiert une valeur}"; shift 2 ;;
        --force) force=1; shift ;;
        --html) html=1; shift ;;
        --docx) docx=1; shift ;;
        --open) open=1; shift ;;
        *) die "scaffold: argument inconnu: $1" ;;
      esac
    done
    [ -n "$type" ] || die "scaffold: --type requis"
    src="$(trame_for "$type")"
    [ -f "$src" ] || die "trame introuvable: $src"
    if [ -e "$out" ] && [ "$force" -ne 1 ]; then
      die "le fichier existe déjà: $out (utiliser --force pour écraser)"
    fi
    mkdir -p "$(dirname "$out")"
    cp "$src" "$out"
    echo "scaffold: $out (type=$type, trame=$(basename "$src"), $(placeholder_count "$out") [À COMPLÉTER])"
    gitignore_out "$out"
    rargs=("$out"); [ "$open" -eq 1 ] && rargs=(--open "${rargs[@]}")
    [ "$html" -eq 1 ] && rargs=(--html "${rargs[@]}")
    [ "$docx" -eq 1 ] && rargs=(--docx "${rargs[@]}")
    if [ "$html" -eq 1 ] || [ "$docx" -eq 1 ]; then render "${rargs[@]}"; fi
    ;;
  render)
    render "$@"
    ;;
  inventory)
    inventory "${1:?inventory: chemin requis}"
    ;;
  lint)
    lint "${1:?lint: fichier .md requis}"
    ;;
  ""|-h|--help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "commande inconnue: '$cmd' (attendu: scaffold | render)"
    ;;
esac
