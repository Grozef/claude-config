#!/usr/bin/env bash
# audit-public.sh — a lancer AVANT tout push de ce depot public.
# Verifie que rien de lie a un projet reel, a la machine ou a l'identite n'est indexe.
#
# La liste des noms de projets n'est pas ecrite en dur : elle est derivee du vault
# a l'execution. Idem pour l'identite (git config) et les chemins (HOME, CLAUDE_VAULT).
# Le depot ne contient donc jamais ce qu'il cherche a exclure.
#
# Usage : audit-public.sh        (depuis la racine du depot)
set -uo pipefail

if [ -f "$HOME/.claude/vault.conf" ]; then . "$HOME/.claude/vault.conf"; fi
vault="${CLAUDE_VAULT:-}"

files=$(git ls-files) || { echo "audit-public: pas un depot git" >&2; exit 1; }
n=$(printf '%s\n' "$files" | wc -l)
fail=0
ok=0
say() { printf '[%s] %-22s %s\n' "$1" "$2" "$3"; [ "$1" = "OK" ] && ok=$((ok+1)) || fail=$((fail+1)); }

echo "== AUDIT PRE-PUSH ($n fichiers indexes) =="

# --- 1. anti-troncature -------------------------------------------------------
# iconv //TRANSLIT s'arrete au premier caractere non convertible : sans -c il rend
# un fichier tronque et TOUS les greps suivants deviennent aveugles apres ce point.
# On le prouve fichier par fichier avant de faire confiance au reste.
trunc=0
while IFS= read -r f; do
  a=$(wc -l < "$f"); b=$(iconv -c -f utf-8 -t ascii//TRANSLIT "$f" 2>/dev/null | wc -l)
  [ "$a" -ne "$b" ] && { echo "    [TRONQUE] $f ($a -> $b)"; trunc=$((trunc+1)); }
done <<< "$files"
[ "$trunc" -eq 0 ] && say OK "anti-troncature" "$n/$n" || say XX "anti-troncature" "$trunc fichier(s) illisibles en entier"

# Desaccentue un fichier indexe. Indispensable : un nom accentue echappe a un motif
# non accentue, et c'est exactement par la que deux fuites sont passees le 2026-07-27.
flat() { iconv -c -f utf-8 -t ascii//TRANSLIT "$1" 2>/dev/null; }

scan() { # scan <libelle> <regex etendue>
  local label="$1" re="$2" hits=""
  while IFS= read -r f; do
    local r; r=$(flat "$f" | grep -inE "$re") && hits+=$(printf '%s\n' "$r" | sed "s#^#    $f:#")$'\n'
  done <<< "$files"
  if [ -n "$hits" ]; then say XX "$label" "hits :"; printf '%s' "$hits"; else say OK "$label" "0 hit"; fi
}

# --- 2. noms de projets reels (derives du vault) ------------------------------
# NB 2026-09-04 : `inspection` ajoute — le monorepo s'appelle Inspection, et le mot est un
# nom commun francais ("commande d'inspection" dans les templates de creation). Le filtre est
# un match EXACT sur le nom derive : les noms composes qui contiennent ce mot restent testes.
# Allowlist : termes generiques de l'outillage qui apparaissent aussi comme nom de
# dossier projet. Sans elle, des mots comme "fichiers" ou "cdc" noient les vrais hits.
STOP='claude|obsidian|cdc|app|apps|back|front|www|dev|api|web|src|doc|docs|tmp|new|old|test|tests|fichiers|generator|memory|config|skills|tools|hooks|notes|projet|projets|session|sessions|inspection'
names=$( { [ -n "$vault" ] && ls -1 "$vault/projets" "$vault/sessions" 2>/dev/null
           ls -1 "$HOME/.claude/projects" 2>/dev/null | sed 's/.*-//'
         } | grep -v ':' | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9]//g' \
           | awk 'length($0)>=3' \
           | grep -vxE "$STOP" \
           | sort -u )
if [ -z "$names" ]; then
  say XX "noms de projets" "aucun nom derive — vault absent, controle IMPOSSIBLE"
else
  cnt=$(printf '%s\n' "$names" | wc -l)
  pat=$(printf '%s\n' "$names" | paste -sd'|' -)
  hits=""
  while IFS= read -r f; do
    r=$(flat "$f" | grep -inE "$pat") && hits+=$(printf '%s\n' "$r" | sed "s#^#    $f:#")$'\n'
  done <<< "$files"
  if [ -n "$hits" ]; then say XX "noms de projets" "hits ($cnt noms testes) :"; printf '%s' "$hits"
  else say OK "noms de projets" "0 hit ($cnt noms testes)"; fi
fi

# --- 3. chemins machine -------------------------------------------------------
me=$(basename "$HOME")
paths="$me|[A-Za-z]:[/\\\\](Users|home)"
[ -n "$vault" ] && paths="$paths|$(printf '%s' "$vault" | sed 's#[][\.^$*/+?(){}|]#\\&#g')"
scan "chemins machine" "$paths"

# --- 4. identite / IP ---------------------------------------------------------
ident='[0-9]{1,3}(\.[0-9]{1,3}){3}'
for tok in $(git config user.name 2>/dev/null) $(git config user.email 2>/dev/null); do
  t=$(printf '%s' "$tok" | sed 's/[^A-Za-z0-9@._-]//g')
  [ ${#t} -ge 4 ] && ident="$ident|$t"
done
scan "identite / IP" "$ident"

# --- 5. secrets ---------------------------------------------------------------
# "token" et "secret" sont des mots courants ici (token efficiency) : on n'alerte que
# si le mot est SUIVI d'une valeur d'au moins 12 caracteres, pas sur le mot seul.
scan "secrets" '((api[_-]?key|access[_-]?key|secret|passwd|password|token|bearer)[[:space:]]*[:=][[:space:]]*.?[A-Za-z0-9_/+-]{12,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)'

# --- 6. contenu prive indexe --------------------------------------------------
priv=$(printf '%s\n' "$files" | grep -E '^(projects|_archive|skills/cdc/assets/lab)/|^vault(-map)?\.conf$|^(SESSION|TODO)\.md$')
[ -z "$priv" ] && say OK "prive dans l'index" "0 hit" || { say XX "prive dans l'index" "hits :"; printf '%s\n' "$priv" | sed 's/^/    /'; }

echo "== $ok/$((ok+fail)) =="
[ "$fail" -eq 0 ] && echo "push autorise" || echo "PUSH BLOQUE — corriger les [XX] ci-dessus"
exit "$fail"
