#!/usr/bin/env bash
# cdc.sh — outil du skill cdc. DÉTERMINISTE uniquement : résout le type -> trame figée,
# copie le squelette, et/ou convertit en html/docx. Le REMPLISSAGE du contenu reste au modèle.
#
# Usage :
#   cdc.sh scaffold [--type {cdc|fill}] [--out <f.md>] [--force] [--html] [--docx] [--no-pdf] [--open]
#       Copie la trame figée vers <f.md> (défaut: documentation_contractuelle/cahier-des-charges.md).
#       --html/--docx : convertit immédiatement (cas "doc vierge structuré sans modèle").
#       Refuse d'écraser un fichier existant sauf --force.
#   cdc.sh fiches <f.md> "F1=Nom" "F2=Nom" ...
#       Remplace le bloc annexe A modèle par une fiche par fonctionnalité (cdc_fiches.py).
#   cdc.sh render [--no-html] [--no-docx] [--no-pdf] [--open] [--brand <nom|dir>|--no-brand] <f.md>
#       Convertit un fichier déjà rempli (cas workflow : scaffold -> remplissage -> render).
#       Par défaut : .html + .pdf (Chrome/Edge headless) + .docx (templates/reference-cdc.docx,
#       titre du YAML reporté dans l'en-tête). --html / --docx restent acceptés.
#       Images relatives au .md (<stem>-diagrams/*.png) incluses (resource-path de md2html/md2docx).
#       Lint BLOQUANT avant conversion : un échec arrête le rendu.
#       Branding HTML : le kit $CLAUDE_BRAND_DIR (vault.conf) est appliqué PAR DÉFAUT s'il existe.
#       --brand <nom|dir> pour un autre kit, --no-brand pour désactiver.
#   cdc.sh docx2pdf <f.docx> [f.pdf]
#       PDF du docx pour constater son rendu : Word (COM) sous Windows, sinon LibreOffice headless.
#   cdc.sh inventory <path>
#       GATE doc : liste TOUTE la doc (*.md, toute profondeur, hors vendor/node_modules/build)
#       + dossiers docs/doc/toDo/.scribe.
#   cdc.sh lint <f.md>
#       GATE BLOQUANT (exit 1, cdc_lint.py) : vocabulaire de dette/audit/WIP, référence de
#       source dans le texte (chemin de fichier, Classe::méthode), consigne du modèle restée dans un CDC rempli, mot entre
#       chevrons hors backticks (pandoc le prend pour une balise et l'efface).
#
# Trame unique depuis le 2026-10-16 (calque de templates/Modele_CDC.docx) :
#   cdc (rempli par le modèle) | fill (squelette vierge) -> skills/cdc/trames/trame-modele.md
set -euo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi

root="$HOME/.claude/skills/cdc"
md2html="$HOME/.claude/tools/md2html.sh"
md2docx="$HOME/.claude/tools/md2docx.sh"
refdocx="$root/templates/reference-cdc.docx"
tools="$HOME/.claude/tools"

die() { echo "cdc.sh: $*" >&2; exit 1; }

# python3 d'abord (Ubuntu n'a pas de `python`), python sinon (Windows).
PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || die "python3 introuvable"
# Sortie en UTF-8 : sous Windows, Python écrit en cp1252 par défaut (accents illisibles).
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
winpath() { cygpath -w "$1" 2>/dev/null || echo "$1"; }

trame_for() {
  case "$1" in
    cdc|fill) echo "$root/trames/trame-modele.md" ;;
    public|tech|full|cdcf) die "type '$1' retiré le 2026-10-16 : modèle unique, utiliser --type cdc (ou fill pour le vierge)" ;;
    *) die "type inconnu: '$1' (attendu: cdc|fill)" ;;
  esac
}

# Post-traitement du docx pour coller au modèle : (1) l'en-tête « [Nom du projet] — Cahier des
# charges » est du texte fixe, on y reporte le title: du YAML ; sans YAML (CDC antérieurs au
# modèle), le premier titre « # » privé de « Cahier des charges — » ; sans titre du tout, le
# placeholder est retiré ; resté « [Nom du projet] » (squelette fill) -> inchangé ;
# (2) pandoc écrit les tableaux en largeur auto, le modèle est en pleine largeur.
docx_post() {
  local dx="$1" md="$2" title
  if head -1 "$md" | grep -qx -- '---'; then
    title="$(sed -n '2,/^---$/{/^title:/{s/^title:[[:space:]]*//;s/^"//;s/"$//;p;q}}' "$md")"
  else
    title="$(grep -m1 '^# ' "$md" | sed 's/^# *//; s/^Cahier des charges *\(—\|-\) *//' || true)"
  fi
  "$PY" - "$(winpath "$dx")" "$title" <<'PY'
import sys, zipfile, shutil, tempfile
from xml.sax.saxutils import escape
path, title = sys.argv[1], escape(sys.argv[2])
placeholder = '[Nom du projet]'
tmp = tempfile.mktemp(suffix='.docx')
with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        name = item.filename
        if name.startswith('word/header') and name.endswith('.xml'):
            xml = data.decode('utf-8')
            if title:
                xml = xml.replace(placeholder, title)
            else:
                xml = xml.replace(placeholder + ' — ', '')
            data = xml.encode('utf-8')
        elif name == 'word/document.xml':
            data = data.decode('utf-8').replace('<w:tblW w:type="auto" w:w="0" />',
                                                '<w:tblW w:type="pct" w:w="5000" />').encode('utf-8')
        zout.writestr(item, data)
shutil.move(tmp, path)
PY
}

# Hors commentaires HTML : la trame en porte un qui cite « [À COMPLÉTER] ».
placeholder_count() { awk '/<!--/{c=1} !c{n+=gsub(/\[À COMPLÉTER\]/,"")} /-->/{c=0} END{print n+0}' "$1"; }

# Gitignore — un CDC généré (.md/.html/.docx/.pdf + <stem>-diagrams/) reste hors versioning,
# SAUF s'il est déjà suivi par git (versionnement choisi pour ce projet, ex. LumiSafe 2026-07) :
# on n'y touche pas. Sinon ajoute les entrées au .gitignore du repo englobant (idempotent).
gitignore_out() {
  local md="$1" dir base repo rel stem ext entry gi added=0
  dir="$(cd "$(dirname "$md")" && pwd)"
  if ! git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "gitignore: pas de repo git pour $md — ignoré (rien à gitignorer)"
    return 0
  fi
  if git -C "$dir" ls-files --error-unmatch "$(basename "$md")" >/dev/null 2>&1; then
    echo "gitignore: $md est versionné dans son repo — .gitignore laissé tel quel"
    return 0
  fi
  # show-prefix : chemin de dir relatif à la racine du repo (slash final, vide si racine).
  # Évite tout mélange de formats Windows/POSIX dans le calcul du relatif.
  rel="$(git -C "$dir" rev-parse --show-prefix 2>/dev/null || true)"
  repo="$(cygpath -u "$(git -C "$dir" rev-parse --show-toplevel)" 2>/dev/null || git -C "$dir" rev-parse --show-toplevel)"
  base="$(basename "$md")"; stem="${base%.md}"
  gi="$repo/.gitignore"
  [ -f "$gi" ] || : > "$gi"
  for ext in md html docx pdf diagrams/; do
    case "$ext" in
      */) entry="/${rel}${stem}-${ext}" ;;   # dossier des diagrammes archify
      *)  entry="/${rel}${stem}.${ext}" ;;
    esac
    if ! grep -qxF "$entry" "$gi" 2>/dev/null; then
      [ "$added" -eq 0 ] && ! grep -qF '# CDC généré (skill cdc)' "$gi" && printf '\n# CDC généré (skill cdc) — ne pas committer\n' >> "$gi"
      echo "$entry" >> "$gi"; added=1
    fi
  done
  if [ "$added" -eq 1 ]; then
    echo "gitignore: /!\\ $gi MODIFIÉ (entrées CDC ajoutées) — à signaler, fichier versionné du repo"
  else
    echo "gitignore: déjà couvert dans $gi"
  fi
}

# GATE doc — inventaire de la doc d'une source, sortie visible dans le contexte modèle.
inventory() {
  local path="${1:?inventory: chemin requis}"
  [ -e "$path" ] || die "inventory: introuvable: $path"
  echo "== INVENTAIRE DOC : $path =="
  # Toute profondeur : un monorepo range sa doc sous <app>/docs/<bucket>/ (profondeur 4+).
  local prune=( \( -name node_modules -o -name vendor -o -name .git -o -name dist -o -name build \
                -o -name storage -o -name .gradle \) -prune -o )
  local n
  n="$(find "$path" "${prune[@]}" -type f -iname '*.md' -print 2>/dev/null | wc -l)"
  echo "-- fichiers .md ($n, toute profondeur, hors vendor/node_modules/build/storage) --"
  find "$path" "${prune[@]}" -type f -iname '*.md' -print 2>/dev/null | sort || true
  echo "-- dossiers de doc --"
  find "$path" "${prune[@]}" -type d \( -iname docs -o -iname doc -o -iname toDo -o -iname .scribe \) \
    -print 2>/dev/null | sort || true
  echo "== fin inventaire =="
}

# GATE BLOQUANT — dette/audit/WIP, références de source dans le texte, consignes restantes (cdc_lint.py).
lint() {
  local file="${1:?lint: fichier .md requis}"
  [ -f "$file" ] || die "lint: introuvable: $file"
  "$PY" "$(winpath "$tools/cdc_lint.py")" "$(winpath "$file")"
}

# PDF d'un docx, pour regarder son rendu tel que Word le met en page.
docx2pdf() {
  local dx="${1:?docx2pdf: .docx requis}" pdf="${2:-}" office
  [ -f "$dx" ] || die "docx2pdf: introuvable: $dx"
  dx="$(cd "$(dirname "$dx")" && pwd)/$(basename "$dx")"
  [ -n "$pdf" ] || pdf="${dx%.docx}.word.pdf"
  # Absolu : Word (COM) résout un chemin relatif depuis son propre répertoire (Documents).
  pdf="$(cd "$(dirname "$pdf")" && pwd)/$(basename "$pdf")"
  case "$dx$pdf" in *"'"*) die "docx2pdf: apostrophe dans le chemin, non gérée par l'appel Word" ;; esac
  rm -f "$pdf"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\$w = New-Object -ComObject Word.Application; \$w.Visible = \$false; try { \$d = \$w.Documents.Open('$(winpath "$dx")', \$false, \$true); \$d.ExportAsFixedFormat('$(winpath "$pdf")', 17); \$d.Close(\$false) } finally { \$w.Quit() }" >/dev/null 2>&1 || true
  fi
  if [ ! -s "$pdf" ]; then
    office="$(command -v soffice libreoffice 2>/dev/null | head -1 || true)"
    [ -n "$office" ] || die "docx2pdf: ni Word (COM) ni LibreOffice : rendu du docx non constatable"
    local tmp; tmp="$(mktemp -d)"
    "$office" --headless --convert-to pdf --outdir "$tmp" "$dx" >/dev/null 2>&1 || true
    [ -s "$tmp/$(basename "${dx%.docx}").pdf" ] && mv "$tmp/$(basename "${dx%.docx}").pdf" "$pdf"
    rm -rf "$tmp"
  fi
  [ -s "$pdf" ] || die "docx2pdf: échec de la conversion de $dx"
  echo "$pdf"
}

# PDF depuis le HTML rendu, via Chrome/Edge headless (print-to-pdf, CSS @media print
# de doc-theme.css). Chrome introuvable ou PDF absent -> erreur visible, jamais silencieuse.
html2pdf() {
  local html pdf chrome="" c profile
  # Chemins absolus : Chrome résout un --print-to-pdf relatif hors du cwd (PDF perdu).
  html="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; pdf="${html%.html}.pdf"
  for c in "${ARCHIFY_CHROME:-}" \
           "/c/Program Files/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
           "$(command -v google-chrome chromium 2>/dev/null | head -1)"; do
    if [ -n "$c" ] && [ -x "$c" ]; then chrome="$c"; break; fi
  done
  [ -n "$chrome" ] || die "pdf: Chrome/Edge introuvable (définir ARCHIFY_CHROME), PDF non produit"
  profile="$(mktemp -d)"
  rm -f "$pdf"
  "$chrome" --headless=new --disable-gpu --no-pdf-header-footer \
    --user-data-dir="$(cygpath -w "$profile" 2>/dev/null || echo "$profile")" \
    --print-to-pdf="$(cygpath -w "$pdf" 2>/dev/null || echo "$pdf")" \
    "file:///$(cygpath -m "$html" 2>/dev/null || echo "$html")" \
    >/dev/null 2>&1 || true
  rm -rf "$profile" 2>/dev/null || true
  [ -s "$pdf" ] || die "pdf: échec de print-to-pdf ($chrome), $pdf absent"
  echo "$pdf"
}

render() {
  local html=1 docx=1 open=0 pdf=1 brand="" file=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --no-pdf) pdf=0; shift ;;
      --html)  html=1; shift ;;
      --no-html) html=0; shift ;;
      --docx)  docx=1; shift ;;
      --no-docx) docx=0; shift ;;
      --open)  open=1; shift ;;
      --brand) brand="${2:?--brand requiert un nom/dossier}"; shift 2 ;;
      --no-brand) brand="none"; shift ;;
      *)       file="$1"; shift ;;
    esac
  done
  [ -n "$file" ] || die "render: fichier .md manquant"
  [ -f "$file" ] || die "render: introuvable: $file"

  # GATE bloquant avant toute conversion : on ne rend pas un CDC qui échoue au lint.
  lint "$file" || die "render: lint en échec sur $file — corriger (ou <!-- lint-ok --> sur un faux positif), rien n'est rendu"

  # CDC généré hors versioning, sauf s'il est déjà versionné.
  gitignore_out "$file"

  # Branding par défaut : le kit désigné par CLAUDE_BRAND_DIR (vault.conf), s'il est
  # configuré. --brand <nom|dir> pour un autre kit, --no-brand pour désactiver.
  [ -n "$brand" ] || brand="${CLAUDE_BRAND_DIR:-none}"
  local branddir=""
  if [ "$brand" != "none" ]; then
    if [ -d "$brand" ]; then branddir="$brand"; else branddir="$root/assets/$brand"; fi
    if [ ! -d "$branddir" ]; then
      echo "render: kit brand introuvable: $branddir — rendu sans branding" >&2
      branddir=""
    fi
  fi
  local openflag=(); [ "$open" -eq 1 ] && openflag=(--open)
  local brandflag=(); [ -n "$branddir" ] && brandflag=(--brand "$branddir")

  if [ "$html" -eq 1 ]; then
    local ht; ht="$(bash "$md2html" "${openflag[@]}" "${brandflag[@]}" "$file")"
    echo "$ht"
    # PDF par défaut avec le HTML (--no-pdf pour couper).
    [ "$pdf" -eq 1 ] && html2pdf "$ht"
  fi
  # Le docx suit le modèle unique (reference-cdc.docx, 2026-10-16) ; le branding ne vise que le HTML.
  if [ "$docx" -eq 1 ]; then
    [ -f "$refdocx" ] || die "render: reference-doc introuvable: $refdocx"
    local dx; dx="$(bash "$md2docx" --ref "$refdocx" "$file")"
    docx_post "$dx" "$file"
    if [ "$open" -eq 1 ]; then
      powershell.exe -NoProfile -Command "Start-Process '$(cygpath -w "$dx")'" >/dev/null 2>&1 || true
    fi
    echo "$dx"
  fi
}

cmd="${1:-}"; shift || true
case "$cmd" in
  scaffold)
    type="cdc"; out="documentation_contractuelle/cahier-des-charges.md"; force=0; html=0; docx=0; open=0; nopdf=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --no-pdf) nopdf=1; shift ;;
        --type) type="${2:?--type requiert une valeur}"; shift 2 ;;
        --out)  out="${2:?--out requiert une valeur}"; shift 2 ;;
        --force) force=1; shift ;;
        --html) html=1; shift ;;
        --docx) docx=1; shift ;;
        --open) open=1; shift ;;
        *) die "scaffold: argument inconnu: $1" ;;
      esac
    done
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
    [ "$html" -eq 1 ] || rargs=(--no-html "${rargs[@]}")
    [ "$docx" -eq 1 ] || rargs=(--no-docx "${rargs[@]}")
    [ "$nopdf" -eq 1 ] && rargs=(--no-pdf "${rargs[@]}")
    if [ "$html" -eq 1 ] || [ "$docx" -eq 1 ]; then render "${rargs[@]}"; fi
    ;;
  render)
    render "$@"
    ;;
  fiches)
    f="${1:?fiches: fichier .md requis}"; shift
    [ $# -gt 0 ] || die "fiches: au moins une fonctionnalité F<n>=Nom"
    "$PY" "$(winpath "$tools/cdc_fiches.py")" "$(winpath "$root/trames/trame-modele.md")" "$(winpath "$f")" "$@"
    ;;
  docx2pdf)
    docx2pdf "$@"
    ;;
  inventory)
    inventory "${1:?inventory: chemin requis}"
    ;;
  lint)
    [ $# -le 1 ] || die "lint: un seul fichier .md attendu (les dépôts sources ne sont plus lus)"
    lint "${1:?lint: fichier .md requis}"
    ;;
  ""|-h|--help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "commande inconnue: '$cmd' (attendu: scaffold | fiches | render | docx2pdf | inventory | lint)"
    ;;
esac
