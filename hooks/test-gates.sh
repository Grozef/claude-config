#!/usr/bin/env bash
# Suite reproductible des gates de stop-verify.js.
# Fabrique des transcripts JSONL temporaires et verifie exit 2 (bloque) / exit 0 (passe).
# Usage : bash ~/.claude/hooks/test-gates.sh
# A relancer apres toute modif de stop-verify.js (avec hooks-healthcheck.sh).
set -u

HOOK="$HOME/.claude/hooks/stop-verify.js"
TMPRAW="$(mktemp -d)"
trap 'rm -rf "$TMPRAW"' EXIT
# Node est natif Windows : il ne resout pas les chemins MSYS (/tmp/...). On passe
# au hook un chemin Windows (C:/...) sinon fs.existsSync echoue et le gate sort a vide.
if command -v cygpath >/dev/null 2>&1; then TMP="$(cygpath -m "$TMPRAW")"; else TMP="$TMPRAW"; fi

pass=0; fail=0

run() { # label  transcript_path  expected_exit
  echo "{\"transcript_path\":\"$2\"}" | node "$HOOK" >/dev/null 2>&1
  local c=$?
  if [ "$c" = "$3" ]; then echo "[OK]  $1 (exit $c)"; pass=$((pass+1));
  else echo "[x]   $1 (exit $c, ATTENDU $3)"; fail=$((fail+1)); fi
}

w() { printf '%s\n' "$2" > "$TMP/$1"; }   # w fichier contenu-1-ligne
wa() { printf '%s\n' "$@" > "$TMP/$1.multi"; mv "$TMP/$1.multi" "$TMP/$1"; }

# Briques JSONL (apostrophe/accents REELS : les regex 2a/2b en dependent)
TXT='{"message":{"role":"assistant","content":[{"type":"text","text":"%s"}]}}'
TUSE='{"message":{"role":"assistant","content":[{"type":"tool_use","name":"%s","input":%s}]}}'

# --- Gate 1 : production non verifiee ---
printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}' > "$TMP/g1a"
run "1  Edit seul sans verif        " "$TMP/g1a" 2

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; } > "$TMP/g1b"
run "1  Edit + Read (verif)         " "$TMP/g1b" 0

# --- Gate 2a : negation d'existence nue ---
printf "$TXT\n" "Ce fichier n'existe pas." > "$TMP/g2a"
run "2a negation nue                " "$TMP/g2a" 2

{ printf "$TUSE\n" "Glob" '{"pattern":"x"}';
  printf "$TXT\n" "Apres recherche, ce fichier n'existe pas."; } > "$TMP/g2a2"
run "2a negation + Glob (large)     " "$TMP/g2a2" 0

printf "$TXT\n" "Introuvable sous /c/Users/moi/.claude apres lecture." > "$TMP/g2a3"
run "2a negation + scope qualifie   " "$TMP/g2a3" 0

# --- Gate 2b : completion affirmee sans aucun tool ---
printf "$TXT\n" "Voila, c'est fait et ca marche." > "$TMP/g2b"
run "2b completion sans tool        " "$TMP/g2b" 2

# --- Gate 2c : CI vert / pret a push sans run de tests ---
printf "$TXT\n" "Les tests passent, on peut pousser." > "$TMP/g2c"
run "2c CI vert sans run            " "$TMP/g2c" 2

{ printf "$TUSE\n" "Bash" '{"command":"npm test"}';
  printf "$TXT\n" "Les tests passent, on peut pousser."; } > "$TMP/g2c2"
run "2c CI vert + npm test          " "$TMP/g2c2" 0

# --- Gate 2e : aveu de scope-creep (surgical / Karpathy #3) ---
{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" "Fait. Au passage j'ai nettoye le code adjacent."; } > "$TMP/g2e"
run "2e aveu scope-creep + prod     " "$TMP/g2e" 2

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" "Fait. J'ai aussi refactorise la fonction voisine."; } > "$TMP/g2e2"
run "2e aveu (j'ai aussi refacto)   " "$TMP/g2e2" 2

printf "$TXT\n" "Au passage, note que le fichier existe deja." > "$TMP/g2e3"
run "2e aveu SANS prod (passe)      " "$TMP/g2e3" 0

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" "Fait. J'ai supprime l'import devenu inutile."; } > "$TMP/g2e4"
run "2e orphelin legitime (passe)   " "$TMP/g2e4" 0

# --- Bypass + garde-fous anti faux-positif ---
printf "$TXT\n" "C'est fait. [NO-VERIFY: doc pure]" > "$TMP/byp"
run "bypass [NO-VERIFY:]            " "$TMP/byp" 0

printf "$TXT\n" "Est-ce que ce fichier n'existe pas ?" > "$TMP/intr"
run "garde-fou interrogatif         " "$TMP/intr" 0

# --- Cas neutre : texte sans affirmation ni prod -> passe ---
printf "$TXT\n" "Voici les options possibles pour la suite." > "$TMP/neutre"
run "neutre (aucune affirmation)    " "$TMP/neutre" 0

echo "== $pass OK / $((pass+fail)) cas =="
[ "$fail" = 0 ] || exit 1
