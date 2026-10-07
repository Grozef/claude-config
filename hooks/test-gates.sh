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

run() { # label  transcript_path  expected_exit  [gate attendu]
  echo "{\"transcript_path\":\"$2\"}" | node "$HOOK" >/dev/null 2>&1
  local c=$?
  # Le code de sortie ne dit pas QUEL gate a bloque : a l'ajout du 2i (2026-10-05), deux cas 2e et un
  # cas 2h restaient en exit 2 en etant bloques par un autre gate. Le 4e argument le controle.
  local g=""; [ "$c" = 2 ] && g=$(tail -1 "$CLAUDE_GATE_BLOCKS_LOG" 2>/dev/null | sed -E 's/.*gate=([^ ]+) claim=.*/\1/')
  if [ "$c" = "$3" ] && { [ -z "${4:-}" ] || [ "$g" = "$4" ]; }; then echo "[OK]  $1 (exit $c${4:+, gate $g})"; pass=$((pass+1));
  else echo "[x]   $1 (exit $c gate=$g, ATTENDU $3 ${4:-})"; fail=$((fail+1)); fi
}

w() { printf '%s\n' "$2" > "$TMP/$1"; }   # w fichier contenu-1-ligne
wa() { printf '%s\n' "$@" > "$TMP/$1.multi"; mv "$TMP/$1.multi" "$TMP/$1"; }

# Briques JSONL (apostrophe/accents REELS : les regex 2a/2b en dependent)
TXT='{"message":{"role":"assistant","content":[{"type":"text","text":"%s"}]}}'
TUSE='{"message":{"role":"assistant","content":[{"type":"tool_use","name":"%s","input":%s}]}}'
# Feedback du gate 2i deja recu. Enveloppe COPIEE d'un feedback reel de stop-verify.sh (transcript du
# 2026-10-05, 152 feedbacks de cette forme) : type user, isMeta true, content CHAINE prefixee du hook.
FB2I='{"type":"user","isMeta":true,"message":{"role":"user","content":"Stop hook feedback:\n[bash ~/.claude/hooks/stop-verify.sh]: PASSE DE RELECTURE (gate 2i) :\nCode ecrit ce tour :\n  /c/x.js"}}'
# Passe de relecture deja faite : sans elle, tout cas qui edite du code s'arrete au 2i avant son gate.
passe2i() { printf '%s\n' "$FB2I"; printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; }

# --- Gate 1 : production non verifiee ---
printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}' > "$TMP/g1a"
run "1  Edit seul sans verif        " "$TMP/g1a" 2 1

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i; } > "$TMP/g1b"
run "1  Edit + Read (verif)         " "$TMP/g1b" 0

# Redirection testee hors quotes (producer.js, 2026-09-14)
{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
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
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
  printf "$TXT\n" "Fait. Au passage j'ai nettoye le code adjacent."; } > "$TMP/g2e"
run "2e aveu scope-creep + prod     " "$TMP/g2e" 2 2e

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
  printf "$TXT\n" "Fait. J'ai aussi refactorise la fonction voisine."; } > "$TMP/g2e2"
run "2e aveu (j'ai aussi refacto)   " "$TMP/g2e2" 2 2e

printf "$TXT\n" "Au passage, note que le fichier existe deja." > "$TMP/g2e3"
run "2e aveu SANS prod (passe)      " "$TMP/g2e3" 0

{ printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
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
  printf "$TUSE\n" "Bash" '{"command":"git status --short"}';
  printf "$TXT\n" 'Note mise a jour.\nREVERIF :\n- ligne 3 ajoutee -> Read du fichier'; } > "$TMP/g2h3"
run "2h Read AVANT l'ecriture seul   " "$TMP/g2h3" 2 2h

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Edit" '{"file_path":"C:/v/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/v/x.js"}'; passe2i;
  printf "$TXT\n" 'Fonction mise a jour.'; } > "$TMP/g2h4"
run "2h code non .md (passe)         " "$TMP/g2h4" 0

{ printf '%s\n' "$USER"; printf "$TUSE\n" "Write" '{"file_path":"C:/x/.claude/plans/p.md"}';
  printf "$TUSE\n" "Read" '{"file_path":"C:/x/.claude/plans/p.md"}';
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

# --- Gate 2i : code ecrit ce tour, passe de relecture forcee une fois (2026-10-05) ---
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" 'Fonction mise a jour.'; } > "$TMP/g2i1"
run "2i code + verif, 1er arret      " "$TMP/g2i1" 2 2i

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; printf '%s\n' "$FB2I";
  printf "$TXT\n" 'Rien a signaler.'; } > "$TMP/g2i2"
run "2i feedback sans verif apres    " "$TMP/g2i2" 2 2i

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
  printf "$TXT\n" 'Fonction mise a jour.'; } > "$TMP/g2i3"
run "2i passe faite (passe)          " "$TMP/g2i3" 0

# La passe d'un tour PRECEDENT ne vaut pas pour le code du tour courant.
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}'; passe2i;
  printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/y.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/y.js"}'; } > "$TMP/g2i4"
run "2i passe d'un tour precedent    " "$TMP/g2i4" 2 2i

# Code ecrit APRES une passe : il lui en faut une nouvelle (tour long, reverification du 2026-10-05).
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}'; passe2i;
  printf "$TUSE\n" "Edit" '{"file_path":"/c/y.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/y.js"}'; } > "$TMP/g2i5"
run "2i code ecrit apres la passe    " "$TMP/g2i5" 2 2i
{ cat "$TMP/g2i5"; passe2i; } > "$TMP/g2i5b"
run "2i seconde passe faite (passe)  " "$TMP/g2i5b" 0

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}'; passe2i;
  printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}'; } > "$TMP/g2i6"
run "2i correction sans verif        " "$TMP/g2i6" 2 1

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TXT\n" 'Fonction mise a jour. [NO-VERIFY: pas de navigateur ici]'; } > "$TMP/g2i7"
run "2i bypass ne couvre pas 2i      " "$TMP/g2i7" 2 2i

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Write" '{"file_path":"C:/t/claude/s1/scratchpad/sonde.js"}';
  printf "$TUSE\n" "Bash" '{"command":"node C:/t/claude/s1/scratchpad/sonde.js"}'; } > "$TMP/g2i8"
run "2i script du scratchpad (passe) " "$TMP/g2i8" 0

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "NotebookEdit" '{"notebook_path":"/c/n.ipynb","new_source":"x"}';
  printf "$TUSE\n" "Read" '{"file_path":"/c/n.ipynb"}'; } > "$TMP/g2i9"
run "2i notebook (notebook_path)     " "$TMP/g2i9" 2 2i
if echo "{\"transcript_path\":\"$TMP/g2i9\"}" | node "$HOOK" 2>&1 >/dev/null | grep -q '^  /c/n.ipynb$'; then echo "[OK]  2i nomme le notebook"; pass=$((pass+1));
else echo "[x]   2i ne nomme pas le notebook"; fail=$((fail+1)); fi

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

# --- /dispatch (2026-10-05) : lot delegue = production ; SubagentStop juge le transcript de l'agent ---
runj() { # label  entree_json_du_hook  expected_exit
  printf '%s' "$2" | node "$HOOK" >/dev/null 2>&1
  local c=$?
  if [ "$c" = "$3" ]; then echo "[OK]  $1 (exit $c)"; pass=$((pass+1));
  else echo "[x]   $1 (exit $c, ATTENDU $3)"; fail=$((fail+1)); fi
}
printf "$TUSE\n" "Agent" '{"subagent_type":"exec-code","prompt":"lot 1"}' > "$TMP/d1"
run "1  lot delegue sans verif       " "$TMP/d1" 2

{ printf "$TUSE\n" "Agent" '{"subagent_type":"exec-code","prompt":"lot 1"}';
  printf "$TUSE\n" "Bash" '{"command":"git diff --stat"}'; } > "$TMP/d2"
run "1  lot delegue + git diff       " "$TMP/d2" 0

runj "1  executant encore en fond     " "{\"transcript_path\":\"$TMP/d1\",\"background_tasks\":[{\"id\":\"t1\",\"type\":\"subagent\",\"status\":\"running\"}]}" 0

printf "$TUSE\n" "Agent" '{"subagent_type":"Explore","prompt":"cherche"}' > "$TMP/d4"
run "1  agent de recherche (passe)   " "$TMP/d4" 0

# Rapport rendu par SubagentHandback (forme reelle du 2026-10-05), last_assistant_message = cloture.
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "SubagentHandback" '{"message":"FICHIERS : /c/x.js"}'; } > "$TMP/d5"
runj "SubagentStop : Edit sans verif  " "{\"transcript_path\":\"$TMP/d2\",\"agent_transcript_path\":\"$TMP/d5\",\"last_assistant_message\":\"ok\"}" 2

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Bash" '{"command":"cat /c/x.js"}';
  printf "$TUSE\n" "SubagentHandback" '{"message":"FICHIERS : /c/x.js"}'; } > "$TMP/d6"
runj "SubagentStop : Edit + verif     " "{\"transcript_path\":\"$TMP/d1\",\"agent_transcript_path\":\"$TMP/d6\",\"last_assistant_message\":\"ok\"}" 0

{ printf '%s\n' "$USTR"; printf "$TUSE\n" "SubagentHandback" '{"message":"Done, it works."}'; } > "$TMP/d7"
runj "SubagentStop : rapport 'fait'   " "{\"transcript_path\":\"$TMP/d2\",\"agent_transcript_path\":\"$TMP/d7\",\"last_assistant_message\":\"ok\"}" 2

# Forme REELLE d'un executant (sonde du 2026-10-05) : Read exige avant l'Edit, puis rapport direct.
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "SubagentHandback" '{"message":"FICHIERS : /c/x.js"}'; } > "$TMP/d8"
runj "SubagentStop : Read AVANT l'Edit" "{\"transcript_path\":\"$TMP/d2\",\"agent_transcript_path\":\"$TMP/d8\",\"last_assistant_message\":\"\"}" 2

{ printf "$TUSE\n" "Read" '{"file_path":"/c/plan.md"}';
  printf "$TUSE\n" "Agent" '{"subagent_type":"exec-simple","prompt":"lot 1"}'; } > "$TMP/d9"
run "1  lot delegue, verif AVANT seule" "$TMP/d9" 2

# Le blocage qui CONTRAINT est celui de l'envoi du rapport (PreToolUse SubagentHandback) : en
# SubagentStop le rapport est deja parti. Payload reel : transcript principal + agent_id, sans chemin d'agent.
mkdir -p "$TMP/sess/subagents"; : > "$TMP/sess.jsonl"
{ printf '%s\n' "$USTR"; printf "$TUSE\n" "Read" '{"file_path":"/c/x.js"}';
  printf "$TUSE\n" "Edit" '{"file_path":"/c/x.js"}'; } > "$TMP/sess/subagents/agent-zz.jsonl"
HBK="\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"SubagentHandback\",\"transcript_path\":\"$TMP/sess.jsonl\",\"agent_id\":\"zz\",\"tool_input\":{\"message\":\"FICHIERS : /c/x.js\"}"
runj "handback exec-* sans verif      " "{$HBK,\"agent_type\":\"exec-simple\"}" 2
runj "handback autre agent (passe)    " "{$HBK,\"agent_type\":\"general-purpose\"}" 0
printf "$TUSE\n" "Bash" '{"command":"cat /c/x.js"}' >> "$TMP/sess/subagents/agent-zz.jsonl"
runj "handback exec-* apres verif     " "{$HBK,\"agent_type\":\"exec-simple\"}" 0

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
# -C vers un dossier hors depot : sans lui, le cas dependait du diff du depot d'ou la suite est lancee
# (garde « relecteur avant commit », 2026-10-05).
rung "guard commit 'push' (passe)    " "$TMP/o1" Bash "git -C $TMP commit -m \"push fix\"" pass
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

# --- pre-guard-outward.js : relecteur avant commit de code (2026-10-05) ---
# Depots jetables : gros = 60 lignes de code reecrites ; petit = 1 ligne ; doc = 60 lignes de .md ;
# risque = 1 ligne dans une migration.
mkrepo() { # nom  fichier  lignes_modifiees
  local d="$R/$1"; mkdir -p "$d/$(dirname "$2")"
  git -C "$d" init -q && seq 1 60 > "$d/$2" && git -C "$d" add . \
    && git -C "$d" -c user.name=t -c user.email=t@t commit -qm init
  seq 1 "$3" | sed 's/$/ modifie/' > "$d/$2.new" && tail -n +"$(($3 + 1))" "$d/$2" >> "$d/$2.new" && mv "$d/$2.new" "$d/$2"
  cygpath -m "$d" 2>/dev/null || echo "$d"
}
RGROS=$(mkrepo gros app.js 60); RPETIT=$(mkrepo petit app.js 1)
RDOC=$(mkrepo doc notes.md 60); RRISK=$(mkrepo risque database/migrations/m.php 1)
# Formes copiees du transcript reel du 2026-10-05 : appel Agent, accuse de lancement en fond, rapport rendu.
AGREL='{"message":{"role":"assistant","content":[{"type":"tool_use","id":"ag1","name":"Agent","input":{"description":"relecture","subagent_type":"relecteur","prompt":"lot 1, diff : git -C \"'"$(git -C "$RGROS" rev-parse --show-toplevel)"'\" diff HEAD"}}]}}'
AGACK='{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"ag1","content":[{"type":"text","text":"Async agent launched successfully. (This tool result is internal metadata)\nagentId: a3ca1858a481d9650 (internal ID)"}]}]}}'
AGRAP='{"type":"user","isMeta":true,"message":{"role":"user","content":"Another Claude session sent a message:\n<agent-message from=\"a3ca1858a481d9650\">\n[Subagent hand-back] VERDICT : NON REFUTE\n</agent-message>"}}'
CMT='{"message":{"role":"assistant","content":[{"type":"tool_use","id":"cm1","name":"Bash","input":{"command":"git commit -qm lot1"}}]}}'
CMTOK='{"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"cm1","content":"[main abc1234] lot1"}]}}'
USANS='{"message":{"role":"user","content":"commite SANS RELECTURE"}}'

rung "commit code >= seuil, sans relu" "$TMP/o1" Bash "git -C $RGROS commit -qam lot" deny
case "$LAST_OUT" in *'60 ligne'*|*'120 ligne'*) echo "[OK]  commit : le refus chiffre le diff"; pass=$((pass+1)) ;;
  *) echo "[x]   commit : refus sans chiffre : $LAST_OUT"; fail=$((fail+1)) ;; esac
rung "commit code sous le seuil      " "$TMP/o1" Bash "git -C $RPETIT commit -qam lot" pass
rung "commit de .md seuls            " "$TMP/o1" Bash "git -C $RDOC commit -qam lot" pass
rung "commit chemin a risque         " "$TMP/o1" Bash "git -C $RRISK commit -qam lot" deny
rung "commit par cd puis git commit  " "$TMP/o1" Bash "cd $RGROS && git commit -qam lot" deny
rung "commit, chemin -C entre quotes " "$TMP/o1" Bash "git -C \"$RGROS\" commit -qam lot" deny
rung "grep citant git commit (passe) " "$TMP/o1" Bash "cd $RGROS && grep -rn \"git commit\" ." pass
rung "echo citant git commit (passe) " "$TMP/o1" Bash "cd $RGROS && echo 'puis git commit -m x'" pass
rung "git commit-graph (passe)       " "$TMP/o1" Bash "git -C $RGROS commit-graph verify" pass
rung "commit, message a apostrophe   " "$TMP/o1" Bash "git -C $RGROS commit -qam \"c'est le lot\"" deny
printf '%s\n' "$USANS" > "$TMP/c2"
rung "commit + SANS RELECTURE        " "$TMP/c2" Bash "git -C $RGROS commit -qam lot" pass
printf '%s\n' "$UP" "$AGREL" "$AGACK" > "$TMP/c3"
rung "commit, relecteur pas rendu    " "$TMP/c3" Bash "git -C $RGROS commit -qam lot" deny
printf '%s\n' "$UP" "$AGREL" "$AGACK" "$AGRAP" > "$TMP/c4"
rung "commit, relecteur rendu        " "$TMP/c4" Bash "git -C $RGROS commit -qam lot" pass
rung "commit, relu d'un AUTRE depot  " "$TMP/c4" Bash "git -C $RRISK commit -qam lot" deny
printf '%s\n' "$UP" "$AGREL" "$AGACK" "$AGRAP" "$CMT" "$CMTOK" > "$TMP/c5"
rung "commit suivant : relu a refaire" "$TMP/c5" Bash "git -C $RGROS commit -qam lot2" deny
# Forme copiee du transcript reel du 2026-10-06 (dev_portfolio, lot /cv) : le rapport d'un relecteur en
# fond arrive en entree `attachment` sans champ `message` ; deux relecteurs rendus, commit refuse 3 fois.
AGATT='{"type":"attachment","attachment":{"type":"queued_command","prompt":"<agent-message from=\"a3ca1858a481d9650\">\n[Subagent hand-back] VERDICT : NON REFUTE","commandMode":"prompt","origin":{"kind":"peer","from":"a3ca1858a481d9650","senderTaskId":"a3ca1858a481d9650","name":"relecteur","handback":true},"isMeta":true}}'
AGATT_AUTRE='{"type":"attachment","attachment":{"type":"queued_command","prompt":"<agent-message from=\"bbbb1858a481d9650\">\n[Subagent hand-back] VERDICT : NON REFUTE","commandMode":"prompt","origin":{"kind":"peer","from":"bbbb1858a481d9650","name":"relecteur","handback":true},"isMeta":true}}'
printf '%s\n' "$UP" "$AGREL" "$AGACK" "$AGATT" > "$TMP/c6"
rung "commit, rapport en attachment  " "$TMP/c6" Bash "git -C $RGROS commit -qam lot" pass
rung "attachment, AUTRE depot        " "$TMP/c6" Bash "git -C $RRISK commit -qam lot" deny
printf '%s\n' "$UP" "$AGREL" "$AGACK" "$AGATT_AUTRE" > "$TMP/c7"
rung "attachment d'un agent inconnu  " "$TMP/c7" Bash "git -C $RGROS commit -qam lot" deny
printf '%s\n' "$UP" "$AGATT" > "$TMP/c8"
rung "attachment sans appel relecteur" "$TMP/c8" Bash "git -C $RGROS commit -qam lot" deny
# Un rapport de sous-agent (role user) n'est pas une prise de parole : il n'efface ni GO PUSH ni
# SANS RELECTURE donnes juste avant, et ne vaut pas reponse a une protestation.
printf '%s\n' "$UGO" "$AGRAP" > "$TMP/o8"
rung "GO PUSH puis rapport sous-agent" "$TMP/o8" Bash "git push origin main" pass
printf '%s\n' "$USANS" "$AGRAP" > "$TMP/c9"
rung "SANS RELECTURE puis rapport    " "$TMP/c9" Bash "git -C $RGROS commit -qam lot" pass
printf '%s\n' "$UPROT" "$AGRAP" > "$TMP/o9"
rung "protestation puis rapport      " "$TMP/o9" Edit "/c/x.md" deny
# Formes courantes qui passaient sans relecteur (constats du relecteur du 2026-10-06, sondes sur depots
# jetables) : `~` et `$HOME` non resolus, `-c cle=valeur` pris pour un repertoire, apostrophe avant le commit.
RH="${RGROS%/gros}"
HOME="$RH" USERPROFILE="$RH" rung "commit, cd ~/depot             " "$TMP/o1" Bash "cd ~/gros && git commit -qam lot" deny
HOME="$RH" USERPROFILE="$RH" rung "commit, -C ~/depot             " "$TMP/o1" Bash "git -C ~/gros commit -qam lot" deny
HOME="$RH" USERPROFILE="$RH" rung "commit, -C \"\$HOME/depot\"       " "$TMP/o1" Bash 'git -C "$HOME/gros" commit -qam lot' deny
rung "commit, option -c de config    " "$TMP/o1" Bash "cd $RGROS && git -c user.name=t commit -qam lot" deny
rung "apostrophe echappee, puis commit" "$TMP/o1" Bash "cd $RGROS && echo c\\'est parti; git commit -qam 'lot'" deny
rung "heredoc a apostrophe, puis commit" "$TMP/o1" Bash "cd $RGROS && cat <<EOF
c'est le lot
EOF
git commit -qa -m 'lot'" deny
rung "commit execute par un heredoc  " "$TMP/o1" Bash "cd $RGROS && bash <<'EOF'
git commit -qam lot
EOF" deny
rung "heredoc vide, puis commit      " "$TMP/o1" Bash "cd $RGROS && cat <<EOF > a.txt
EOF
git commit -qam lot
cat <<EOF
x
EOF" deny
rung "apostrophe en commentaire      " "$TMP/o1" Bash "cd $RGROS
# on valide l'ensemble
git commit -qam 'lot'" deny
rung "apostrophe jamais refermee     " "$TMP/o1" Bash "cd $RGROS && echo l'index; git commit -qam lot" deny
rung "guillemet echappe en chaine    " "$TMP/o1" Bash "cd $RGROS && echo \"a \\\" b\"; git commit -qam \"lot\"" deny
rung "-c a valeur entre guillemets   " "$TMP/o1" Bash "cd $RGROS && git -c user.name=\"A B\" commit -qam lot" deny
HOME="$RH" USERPROFILE="$RH" rung "PowerShell, cd ~\\depot          " "$TMP/o1" PowerShell "cd ~\\gros; git commit -qam lot" deny
rung "PowerShell, chaine finie par \\  " "$TMP/o1" PowerShell "cd $RGROS; Write-Host \"C:\\tmp\\\"; git commit -qam lot; Write-Host \"fin\"" deny
# Le seuil porte sur ce qui part : mixte = 120 lignes de code hors index, un .md seul dans l'index.
RMIX=$(mkrepo mixte app.js 60); printf 'x\n' > "$RMIX/notes.md"; git -C "$RMIX" add notes.md
rung "commit de l'index, code hors index" "$TMP/o1" Bash "git -C $RMIX commit -qm docs" pass
rung "index .md, commande suivie de -la" "$TMP/o1" Bash "git -C $RMIX commit -qm docs && ls -la" pass
rung "meme depot, commit -a          " "$TMP/o1" Bash "git -C $RMIX commit -qam docs" deny
rung "meme depot, commit par chemin  " "$TMP/o1" Bash "git -C $RMIX commit app.js -qm lot" deny
rung "meme depot, commit -m lot .    " "$TMP/o1" Bash "git -C $RMIX commit -qm lot ." deny
rung "meme depot, git add puis commit" "$TMP/o1" Bash "git -C $RMIX add app.js && git -C $RMIX commit -qm lot" deny
rung "commit par chemin, index vide  " "$TMP/o1" Bash "git -C $RGROS commit app.js -qm lot" deny
git -C "$RMIX" add app.js
rung "commit, code indexe >= seuil   " "$TMP/o1" Bash "git -C $RMIX commit -qm lot" deny
case "$LAST_OUT" in *'diff --cached'*) echo "[OK]  commit : le refus nomme le diff de l'index"; pass=$((pass+1)) ;;
  *) echo "[x]   commit : diff a relire mal nomme : $LAST_OUT"; fail=$((fail+1)) ;; esac

echo "== $pass OK / $((pass+fail)) cas =="
[ "$fail" = 0 ] || exit 1
