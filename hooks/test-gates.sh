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
# Logs du hook rediriges vers $TMP : sans cela la suite ecrivait ses bypass factices dans le
# .no-verify.log reel (35 lignes purgees le 2026-09-13) et remplissait le journal des blocages.
export CLAUDE_NOVERIFY_LOG="$TMP/no-verify.log" CLAUDE_PENDING_LOG="$TMP/pending-verify.log" CLAUDE_GATE_BLOCKS_LOG="$TMP/gate-blocks.log"

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

# Redirection testee hors quotes (producer.js, 2026-09-14)
{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Bash" '{"command":"grep -n '"'"'^[<>]'"'"' /c/x.js"}'; } > "$TMP/g1c"
run "1  grep '^[<>]' n'est pas prod " "$TMP/g1c" 0

printf "$TUSE\n" "Bash" '{"command":"echo x > /c/out.txt"}' > "$TMP/g1d"
run "1  redirection reelle sans verif" "$TMP/g1d" 2

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

# --- Gate 2b elargi : completion affirmee avec des outils mais AUCUNE verif du tour ---
USER='{"message":{"role":"user","content":[{"type":"text","text":"vas-y"}]}}'

{ printf '%s\n' "$USER";
  printf "$TUSE\n" "WebFetch" '{"url":"https://x"}';
  printf "$TXT\n" "Voila, c'est fait."; } > "$TMP/g2b2"
run "2b completion, outil non-verif  " "$TMP/g2b2" 2

{ printf '%s\n' "$USER";
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" "Voila, c'est fait."; } > "$TMP/g2b3"
run "2b completion + Read (passe)    " "$TMP/g2b3" 0

# --- PowerShell traite comme Bash (2026-09-13 : 41 % des appels shell etaient invisibles aux gates) ---
: > "$CLAUDE_GATE_BLOCKS_LOG"
printf "$TUSE\n" "PowerShell" '{"command":"Set-Content -Path x.txt -Value 1"}' > "$TMP/ps1"
run "1  PowerShell Set-Content seul  " "$TMP/ps1" 2
if grep -q '] gate=1 claim=' "$CLAUDE_GATE_BLOCKS_LOG"; then echo "[OK]  journal des blocages (gate=1)"; pass=$((pass+1));
else echo "[x]   journal des blocages : aucune ligne gate=1"; fail=$((fail+1)); fi

# Le CONTENU journalise, pas seulement sa presence : le 2026-09-13 une regex /s+/ (antislash mange)
# ecrivait « n'e  pa » pour « n'existe pas » et le controle ci-dessus restait vert.
run "2a negation nue (journal)      " "$TMP/g2a" 2
if grep -qF "gate=2a claim=\"Ce fichier n'existe pas.\"" "$CLAUDE_GATE_BLOCKS_LOG"; then echo "[OK]  journal : claim intact"; pass=$((pass+1));
else echo "[x]   journal : claim altere : $(tail -1 "$CLAUDE_GATE_BLOCKS_LOG")"; fail=$((fail+1)); fi

{ printf '%s\n' "$USER"; printf "$TUSE\n" "PowerShell" '{"command":"php artisan test"}';
  printf "$TXT\n" "Les tests passent, on peut pousser."; } > "$TMP/ps2"
run "2c CI vert + test PowerShell    " "$TMP/ps2" 0

{ printf '%s\n' "$USER"; printf "$TUSE\n" "PowerShell" '{"command":"Get-Content x.txt"}';
  printf "$TXT\n" "Voila, c'est fait."; } > "$TMP/ps3"
run "2b completion + verif PowerShell" "$TMP/ps3" 0

# --- Gate 2g : succes silencieux (drapeau .pending-verify.log) ---
PEND="$CLAUDE_PENDING_LOG"
flag() { printf '[2026-09-04T00:00:00Z] surface=%s quoi="%s" cmd="npm test" sortie="%s"\n' "$1" "$2" "$3" > "$PEND"; }

flag ci "0 test execute" "Can t run because no spec files were found."
printf "$TXT\n" "Les tests passent, on peut pousser." > "$TMP/g2g"
{ printf '%s\n' "$USER"; printf "$TUSE\n" "Bash" '{"command":"npm test"}';
  printf "$TXT\n" "Les tests passent, on peut pousser."; } > "$TMP/g2g"
run "2g succes silencieux + 'vert'  " "$TMP/g2g" 2

flag ci "0 test execute" "no spec files were found"
{ printf '%s\n' "$USER"; printf "$TUSE\n" "Bash" '{"command":"npm test"}';
  printf "$TXT\n" "La spec est exclue par excludeSpecPattern, je corrige le nom."; } > "$TMP/g2g2"
run "2g drapeau sans annonce (passe) " "$TMP/g2g2" 0

: > "$PEND"
{ printf '%s\n' "$USER"; printf "$TUSE\n" "Bash" '{"command":"npm test"}';
  printf "$TXT\n" "Les tests passent, on peut pousser."; } > "$TMP/g2g3"
run "2g sans drapeau (passe)         " "$TMP/g2g3" 0

# --- Gate 2h : livrable .md sans passe de reverification (TODO 197, 2026-09-14) ---
{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf "$TXT\n" 'Note mise a jour.'; } > "$TMP/g2h1"
run "2h .md relu, sans bloc REVERIF  " "$TMP/g2h1" 2

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf "$TXT\n" 'Note mise a jour.\nREVERIF :\n- ligne 3 ajoutee -> Read du fichier, ligne 3 presente'; } > "$TMP/g2h2"
run "2h .md relu + REVERIF (passe)   " "$TMP/g2h2" 0

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TXT\n" 'Note mise a jour.\nREVERIF :\n- ligne 3 ajoutee -> Read du fichier'; } > "$TMP/g2h3"
run "2h Read AVANT l'ecriture seul   " "$TMP/g2h3" 2

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/x.js"}';
  printf "$TXT\n" 'Fonction mise a jour.'; } > "$TMP/g2h4"
run "2h code non .md (passe)         " "$TMP/g2h4" 0

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Write" '{"file_path":"C:/Users/moi/.claude/plans/p.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/Users/moi/.claude/plans/p.md"}';
  printf "$TXT\n" 'Plan redige.'; } > "$TMP/g2h5"
run "2h fichier de plan (passe)      " "$TMP/g2h5" 0

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf "$TXT\n" 'Note mise a jour. [NO-VERIFY: relu a la main]'; } > "$TMP/g2h6"
run "2h bypass ne couvre pas 2h      " "$TMP/g2h6" 2

# Relecture d'un AUTRE fichier apres l'ecriture : ne vaut pas relecture du livrable (constate le
# 2026-09-14 dans un vrai transcript : un Bash parallele sans rapport suffisait a passer le gate).
{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/autre.js"}';
  printf "$TXT\n" 'Note mise a jour.\nREVERIF :\n- ligne 3 ajoutee -> Read'; } > "$TMP/g2h7"
run "2h relu un AUTRE fichier        " "$TMP/g2h7" 2

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:\\v\\note.md"}';
  printf "$TUSE\n" "Bash" '{"command":"grep -n ligne C:/v/note.md"}';
  printf "$TXT\n" 'Note mise a jour.\nREVERIF :\n- ligne 3 ajoutee -> grep -n, ligne 3'; } > "$TMP/g2h8"
run "2h grep nommant le .md (passe)  " "$TMP/g2h8" 0

# Frontiere de tour sur la forme REELLE d'un prompt : content CHAINE (transcript du 2026-09-14).
# Les fixtures en tableau ci-dessus ne l'exercaient pas : en reel, la frontiere ne jouait jamais.
USTR='{"type":"user","message":{"role":"user","content":"autre demande"}}'
STOPSTR='{"type":"user","message":{"role":"user","content":"Stop hook feedback: gate 2h"}}'
{ printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf '%s\n' "$USTR"; printf "$TXT\n" 'Voici la suite.'; } > "$TMP/g2h9"
run "2h .md d'un tour PRECEDENT      " "$TMP/g2h9" 0

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/note.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/note.md"}';
  printf '%s\n' "$STOPSTR"; printf "$TXT\n" 'Voici la suite.'; } > "$TMP/g2h10"
run "2h feedback Stop ne rouvre pas  " "$TMP/g2h10" 2

# --- Bypass : doit NOMMER ce qui n a pas ete observe ---
printf "$TXT\n" "C est fait. [NO-VERIFY:]" > "$TMP/byp2"
run "bypass vide (bloque)            " "$TMP/byp2" 2

# --- Marqueur CITE entre backticks : ni bypass vide, ni bypass (2026-09-14) ---
printf "$TXT\n" "Le gate 2h est non neutralise par \`[NO-VERIFY:]\`." > "$TMP/byp4"
run "marqueur cite (passe)           " "$TMP/byp4" 0
printf "$TXT\n" "Voila, c'est fait et ca marche. \`[NO-VERIFY: doc pure]\`" > "$TMP/byp5"
run "marqueur cite ne dispense pas   " "$TMP/byp5" 2

# --- Bypass : ne couvre plus le gate 1 (production non regardee) ---
{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" "C est fait. [NO-VERIFY: rendu visuel impossible ici]"; } > "$TMP/byp3"
run "bypass ne couvre pas le gate 1  " "$TMP/byp3" 2

# --- Cas neutre : texte sans affirmation ni prod -> passe ---
printf "$TXT\n" "Voici les options possibles pour la suite." > "$TMP/neutre"
run "neutre (aucune affirmation)    " "$TMP/neutre" 0

# --- Couverture linguistique des regex (accents, formes flechies) ---
if node "$HOME/.claude/hooks/test-regex.js" >/dev/null 2>&1; then echo "[OK]  regex : 0 angle mort (test-regex.js)"; pass=$((pass+1));
else echo "[x]   regex : angle(s) mort(s) — node ~/.claude/hooks/test-regex.js"; fail=$((fail+1)); fi

# --- Gates en anglais (incident 2026-09-10 : 3 messages finaux anglais sans aucun gate) ---
printf "$TXT\n" "Done: everything is verified, all tests pass." > "$TMP/g2b_en"
run "2b completion en anglais       " "$TMP/g2b_en" 2

# --- pre-guard-outward.js : push sans GO PUSH, mode stop, fichiers fournis (incident 2026-09-10) ---
GUARD="$HOME/.claude/hooks/pre-guard-outward.js"
rung() { # label transcript tool_name commande|fichier attendu(deny|pass)
  local inp got
  inp=$(node -e 'const [t,n,c]=process.argv.slice(1);const ti=/^(Write|Edit|NotebookEdit)$/.test(n)?{file_path:c}:{command:c};console.log(JSON.stringify({transcript_path:t,tool_name:n,tool_input:ti,cwd:process.cwd()}))' "$2" "$3" "$4")
  LAST_OUT=$(printf '%s' "$inp" | node "$GUARD" 2>&1)
  local rc=$?
  case "$LAST_OUT" in *'"deny"'*) got=deny ;; *) got=pass ;; esac
  # Un crash n'est pas un "pass" : le 2026-09-13 un ReferenceError (exit 1) passait pour tel.
  [ "$rc" = 0 ] || got="crash-exit-$rc"
  if [ "$got" = "$5" ]; then echo "[OK]  $1 ($got)"; pass=$((pass+1));
  else echo "[x]   $1 ($got, ATTENDU $5) $LAST_OUT"; fail=$((fail+1)); fi
}
UP='{"message":{"role":"user","content":"ajoute le nom en tete"}}'
UGO='{"message":{"role":"user","content":[{"type":"text","text":"ok GO PUSH"}]}}'
UPROT='{"message":{"role":"user","content":"Candidat_06.md ????????? tu fais quoi la ?"}}'
ASK='{"message":{"role":"assistant","content":[{"type":"tool_use","id":"q1","name":"AskUserQuestion","input":{}}]}}'
ANS_GO='{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"q1","content":"Your questions have been answered: \"Pousser ?\"=\"GO PUSH\". You can now continue"}]}}'
ANS_NO='{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"q1","content":"Your questions have been answered: \"Pousser (GO PUSH) ?\"=\"Non\". You can now continue"}]}}'
STOPFB='{"message":{"role":"user","content":[{"type":"text","text":"Stop hook feedback: VERIF MANQUANTE"}]}}'

printf '%s\n' "$UP" > "$TMP/o1"
rung "guard push sans accord         " "$TMP/o1" Bash "git push origin main" deny
rung "guard git -C x push            " "$TMP/o1" Bash "git -C wt-01 push -q origin livrable-01" deny
rung "guard gh pr edit               " "$TMP/o1" Bash "gh pr edit 45 --title x" deny
rung "guard commit 'push' (passe)    " "$TMP/o1" Bash 'git commit -m "push fix"' pass
printf '%s\n' "$UGO" > "$TMP/o2"
rung "guard push + GO PUSH (passe)   " "$TMP/o2" Bash "git push origin main" pass
printf '%s\n' "$UP" "$ASK" "$ANS_GO" > "$TMP/o3"
rung "guard GO PUSH en reponse       " "$TMP/o3" Bash "git push origin main" pass
printf '%s\n' "$UP" "$ASK" "$ANS_NO" > "$TMP/o4"
rung "guard GO PUSH dans ma question " "$TMP/o4" Bash "git push origin main" deny
printf '%s\n' "$UPROT" > "$TMP/o5"
rung "guard protestation + Edit      " "$TMP/o5" Edit "/c/x.md" deny
rung "guard protestation + lecture   " "$TMP/o5" Bash "git status" pass
printf '%s\n' "$UPROT" "$ASK" "$ANS_NO" > "$TMP/o6"
rung "guard protestation + reponse   " "$TMP/o6" Edit "/c/x.md" pass
printf '%s\n' "$UPROT" "$STOPFB" > "$TMP/o7"
rung "guard feedback hook != reponse " "$TMP/o7" Edit "/c/x.md" deny

R="$TMPRAW/repos"; mkdir -p "$R/up"
git -C "$R/up" init -q && printf 'x\n' > "$R/up/template.md" && git -C "$R/up" add . \
  && git -C "$R/up" -c user.name=t -c user.email=t@t commit -qm init \
  && git clone -q "$R/up" "$R/work" && git -C "$R/work" remote rename origin upstream \
  && git -C "$R/work" mv template.md Candidat_template.md \
  && git -C "$R/work" -c user.name=t -c user.email=t@t commit -qm ren
RW="$(cygpath -m "$R/work" 2>/dev/null || echo "$R/work")"
rung "guard push + fichier renomme   " "$TMP/o1" Bash "git -C $RW push origin main" deny
case "$LAST_OUT" in *'R template.md -> Candidat_template.md'*) echo "[OK]  guard liste le template renomme"; pass=$((pass+1)) ;;
  *) echo "[x]   guard ne liste pas le renommage : $LAST_OUT"; fail=$((fail+1)) ;; esac

echo "== $pass OK / $((pass+fail)) cas =="
[ "$fail" = 0 ] || exit 1
