#!/usr/bin/env bash
# hooks-healthcheck.sh — pipe un JSON d'exemple a CHAQUE hook declare dans settings.json
# et signale tout crash (stack trace / stdin casse / commande absente). Anti-mort-silencieuse.
# A lancer depuis un dossier neutre (~/.claude) : certains hooks ont des effets de bord en projet.
set -uo pipefail

settings="$HOME/.claude/settings.json"
[ -f "$settings" ] || { echo "healthcheck: settings.json introuvable" >&2; exit 2; }

# --- Mode --static : controle SANS EXECUTER (2026-09-04) ---
# Le mode complet lance reellement chaque hook : post-write.sh touche le .gitignore du
# projet, stop-vault-sync.sh copie dans le vault.
# Il est donc inutilisable en automatique. Le mode statique ne resout que le SCRIPT vise
# par chaque commande declaree et verifie qu il existe et qu il compile — ce qui couvre la
# mort silencieuse constatee : un hook declare sur un fichier absent ou casse ne dit rien.
# Silencieux quand tout va bien (declare en SessionStart async), exit 0 dans tous les cas.
if [ "${1:-}" = "--static" ]; then
  probs=0
  while IFS= read -r cmd; do
    scr="$(printf %s "$cmd" | grep -oE "[^ ]+\.(js|sh)" | head -1)"
    [ -n "$scr" ] || continue
    scr="${scr/#\~/$HOME}"
    case "$scr" in /*|[A-Za-z]:*) ;; *) scr="$HOME/.claude/$scr" ;; esac
    if [ ! -f "$scr" ]; then echo "[HOOK MORT] declare mais absent : $scr" >&2; probs=$((probs+1)); continue; fi
    case "$scr" in
      *.js) node --check "$scr" >/dev/null 2>&1 || { echo "[HOOK CASSE] syntaxe : $scr" >&2; probs=$((probs+1)); } ;;
      *.sh) bash -n "$scr" >/dev/null 2>&1 || { echo "[HOOK CASSE] syntaxe : $scr" >&2; probs=$((probs+1)); } ;;
    esac
  done < <(node -e "
const s=require(process.argv[1]); const o=[];
for(const ev of Object.keys(s.hooks||{}))
  for(const g of s.hooks[ev]||[])
    for(const h of (g.hooks||[])) o.push(h.command);
console.log(o.join(String.fromCharCode(10)));
" "$settings")
  [ "$probs" -gt 0 ] && echo "hooks-healthcheck --static : $probs probleme(s) — lance bash ~/.claude/tools/hooks-healthcheck.sh depuis ~/.claude pour le detail" >&2
  exit 0
fi

# Transcript minimal pour les hooks Stop (1 message assistant, aucune violation).
tr="$(mktemp)"; printf '%s\n' '{"message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}' > "$tr"

# JSON d'entree couvrant prompt (UserPromptSubmit), tool_input (Pre/PostToolUse), transcript_path (Stop).
sample="$(node -e "console.log(JSON.stringify({prompt:'ajoute une fonction',tool_input:{command:'git log',file_path:process.argv[1]},transcript_path:process.argv[1],hook_event_name:'HealthCheck'}))" "$tr")"

# Extraire ev<TAB>command depuis settings.json (require parse le JSON).
mapfile -t rows < <(node -e "
const s=require(process.argv[1]); const o=[];
for(const ev of Object.keys(s.hooks||{}))
  for(const g of s.hooks[ev]||[])
    for(const h of (g.hooks||[])) o.push(ev+'\t'+h.command);
console.log(o.join('\n'));
" "$settings")

errpat='Error:|Traceback|dev[\\/]stdin|command not found|No such file or directory|SyntaxError|ReferenceError|TypeError|is not defined|Cannot read'
fail=0; ok=0
echo "== HOOKS HEALTHCHECK (${#rows[@]} hooks) =="
for row in "${rows[@]}"; do
  ev="${row%%$'\t'*}"; cmd="${row#*$'\t'}"
  out="$(printf '%s' "$sample" | eval "$cmd" 2>&1)" || true
  if echo "$out" | grep -qE "$errpat"; then
    echo "[CRASH] $ev :: $cmd"
    echo "$out" | grep -E "$errpat" | head -1 | sed 's/^/         /'
    fail=1
  else
    echo "[OK]    $ev :: $cmd"
    ok=$((ok+1))
  fi
done
rm -f "$tr"
echo "== $ok OK / ${#rows[@]} hooks =="
exit $fail
